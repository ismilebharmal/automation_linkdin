from __future__ import annotations

import asyncio
import os

# Avoid LangSmith client work on import (can stall dev machines / CI).
os.environ.setdefault("LANGCHAIN_TRACING_V2", "false")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.chains import (
    TopicAngle,
    TrendItemIn,
    create_gemini_image_data_url,
    create_openai_image_url,
    ping_chat_model,
    pollinations_image_url,
    run_filter_trends_for_topic,
    run_generate_post,
    run_topic_angles,
)
from app.config import cors_origin_list, get_settings
from app.trends import gather_trends

app = FastAPI(title="Content Studio API", version="0.1.0")
_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origin_list(_settings),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TrendsRequest(BaseModel):
    topics: str = Field(
        default="AI, machine learning, developer tools",
        description="Original topic text (fallback if selected_queries empty)",
    )
    selected_queries: list[str] | None = Field(
        default=None,
        description="Search lines from checked AI angles; when set and non-empty, drives HN/GitHub/Reddit/News search",
    )


class TrendItem(BaseModel):
    title: str
    summary: str
    source: str
    url: str = ""


class TrendsResponse(BaseModel):
    items: list[TrendItem]


class TrendFilterRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=2000)
    items: list[TrendItem] = Field(min_length=1, max_length=40)


class TrendFilterResponse(BaseModel):
    items: list[TrendItem]
    note: str = ""
    used_fallback: bool = False


class TopicAnglesRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=2000)


class TopicAnglesResponse(BaseModel):
    angles: list[TopicAngle]


class GenerateRequest(BaseModel):
    items: list[TrendItem]
    tone: str = Field(default="professional and concise")
    extra_instructions: str = ""
    system_prompt: str = Field(
        default="",
        max_length=4000,
        description="Optional text appended to the default system prompt (role, constraints, brand voice).",
    )
    include_image_prompt: bool = Field(
        default=True,
        description="If false, only LinkedIn text + hashtags (no image prompt; skip image UX).",
    )


class GenerateResponse(BaseModel):
    linkedin_post: str
    image_prompt: str
    hashtags: list[str]


class ImageRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=4000)


class ImageResponse(BaseModel):
    url: str


class LlmHealthResponse(BaseModel):
    ok: bool
    provider: str | None = None
    model: str | None = None
    reply_preview: str | None = None
    error: str | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/llm", response_model=LlmHealthResponse)
def health_llm() -> LlmHealthResponse:
    settings = get_settings()
    raw = ping_chat_model(
        gemini_api_key=settings.gemini_api_key,
        gemini_model=settings.gemini_model,
        openai_api_key=settings.openai_api_key,
        openai_model="gpt-4o-mini",
    )
    return LlmHealthResponse(**raw)


@app.post("/topic-angles", response_model=TopicAnglesResponse)
def topic_angles(body: TopicAnglesRequest) -> TopicAnglesResponse:
    settings = get_settings()
    if not settings.gemini_api_key.strip() and not settings.openai_api_key.strip():
        raise HTTPException(
            status_code=400,
            detail="Set GEMINI_API_KEY or OPENAI_API_KEY to break down topics with AI",
        )
    try:
        angles = run_topic_angles(
            topic=body.topic,
            gemini_api_key=settings.gemini_api_key,
            gemini_model=settings.gemini_model,
            openai_api_key=settings.openai_api_key,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return TopicAnglesResponse(angles=angles)


@app.post("/trends", response_model=TrendsResponse)
async def trends(body: TrendsRequest) -> TrendsResponse:
    settings = get_settings()
    raw = await gather_trends(
        body.topics,
        news_api_key=settings.news_api_key,
        selected_queries=body.selected_queries,
    )
    items = [TrendItem(**r) for r in raw]
    return TrendsResponse(items=items)


@app.post("/trends/filter", response_model=TrendFilterResponse)
def trends_filter(body: TrendFilterRequest) -> TrendFilterResponse:
    settings = get_settings()
    if not settings.gemini_api_key.strip() and not settings.openai_api_key.strip():
        raise HTTPException(
            status_code=400,
            detail="Set GEMINI_API_KEY or OPENAI_API_KEY to filter trends with AI",
        )
    raw_items = [i.model_dump() for i in body.items[:35]]
    try:
        filtered, note, used_fb = run_filter_trends_for_topic(
            topic=body.topic,
            items=raw_items,
            gemini_api_key=settings.gemini_api_key,
            gemini_model=settings.gemini_model,
            openai_api_key=settings.openai_api_key,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return TrendFilterResponse(
        items=[TrendItem(**r) for r in filtered],
        note=note,
        used_fallback=used_fb,
    )


@app.post("/generate", response_model=GenerateResponse)
def generate(body: GenerateRequest) -> GenerateResponse:
    settings = get_settings()
    if not settings.gemini_api_key.strip() and not settings.openai_api_key.strip():
        raise HTTPException(
            status_code=400,
            detail="Set GEMINI_API_KEY (recommended) or OPENAI_API_KEY in api/.env",
        )
    try:
        items_in = [
            TrendItemIn(title=i.title, summary=i.summary, source=i.source, url=i.url)
            for i in body.items
        ]
        out = run_generate_post(
            items=items_in,
            tone=body.tone,
            extra_instructions=body.extra_instructions,
            system_prompt=body.system_prompt,
            include_image_prompt=body.include_image_prompt,
            gemini_api_key=settings.gemini_api_key,
            gemini_model=settings.gemini_model,
            openai_api_key=settings.openai_api_key,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return GenerateResponse(
        linkedin_post=out.linkedin_post,
        image_prompt=out.image_prompt,
        hashtags=out.hashtags,
    )


@app.post("/image", response_model=ImageResponse)
async def image(body: ImageRequest) -> ImageResponse:
    settings = get_settings()
    backend = settings.resolved_image_backend()
    try:
        if backend == "openai":
            key = settings.openai_api_key.strip()
            if not key:
                raise HTTPException(
                    status_code=400,
                    detail="IMAGE_BACKEND=openai requires OPENAI_API_KEY",
                )
            url = await create_openai_image_url(api_key=key, prompt=body.prompt)
            return ImageResponse(url=url)

        if backend == "gemini":
            gkey = settings.gemini_api_key.strip()
            if not gkey:
                raise HTTPException(
                    status_code=400,
                    detail="IMAGE_BACKEND=gemini requires GEMINI_API_KEY",
                )
            url = await asyncio.to_thread(
                create_gemini_image_data_url,
                api_key=gkey,
                model=settings.gemini_image_model,
                prompt=body.prompt,
            )
            return ImageResponse(url=url)

        # pollinations — no keys
        return ImageResponse(url=pollinations_image_url(body.prompt))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
