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
