import os
import re
import json
import html
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import feedparser

try:
    from google import genai
except Exception:
    genai = None

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "stiri"
OUT_JSON = OUT_DIR / "stiri.json"

KEYWORDS = {
    "AI": ["ai", "artificial intelligence", "openai", "anthropic", "gemini", "llm", "chatgpt", "agent", "agents", "machine learning", "model"],
    "Gadgeturi": ["gadget", "phone", "laptop", "device", "wearable", "chip", "nvidia", "apple", "samsung", "hardware"],
    "Cybersecurity": ["security", "cyber", "breach", "malware", "privacy", "hack", "ransomware"],
    "Startup": ["startup", "funding", "venture", "launch", "raises", "acquisition"],
    "Automatizare": ["automation", "robot", "robotics", "workflow", "enterprise", "productivity"],
    "Tech": ["software", "platform", "cloud", "app", "internet", "developer", "api", "data"],
}

FEEDS = [
    {"name": "TechCrunch", "url": "https://techcrunch.com/feed/", "weight": 1.15},
    {"name": "The Verge", "url": "https://www.theverge.com/rss/index.xml", "weight": 1.05},
    {"name": "VentureBeat AI", "url": "https://venturebeat.com/category/ai/feed/", "weight": 1.18},
    {"name": "MIT News AI", "url": "https://news.mit.edu/topic/artificial-intelligence2-rss.xml", "weight": 1.12},
    {"name": "Google AI Blog", "url": "https://blog.google/technology/ai/rss/", "weight": 1.1},
    {"name": "OpenAI Blog", "url": "https://openai.com/news/rss.xml", "weight": 1.2},
    {"name": "Anthropic News", "url": "https://www.anthropic.com/news/rss.xml", "weight": 1.15},
    {"name": "Engadget", "url": "https://www.engadget.com/rss.xml", "weight": 0.95},
    {"name": "Ars Technica", "url": "https://feeds.arstechnica.com/arstechnica/index", "weight": 1.0},
    {"name": "ZDNET", "url": "https://www.zdnet.com/news/rss.xml", "weight": 0.95},
]


def clean_text(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def parsed_date(entry):
    if getattr(entry, "published_parsed", None):
        return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
    if getattr(entry, "updated_parsed", None):
        return datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
    return datetime.now(timezone.utc)


def detect_category(text: str) -> str:
    text_lower = text.lower()
    scores = {
        category: sum(1 for keyword in keywords if keyword in text_lower)
        for category, keywords in KEYWORDS.items()
    }
    best = max(scores, key=scores.get)
    return best if scores[best] else "Tech"


def relevance(text: str, weight: float, date: datetime) -> float:
    text_lower = text.lower()
    score = 0

    for keywords in KEYWORDS.values():
        for keyword in keywords:
            if keyword in text_lower:
                score += 3 if keyword in ["ai", "agent", "agents", "openai", "anthropic", "gemini", "robotics"] else 1

    age_hours = max((datetime.now(timezone.utc) - date).total_seconds() / 3600, 1)
    freshness = max(0, 72 - min(age_hours, 72)) / 12

    return (score + freshness) * weight


def short_summary(title: str, raw_summary: str, source: str) -> str:
    text = clean_text(raw_summary or title)
    if len(text) > 360:
        text = text[:360].rsplit(" ", 1)[0] + "..."
    return text


def hashtags(category: str):
    base = ["#NEXAS", "#AI", "#Tehnologie"]
    extra = {
        "AI": ["#InteligentaArtificiala", "#AIAgents"],
        "Gadgeturi": ["#Gadgeturi", "#TechNews"],
        "Cybersecurity": ["#Cybersecurity", "#DataProtection"],
        "Startup": ["#Startup", "#Innovation"],
        "Automatizare": ["#Automatizare", "#Digitalizare"],
        "Tech": ["#IT", "#ViitorDigital"],
    }
    return base + extra.get(category, ["#IT"])


def default_impact(category: str) -> str:
    messages = {
        "AI": "Stirea arata o schimbare concreta in zona AI, cu impact posibil asupra produselor digitale si a modului in care companiile folosesc automatizarea.",
        "Gadgeturi": "Stirea arata directia in care merg dispozitivele si tehnologia folosita zilnic de utilizatori si companii.",
        "Cybersecurity": "Stirea conteaza pentru ca securitatea datelor devine o parte importanta a infrastructurii digitale.",
        "Startup": "Stirea poate indica o directie noua de investitii sau un produs care poate creste in piata tech.",
        "Automatizare": "Stirea arata cum procesele digitale pot reduce munca manuala si pot schimba modul de lucru in companii.",
        "Tech": "Stirea ajuta la intelegerea unui trend care poate influenta software-ul, site-urile si serviciile digitale.",
    }
    return messages.get(category, messages["Tech"])


def image_prompt(title: str, category: str) -> str:
    return (
        f"Premium futuristic editorial image about {category}: {title}. "
        "Dark technology atmosphere, glass interface, neon blue and violet accents, no readable text, no logos."
    )


def parse_json_from_text(text: str) -> dict:
    text = (text or "").strip()
    text = re.sub(r"^```json\s*", "", text)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def gemini_rewrite_ro(item: dict) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key or genai is None:
        print("Gemini skipped: GEMINI_API_KEY lipseste sau google-genai nu este instalat.")
        item["why_it_matters"] = default_impact(item.get("category", "Tech"))
        return item

    prompt = f"""
Rescrie stirea de mai jos in limba romana pentru site-ul NEXAS.

Reguli stricte:
- Nu copia articolul original.
- Nu inventa date, cifre sau promisiuni.
- Pastreaza sensul stirii.
- Titlul trebuie sa fie in romana, clar, maximum 95 caractere.
- Rezumatul trebuie sa fie in romana, maximum 420 caractere.
- Impactul trebuie sa fie concret si legat direct de aceasta stire.
- Captionul Instagram trebuie sa fie scurt, in romana, maximum 450 caractere.
- Hashtagurile trebuie sa fie fara diacritice.
- Raspunde strict JSON valid. Fara markdown. Fara explicatii.

Stire:
Titlu original: {item.get('title', '')}
Rezumat original: {item.get('summary', '')}
Sursa: {item.get('source', '')}
Categorie: {item.get('category', '')}
URL: {item.get('url', '')}

Format JSON:
{{
  "title": "",
  "summary": "",
  "why_it_matters": "",
  "instagram_caption": "",
  "hashtags": []
}}
"""

    models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]

    for model_name in models_to_try:
        try:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )

            data = parse_json_from_text(response.text)

            item["title"] = clean_text(data.get("title") or item.get("title", ""))
            item["summary"] = clean_text(data.get("summary") or item.get("summary", ""))
            item["why_it_matters"] = clean_text(data.get("why_it_matters") or default_impact(item.get("category", "Tech")))
            item["instagram_caption"] = clean_text(data.get("instagram_caption") or item.get("instagram_caption", ""))

            new_hashtags = data.get("hashtags")
            if isinstance(new_hashtags, list) and new_hashtags:
                item["hashtags"] = [str(tag).strip() for tag in new_hashtags if str(tag).strip()]

            print(f"Gemini ({model_name}) rewrite OK: {item.get('title', '')[:60]}")
            return item

        except Exception as error:
            print(f"Gemini {model_name} failed: {error}")
            continue

    print(f"Toate modelele Gemini au esuat pentru: {item.get('url', '')}")
    item["why_it_matters"] = default_impact(item.get("category", "Tech"))
    return item


def collect_articles():
    articles = []
    seen_urls = set()
    seen_titles = set()

    for feed in FEEDS:
        try:
            parsed = feedparser.parse(feed["url"])
        except Exception as error:
            print(f"Feed failed {feed['name']}: {error}")
            continue

        for entry in parsed.entries[:14]:
            title = clean_text(getattr(entry, "title", ""))
            url = getattr(entry, "link", "")

            if not title or not url:
                continue

            domain = urlparse(url).netloc.replace("www.", "")
            title_key = re.sub(r"\W+", "", title.lower())[:90]

            if url in seen_urls or title_key in seen_titles:
                continue

            seen_urls.add(url)
            seen_titles.add(title_key)

            raw_summary = clean_text(getattr(entry, "summary", "") or getattr(entry, "description", ""))
            date = parsed_date(entry)
            text = f"{title} {raw_summary}"
            category = detect_category(text)
            score = relevance(text, feed.get("weight", 1), date)

            if score < 2.5:
                continue

            articles.append({
                "title": title,
                "source": feed["name"],
                "url": url,
                "domain": domain,
                "date": date.isoformat(),
                "category": category,
                "summary": short_summary(title, raw_summary, feed["name"]),
                "why_it_matters": default_impact(category),
                "instagram_caption": f"{title}\n\nCiteste selectia pe nexas.ro/stiri/",
                "hashtags": hashtags(category),
                "image": "",
                "image_prompt": image_prompt(title, category),
                "_score": score,
            })

    articles.sort(key=lambda item: item["_score"], reverse=True)

    selected = []
    used_sources = set()

    for article in articles:
        if article["source"] in used_sources and len(selected) < 2:
            continue

        selected.append(article)
        used_sources.add(article["source"])

        if len(selected) == 3:
            break

    return selected


def fallback_items():
    return [{
        "title": "Nu au fost gasite stiri noi la ultima rulare",
        "source": "NEXAS Agent",
        "url": "https://www.nexas.ro/stiri/",
        "date": datetime.now(timezone.utc).isoformat(),
        "category": "AI",
        "summary": "Agentul a rulat, dar sursele nu au returnat suficiente rezultate relevante. Verifica logurile din GitHub Actions.",
        "why_it_matters": "Fallback-ul pastreaza pagina functionala pana la urmatoarea rulare.",
        "instagram_caption": "Agentul NEXAS nu a gasit suficiente stiri noi la ultima rulare.",
        "hashtags": ["#NEXAS", "#AI", "#Tehnologie"],
        "image": "",
        "image_prompt": "Premium futuristic AI news control room, no readable text",
    }]


def load_old_items():
    if not OUT_JSON.exists():
        return []

    try:
        old_payload = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        if isinstance(old_payload, dict):
            return old_payload.get("items", []) or []
        if isinstance(old_payload, list):
            return old_payload
    except Exception as error:
        print(f"Nu pot citi stirile vechi: {error}")

    return []


def merge_items(new_items, old_items, limit=60):
    merged = []
    seen_urls = set()

    for item in new_items + old_items:
        url = item.get("url", "")
        if not url or url in seen_urls:
            continue

        seen_urls.add(url)
        merged.append(item)

    return merged[:limit]


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    new_items = collect_articles() or fallback_items()
    clean_items = []

    for item in new_items[:3]:
        item.pop("_score", None)
        item.pop("domain", None)
        item = gemini_rewrite_ro(item)
        clean_items.append(item)

    old_items = load_old_items()
    merged = merge_items(clean_items, old_items, limit=60)

    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "items": merged,
    }

    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_JSON} with {len(merged)} items. New items: {len(clean_items)}")


if __name__ == "__main__":
    main()
