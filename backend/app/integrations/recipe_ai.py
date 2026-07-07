"""Save a recipe from a URL: recipe-scrapers first, Gemini fallback/cleanup."""

import json
import logging
import re

import httpx

from ..config import get_settings

log = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0 Safari/537.36"
)

RECIPE_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "image_url": {"type": "string"},
        "servings": {"type": "string"},
        "prep_time": {"type": "string", "description": "e.g. '15 min', empty if unknown"},
        "cook_time": {"type": "string"},
        "total_time": {"type": "string"},
        "ingredients": {
            "type": "array",
            "items": {"type": "string"},
            "description": "one ingredient per entry, 'quantity unit ingredient' form",
        },
        "steps": {
            "type": "array",
            "items": {"type": "string"},
            "description": "numbered instructions, one concise step per entry",
        },
        "tags": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["title", "ingredients", "steps"],
}


def fetch_html(url: str) -> str:
    resp = httpx.get(
        url, headers={"User-Agent": USER_AGENT}, follow_redirects=True, timeout=30
    )
    resp.raise_for_status()
    return resp.text


def _minutes(value) -> str:
    try:
        m = int(value)
        return f"{m // 60} hr {m % 60} min" if m >= 60 else f"{m} min"
    except (TypeError, ValueError):
        return str(value or "")


def try_scraper(url: str, html: str) -> dict | None:
    """recipe-scrapers extraction; None if the site is unsupported or data is unusable."""
    try:
        from recipe_scrapers import scrape_html

        scraper = scrape_html(html, org_url=url, supported_only=False)

        def grab(fn, default=""):
            try:
                v = fn()
                return v if v is not None else default
            except Exception:
                return default

        data = {
            "title": grab(scraper.title),
            "image_url": grab(scraper.image),
            "servings": str(grab(scraper.yields)),
            "prep_time": _minutes(grab(scraper.prep_time, None)),
            "cook_time": _minutes(grab(scraper.cook_time, None)),
            "total_time": _minutes(grab(scraper.total_time, None)),
            "ingredients": grab(scraper.ingredients, []),
            "steps": grab(scraper.instructions_list, []),
            "tags": [t for t in [grab(scraper.category), grab(scraper.cuisine)] if t],
        }
        if data["title"] and data["ingredients"] and data["steps"]:
            return data
    except Exception as e:
        log.info("recipe-scrapers failed for %s: %s", url, e)
    return None


def _page_text(html: str) -> str:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "iframe"]):
        tag.decompose()
    # keep ld+json recipe blobs — often the cleanest data on the page
    blobs = []
    from bs4 import BeautifulSoup as _BS  # re-parse original for ld+json

    for s in _BS(html, "html.parser").find_all("script", type="application/ld+json"):
        if s.string and "recipe" in s.string.lower():
            blobs.append(s.string[:8000])
    text = re.sub(r"\n{3,}", "\n\n", soup.get_text("\n", strip=True))
    return ("\n\n".join(blobs) + "\n\n" + text)[:60000]


def gemini_extract(url: str, html: str) -> dict:
    s = get_settings()
    if not s.gemini_api_key:
        raise RuntimeError("Site not supported by the scraper and GEMINI_API_KEY is not set")
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=s.gemini_api_key)
    prompt = (
        "Extract the recipe from this web page content and standardize it.\n"
        "- Ingredients: one per entry, 'quantity unit ingredient (prep note)' form, "
        "normalize unicode fractions (½ -> 1/2).\n"
        "- Steps: concise numbered-style instructions, one action group per step, no step numbers in the text.\n"
        "- Times as human strings like '15 min' or '1 hr 20 min'; empty string if unknown.\n"
        "- tags: 2-5 short tags (cuisine, course, key ingredient).\n"
        f"Source URL: {url}\n\nPAGE CONTENT:\n{_page_text(html)}"
    )
    resp = client.models.generate_content(
        model=s.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=RECIPE_SCHEMA,
        ),
    )
    data = json.loads(resp.text)
    if not data.get("title") or not data.get("ingredients"):
        raise RuntimeError("Gemini could not find a recipe on that page")
    return {
        "title": data.get("title", ""),
        "image_url": data.get("image_url", ""),
        "servings": data.get("servings", ""),
        "prep_time": data.get("prep_time", ""),
        "cook_time": data.get("cook_time", ""),
        "total_time": data.get("total_time", ""),
        "ingredients": data.get("ingredients", []),
        "steps": data.get("steps", []),
        "tags": data.get("tags", []),
    }


def extract_recipe(url: str) -> dict:
    """Full pipeline. Raises RuntimeError with a user-facing message on failure."""
    html = fetch_html(url)
    data = try_scraper(url, html)
    if data is None:
        data = gemini_extract(url, html)
    data["source_url"] = url
    return data
