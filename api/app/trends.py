"""Fetch tech trends from public APIs (no DB), biased toward the user's topic."""

from __future__ import annotations

import asyncio
import os
import re
from typing import Any
import httpx

UA = {"User-Agent": "ContentStudio/1.0 (+https://example.local; dev)"}


def _search_query(topics: str) -> str:
    """Single string for search APIs (phrase + comma parts)."""
    t = (topics or "").strip()
    if not t:
        return "artificial intelligence technology"
    return t


def _topic_keywords(topics: str) -> list[str]:
    """Lowercase tokens (length > 2) for lightweight relevance scoring."""
    raw = (topics or "").lower().replace(",", " ")
    words = [w for w in re.split(r"\W+", raw) if len(w) > 2]
    seen: set[str] = set()
    out: list[str] = []
    for w in words:
        if w not in seen:
            seen.add(w)
            out.append(w)
    return out if out else ["technology"]


def _relevance_score(title: str, summary: str, keywords: list[str]) -> int:
    blob = f"{title} {summary}".lower()
    return sum(1 for k in keywords if k in blob)


async def _hn_search_algolia(
    client: httpx.AsyncClient, query: str, limit: int = 12
) -> list[dict[str, Any]]:
    """HN stories matching the topic (not the global front page)."""
    q = query.strip()
    if not q:
        return []
    r = await client.get(
        "https://hn.algolia.com/api/v1/search",
        params={"tags": "story", "query": q},
        headers=UA,
        timeout=30.0,
    )
    if r.status_code != 200:
        return []
    hits = r.json().get("hits") or []
    out: list[dict[str, Any]] = []
    for h in hits[: limit + 5]:
        title = h.get("title")
        if not title:
            continue
        story_id = h.get("objectID") or h.get("story_id")
        url = h.get("url") or (
            f"https://news.ycombinator.com/item?id={story_id}" if story_id else ""
        )
        story = (h.get("story_text") or "")[:400]
        summary = story if story else "Hacker News — open the link for discussion or article."
        out.append(
            {
                "title": title,
                "summary": summary,
                "source": "Hacker News",
                "url": url,
            }
        )
    return out[:limit]


async def _github_repos(
    client: httpx.AsyncClient, query: str, limit: int = 6
) -> list[dict[str, Any]]:
    q_clean = (query or "machine learning").strip()
    token = os.getenv("GITHUB_TOKEN", "").strip()
    headers = {**UA, "Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = await client.get(
        "https://api.github.com/search/repositories",
        params={
            "q": f"{q_clean} in:name,description,readme",
            "sort": "updated",
            "order": "desc",
            "per_page": limit,
        },
        headers=headers,
        timeout=30.0,
    )
    if r.status_code != 200:
        return []
    data = r.json()
    items = data.get("items") or []
    out: list[dict[str, Any]] = []
    for it in items[:limit]:
        desc = (it.get("description") or "Recently updated repository.")[:400]
        out.append(
            {
                "title": it.get("full_name") or it.get("name") or "Repo",
                "summary": desc,
                "source": "GitHub",
                "url": it.get("html_url") or "",
            }
        )
    return out


async def _reddit_search(
    client: httpx.AsyncClient, query: str, limit: int = 8
) -> list[dict[str, Any]]:
    """Site-wide Reddit search by relevance (not generic subreddit hot)."""
    if not query.strip():
        return []
    r = await client.get(
        "https://www.reddit.com/search.json",
        params={
            "q": query.strip(),
            "sort": "relevance",
            "t": "month",
            "limit": min(limit, 25),
        },
        headers=UA,
        timeout=30.0,
    )
    if r.status_code != 200:
        return []
    data = r.json()
    children = (data.get("data") or {}).get("children") or []
    out: list[dict[str, Any]] = []
    for ch in children:
        p = ch.get("data") or {}
        title = p.get("title")
        if not title or p.get("stickied"):
            continue
        permalink = p.get("permalink") or ""
        url_full = f"https://www.reddit.com{permalink}" if permalink else ""
        selftext = (p.get("selftext") or "")[:400]
        sub = p.get("subreddit") or "reddit"
        summary = selftext if selftext else "Reddit discussion — open the link."
        out.append(
            {
                "title": title,
                "summary": summary,
                "source": f"Reddit r/{sub}",
                "url": url_full,
            }
        )
        if len(out) >= limit:
            break
    return out


async def _newsapi_everything(
    client: httpx.AsyncClient, api_key: str, query: str, limit: int = 8
) -> list[dict[str, Any]]:
    if not api_key:
        return []
    q = query.strip() or "artificial intelligence"
    r = await client.get(
        "https://newsapi.org/v2/everything",
        headers=UA,
        params={
            "apiKey": api_key,
            "q": q,
            "language": "en",
            "sortBy": "relevancy",
            "pageSize": limit,
        },
        timeout=30.0,
    )
    if r.status_code != 200:
        return []
    try:
        data = r.json()
    except Exception:
        return []
    # NewsAPI sometimes returns HTTP 200 with {"status":"error","message":"..."}
    if data.get("status") == "error" or not isinstance(data.get("articles"), list):
        return []
    articles = data["articles"]
    out: list[dict[str, Any]] = []
    for a in articles[:limit]:
        title = a.get("title") or "News"
        desc = (a.get("description") or a.get("content") or "")[:400]
        summary = desc if desc else "See article for details."
        out.append(
            {
                "title": title,
                "summary": summary,
                "source": f"News: {a.get('source', {}).get('name', 'NewsAPI')}",
                "url": a.get("url") or "",
            }
        )
    return out


async def gather_trends(
    topics: str,
    *,
    news_api_key: str = "",
    selected_queries: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Pull sources using the user's topic string for search — not unrelated front pages.
    If selected_queries is non-empty (from AI angles), combine those for search + ranking.
    """
    sq_list = [s.strip() for s in (selected_queries or []) if s.strip()]
    if sq_list:
        search_q = " ".join(sq_list)
        keyword_source = search_q
    else:
        search_q = _search_query(topics)
        keyword_source = topics
    keywords = _topic_keywords(keyword_source)

    async with httpx.AsyncClient(timeout=30.0) as client:
        hn_task = _hn_search_algolia(client, search_q, 12)
        gh_task = _github_repos(client, search_q, 6)
        reddit_task = _reddit_search(client, search_q, 8)
        news_task = _newsapi_everything(client, news_api_key, search_q, 8)
        hn, gh, rd, news = await asyncio.gather(
            hn_task, gh_task, reddit_task, news_task
        )

    # News + HN + GitHub tend to match the topic best; Reddit can be noisy — still ranked.
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in news + hn + gh + rd:
        key = (row.get("title") or "").lower().strip()
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(row)

    merged.sort(
        key=lambda r: _relevance_score(
            r.get("title") or "",
            r.get("summary") or "",
            keywords,
        ),
        reverse=True,
    )
    return merged[:24]
