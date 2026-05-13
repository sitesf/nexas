import os
import re
import json
import html
from datetime import datetime, timezone
from pathlib import Path
import feedparser

try:
    from google import genai
except Exception:
    genai = None

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "stiri"
OUT_JSON = OUT_DIR / "stiri.json"

ARTICLES_PER_CATEGORY = 3
MAX_PER_CATEGORY = 30

# ============================================================
# CATEGORII + SURSE RSS
# ============================================================
CATEGORY_FEEDS = {
    "AI & Tech": {
        "lang": "en",
        "feeds": [
            {"name": "TechCrunch",    "url": "https://techcrunch.com/feed/",                           "weight": 1.15},
            {"name": "VentureBeat",   "url": "https://venturebeat.com/category/ai/feed/",              "weight": 1.18},
            {"name": "The Verge",     "url": "https://www.theverge.com/rss/index.xml",                 "weight": 1.05},
            {"name": "OpenAI Blog",   "url": "https://openai.com/news/rss.xml",                        "weight": 1.20},
            {"name": "Anthropic",     "url": "https://www.anthropic.com/news/rss.xml",                 "weight": 1.15},
            {"name": "Ars Technica",  "url": "https://feeds.arstechnica.com/arstechnica/index",        "weight": 1.00},
        ],
    },
    "Sport": {
        "lang": "ro",
        "feeds": [
            {"name": "ProSport",      "url": "https://www.prosport.ro/feed",                           "weight": 1.20},
            {"name": "GSP",           "url": "https://www.gsp.ro/rss",                                 "weight": 1.15},
            {"name": "DigiSport",     "url": "https://www.digisport.ro/rss",                           "weight": 1.10},
            {"name": "Fanatik",       "url": "https://www.fanatik.ro/feed",                            "weight": 1.05},
        ],
    },
    "Sanatate": {
        "lang": "ro",
        "feeds": [
            {"name": "CSID",          "url": "https://www.csid.ro/rss",                                "weight": 1.15},
            {"name": "Mediafax",      "url": "https://www.mediafax.ro/sanatate/rss",                   "weight": 1.10},
            {"name": "Descopera",     "url": "https://descopera.ro/sanatate/feed",                     "weight": 1.00},
            {"name": "WebMD",         "url": "https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC", "weight": 0.90},
        ],
    },
    "Business": {
        "lang": "ro",
        "feeds": [
            {"name": "Ziarul Financiar", "url": "https://www.zf.ro/rss",                              "weight": 1.20},
            {"name": "Profit.ro",        "url": "https://www.profit.ro/rss",                           "weight": 1.15},
            {"name": "Business Magazin", "url": "https://www.businessmagazin.ro/rss",                  "weight": 1.00},
            {"name": "Economica",        "url": "https://economica.net/rss",                            "weight": 1.05},
        ],
    },
    "International": {
        "lang": "en",
        "feeds": [
            {"name": "BBC World",     "url": "http://feeds.bbci.co.uk/news/world/rss.xml",             "weight": 1.20},
            {"name": "Reuters",       "url": "https://feeds.reuters.com/reuters/topNews",              "weight": 1.15},
            {"name": "DW News",       "url": "https://rss.dw.com/rdf/rss-en-world",                   "weight": 1.00},
            {"name": "AP News",       "url": "https://rsshub.app/apnews/topics/apf-topnews",           "weight": 1.10},
        ],
    },
    "Entertainment": {
        "lang": "ro",
        "feeds": [
            {"name": "SpyNews",       "url": "https://spynews.ro/feed",                                "weight": 1.15},
            {"name": "Viva",          "url": "https://www.viva.ro/rss",                                "weight": 1.10},
            {"name": "OK Magazine",   "url": "https://okmagazine.ro/feed",                             "weight": 1.00},
            {"name": "Unica",         "url": "https://unica.ro/feed",                                  "weight": 1.05},
        ],
    },
    "Romania": {
        "lang": "ro",
        "feeds": [
            {"name": "Digi24",        "url": "https://www.digi24.ro/rss",                              "weight": 1.20},
            {"name": "G4Media",       "url": "https://www.g4media.ro/feed",                            "weight": 1.15},
            {"name": "HotNews",       "url": "https://www.hotnews.ro/rss",                             "weight": 1.10},
            {"name": "Libertatea",    "url": "https://www.libertatea.ro/rss",                          "weight": 1.05},
        ],
    },
    "Stiinta": {
        "lang": "en",
        "feeds": [
            {"name": "Science Daily", "url": "https://www.sciencedaily.com/rss/top.xml",               "weight": 1.15},
            {"name": "NASA News",     "url": "https://www.nasa.gov/rss/dyn/breaking_news.rss",         "weight": 1.10},
            {"name": "New Scientist", "url": "https://www.newscientist.com/feed/home/",                "weight": 1.05},
            {"name": "Descopera Ro",  "url": "https://descopera.ro/stiinta/feed",                      "weight": 1.00},
        ],
    },
}

CATEGORY_ICONS = {
    "AI & Tech":     "🤖",
    "Sport":         "⚽",
    "Sanatate":      "💊",
    "Business":      "💼",
    "International": "🌍",
    "Entertainment": "🎬",
    "Romania":       "🏛️",
    "Stiinta":       "🔬",
}

DEFAULT_HASHTAGS = {
    "AI & Tech":     ["#NEXAS", "#AI", "#Tech", "#Tehnologie", "#InteligentaArtificiala"],
    "Sport":         ["#NEXAS", "#Sport", "#Fotbal", "#Romania", "#Campionat"],
    "Sanatate":      ["#NEXAS", "#Sanatate", "#Health", "#Medicina", "#Wellness"],
    "Business":      ["#NEXAS", "#Business", "#Economie", "#Antreprenoriat", "#Finance"],
    "International": ["#NEXAS", "#International", "#StiriMondiale", "#Lume", "#Breaking"],
    "Entertainment": ["#NEXAS", "#Entertainment", "#Vedete", "#Divertisment", "#Lifestyle"],
    "Romania":       ["#NEXAS", "#Romania", "#StiriRomania", "#Actualitate", "#Breaking"],
    "Stiinta":       ["#NEXAS", "#Stiinta", "#Science", "#Descoperiri", "#Inovatie"],
}

# ============================================================
# UTILITARE
# ============================================================
def clean_text(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value

def parsed_date(entry) -> datetime:
    if getattr(entry, "published_parsed", None):
        return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
    if getattr(entry, "updated_parsed", None):
        return datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
    return datetime.now(timezone.utc)

def freshness_score(date: datetime) -> float:
    age_hours = max((datetime.now(timezone.utc) - date).total_seconds() / 3600, 1)
    return max(0.0, 72.0 - min(age_hours, 72.0)) / 12.0

def image_prompt(title: str, category: str) -> str:
    return (
        f"Premium editorial photograph for {category} news: {title[:100]}. "
        "Professional photorealistic style. No text, no logos, no watermarks."
    )

# ============================================================
# COLECTARE STIRI PER CATEGORIE
# ============================================================
def collect_for_category(category: str, config: dict, target: int = 3) -> list:
    articles = []
    seen_urls = set()
    seen_titles = set()

    for feed in config["feeds"]:
        try:
            parsed = feedparser.parse(feed["url"])
        except Exception as e:
            print(f"    Feed failed [{feed['name']}]: {e}")
            continue

        for entry in parsed.entries[:12]:
            title = clean_text(getattr(entry, "title", ""))
            url = getattr(entry, "link", "")

            if not title or not url or len(title) < 10:
                continue

            title_key = re.sub(r"\W+", "", title.lower())[:80]
            if url in seen_urls or title_key in seen_titles:
                continue

            seen_urls.add(url)
            seen_titles.add(title_key)

            raw = clean_text(getattr(entry, "summary", "") or getattr(entry, "description", ""))
            date = parsed_date(entry)
            score = freshness_score(date) * feed.get("weight", 1.0)

            articles.append({
                "title": title,
                "source": feed["name"],
                "url": url,
                "date": date.isoformat(),
                "category": category,
                "summary": raw[:420] if raw else title,
                "instagram_caption": f"{title}\n\nCiteste pe nexas.ro/stiri/",
                "hashtags": DEFAULT_HASHTAGS.get(category, ["#NEXAS"]),
                "image": "",
                "image_prompt": image_prompt(title, category),
                "_score": score,
                "_lang": config.get("lang", "en"),
            })

    articles.sort(key=lambda x: x["_score"], reverse=True)
    result = articles[:target * 2]  # extra pool for dedup

    # Deduplicate by picking from different sources where possible
    final = []
    used_sources = set()
    for a in result:
        if len(final) >= target:
            break
        if a["source"] not in used_sources or len(final) < target:
            final.append(a)
            used_sources.add(a["source"])

    return final[:target]

# ============================================================
# GEMINI REWRITE
# ============================================================
def gemini_rewrite_ro(item: dict) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or genai is None:
        print("    Gemini skipped: GEMINI_API_KEY lipseste")
        return item

    is_ro = item.get("_lang") == "ro"

    if is_ro:
        prompt = f"""Rescrie si curata aceasta stire romaneasca pentru site-ul NEXAS.
Pastreaza informatia reala, nu inventa nimic nou.
Titlu: max 90 caractere, clar si atractiv.
Rezumat: max 380 caractere, informativ si usor de citit.
Caption Instagram: max 400 caractere, in romana, cu emoji.
Raspunde STRICT JSON valid, fara markdown, fara explicatii.

Stire:
Titlu: {item.get('title','')}
Rezumat: {item.get('summary','')}
Sursa: {item.get('source','')}
Categorie: {item.get('category','')}

Format exact:
{{"title":"","summary":"","instagram_caption":"","hashtags":[]}}"""
    else:
        prompt = f"""Traduce si rescrie aceasta stire in limba romana pentru site-ul NEXAS.
Nu inventa date, cifre sau informatii. Pastreaza sensul original.
Titlu: max 90 caractere, in romana, atractiv.
Rezumat: max 380 caractere, in romana, clar si informativ.
Caption Instagram: max 400 caractere, in romana, cu emoji.
Raspunde STRICT JSON valid, fara markdown, fara explicatii.

Stire originala:
Titlu: {item.get('title','')}
Rezumat: {item.get('summary','')}
Sursa: {item.get('source','')}
Categorie: {item.get('category','')}

Format exact:
{{"title":"","summary":"","instagram_caption":"","hashtags":[]}}"""

    for model_name in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
        try:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(model=model_name, contents=prompt)
            text = (response.text or "").strip()
            text = re.sub(r"^```json\s*", "", text)
            text = re.sub(r"^```\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
            data = json.loads(text)

            item["title"] = clean_text(data.get("title") or item["title"])
            item["summary"] = clean_text(data.get("summary") or item["summary"])
            item["instagram_caption"] = clean_text(data.get("instagram_caption") or item["instagram_caption"])
            new_tags = data.get("hashtags")
            if isinstance(new_tags, list) and new_tags:
                item["hashtags"] = [str(t).strip() for t in new_tags if str(t).strip()]

            print(f"    ✓ Gemini ({model_name}): {item['title'][:55]}")
            return item

        except Exception as e:
            print(f"    ✗ Gemini {model_name}: {e}")
            continue

    print(f"    Gemini esuat pentru: {item.get('url','')[:60]}")
    return item

# ============================================================
# MERGE + ARHIVA
# ============================================================
def load_old_items() -> list:
    if not OUT_JSON.exists():
        return []
    try:
        data = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data.get("items", [])
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"Nu pot citi stirile vechi: {e}")
        return []

def merge_items(new_items: list, old_items: list, max_per_cat: int = 30) -> list:
    seen_urls = set(item["url"] for item in new_items if item.get("url"))
    merged = list(new_items)

    cat_counts = {}
    for item in new_items:
        cat = item.get("category", "")
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    for item in old_items:
        url = item.get("url", "")
        cat = item.get("category", "")
        if not url or url in seen_urls:
            continue
        if cat_counts.get(cat, 0) >= max_per_cat:
            continue
        seen_urls.add(url)
        merged.append(item)
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    merged.sort(key=lambda x: x.get("date", ""), reverse=True)
    return merged

# ============================================================
# MAIN
# ============================================================
def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    run_log = {}
    all_new_items = []

    print(f"\n{'='*50}")
    print(f"NEXAS Stiri Agent — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*50}")

    for category, config in CATEGORY_FEEDS.items():
        icon = CATEGORY_ICONS.get(category, "📰")
        print(f"\n{icon} {category}")

        items = collect_for_category(category, config, target=ARTICLES_PER_CATEGORY)

        if len(items) < ARTICLES_PER_CATEGORY:
            print(f"  ⚠ Insuficiente: {len(items)}/{ARTICLES_PER_CATEGORY} — categoria sarita")
            run_log[category] = 0
            continue

        rewrote = []
        for item in items:
            item.pop("_score", None)
            item.pop("_lang", None)
            item = gemini_rewrite_ro(item)
            rewrote.append(item)

        all_new_items.extend(rewrote)
        run_log[category] = len(rewrote)
        print(f"  ✓ {len(rewrote)} stiri salvate")

    old_items = load_old_items()
    merged = merge_items(all_new_items, old_items, max_per_cat=MAX_PER_CATEGORY)

    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "run_log": run_log,
        "items": merged,
    }

    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    total_new = sum(run_log.values())
    cats_ok = sum(1 for v in run_log.values() if v > 0)
    print(f"\n{'='*50}")
    print(f"✓ Categorii active: {cats_ok}/{len(CATEGORY_FEEDS)}")
    print(f"✓ Stiri noi: {total_new} | Total in JSON: {len(merged)}")
    print(f"Run log: {run_log}")
    print(f"{'='*50}\n")

if __name__ == "__main__":
    main()
