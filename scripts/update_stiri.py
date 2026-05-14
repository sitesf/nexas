import os
import re
import json
import html
import time
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
# 9 CATEGORII — 68 SURSE RSS
# ============================================================
CATEGORY_FEEDS = {
    "AI & Tech": {
        "lang": "en",
        "feeds": [
            {"name": "TechCrunch",       "url": "https://techcrunch.com/feed/",                                                             "weight": 1.15},
            {"name": "VentureBeat AI",   "url": "https://venturebeat.com/category/ai/feed/",                                                "weight": 1.18},
            {"name": "The Verge",        "url": "https://www.theverge.com/rss/index.xml",                                                   "weight": 1.05},
            {"name": "OpenAI Blog",      "url": "https://openai.com/news/rss.xml",                                                          "weight": 1.25},
            {"name": "Anthropic Blog",   "url": "https://www.anthropic.com/news/rss.xml",                                                   "weight": 1.25},
            {"name": "Google DeepMind",  "url": "https://deepmind.google/blog/rss.xml",                                                     "weight": 1.20},
            {"name": "Meta AI Blog",     "url": "https://ai.meta.com/blog/rss/",                                                            "weight": 1.18},
            {"name": "Microsoft AI",     "url": "https://blogs.microsoft.com/ai/feed/",                                                     "weight": 1.15},
            {"name": "Mistral AI",       "url": "https://mistral.ai/news/rss.xml",                                                          "weight": 1.10},
            {"name": "Ars Technica",     "url": "https://feeds.arstechnica.com/arstechnica/index",                                          "weight": 1.00},
            {"name": "Wired AI",         "url": "https://www.wired.com/feed/category/artificial-intelligence/latest/rss",                   "weight": 1.10},
            {"name": "Google News Tech", "url": "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=ro&gl=RO&ceid=RO:ro",    "weight": 1.05},
        ],
    },
    "Sport": {
        "lang": "ro",
        "feeds": [
            {"name": "ProSport",         "url": "https://www.prosport.ro/feed",                                                             "weight": 1.20, "lang": "ro"},
            {"name": "GSP",              "url": "https://www.gsp.ro/rss",                                                                   "weight": 1.18, "lang": "ro"},
            {"name": "DigiSport",        "url": "https://www.digisport.ro/rss",                                                             "weight": 1.15, "lang": "ro"},
            {"name": "Fanatik",          "url": "https://www.fanatik.ro/feed",                                                              "weight": 1.10, "lang": "ro"},
            {"name": "BBC Sport",        "url": "http://feeds.bbci.co.uk/sport/rss.xml",                                                    "weight": 1.05, "lang": "en"},
            {"name": "ESPN",             "url": "https://www.espn.com/espn/rss/news",                                                       "weight": 1.00, "lang": "en"},
            {"name": "Google Sport",     "url": "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=ro&gl=RO&ceid=RO:ro",        "weight": 1.10, "lang": "ro"},
            {"name": "Yahoo Sport",      "url": "https://sports.yahoo.com/rss/",                                                            "weight": 1.00, "lang": "en"},
        ],
    },
    "Sanatate": {
        "lang": "ro",
        "feeds": [
            {"name": "CSID",             "url": "https://www.csid.ro/rss",                                                                  "weight": 1.15, "lang": "ro"},
            {"name": "Mediafax",         "url": "https://www.mediafax.ro/sanatate/rss",                                                     "weight": 1.10, "lang": "ro"},
            {"name": "Descopera",        "url": "https://descopera.ro/sanatate/feed",                                                       "weight": 1.05, "lang": "ro"},
            {"name": "WebMD",            "url": "https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC",                             "weight": 0.95, "lang": "en"},
            {"name": "Medical News",     "url": "https://www.medicalnewstoday.com/rss/news",                                                "weight": 1.00, "lang": "en"},
            {"name": "Healthline",       "url": "https://www.healthline.com/rss/health-news",                                               "weight": 0.95, "lang": "en"},
            {"name": "Google Sanatate",  "url": "https://news.google.com/rss/headlines/section/topic/HEALTH?hl=ro&gl=RO&ceid=RO:ro",        "weight": 1.10, "lang": "ro"},
        ],
    },
    "Business": {
        "lang": "ro",
        "feeds": [
            {"name": "Ziarul Financiar", "url": "https://www.zf.ro/rss",                                                                    "weight": 1.20, "lang": "ro"},
            {"name": "Profit.ro",        "url": "https://www.profit.ro/rss",                                                                "weight": 1.18, "lang": "ro"},
            {"name": "Business Magazin", "url": "https://www.businessmagazin.ro/rss",                                                       "weight": 1.05, "lang": "ro"},
            {"name": "Economica",        "url": "https://economica.net/rss",                                                                 "weight": 1.05, "lang": "ro"},
            {"name": "Forbes Romania",   "url": "https://www.forbes.ro/feed",                                                               "weight": 1.10, "lang": "ro"},
            {"name": "Reuters Business", "url": "https://feeds.reuters.com/reuters/businessNews",                                           "weight": 1.10, "lang": "en"},
            {"name": "Google Business",  "url": "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ro&gl=RO&ceid=RO:ro",      "weight": 1.08, "lang": "ro"},
            {"name": "Yahoo Finance",    "url": "https://finance.yahoo.com/news/rssindex",                                                  "weight": 1.00, "lang": "en"},
        ],
    },
    "International": {
        "lang": "en",
        "feeds": [
            {"name": "BBC World",        "url": "http://feeds.bbci.co.uk/news/world/rss.xml",                                               "weight": 1.20},
            {"name": "Reuters Top",      "url": "https://feeds.reuters.com/reuters/topNews",                                                "weight": 1.18},
            {"name": "DW News",          "url": "https://rss.dw.com/rdf/rss-en-world",                                                     "weight": 1.05},
            {"name": "Al Jazeera",       "url": "https://www.aljazeera.com/xml/rss/all.xml",                                               "weight": 1.10},
            {"name": "Yahoo News",       "url": "https://news.yahoo.com/rss/",                                                              "weight": 1.00},
            {"name": "Google Intl",      "url": "https://news.google.com/rss/headlines/section/topic/WORLD?hl=ro&gl=RO&ceid=RO:ro",         "weight": 1.10},
            {"name": "AP News",          "url": "https://rsshub.app/apnews/topics/apf-topnews",                                             "weight": 1.05},
        ],
    },
    "Entertainment": {
        "lang": "ro",
        "feeds": [
            {"name": "SpyNews",          "url": "https://spynews.ro/feed",                                                                  "weight": 1.15, "lang": "ro"},
            {"name": "Viva",             "url": "https://www.viva.ro/rss",                                                                  "weight": 1.10, "lang": "ro"},
            {"name": "OK Magazine",      "url": "https://okmagazine.ro/feed",                                                               "weight": 1.05, "lang": "ro"},
            {"name": "Unica",            "url": "https://unica.ro/feed",                                                                    "weight": 1.05, "lang": "ro"},
            {"name": "Google Ent",       "url": "https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=ro&gl=RO&ceid=RO:ro", "weight": 1.10, "lang": "ro"},
            {"name": "Yahoo Ent",        "url": "https://www.yahoo.com/entertainment/rss",                                                  "weight": 1.00, "lang": "en"},
        ],
    },
    "Romania": {
        "lang": "ro",
        "feeds": [
            {"name": "Digi24",           "url": "https://www.digi24.ro/rss",                                                                "weight": 1.20},
            {"name": "G4Media",          "url": "https://www.g4media.ro/feed",                                                              "weight": 1.18},
            {"name": "HotNews",          "url": "https://www.hotnews.ro/rss",                                                               "weight": 1.15},
            {"name": "Libertatea",       "url": "https://www.libertatea.ro/rss",                                                            "weight": 1.10},
            {"name": "ProTV Stiri",      "url": "https://stirileprotv.ro/rss",                                                              "weight": 1.15},
            {"name": "Antena3",          "url": "https://www.antena3.ro/rss",                                                               "weight": 1.05},
            {"name": "Google Romania",   "url": "https://news.google.com/rss?hl=ro&gl=RO&ceid=RO:ro",                                       "weight": 1.12},
        ],
    },
    "Stiinta": {
        "lang": "en",
        "feeds": [
            {"name": "Science Daily",    "url": "https://www.sciencedaily.com/rss/top.xml",                                                 "weight": 1.15},
            {"name": "NASA News",        "url": "https://www.nasa.gov/rss/dyn/breaking_news.rss",                                           "weight": 1.10},
            {"name": "New Scientist",    "url": "https://www.newscientist.com/feed/home/",                                                  "weight": 1.08},
            {"name": "Descopera Ro",     "url": "https://descopera.ro/stiinta/feed",                                                        "weight": 1.10, "lang": "ro"},
            {"name": "Space.com",        "url": "https://www.space.com/feeds/all",                                                          "weight": 1.05},
            {"name": "Live Science",     "url": "https://www.livescience.com/feeds/all",                                                    "weight": 1.00},
            {"name": "Google Stiinta",   "url": "https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=ro&gl=RO&ceid=RO:ro",       "weight": 1.08, "lang": "ro"},
        ],
    },
    "Bursa & Piete": {
        "lang": "ro",
        "feeds": [
            {"name": "Ziarul Financiar", "url": "https://www.zf.ro/rss",                                                                    "weight": 1.20, "lang": "ro"},
            {"name": "Yahoo Finance",    "url": "https://finance.yahoo.com/news/rssindex",                                                  "weight": 1.18, "lang": "en"},
            {"name": "Reuters Markets",  "url": "https://feeds.reuters.com/reuters/businessNews",                                           "weight": 1.15, "lang": "en"},
            {"name": "Investing.com",    "url": "https://ro.investing.com/rss/news.rss",                                                    "weight": 1.15, "lang": "ro"},
            {"name": "Bloomberg",        "url": "https://feeds.bloomberg.com/markets/news.rss",                                             "weight": 1.20, "lang": "en"},
            {"name": "Profit.ro",        "url": "https://www.profit.ro/rss",                                                                "weight": 1.10, "lang": "ro"},
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
    "Bursa & Piete": "📈",
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
    "Bursa & Piete": ["#NEXAS", "#Bursa", "#Piete", "#Investitii", "#Finance", "#BVB"],
}

SKIP_PATTERNS = [
    r"^market update:",
    r"^stock market today:",
    r"^markets:",
    r"^\d+ stocks",
    r"^top \d+",
    r"^here('s| is) what",
    r"^what to know",
    r"^live updates?:",
]

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

def is_low_quality(title: str) -> bool:
    t = title.lower().strip()
    if len(t) < 20:
        return True
    for pattern in SKIP_PATTERNS:
        if re.match(pattern, t):
            return True
    return False

def is_english(text: str) -> bool:
    en_words = ['the','and','for','that','with','this','from','have','are','was',
                'will','been','they','their','said','more','about','which','when','also']
    words = text.lower().split()
    if not words:
        return False
    en_count = sum(1 for w in words if w in en_words)
    return en_count / len(words) > 0.08

def force_translate(item: dict, api_key: str) -> dict:
    if not api_key or genai is None:
        return item
    prompt = f"""Traduce URGENT in romana. Raspunde STRICT JSON fara markdown.
Titlu EN: {item.get('title','')}
Rezumat EN: {item.get('summary','')[:200]}
Format: {{"title":"","summary":""}}"""
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        text = re.sub(r"^```json\s*|^```\s*|\s*```$", "", (response.text or "").strip())
        data = json.loads(text)
        if data.get("title"):
            item["title"] = clean_text(data["title"])
        if data.get("summary"):
            item["summary"] = clean_text(data["summary"])
        print(f"    ↺ Re-tradus: {item['title'][:55]}")
    except Exception as e:
        print(f"    ✗ Force translate failed: {e}")
    return item

# ============================================================
# COLECTARE
# ============================================================
def collect_for_category(category: str, config: dict, target: int = 3) -> list:
    articles = []
    seen_urls = set()
    seen_titles = set()

    for feed in config["feeds"]:
        try:
            parsed = feedparser.parse(feed["url"])
        except Exception as e:
            print(f"    ✗ [{feed['name']}]: {e}")
            continue

        for entry in parsed.entries[:12]:
            title = clean_text(getattr(entry, "title", ""))
            url = getattr(entry, "link", "")
            if not title or not url or len(title) < 10:
                continue
            if is_low_quality(title):
                continue
            title_key = re.sub(r"\W+", "", title.lower())[:80]
            if url in seen_urls or title_key in seen_titles:
                continue
            seen_urls.add(url)
            seen_titles.add(title_key)

            raw = clean_text(getattr(entry, "summary", "") or getattr(entry, "description", ""))
            date = parsed_date(entry)
            score = freshness_score(date) * feed.get("weight", 1.0)
            item_lang = feed.get("lang", config.get("lang", "en"))

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
                "_lang": item_lang,
            })

    articles.sort(key=lambda x: x["_score"], reverse=True)

    final, used_sources = [], set()
    for a in articles:
        if len(final) >= target:
            break
        if a["source"] not in used_sources:
            final.append(a)
            used_sources.add(a["source"])

    if len(final) < target:
        for a in articles:
            if len(final) >= target:
                break
            if a not in final:
                final.append(a)

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
Titlu: max 90 caractere. Rezumat: max 380 caractere. Caption Instagram: max 400 caractere cu emoji.
Raspunde STRICT JSON valid, fara markdown.
Titlu: {item.get('title','')}
Rezumat: {item.get('summary','')}
Sursa: {item.get('source','')}
Format: {{"title":"","summary":"","instagram_caption":"","hashtags":[]}}"""
    else:
        prompt = f"""Traduce si rescrie in romana pentru site-ul NEXAS. Nu inventa nimic.
Titlu: max 90 caractere in romana. Rezumat: max 380 caractere in romana. Caption Instagram: max 400 caractere cu emoji.
Raspunde STRICT JSON valid, fara markdown.
Titlu: {item.get('title','')}
Rezumat: {item.get('summary','')}
Sursa: {item.get('source','')}
Categorie: {item.get('category','')}
Format: {{"title":"","summary":"","instagram_caption":"","hashtags":[]}}"""

    for attempt, model in enumerate(["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]):
        try:
            if attempt > 0:
                time.sleep(3)
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(model=model, contents=prompt)
            text = re.sub(r"^```json\s*|^```\s*|\s*```$", "", (response.text or "").strip())
            data = json.loads(text)
            item["title"] = clean_text(data.get("title") or item["title"])
            item["summary"] = clean_text(data.get("summary") or item["summary"])
            item["instagram_caption"] = clean_text(data.get("instagram_caption") or item["instagram_caption"])
            tags = data.get("hashtags")
            if isinstance(tags, list) and tags:
                item["hashtags"] = [str(t).strip() for t in tags if str(t).strip()]
            print(f"    ✓ ({model}): {item['title'][:55]}")
            time.sleep(1)
            return item
        except Exception as e:
            print(f"    ✗ {model}: {e}")
            time.sleep(4)
            continue

    print(f"    ✗ Gemini esuat: {item.get('url','')[:60]}")
    return item

# ============================================================
# MERGE + ARHIVA
# ============================================================
def load_old_items() -> list:
    if not OUT_JSON.exists():
        return []
    try:
        data = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        return data.get("items", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
    except:
        return []

def merge_items(new_items: list, old_items: list, max_per_cat: int = 30) -> list:
    seen = set(i["url"] for i in new_items if i.get("url"))
    merged = list(new_items)
    counts = {}
    for i in new_items:
        c = i.get("category", "")
        counts[c] = counts.get(c, 0) + 1
    for i in old_items:
        url, cat = i.get("url", ""), i.get("category", "")
        if not url or url in seen or counts.get(cat, 0) >= max_per_cat:
            continue
        seen.add(url)
        merged.append(i)
        counts[cat] = counts.get(cat, 0) + 1
    merged.sort(key=lambda x: x.get("date", ""), reverse=True)
    return merged

# ============================================================
# MAIN
# ============================================================
def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    run_log = {}
    all_new = []
    total_feeds = sum(len(c["feeds"]) for c in CATEGORY_FEEDS.values())

    print(f"\n{'='*55}")
    print(f"NEXAS News Agent — {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"{len(CATEGORY_FEEDS)} categorii | {total_feeds} surse RSS")
    print(f"{'='*55}")

    for category, config in CATEGORY_FEEDS.items():
        icon = CATEGORY_ICONS.get(category, "📰")
        print(f"\n{icon}  {category}")
        items = collect_for_category(category, config, target=ARTICLES_PER_CATEGORY)

        if len(items) == 0:
            print(f"   ⚠ Nicio stire gasita — categoria sarita")
            run_log[category] = 0
            continue

        rewrote = []
        api_key = os.getenv("GEMINI_API_KEY")
        for item in items:
            item.pop("_score", None)
            lang = item.pop("_lang", "en")
            item["_lang"] = lang
            item = gemini_rewrite_ro(item)
            item.pop("_lang", None)
            # Verifica daca a ramas in engleza si reincearca
            if is_english(item.get("title", "")) and api_key:
                print(f"   ⚠ Inca in engleza — retraducere...")
                time.sleep(2)
                item = force_translate(item, api_key)
            rewrote.append(item)

        all_new.extend(rewrote)
        run_log[category] = len(rewrote)
        print(f"   ✓ {len(rewrote)} stiri salvate")

    merged = merge_items(all_new, load_old_items(), max_per_cat=MAX_PER_CATEGORY)

    OUT_JSON.write_text(json.dumps({
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "run_log": run_log,
        "items": merged,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    total_new = sum(run_log.values())
    cats_ok = sum(1 for v in run_log.values() if v > 0)
    print(f"\n{'='*55}")
    print(f"✓ Categorii active: {cats_ok}/{len(CATEGORY_FEEDS)}")
    print(f"✓ Stiri noi: {total_new} | Total JSON: {len(merged)}")
    print(f"Run log: {json.dumps(run_log, ensure_ascii=False)}")
    print(f"{'='*55}\n")

if __name__ == "__main__":
    main()
