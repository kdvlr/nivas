from app.integrations.recipe_ai import _minutes, _page_text, try_scraper

LD_JSON_RECIPE = """
<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Recipe","name":"Test Pancakes",
 "image":"https://example.com/p.jpg","recipeYield":"4 servings",
 "prepTime":"PT10M","cookTime":"PT15M","totalTime":"PT25M",
 "recipeIngredient":["2 cups flour","1 cup milk","2 eggs"],
 "recipeInstructions":[{"@type":"HowToStep","text":"Mix dry ingredients."},
                        {"@type":"HowToStep","text":"Add wet ingredients and whisk."},
                        {"@type":"HowToStep","text":"Cook on a hot griddle."}]}
</script></head>
<body><h1>Test Pancakes</h1><p>The best pancakes.</p></body></html>
"""


def test_minutes_formatting():
    assert _minutes(15) == "15 min"
    assert _minutes(90) == "1 hr 30 min"
    assert _minutes(None) == ""
    assert _minutes("") == ""


def test_scraper_extracts_ld_json_recipe():
    data = try_scraper("https://example.com/pancakes", LD_JSON_RECIPE)
    assert data is not None
    assert data["title"] == "Test Pancakes"
    assert len(data["ingredients"]) == 3
    assert len(data["steps"]) == 3
    assert data["prep_time"] == "10 min"


def test_scraper_returns_none_without_recipe():
    assert try_scraper("https://example.com/nope", "<html><body>Just a blog post</body></html>") is None


def test_page_text_keeps_ld_json_and_strips_scripts():
    text = _page_text(LD_JSON_RECIPE)
    assert "Test Pancakes" in text
    assert "recipeIngredient" in text  # ld+json blob preserved for Gemini
    html = "<html><body><script>evil()</script><p>Hello recipe world</p></body></html>"
    assert "evil" not in _page_text(html)


LD_JSON_RECIPE_WITH_NUTRITION = """
<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Recipe","name":"Nutritious Salad",
 "recipeYield":"2 servings",
 "recipeIngredient":["4 cups spinach", "1 tbsp olive oil"],
 "recipeInstructions":[{"@type":"HowToStep","text":"Toss and serve."}],
 "nutrition": {
    "@type": "NutritionInformation",
    "calories": "180 calories",
    "fatContent": "14 g",
    "saturatedFatContent": "2 g",
    "carbohydrateContent": "8 g",
    "fiberContent": "3 g",
    "proteinContent": "4 g",
    "sodiumContent": "120 mg",
    "servingSize": "1 bowl"
 }
}
</script></head>
<body><h1>Nutritious Salad</h1></body></html>
"""


def test_scraper_extracts_nutrition():
    data = try_scraper("https://example.com/salad", LD_JSON_RECIPE_WITH_NUTRITION)
    assert data is not None
    assert data["nutrition"] is not None
    assert "website" in data["nutrition"]
    web = data["nutrition"]["website"]
    assert web["calories"] == 180
    assert web["total_fat"] == "14 g"
    assert web["saturated_fat"] == "2 g"
    assert web["total_carbohydrate"] == "8 g"
    assert web["dietary_fiber"] == "3 g"
    assert web["protein"] == "4 g"
    assert web["sodium"] == "120 mg"
    assert web["source"] == "website"
    assert data["nutrition"]["active_source"] == "website"


def test_normalize_scraped_nutrients():
    from app.integrations.recipe_ai import normalize_scraped_nutrients

    raw = {
        "calories": "250 kcal",
        "fat": "10",
        "protein": "15g",
        "carbohydrate": "25 g",
        "sodium": "350",
    }
    norm = normalize_scraped_nutrients(raw, fallback_servings="4")
    assert norm is not None
    assert norm["calories"] == 250
    assert norm["total_fat"] == "10g"
    assert norm["protein"] == "15g"
    assert norm["total_carbohydrate"] == "25 g"
    assert norm["sodium"] == "350mg"
    assert norm["source"] == "website"

    # Empty or irrelevant dict returns None
    assert normalize_scraped_nutrients({}) is None
    assert normalize_scraped_nutrients(None) is None
    assert normalize_scraped_nutrients({"random": "value"}) is None


def test_calculate_nutrition_ai_with_mock_and_fallback(monkeypatch):
    import json
    from unittest.mock import MagicMock
    from app.integrations.recipe_ai import calculate_nutrition_ai

    mock_client = MagicMock()

    # Simulate 503 on gemini-3.8-flash, then success on gemini-3.6-flash
    def fake_generate_content(model, contents, config):
        if model == "gemini-3.8-flash":
            raise RuntimeError("503 UNAVAILABLE: High demand")
        res = MagicMock()
        res.text = json.dumps({
            "serving_size": "1 portion",
            "servings_per_recipe": "2",
            "calories": 220,
            "total_fat": "9g",
            "saturated_fat": "1.5g",
            "trans_fat": "0g",
            "cholesterol": "10mg",
            "sodium": "280mg",
            "total_carbohydrate": "24g",
            "dietary_fiber": "4g",
            "sugars": "3g",
            "protein": "8g"
        })
        return res

    mock_client.models.generate_content.side_effect = fake_generate_content

    # Mock genai.Client
    mock_genai = MagicMock()
    mock_genai.Client.return_value = mock_client
    monkeypatch.setattr("google.genai.Client", mock_genai.Client, raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    from app.config import get_settings
    get_settings.cache_clear()

    res = calculate_nutrition_ai("Test Dish", "2 servings", ["1 cup rice", "1 egg"], ["Cook together."])
    assert res["calories"] == 220
    assert res["total_fat"] == "9g"
    assert res["protein"] == "8g"
    assert res["source"] == "ai"
    get_settings.cache_clear()


def test_recipe_nutrition_endpoints():
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool
    from app.main import app
    from app.db import get_db
    from app.models import Base

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    db = TestingSessionLocal()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    try:
        # 1. Create a manual recipe
        create_res = client.post("/api/recipes/manual", json={
            "title": "Nutrition Test Stew",
            "servings": "4 servings",
            "ingredients": ["1 lb beef", "2 carrots", "2 potatoes"],
            "steps": ["Chop and simmer for 1 hour."],
            "nutrition": {
                "website": {
                    "serving_size": "1 bowl",
                    "calories": 320,
                    "total_fat": "12g",
                    "protein": "25g",
                    "total_carbohydrate": "20g",
                    "source": "website"
                },
                "active_source": "website"
            }
        })
        assert create_res.status_code == 200
        recipe = create_res.json()
        r_id = recipe["id"]
        assert recipe["nutrition"]["website"]["calories"] == 320

        # 2. Toggle active_source
        toggle_res = client.post(f"/api/recipes/{r_id}/nutrition", json={"active_source": "ai"})
        assert toggle_res.status_code == 200
        assert toggle_res.json()["nutrition"]["active_source"] == "ai"

        # Cleanup
        del_res = client.delete(f"/api/recipes/{r_id}")
        assert del_res.status_code == 200
    finally:
        app.dependency_overrides.clear()
        db.close()


def test_sanitize_ld_json():
    from app.integrations.recipe_ai import sanitize_ld_json

    # Test trailing colon after closing brace
    bad_html = '<script type="application/ld+json">{"@type": "Recipe", "name": "Curry"}:</script>'
    cleaned = sanitize_ld_json(bad_html)
    assert '}:' not in cleaned
    assert '{"@type": "Recipe", "name": "Curry"}' in cleaned

    # Test trailing comma inside json
    bad_comma = '<script type="application/ld+json">{"@type": "Recipe", "items": [1, 2, ],}</script>'
    cleaned_comma = sanitize_ld_json(bad_comma)
    assert ',}' not in cleaned_comma
    assert ', ]' not in cleaned_comma


def test_extract_html_table_nutrients_and_normalization():
    from app.integrations.recipe_ai import extract_html_table_nutrients, normalize_scraped_nutrients

    sample_html = """
    <html><body>
    <div class="nutrition">
      <table class="table">
        <tbody>
          <tr><td>Energy</td><td>201 kcal</td></tr>
          <tr><td>Fat (g)</td><td>5</td></tr>
          <tr><td>of which saturates (g)</td><td>1</td></tr>
          <tr><td>Carbohydrates (g)</td><td>37</td></tr>
          <tr><td>of which sugars (g)</td><td>3</td></tr>
          <tr><td>Fibre (g)</td><td>5</td></tr>
          <tr><td>Protein (g)</td><td>4</td></tr>
          <tr><td>Salt (mg)</td><td>573</td></tr>
        </tbody>
      </table>
    </div>
    </body></html>
    """
    raw = extract_html_table_nutrients(sample_html)
    assert raw is not None
    assert "Energy" in raw
    assert raw["Energy"] == "201 kcal"
    assert raw["Fat (g)"] == "5"

    norm = normalize_scraped_nutrients(raw, fallback_servings="4")
    assert norm is not None
    assert norm["calories"] == 201
    assert norm["total_fat"] == "5g"
    assert norm["saturated_fat"] == "1g"
    assert norm["total_carbohydrate"] == "37g"
    assert norm["sugars"] == "3g"
    assert norm["dietary_fiber"] == "5g"
    assert norm["protein"] == "4g"
    assert norm["sodium"] == "573mg"
    assert norm["source"] == "website"


def test_try_scraper_sanitizes_ld_json_and_extracts_table_nutrition():
    from app.integrations.recipe_ai import try_scraper

    page = """
    <html><head>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Recipe","name":"Bombay Potatoes",
     "image":"https://example.com/bombay.jpg","recipeYield":"4 servings",
     "recipeIngredient":["2 potatoes","1 tsp cumin"],
     "recipeInstructions":[{"@type":"HowToStep","text":"Boil and fry."}]}:
    </script>
    </head>
    <body>
      <h1>Bombay Potatoes</h1>
      <div class="nutrition">
        <table>
          <tr><td>Energy</td><td>841 kJ / 201 kcal</td></tr>
          <tr><td>Fat (g)</td><td>5</td></tr>
          <tr><td>Carbohydrates (g)</td><td>37</td></tr>
          <tr><td>Protein (g)</td><td>4</td></tr>
        </table>
      </div>
    </body></html>
    """
    data = try_scraper("https://example.com/bombay", page)
    assert data is not None
    assert data["title"] == "Bombay Potatoes"
    assert len(data["ingredients"]) == 2
    assert data["nutrition"] is not None
    assert "website" in data["nutrition"]
    web = data["nutrition"]["website"]
    assert web["calories"] == 201
    assert web["total_fat"] == "5g"
    assert web["total_carbohydrate"] == "37g"
    assert web["protein"] == "4g"
    assert web["source"] == "website"


