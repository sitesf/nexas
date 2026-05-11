import os
import re
import json
import html
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import feedparser

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "stiri"
ASSET_DIR = OUT_DIR / "assets" / "generated"
OUT_JSON = OUT_DIR / "stiri.json"

KEYWORDS = {
    "AI": ["ai", "artificial intelligence", "openai", "anthropic", "gemini", "llm", "chatgpt", "agent", "agents", "machine learning", "model"],
    "Gadgeturi": ["gadget", "phone", "laptop", "device", "wearable", "chip", "nvidia", "apple", "samsung", "hardware"],
    "Cybersecurity": ["security", "cyber", "breach", "malware", "privacy", "hack", "ransomware"],
    "Startup": ["startup", "funding", "venture", "launch", "raises", "acquisition"],
    "Automatizare": ["automation", "robot", "robotics", "workflow", "enterprise", "productivity"],
    "Tech": ["software", "platform", "cloud", "app", "internet", "developer", "api", "data"]
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
    {"name": "ZDNET", "url": "https://www.zdnet.com/news/rss.xml", "weight": 0.95}
]

STOP_WORDS = {"the", "and", "with", "for", "this", "that", "from", "into", "your", "about", "after", "before", "new", "how", "are", "you"}


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
    t = text.lower()
    scores = {cat: sum(1 for kw in kws if kw in t) for cat, kws in KEYWORDS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] else "Tech"


def relevance(text: str, weight: float, date: datetime) -> float:
    t = text.lower()
    score = 0
    for kws in KEYWORDS.values():
        for kw in kws:
            if kw in t:
                score += 3 if kw in ["ai", "agent", "agents", "openai", "anthropic", "gemini", "robotics"] else 1
    age_hours = max((datetime.now(timezone.utc) - date).total_seconds() / 3600, 1)
    freshness = max(0, 48 - min(age_hours, 48)) / 12
    return (score + freshness) * weight


def short_summary(title: str, raw_summary: str, source: str) -> str:
    def romanian_title(title: str) -> str:
    replacements = {
        "AI": "AI",
        "artificial intelligence": "inteligenta artificiala",
        "Artificial intelligence": "Inteligenta artificiala",
        "startup": "startup",
        "launches": "lanseaza",
        "launch": "lansare",
        "new": "nou",
        "New": "Nou",
        "app": "aplicatie",
        "robot": "robot",
        "robots": "roboti",
        "agent": "agent",
        "agents": "agenti",
        "model": "model",
        "models": "modele",
        "Google": "Google",
        "OpenAI": "OpenAI",
        "Anthropic": "Anthropic",
        "Microsoft": "Microsoft",
        "Apple": "Apple",
        "Meta": "Meta",
        "Nvidia": "Nvidia"
    }

    result = title
    for old, new in replacements.items():
        result = result.replace(old, new)

    return result


def romanian_social_text(title: str, category: str) -> str:
    return (
        f"{romanian_title(title)}\n\n"
        f"Stire importanta din zona {category}. "
        f"Aceasta noutate arata cum evolueaza tehnologia si cum poate influenta produsele digitale, "
        f"automatizarile si agentii AI.\n\n"
        f"Citeste selectia pe nexas.ro/stiri/"
    )
    base = raw_summary or title
    base = clean_text(base)
    if len(base) > 260:
        base = base[:257].rsplit(" ", 1)[0] + "..."
    return f"{base} Sursa {source} indica o schimbare relevanta pentru zona AI si tehnologie."


def why_it_matters(category: str) -> str:
    messages = {
        "AI": "Poate influenta modul in care companiile folosesc agenti AI, automatizari si modele generative.",
        "Gadgeturi": "Arata directia in care merg dispozitivele folosite zilnic de utilizatori si firme.",
        "Cybersecurity": "Afecteaza siguranta datelor, aplicatiilor si infrastructurii digitale.",
        "Startup": "Poate semnala o piata noua, un produs nou sau o investitie importanta in tehnologie.",
        "Automatizare": "Poate reduce munca manuala si poate schimba procesele din companii.",
        "Tech": "Ajuta la intelegerea trendurilor care pot afecta produse, site-uri si servicii digitale."
    }
    return messages.get(category, messages["Tech"])


def hashtags(category: str):
    base = ["#NEXAS", "#AI", "#Tehnologie"]
    extra = {
        "AI": ["#InteligentaArtificiala", "#AIAgents"],
        "Gadgeturi": ["#Gadgeturi", "#TechNews"],
        "Cybersecurity": ["#Cybersecurity", "#DataProtection"],
        "Startup": ["#Startup", "#Innovation"],
        "Automatizare": ["#Automatizare", "#Digitalizare"],
        "Tech": ["#IT", "#ViitorDigital"]
    }
    return base + extra.get(category, ["#IT"])


def image_prompt(title: str, category: str) -> str:
    return f"Premium futuristic editorial image about {category}: {title}. Dark technology atmosphere, glass interface, neon blue and violet accents, no readable text, no logos."


def make_svg(article, path: Path):
    safe_title = clean_text(article["title"])[:70]
    category = article.get("category", "Tech")
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#5dd7ff"/><stop offset=".55" stop-color="#9b6cff"/><stop offset="1" stop-color="#ff4fd8"/></linearGradient>
    <radialGradient id="r" cx="54%" cy="44%" r="54%"><stop stop-color="#5dd7ff" stop-opacity=".34"/><stop offset=".42" stop-color="#9b6cff" stop-opacity=".16"/><stop offset="1" stop-color="#05060b" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1280" height="800" fill="#05060b"/>
  <rect width="1280" height="800" fill="url(#r)"/>
  <g opacity=".26" stroke="#fff"><path d="M0 620 C260 520 420 260 720 390 S1020 550 1280 240" fill="none"/><path d="M0 220 C300 360 420 510 720 400 S1040 130 1280 350" fill="none"/></g>
  <circle cx="660" cy="394" r="190" fill="none" stroke="url(#g)" stroke-width="2" opacity=".88"/>
  <circle cx="660" cy="394" r="116" fill="none" stroke="#5dd7ff" stroke-width="2" opacity=".55"/>
  <circle cx="660" cy="394" r="54" fill="url(#g)" opacity=".8"/>
  <g fill="#fff" opacity=".72"><circle cx="350" cy="520" r="5"/><circle cx="510" cy="314" r="4"/><circle cx="822" cy="518" r="5"/><circle cx="1015" cy="276" r="4"/></g>
  <text x="70" y="95" fill="#fff" font-family="Arial, sans-serif" font-size="38" font-weight="800">NEXAS NEWS</text>
  <text x="70" y="144" fill="#5dd7ff" font-family="Arial, sans-serif" font-size="24" font-weight="700">{html.escape(category.upper())}</text>
  <text x="70" y="690" fill="#dfe7ff" font-family="Arial, sans-serif" font-size="30" font-weight="700">{html.escape(safe_title)}</text>
</svg>'''
    path.write_text(svg, encoding="utf-8")


def collect_articles():
    articles = []
    seen = set()
    for feed in FEEDS:
        parsed = feedparser.parse(feed["url"])
        for entry in parsed.entries[:12]:
            title = clean_text(getattr(entry, "title", ""))
            url = getattr(entry, "link", "")
            if not title or not url:
                continue
            key = re.sub(r"\W+", "", title.lower())[:90]
            domain = urlparse(url).netloc.replace("www.", "")
            if key in seen or domain in seen:
                continue
            seen.add(key)
            summary = clean_text(getattr(entry, "summary", "") or getattr(entry, "description", ""))
            date = parsed_date(entry)
            text = f"{title} {summary}"
            cat = detect_category(text)
            score = relevance(text, feed.get("weight", 1), date)
            if score < 2.5:
                continue
            articles.append({
             "title": romanian_title(title),
                "source": feed["name"],
                "url": url,
                "date": date.isoformat(),
                "category": cat,
                "summary": short_summary(title, summary, feed["name"]),
                "why_it_matters": why_it_matters(cat),
                "instagram_caption": f"{title}\n\n{why_it_matters(cat)}\n\nCiteste selectia pe nexas.ro/stiri/",
                "hashtags": hashtags(cat),
                "image_prompt": image_prompt(title, cat),
                "_score": score
            })
    articles.sort(key=lambda x: x["_score"], reverse=True)
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
    return [
        {
            "title": "Nu au fost gasite stiri noi la ultima rulare",
            "source": "NEXAS Agent",
            "url": "https://www.nexas.ro/stiri/",
            "date": datetime.now(timezone.utc).isoformat(),
            "category": "AI",
            "summary": "Agentul a rulat, dar sursele nu au returnat suficiente rezultate relevante. Verifica logurile din GitHub Actions.",
            "why_it_matters": "Fallback-ul pastreaza pagina functionala pana la urmatoarea rulare.",
            "instagram_caption": "Agentul NEXAS nu a gasit suficiente stiri noi la ultima rulare.",
            "hashtags": ["#NEXAS", "#AI", "#Tehnologie"],
            "image_prompt": "Premium futuristic AI news control room, no readable text"
        }
    ]


def main():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    items = collect_articles() or fallback_items()
    clean_items = []
    for item in items[:3]:
        item.pop("_score", None)
        slug = hashlib.sha1(item["url"].encode("utf-8")).hexdigest()[:12]
        svg_path = ASSET_DIR / f"news-{slug}.svg"
        make_svg(item, svg_path)
        item["image"] = f"assets/generated/{svg_path.name}"
        clean_items.append(item)

    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "items": clean_items
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_JSON} with {len(clean_items)} items")


if __name__ == "__main__":
    main()
