"""LangChain: LinkedIn draft + image prompt from trend items."""

from __future__ import annotations

import base64
import json
import re
from typing import Any
from urllib.parse import quote

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.trends import _relevance_score, _topic_keywords


class TrendItemIn(BaseModel):
    title: str
    summary: str
    source: str
    url: str = ""


class GeneratedPost(BaseModel):
    linkedin_post: str = Field(description="Full LinkedIn post, ready to paste. No markdown code fences.")
    image_prompt: str = Field(
        description="Short visual brief: abstract tech illustration, no legible text, professional."
    )
    hashtags: list[str] = Field(
        default_factory=list,
        description="3–6 relevant hashtags without # in strings, e.g. ['AI','MachineLearning']",
    )


class GeneratedPostTextOnly(BaseModel):
    linkedin_post: str = Field(description="Full LinkedIn post, ready to paste. No markdown code fences.")
    hashtags: list[str] = Field(
        default_factory=list,
        description="3–6 relevant hashtags without # in strings, e.g. ['AI','MachineLearning']",
    )


class TopicAngle(BaseModel):
    id: str = Field(description="Unique snake_case id for UI, e.g. job_augmentation")
    label: str = Field(description="Short checkbox label the user understands")
    search_query: str = Field(
        description="Keyword line for HN/Reddit/GitHub search (no #, no quotes); 6–14 words"
    )


class TopicAnglesParsed(BaseModel):
    angles: list[TopicAngle] = Field(
        min_length=3,
        max_length=7,
        description="Distinct searchable angles faithful to the user's topic",
    )


class TrendFilterLLMOut(BaseModel):
    relevant_indices: list[int] = Field(
        default_factory=list,
        description="0-based indices from the numbered list that are genuinely useful for LinkedIn "
        "commentary on the topic. Omit noise, unrelated viral tech, and thin duplicates.",
    )
    note: str = Field(
        default="",
        description="One short sentence: what you kept or dropped (optional).",
    )


def _normalize_angle_ids(angles: list[TopicAngle]) -> list[TopicAngle]:
    seen: set[str] = set()
    out: list[TopicAngle] = []
    for a in angles:
        raw = re.sub(r"[^a-z0-9_]+", "_", (a.id or "angle").lower()).strip("_") or "angle"
        aid = raw
        n = 0
        while aid in seen:
            n += 1
            aid = f"{raw}_{n}"
        seen.add(aid)
        out.append(
            TopicAngle(id=aid, label=a.label.strip(), search_query=a.search_query.strip())
        )
    return out


def run_topic_angles(
    *,
    topic: str,
    gemini_api_key: str = "",
    gemini_model: str = "gemini-2.5-flash-lite",
    openai_api_key: str = "",
    openai_model: str = "gpt-4o-mini",
) -> list[TopicAngle]:
    t = topic.strip()
    if len(t) < 3:
        raise ValueError("Topic must be at least 3 characters")

    tmpl = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You decompose a user's content topic into 4–6 concrete search angles for discovering "
                "news, discussions, and repos. Each angle must map clearly to what the user cares about — "
                "not generic 'tech trends'. "
                "search_query must be a tight keyword phrase (proper nouns OK) suitable for Algolia HN and Reddit search. "
                "No hashtags, no quotes wrapping the whole string, no duplicate angles.",
            ),
            ("human", "Topic:\n{topic}"),
        ]
    )
    payload = {"topic": t}

    gkey = gemini_api_key.strip()
    okey = openai_api_key.strip()

    if gkey:
        llm = ChatGoogleGenerativeAI(
            model=gemini_model,
            api_key=gkey,
            temperature=0.4,
        )
        structured = llm.with_structured_output(TopicAnglesParsed)
        chain = tmpl | structured
        parsed = chain.invoke(payload)
        return _normalize_angle_ids(list(parsed.angles))

    if okey:
        llm = ChatOpenAI(api_key=okey, model=openai_model, temperature=0.4)
        structured = llm.with_structured_output(TopicAnglesParsed)
        chain = tmpl | structured
        parsed = chain.invoke(payload)
        return _normalize_angle_ids(list(parsed.angles))

    raise ValueError(
        "Set GEMINI_API_KEY or OPENAI_API_KEY in api/.env to break down topics with AI"
    )


def _numbered_trend_block(items: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for i, it in enumerate(items):
        title = str(it.get("title", ""))[:200]
        src = str(it.get("source", ""))[:40]
        summ = str(it.get("summary", ""))[:280]
        lines.append(f"[{i}] {src} | {title} | {summ}")
    return "\n".join(lines)


def run_filter_trends_for_topic(
    *,
    topic: str,
    items: list[dict[str, Any]],
    gemini_api_key: str = "",
    gemini_model: str = "gemini-2.5-flash-lite",
    openai_api_key: str = "",
    openai_model: str = "gpt-4o-mini",
) -> tuple[list[dict[str, Any]], str, bool]:
    """Return (filtered_items, note, used_fallback)."""
    t = topic.strip()
    if len(t) < 3:
        raise ValueError("Topic must be at least 3 characters")
    if not items:
        raise ValueError("No items to filter")

    capped = items[:35]
    block = _numbered_trend_block(capped)

    tmpl = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You filter a numbered list of trend candidates for one user topic. "
                "Return only 0-based indices that appear in the list (e.g. [0] means the first row). "
                "Prefer items someone could react to on LinkedIn for this topic — drop obvious misfits. "
                "Do not invent indices. If almost nothing fits, return a small set of the least-bad matches. "
                "Quality over quantity: typically 4–18 indices when enough good rows exist.",
            ),
            (
                "human",
                "Topic:\n{topic}\n\nNumbered candidates (index in brackets):\n{block}\n",
            ),
        ]
    )
    payload = {"topic": t, "block": block}

    gkey = gemini_api_key.strip()
    okey = openai_api_key.strip()
    parsed: TrendFilterLLMOut | None = None

    if gkey:
        llm = ChatGoogleGenerativeAI(
            model=gemini_model,
            api_key=gkey,
            temperature=0.2,
        )
        structured = llm.with_structured_output(TrendFilterLLMOut)
        chain = tmpl | structured
        parsed = chain.invoke(payload)
    elif okey:
        llm = ChatOpenAI(api_key=okey, model=openai_model, temperature=0.2)
        structured = llm.with_structured_output(TrendFilterLLMOut)
        chain = tmpl | structured
        parsed = chain.invoke(payload)
    else:
        raise ValueError(
            "Set GEMINI_API_KEY or OPENAI_API_KEY in api/.env to filter trends with AI"
        )

    assert parsed is not None
    note = (parsed.note or "").strip()
    valid: list[int] = []
    seen: set[int] = set()
    for i in parsed.relevant_indices:
        if isinstance(i, int) and 0 <= i < len(capped) and i not in seen:
            seen.add(i)
            valid.append(i)

    used_fallback = False
    if not valid:
        used_fallback = True
        kws = _topic_keywords(t)
        scored = [
            (
                idx,
                _relevance_score(
                    str(capped[idx].get("title", "")),
                    str(capped[idx].get("summary", "")),
                    kws,
                ),
            )
            for idx in range(len(capped))
        ]
        scored.sort(key=lambda x: x[1], reverse=True)
        valid = [idx for idx, s in scored if s > 0][:18]
    if not valid:
        used_fallback = True
        valid = list(range(min(10, len(capped))))

    out = [capped[i] for i in valid]
    return out, note, used_fallback


def _items_block(items: list[TrendItemIn]) -> str:
    payload: list[dict[str, Any]] = []
    for it in items:
        payload.append(
            {
                "title": it.title,
                "summary": it.summary,
                "source": it.source,
                "url": it.url,
            }
        )
    return json.dumps(payload, ensure_ascii=False, indent=2)


def _format_system_addon(system_prompt: str) -> str:
    t = (system_prompt or "").strip()
    if not t:
        return ""
    return (
        "\n\n---\nAuthor-provided system instructions (follow strictly):\n"
        f"{t}\n"
    )


def _prompt_messages(tone: str) -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are a LinkedIn content assistant for technical professionals. "
                "Write original commentary inspired by the sources (do not copy sentences). "
                "Include a clear hook, 2–4 short paragraphs or bullets where appropriate, and a soft CTA. "
                "Tone: {tone}. "
                "If URLs are provided, you may mention 'link in comments' or weave one URL naturally — never invent URLs. "
                "Hashtags: return plain words only (no # prefix in the list). "
                "Also produce a short image_prompt field: abstract tech illustration brief, no legible text, no logos, no real people's names."
                "{system_addon}",
            ),
            (
                "human",
                "Sources (JSON):\n{items_block}\n\n"
                "Extra instructions from the user:\n{extra}\n",
            ),
        ]
    )


def _prompt_messages_text_only(tone: str) -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are a LinkedIn content assistant for technical professionals. "
                "Write original commentary inspired by the sources (do not copy sentences). "
                "Include a clear hook, 2–4 short paragraphs or bullets where appropriate, and a soft CTA. "
                "Tone: {tone}. "
                "If URLs are provided, you may mention 'link in comments' or weave one URL naturally — never invent URLs. "
                "Hashtags: return plain words only (no # prefix in the list). "
                "Do not include any image ideas or art directions — text for LinkedIn only."
                "{system_addon}",
            ),
            (
                "human",
                "Sources (JSON):\n{items_block}\n\n"
                "Extra instructions from the user:\n{extra}\n",
            ),
        ]
    )


def _message_text(msg: Any) -> str:
    c = getattr(msg, "content", msg)
    if isinstance(c, str):
        return c.strip()
    if isinstance(c, list):
        parts: list[str] = []
        for block in c:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and "text" in block:
                parts.append(str(block["text"]))
            else:
                parts.append(str(block))
        return "".join(parts).strip()
    return str(c).strip()


def run_generate_post(
    *,
    items: list[TrendItemIn],
    tone: str,
    extra_instructions: str = "",
    system_prompt: str = "",
    include_image_prompt: bool = True,
    gemini_api_key: str = "",
    gemini_model: str = "gemini-2.5-flash-lite",
    openai_api_key: str = "",
    openai_model: str = "gpt-4o-mini",
) -> GeneratedPost:
    if not items:
        raise ValueError("At least one trend item is required")

    gkey = gemini_api_key.strip()
    okey = openai_api_key.strip()
    payload = {
        "tone": tone,
        "items_block": _items_block(items),
        "extra": extra_instructions.strip() or "(none)",
        "system_addon": _format_system_addon(system_prompt),
    }

    if include_image_prompt:
        tmpl = _prompt_messages(tone)
        if gkey:
            llm = ChatGoogleGenerativeAI(
                model=gemini_model,
                api_key=gkey,
                temperature=0.75,
            )
            structured = llm.with_structured_output(GeneratedPost)
            chain = tmpl | structured
            return chain.invoke(payload)

        if okey:
            llm = ChatOpenAI(api_key=okey, model=openai_model, temperature=0.75)
            structured = llm.with_structured_output(GeneratedPost)
            chain = tmpl | structured
            return chain.invoke(payload)
    else:
        tmpl = _prompt_messages_text_only(tone)
        if gkey:
            llm = ChatGoogleGenerativeAI(
                model=gemini_model,
                api_key=gkey,
                temperature=0.75,
            )
            structured = llm.with_structured_output(GeneratedPostTextOnly)
            chain = tmpl | structured
            out = chain.invoke(payload)
            return GeneratedPost(
                linkedin_post=out.linkedin_post,
                image_prompt="",
                hashtags=out.hashtags,
            )

        if okey:
            llm = ChatOpenAI(api_key=okey, model=openai_model, temperature=0.75)
            structured = llm.with_structured_output(GeneratedPostTextOnly)
            chain = tmpl | structured
            out = chain.invoke(payload)
            return GeneratedPost(
                linkedin_post=out.linkedin_post,
                image_prompt="",
                hashtags=out.hashtags,
            )

    raise ValueError(
        "Set GEMINI_API_KEY (recommended) or OPENAI_API_KEY in api/.env for /generate"
    )


def ping_chat_model(
    *,
    gemini_api_key: str,
    gemini_model: str,
    openai_api_key: str,
    openai_model: str,
) -> dict[str, Any]:
    """One minimal LLM call to verify keys and connectivity."""
    gkey = gemini_api_key.strip()
    okey = openai_api_key.strip()
    if not gkey and not okey:
        return {
            "ok": False,
            "provider": None,
            "model": None,
            "reply_preview": None,
            "error": "No GEMINI_API_KEY or OPENAI_API_KEY in api/.env",
        }

    if gkey:
        try:
            llm = ChatGoogleGenerativeAI(
                model=gemini_model,
                api_key=gkey,
                temperature=0,
                max_output_tokens=32,
            )
            msg = llm.invoke(
                "You must reply with exactly the single word ALIVE and nothing else."
            )
            text = _message_text(msg)
            return {
                "ok": True,
                "provider": "gemini",
                "model": gemini_model,
                "reply_preview": text[:200] if text else "(empty)",
                "error": None,
            }
        except Exception as e:
            return {
                "ok": False,
                "provider": "gemini",
                "model": gemini_model,
                "reply_preview": None,
                "error": str(e),
            }

    try:
        llm = ChatOpenAI(
            api_key=okey,
            model=openai_model,
            temperature=0,
            max_tokens=32,
        )
        msg = llm.invoke(
            "You must reply with exactly the single word ALIVE and nothing else."
        )
        text = _message_text(msg)
        return {
            "ok": True,
            "provider": "openai",
            "model": openai_model,
            "reply_preview": text[:200] if text else "(empty)",
            "error": None,
        }
    except Exception as e:
        return {
            "ok": False,
            "provider": "openai",
            "model": openai_model,
            "reply_preview": None,
            "error": str(e),
        }


def pollinations_image_url(prompt: str, width: int = 1024, height: int = 1024) -> str:
    """No API key; quality varies — fine for experiments only."""
    q = quote(prompt.strip()[:2000], safe="")
    return f"https://image.pollinations.ai/prompt/{q}?width={width}&height={height}&nologo=true"


def create_gemini_image_data_url(
    *,
    api_key: str,
    model: str,
    prompt: str,
) -> str:
    """Returns a data: URL the browser can render in <img src>."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key.strip())
    user_prompt = (
        "Create one square abstract editorial illustration for a LinkedIn tech post. "
        "No readable text, no logos, no real people's faces. "
        f"Visual brief: {prompt.strip()[:2800]}"
    )
    cfg = types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"])
    response = client.models.generate_content(
        model=model.strip(),
        contents=[user_prompt],
        config=cfg,
    )
    parts: list[Any] = []
    if getattr(response, "parts", None):
        parts = list(response.parts)
    else:
        for c in getattr(response, "candidates", None) or []:
            content = getattr(c, "content", None)
            if content is not None and getattr(content, "parts", None):
                parts.extend(content.parts)

    for part in parts:
        if part.inline_data is not None and part.inline_data.data:
            raw = part.inline_data.data
            mime = part.inline_data.mime_type or "image/png"
            if isinstance(raw, str):
                raw_b = base64.b64decode(raw)
            else:
                raw_b = raw
            b64 = base64.b64encode(raw_b).decode("ascii")
            return f"data:{mime};base64,{b64}"
    raise ValueError(
        "Gemini returned no image (safety filter, quota, or model output). "
        "Try IMAGE_BACKEND=pollinations or set OPENAI_API_KEY."
    )


async def create_openai_image_url(
    *,
    api_key: str,
    prompt: str,
    size: str = "1024x1024",
) -> str:
    """OpenAI Images API; returns temporary HTTPS URL."""
    import httpx

    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            "https://api.openai.com/v1/images/generations",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "dall-e-3",
                "prompt": prompt[:4000],
                "n": 1,
                "size": size,
            },
        )
        r.raise_for_status()
        data = r.json()
        return str(data["data"][0]["url"])
