=========================================
  NEXAS AI AGENT — Setup Guide v1.0
=========================================

FISIERE INCLUSE:
  nexas-agent.js      → Widgetul principal (tot codul)
  demo.html           → Pagina de test local
  embed-example.html  → Exemplu de integrare pe orice site
  README.txt          → Acest fisier

-----------------------------------------
SETUP IN 3 PASI
-----------------------------------------

PAS 1 — Obtine API Key Anthropic
  → Mergi pe: https://console.anthropic.com
  → Creaza cont (sau logheaza-te)
  → Settings → API Keys → Create Key
  → Copiaza cheia (arata asa: sk-ant-api03-...)

PAS 2 — Configureaza nexas-agent.js
  Deschide fisierul nexas-agent.js intr-un editor text (Notepad, VS Code)
  Cauta aceasta sectiune la inceputul fisierului:

    const CONFIG = {
      API_KEY: "PUNE_API_KEY_AICI",      ← inlocuieste cu cheia ta
      WHATSAPP: "40712345678",           ← inlocuieste cu numarul tau
      ...
    };

  Salveaza fisierul.

PAS 3 — Adauga pe site
  Incarca nexas-agent.js in folderul site-ului tau (ex: /assets/js/)
  Adauga o singura linie inainte de </body> in orice pagina HTML:

    <script src="/assets/js/nexas-agent.js"></script>

  Gata! Widgetul apare automat in coltul din dreapta jos.

-----------------------------------------
TEST LOCAL (fara server)
-----------------------------------------
  Deschide demo.html direct in browser.
  ATENTIE: unele browsere blocheaza fetch() in fisiere locale.
  Recomandat: foloseste extensia "Live Server" in VS Code
  sau testeaza direct pe site dupa upload.

-----------------------------------------
PERSONALIZARE
-----------------------------------------
  In sectiunea CONFIG din nexas-agent.js poti schimba:
  
  AGENT_NAME    → Numele agentului (default: Alex)
  AGENCY_NAME   → Numele agentiei (default: Nexas)
  WHATSAPP      → Numarul de WhatsApp (format international, fara +)
  PRIMARY_COLOR → Culoarea principala a widgetului (hex)
  ACCENT_COLOR  → Culoarea de accent

  Informatiile despre servicii si preturi se configureaza
  in variabila SYSTEM_PROMPT din acelasi fisier.

-----------------------------------------
COSTURI ESTIMATIVE
-----------------------------------------
  Modelul folosit: claude-sonnet-4 (Anthropic)
  Cost mediu per conversatie: ~0.01–0.03 USD
  Pentru 100 conversatii/luna: ~1–3 USD
  Pentru 500 conversatii/luna: ~5–15 USD
  
  ⚠ IMPORTANT — SECURITATE API KEY:
  Cheia API este vizibila in codul sursa al paginii.
  Pentru productie la volum mare, recomandam un proxy server
  (Google Apps Script Web App) care ascunde cheia.
  Contactati Nexas pentru implementare proxy.

-----------------------------------------
SUPORT
-----------------------------------------
  WhatsApp: +40 712 345 678
  Web: https://nexas.ro

=========================================
