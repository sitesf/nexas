# NEXAS Stiri AI si Tech

Pagina publica: `https://www.nexas.ro/stiri/`

## Cum functioneaza

- `stiri/index.html` afiseaza stirile.
- `stiri/app.js` citeste datele din `stiri/stiri.json`.
- `scripts/update_stiri.py` citeste surse RSS si alege top 3 stiri.
- `.github/workflows/update-stiri.yml` ruleaza zilnic si actualizeaza JSON-ul.

## Test local

```bash
pip install -r requirements.txt
python scripts/update_stiri.py
```

Apoi deschizi `stiri/index.html` sau publici repository-ul pe GitHub Pages.

## Instagram

Etapa 1 nu posteaza automat pe Instagram. Scriptul pregateste deja campurile `instagram_caption`, `hashtags` si `image_prompt` in `stiri.json`.
