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

NUTRITION_SCHEMA = {
    "type": "object",
    "properties": {
        "serving_size": {"type": "string", "description": "e.g. '1 serving', '1 cup (240g)', '2 pieces'"},
        "servings_per_recipe": {"type": "string", "description": "e.g. '4', '6 servings'"},
        "calories": {"type": "integer", "description": "Estimated calories per serving"},
        "total_fat": {"type": "string", "description": "e.g. '12g'"},
        "saturated_fat": {"type": "string", "description": "e.g. '3.5g'"},
        "trans_fat": {"type": "string", "description": "e.g. '0g'"},
        "cholesterol": {"type": "string", "description": "e.g. '30mg'"},
        "sodium": {"type": "string", "description": "e.g. '450mg'"},
        "total_carbohydrate": {"type": "string", "description": "e.g. '35g'"},
        "dietary_fiber": {"type": "string", "description": "e.g. '4g'"},
        "sugars": {"type": "string", "description": "e.g. '6g'"},
        "protein": {"type": "string", "description": "e.g. '14g'"},
    },
    "required": ["serving_size", "calories", "total_fat", "total_carbohydrate", "protein"],
}


import ipaddress
import socket
from urllib.parse import urlparse

def is_safe_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if not parsed.hostname:
            return False
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        # Resolve hostname to all associated IP addresses
        for info in socket.getaddrinfo(parsed.hostname, port):
            ip_str = info[4][0]
            # Strip scope zone index from IPv6 if present
            ip_str = ip_str.split("%")[0]
            ip = ipaddress.ip_address(ip_str)
            if ip.is_loopback or ip.is_private or ip.is_link_local:
                return False
        return True
    except Exception:
        return False


def fetch_html(url: str) -> str:
    if not is_safe_url(url):
        raise ValueError("URL points to an unsafe target location (private/local network)")
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


def sanitize_ld_json(html: str) -> str:
    """Clean up common syntax mistakes in <script type="application/ld+json"> blocks.

    Fixes:
    - Trailing colon/semicolon/comma after outermost closing brace (e.g. `}: </script>`)
    - Trailing commas before closing braces/brackets (e.g. `{"a": 1, }`)
    """
    if not html or "ld+json" not in html:
        return html

    def _clean_block(match: re.Match) -> str:
        tag_open = match.group(1)
        content = match.group(2)
        tag_close = match.group(3)

        # 1. Strip trailing colons, semicolons, or commas after the outermost closing brace/bracket
        cleaned = re.sub(r'([\}\]])\s*[:;,]+\s*$', r'\1', content.strip())
        # 2. Clean up trailing comma before closing brace or bracket
        cleaned = re.sub(r',\s*([\}\]])', r'\1', cleaned)
        return f"{tag_open}{cleaned}{tag_close}"

    pattern = re.compile(
        r'(<script\s+[^>]*type=[\'"]?application/ld\+json[\'"]?[^>]*>)(.*?)(</script>)',
        re.DOTALL | re.IGNORECASE,
    )
    return pattern.sub(_clean_block, html)


def extract_html_table_nutrients(html: str) -> dict | None:
    """Extract nutrient key-value pairs from HTML tables or nutrition containers."""
    if not html:
        return None
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    nutrients = {}

    # Target containers likely to contain nutrition info
    containers = soup.find_all(
        lambda tag: tag.name in ("div", "section", "table", "aside")
        and any(
            term in " ".join(tag.get("class", [])).lower() or term in (tag.get("id") or "").lower()
            for term in ["nutrition", "recipe-nutrition", "nutrition-facts", "nutrients", "nutrition-info"]
        )
    )

    if not containers:
        containers = soup.find_all("table")

    candidate_pairs = []
    for container in containers:
        table_rows = container.find_all("tr")
        if table_rows:
            for tr in table_rows:
                cells = tr.find_all(["td", "th"])
                if len(cells) >= 2:
                    k = cells[0].get_text(strip=True)
                    v = cells[1].get_text(strip=True)
                    candidate_pairs.append((k, v))
        else:
            for item in container.find_all(["li", "div"], recursive=False) or container.find_all(["li"]):
                spans = item.find_all(["span", "div", "p"], recursive=False)
                if len(spans) >= 2:
                    k = spans[0].get_text(strip=True)
                    v = spans[1].get_text(strip=True)
                    candidate_pairs.append((k, v))
                else:
                    txt = item.get_text(strip=True)
                    if ":" in txt:
                        parts = txt.split(":", 1)
                        candidate_pairs.append((parts[0].strip(), parts[1].strip()))

    for label, val in candidate_pairs:
        clean_lbl = label.lower()
        if any(term in clean_lbl for term in [
            "calorie", "energy", "fat", "saturate", "carb", "sugar",
            "fiber", "fibre", "protein", "salt", "sodium", "cholesterol"
        ]):
            if label not in nutrients and val:
                nutrients[label] = val

    return nutrients if nutrients else None


def normalize_scraped_nutrients(raw: dict | None, fallback_servings: str = "") -> dict | None:
    """Standardize nutrient dictionary from recipe-scrapers / schema.org / HTML tables."""
    if not raw or not isinstance(raw, dict):
        return None

    def _clean_key(k: str) -> str:
        # Strip parentheticals like (g), (mg), (kcal)
        cleaned = re.sub(r'\(.*?\)', '', k)
        return cleaned.lower().replace(" ", "").replace("_", "").replace("-", "")

    def _val(keys: list[str]) -> str:
        norm_keys = [k.lower().replace(" ", "").replace("_", "").replace("-", "") for k in keys]
        for rk, rv in raw.items():
            if _clean_key(rk) in norm_keys:
                if rv is not None:
                    s = str(rv).strip()
                    if s and s.lower() not in ("none", "null", "unknown"):
                        return s
        return ""

    def _extract_int(val: str) -> int | None:
        if not val:
            return None
        # Prefer kcal/calorie value if energy format has both kJ and kcal
        cal_m = re.search(r"(\d+(?:\.\d+)?)\s*k?cal", val, re.IGNORECASE)
        if cal_m:
            try:
                return round(float(cal_m.group(1)))
            except ValueError:
                pass
        m = re.search(r"(\d+(?:\.\d+)?)", val)
        if m:
            try:
                return round(float(m.group(1)))
            except ValueError:
                return None
        return None

    calories_str = _val(["calories", "calorie", "energy", "caloriescontent", "kcal"])
    calories = _extract_int(calories_str)

    total_fat = _val(["fatContent", "totalFat", "fat", "totalFatContent", "fats"])
    sat_fat = _val(["saturatedFatContent", "saturatedFat", "satFat", "saturates", "ofwhichsaturates", "saturated"])
    trans_fat = _val(["transFatContent", "transFat"])
    cholesterol = _val(["cholesterolContent", "cholesterol"])
    sodium = _val(["sodiumContent", "sodium", "salt"])
    carbs = _val(["carbohydrateContent", "carbohydrates", "carbohydrate", "totalCarbohydrate", "carbs"])
    fiber = _val(["fiberContent", "fiber", "fibre", "dietaryFiber", "dietaryFiberContent", "dietaryfibre"])
    sugars = _val(["sugarContent", "sugar", "sugars", "totalSugars", "ofwhichsugars"])
    protein = _val(["proteinContent", "protein", "proteins"])
    serving_size = _val(["servingSize", "serving", "yield"]) or fallback_servings or "1 serving"

    # Require at least calories or at least two macros
    has_macros = sum(bool(x) for x in [total_fat, carbs, protein]) >= 2
    if calories is None and not has_macros:
        return None

    def _unit(val: str, default_unit: str = "g") -> str:
        if not val:
            return ""
        v = val.strip()
        if re.match(r"^\d+(?:\.\d+)?$", v):
            return f"{v}{default_unit}"
        return v

    return {
        "serving_size": serving_size,
        "servings_per_recipe": fallback_servings or "1",
        "calories": calories if calories is not None else 0,
        "total_fat": _unit(total_fat, "g"),
        "saturated_fat": _unit(sat_fat, "g"),
        "trans_fat": _unit(trans_fat, "g"),
        "cholesterol": _unit(cholesterol, "mg"),
        "sodium": _unit(sodium, "mg"),
        "total_carbohydrate": _unit(carbs, "g"),
        "dietary_fiber": _unit(fiber, "g"),
        "sugars": _unit(sugars, "g"),
        "protein": _unit(protein, "g"),
        "source": "website",
    }


def calculate_nutrition_ai(title: str, servings: str, ingredients: list[str], steps: list[str]) -> dict:
    """Calculate per-serving nutrition facts using Gemini with gemini-3.8-flash (and 3.6 fallback)."""
    s = get_settings()
    api_key = s.gemini_api_key
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    ingredients_text = "\n".join(f"- {ing}" for ing in ingredients) if ingredients else "None specified"
    steps_text = "\n".join(f"{i+1}. {step}" for i, step in enumerate(steps)) if steps else "None specified"

    prompt = (
        "You are an expert culinary nutritionist and dietitian.\n"
        "Analyze the recipe ingredients, quantities, cooking techniques (e.g. pan frying, baking, boiling, deep frying), "
        "and total yield/servings.\n"
        "Calculate the estimated nutritional facts PER SERVING for this recipe.\n"
        f"Recipe Title: {title}\n"
        f"Declared Servings: {servings or '1 serving'}\n\n"
        f"Ingredients:\n{ingredients_text}\n\n"
        f"Cooking Instructions:\n{steps_text}\n\n"
        "Provide accurate estimates for calories, total fat, saturated fat, trans fat, cholesterol, sodium, "
        "total carbohydrate, dietary fiber, sugars, and protein per serving."
    )

    models_to_try = [s.gemini_model, "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.7-flash"]
    seen = set()
    models_to_try = [m for m in models_to_try if not (m in seen or seen.add(m))]

    last_err = None
    for model_name in models_to_try:
        try:
            resp = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=NUTRITION_SCHEMA,
                ),
            )
            data = json.loads(resp.text)
            return {
                "serving_size": data.get("serving_size", "1 serving"),
                "servings_per_recipe": data.get("servings_per_recipe") or servings or "1",
                "calories": int(data.get("calories", 0)),
                "total_fat": str(data.get("total_fat", "")),
                "saturated_fat": str(data.get("saturated_fat", "")),
                "trans_fat": str(data.get("trans_fat", "")),
                "cholesterol": str(data.get("cholesterol", "")),
                "sodium": str(data.get("sodium", "")),
                "total_carbohydrate": str(data.get("total_carbohydrate", "")),
                "dietary_fiber": str(data.get("dietary_fiber", "")),
                "sugars": str(data.get("sugars", "")),
                "protein": str(data.get("protein", "")),
                "source": "ai",
            }
        except Exception as e:
            log.warning("Gemini nutrition calculation failed with model %s: %s", model_name, e)
            last_err = e

    raise RuntimeError(f"AI nutrition calculation failed across models: {last_err}")


def try_scraper(url: str, html: str) -> dict | None:
    """recipe-scrapers extraction; None if the site is unsupported or data is unusable."""
    try:
        from recipe_scrapers import scrape_html

        sanitized_html = sanitize_ld_json(html)
        scraper = scrape_html(sanitized_html, org_url=url, supported_only=False)

        def grab(fn, default=""):
            try:
                v = fn()
                return v if v is not None else default
            except Exception:
                return default

        # Try extracting website nutrition
        website_nutrition = None
        try:
            raw_nutrients = grab(scraper.nutrients, None)
            if raw_nutrients:
                website_nutrition = normalize_scraped_nutrients(raw_nutrients, fallback_servings=str(grab(scraper.yields)))
        except Exception as ne:
            log.info("scraper nutrients extraction failed for %s: %s", url, ne)

        # Fallback to HTML table nutrients if scraper didn't find website nutrition
        if not website_nutrition:
            try:
                table_raw = extract_html_table_nutrients(sanitized_html)
                if table_raw:
                    website_nutrition = normalize_scraped_nutrients(table_raw, fallback_servings=str(grab(scraper.yields)))
            except Exception as te:
                log.info("table nutrients extraction failed for %s: %s", url, te)

        nutrition = None
        if website_nutrition:
            nutrition = {
                "website": website_nutrition,
                "active_source": "website",
            }

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
            "nutrition": nutrition,
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

    models_to_try = [s.gemini_model, "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.7-flash"]
    seen = set()
    models_to_try = [m for m in models_to_try if not (m in seen or seen.add(m))]

    last_err = None
    data = None
    for model_name in models_to_try:
        try:
            resp = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=RECIPE_SCHEMA,
                ),
            )
            data = json.loads(resp.text)
            break
        except Exception as e:
            log.warning("Gemini extraction failed with model %s: %s", model_name, e)
            last_err = e

    if not data or not data.get("title") or not data.get("ingredients"):
        raise RuntimeError(f"Gemini could not find a recipe on that page: {last_err}")
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
        "nutrition": None,
    }


def extract_recipe(url: str) -> dict:
    """Full pipeline. Raises RuntimeError with a user-facing message on failure."""
    html = fetch_html(url)
    data = try_scraper(url, html)
    if data is None:
        data = gemini_extract(url, html)
        try:
            table_raw = extract_html_table_nutrients(html)
            if table_raw:
                web_nutr = normalize_scraped_nutrients(table_raw, fallback_servings=data.get("servings", ""))
                if web_nutr:
                    data["nutrition"] = {
                        "website": web_nutr,
                        "active_source": "website",
                    }
        except Exception as te:
            log.info("fallback table nutrients extraction failed: %s", te)
    data["source_url"] = url

    # If website did not provide nutrition, calculate AI nutrition automatically
    if not data.get("nutrition") or not data["nutrition"].get("website"):
        try:
            s = get_settings()
            if s.gemini_api_key:
                ai_nutr = calculate_nutrition_ai(
                    title=data.get("title", ""),
                    servings=data.get("servings", ""),
                    ingredients=data.get("ingredients", []),
                    steps=data.get("steps", []),
                )
                current_nutr = data.get("nutrition") or {}
                current_nutr["ai"] = ai_nutr
                current_nutr["active_source"] = "ai"
                data["nutrition"] = current_nutr
        except Exception as e:
            log.warning("Automatic AI nutrition estimation during recipe extraction skipped: %s", e)

    return data
