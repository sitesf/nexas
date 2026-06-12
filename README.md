# NEXAS.RO — site static (GitHub Pages)

Site de prezentare NEXAS, găzduit pe **GitHub Pages** (domeniu custom `nexas.ro`, vezi `CNAME`).
Nu există backend / server propriu — totul este HTML/CSS/JS static, publicat automat din branch-ul `main`.

---

## ⚠️ PRIMUL LUCRU DE FĂCUT: SCHIMBĂ PAROLA DE ADMIN

Panoul de administrare (`/admin/`) este livrat cu un cont inițial:

- **utilizator:** `admin`
- **parolă:** `SchimbaParola123!`

Această parolă este **publică** (apare în istoricul git și în acest README).
**Schimb-o imediat după primul login**, din secțiunea „Schimbă parola" a panoului.
Folosește o parolă lungă (12+ caractere), unică, cu litere mari/mici, cifre și simboluri.

---

## Cum pornești proiectul

Local (pentru testare):

```bash
# din rădăcina proiectului
python3 -m http.server 8000
# apoi deschide http://localhost:8000
```

> Deschiderea fișierelor direct cu `file://` nu funcționează corect (fetch-urile către
> `posts.json`, `stiri.json` etc. au nevoie de un server HTTP).

În producție: orice push pe `main` este publicat automat de GitHub Pages în 1–2 minute.

## Cum intri în admin

1. Deschide `https://nexas.ro/admin/` (local: `http://localhost:8000/admin/`).
2. Loghează-te cu utilizatorul și parola de admin.
3. Pentru a putea **salva** (postări, parolă), adaugă un **token GitHub**:
   - GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token
   - Repository access: **doar acest repo**
   - Permissions → Repository permissions → **Contents: Read and write** (atât)
   - Lipește token-ul în panou. Poți bifa „Ține minte token-ul" — este salvat **criptat
     cu parola ta (AES-GCM)** doar în browserul respectiv.

### De ce e nevoie de token? (important de înțeles)

Site-ul e static, fără server. Orice „login" pur client-side poate fi ocolit de cineva
care citește codul — de aceea **scrierea** datelor se face exclusiv prin GitHub API, cu
token-ul tău personal, care **nu este stocat nicăieri în site sau în repo**. Parola de
admin protejează interfața, blochează încercările repetate și criptează token-ul memorat
local. Fără token GitHub valid, nimeni nu poate modifica site-ul, indiferent de parolă.

## Cum schimbi parola

Admin → secțiunea **„Schimbă parola"** → introduci parola veche + parola nouă (de două ori).
Noul hash (PBKDF2-SHA256, 600.000 iterații + salt nou) este scris în `admin/config.json`
prin GitHub API. După ce GitHub Pages publică modificarea (~1–2 min), folosește parola nouă.

## Cum adaugi o postare

1. Admin → **„+ Postare nouă"**.
2. Completezi: titlu, descriere scurtă, conținut (text simplu, paragrafe separate prin linie
   goală), imagine opțională (png/jpg/webp/gif, max 2 MB), dată, status **Publicat / Ciornă**.
3. **Salvează postarea** → datele ajung în `blog/posts.json` (+ imaginea în `blog/uploads/`),
   iar pagina publică **`/blog/`** se actualizează automat în 1–2 minute.

Editare / ștergere: din lista de postări, butoanele **Editează** / **Șterge**.

## Cum verifici că bannerul de cookies funcționează

1. Deschide site-ul într-o fereastră **incognito** (sau șterge datele site-ului).
2. Bannerul apare jos, cu **Setări / Respinge / Acceptă**.
3. Deschide DevTools → Network: înainte de orice click, **nu** trebuie să existe vreo
   cerere către `googletagmanager.com`.
4. Apasă **Acceptă** → scriptul Google Analytics se încarcă (apare în Network).
5. Apasă **Setări** → poți debifa „Analiză" individual.
6. Retragere: pagina `/cookies.html` → butonul **„Retrage consimțământul"** — GA este
   dezactivat imediat și cookie-urile `_ga*` sunt șterse.
7. Preferința este reținută în `localStorage` sub cheia `nexas_cookie_consent`.

---

## Structura relevantă

| Cale | Rol |
|---|---|
| `index.html`, `servicii.html`, `contact.html`, … | paginile site-ului |
| `privacy.html`, `cookies.html`, `termeni.html` | pagini legale (GDPR / ePrivacy) |
| `assets/nexas-consent.js` | banner cookies + consimțământ + retragere |
| `admin/` | panou administrare (login, CRUD postări, schimbare parolă) |
| `admin/config.json` | user + hash PBKDF2 al parolei (NU parola în clar) |
| `blog/` | pagina publică de postări + `posts.json` + `uploads/` |
| `stiri/` | știri agregate automat (workflow GitHub Actions) |
| `chatbot/` | chatbot Alex (cheia API stă într-un proxy Apps Script, nu în client) |

---

## Raport securitate (audit 2026-06-12)

**Găsite și remediate:**
- Lipsa headerelor de securitate → adăugate meta-taguri `Content-Security-Policy`
  (`object-src 'none'; base-uri 'self'`) și `Referrer-Policy` pe toate paginile;
  panoul `/admin/` are un CSP strict complet (`default-src 'self'`, conexiuni doar
  către `api.github.com`).
- Linkuri legale moarte (`href="#"`) în footer-ul `reparatii.html` → corectate.
- `robots.txt` → `/admin/` exclus de la indexare; pagina are și `noindex, nofollow`.
- Panoul admin: parolă **hashuită** (PBKDF2-SHA256, 600k iterații, salt aleator),
  comparație constant-time, **blocare progresivă brute-force** (după 5 eșecuri: 30s,
  apoi dublare până la 1h), sesiune cu expirare 30 min + logout, token GitHub ținut
  doar în browser (sessionStorage sau criptat AES-GCM cu parola).
- Blogul public tratează conținutul postărilor strict ca **text** (`textContent`),
  nu HTML → fără risc XSS din postări; imaginile sunt acceptate doar din
  `/blog/uploads/`; upload validat (tip + max 2 MB).

**Verificate — fără probleme:**
- XSS în `stiri/app.js` și `chatbot/nexas-agent.js`: conținutul extern este escapat
  (`escapeHtml`) sau redat cu `textContent`. ✔
- SQL Injection / CSRF: nu se aplică (nu există bază de date sau sesiuni pe server). ✔
- Chei API: cheia Gemini e în GitHub Secrets; cheia Anthropic a chatbotului stă în
  spatele unui proxy Google Apps Script (nu în client); cheia publică EmailJS este
  publică prin design. ✔ Nicio parolă hardcodată (în afara celei inițiale de admin,
  documentată mai sus).
- Erori afișate public, upload nesecurizat pe server, fișiere sensibile: nu se aplică
  pe hosting static. ✔

**Limitări care NU se pot rezolva pe GitHub Pages (acțiune manuală):**
1. **Headere HTTP reale** (`X-Frame-Options`, `X-Content-Type-Options`,
   `Permissions-Policy`, CSP complet cu `frame-ancestors`) nu pot fi setate pe GitHub
   Pages. Soluție: pune **Cloudflare** (gratuit) în fața domeniului și setează headerele
   din *Transform Rules → Response headers*, sau mută hostingul pe Netlify/Cloudflare
   Pages care suportă fișier `_headers`.
2. **Rate limiting pe rețea** nu există pe static hosting — blocarea brute-force din
   admin este client-side (best effort); protecția reală este token-ul GitHub.
3. **Proxy-ul chatbotului** (Apps Script) este un URL public — recomandat să aibă în
   spate rate-limiting și un plafon de cost pe cheia Anthropic.

## Raport legal GDPR / ePrivacy (audit 2026-06-12)

**Existau deja (corecte):** politica de confidențialitate (operator, scopuri, temeiuri
art. 6, drepturi art. 15–21, retenție, transferuri SCC, mențiunea „nu vindem datele",
ANSPDCP), politica de cookies cu tabel, termeni și condiții, checkbox GDPR pe formularul
de contact, GA încărcat **doar** după consimțământ, fonturi locale pe paginile principale.

**Lipseau — adăugate acum:**
- Buton **„Setări"** în bannerul de cookies (granularitate pe categorii) — cerință CJUE/ANSPDCP.
- **Retragerea consimțământului** la fel de ușor cum a fost dat: butoane în `/cookies.html`
  + link „Setări cookies" în footer; la retragere GA e oprit și cookie-urile `_ga*` șterse.
- Bannerul de consimțământ lipsea pe `demo.html`, `reparatii.html`, `stiri/index.html`,
  `cookies.html` → adăugat.
- Linkuri legale funcționale în footer-ul `reparatii.html` (erau `#`).
- Placeholder vizibil pentru **CUI / Nr. Reg. Com.** în `privacy.html`.

**De completat manual (nu inventez date legale):**
1. `privacy.html` — completează **CUI** și **J__/____/____** reale (marcate cu `[►COMPLETEAZĂ...]`).
2. `reparatii.html` — footer-ul conține `CUI: RO00000000` (placeholder) și un număr
   WhatsApp `40700000000` (placeholder) — înlocuiește-le cu datele reale sau șterge-le.
3. `reparatii.html` și `demo.html` încarcă **Google Fonts de pe serverele Google**
   (IP-ul vizitatorului ajunge la Google înainte de consimțământ — speță cunoscută,
   LG München 2022). Restul site-ului folosește fonturi locale. Recomandat: descarcă
   fonturile (Inter, Space Grotesk, DM Sans) în `/fonts/` și înlocuiește `<link>`-urile.
   Nu am făcut schimbarea automat ca să nu risc modificarea aspectului.
4. Dacă activezi vreodată Meta Pixel sau alte trackere, adaugă-le în `cookies.html`
   și încarcă-le doar după consimțământ (prin `assets/nexas-consent.js`).
