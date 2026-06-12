(function () {
  const STORAGE_KEY = "nexas_cookie_consent";
  const GA_ID = "G-YTY08X40FV";
  const CONSENT_VERSION = 2;

  /* ── Stocare consimtamant ──
     Format nou: {"v":2,"analytics":true|false,"ts":"ISO date"}
     Format vechi (compatibilitate): "accepted" / "rejected"            */

  function readConsent() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
    if (!raw) return null;
    if (raw === "accepted") return { v: 1, analytics: true };
    if (raw === "rejected") return { v: 1, analytics: false };
    try {
      const data = JSON.parse(raw);
      if (data && typeof data.analytics === "boolean") return data;
    } catch (e) {}
    return null;
  }

  function saveConsent(analytics) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ v: CONSENT_VERSION, analytics: !!analytics, ts: new Date().toISOString() })
      );
    } catch (e) {}
  }

  /* ── Google Analytics: incarcat DOAR dupa consimtamant ── */

  function loadGoogleAnalytics() {
    if (window.__nexasAnalyticsLoaded) return;
    window.__nexasAnalyticsLoaded = true;
    window["ga-disable-" + GA_ID] = false;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      dataLayer.push(arguments);
    }

    window.gtag = gtag;

    gtag("js", new Date());
    gtag("config", GA_ID, {
      anonymize_ip: true
    });
  }

  /* ── Retragere consimtamant: opreste GA si sterge cookie-urile lui ── */

  function disableAnalytics() {
    window["ga-disable-" + GA_ID] = true;
    const domains = ["", location.hostname, "." + location.hostname.replace(/^www\./, "")];
    document.cookie.split(";").forEach(function (c) {
      const name = c.split("=")[0].trim();
      if (/^(_ga|_gid|_gat)/.test(name)) {
        domains.forEach(function (d) {
          document.cookie =
            name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + (d ? "; domain=" + d : "");
        });
      }
    });
  }

  function applyConsent(analytics) {
    saveConsent(analytics);
    if (analytics) {
      loadGoogleAnalytics();
    } else {
      disableAnalytics();
    }
  }

  /* ── Banner ── */

  function removeBanner() {
    const el = document.getElementById("nexas-cookie-banner");
    if (el) el.remove();
  }

  function createBanner(opts) {
    opts = opts || {};
    removeBanner();

    const existing = readConsent();
    const analyticsChecked = existing ? !!existing.analytics : false;

    const banner = document.createElement("div");
    banner.id = "nexas-cookie-banner";

    banner.innerHTML = `
      <div class="nexas-cookie-box" role="dialog" aria-modal="false" aria-label="Setari cookie-uri">
        <div class="nexas-cookie-text">
          <strong>Folosim cookie-uri</strong>
          <p>
            Folosim cookie-uri esentiale pentru functionarea site-ului si, doar cu acordul tau,
            cookie-uri de analiza pentru imbunatatirea experientei. Iti poti retrage acordul oricand.
          </p>
          <a href="/cookies.html">Politica de cookies</a>

          <div class="nexas-cookie-prefs" id="nexas-cookie-prefs" hidden>
            <label class="nexas-cookie-pref">
              <input type="checkbox" checked disabled />
              <span><strong>Esentiale</strong> — necesare functionarii site-ului (mereu active)</span>
            </label>
            <label class="nexas-cookie-pref">
              <input type="checkbox" id="nexas-pref-analytics" ${analyticsChecked ? "checked" : ""} />
              <span><strong>Analiza</strong> — Google Analytics (trafic anonimizat)</span>
            </label>
          </div>
        </div>

        <div class="nexas-cookie-actions">
          <button type="button" id="nexas-cookie-settings">Setari</button>
          <button type="button" id="nexas-cookie-reject">Respinge</button>
          <button type="button" id="nexas-cookie-accept">Accepta</button>
        </div>
      </div>
    `;

    if (!document.getElementById("nexas-cookie-style")) {
      const style = document.createElement("style");
      style.id = "nexas-cookie-style";
      style.innerHTML = `
      #nexas-cookie-banner {
        position: fixed;
        left: 16px;
        right: 16px;
        bottom: 16px;
        z-index: 99999;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .nexas-cookie-box {
        max-width: 980px;
        margin: 0 auto;
        padding: 18px;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 18px;
        background: rgba(10,10,18,.94);
        color: #fff;
        box-shadow: 0 20px 60px rgba(0,0,0,.45);
        display: flex;
        gap: 18px;
        align-items: center;
        justify-content: space-between;
        backdrop-filter: blur(18px);
      }

      .nexas-cookie-text strong {
        display: block;
        font-size: 16px;
        margin-bottom: 6px;
      }

      .nexas-cookie-text p {
        margin: 0 0 8px;
        font-size: 14px;
        line-height: 1.5;
        color: rgba(255,255,255,.78);
      }

      .nexas-cookie-text a {
        color: #b784ff;
        font-size: 14px;
        text-decoration: none;
      }

      .nexas-cookie-prefs {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(255,255,255,.12);
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .nexas-cookie-pref {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 13px;
        line-height: 1.45;
        color: rgba(255,255,255,.78);
        cursor: pointer;
      }

      .nexas-cookie-pref strong {
        display: inline;
        font-size: 13px;
        margin: 0;
      }

      .nexas-cookie-pref input {
        margin-top: 2px;
        accent-color: #7c3cff;
      }

      .nexas-cookie-actions {
        display: flex;
        gap: 10px;
        flex-shrink: 0;
      }

      .nexas-cookie-actions button {
        border: 0;
        cursor: pointer;
        border-radius: 999px;
        padding: 11px 18px;
        font-weight: 700;
        font-size: 14px;
      }

      #nexas-cookie-settings {
        background: transparent;
        color: rgba(255,255,255,.75);
        border: 1px solid rgba(255,255,255,.18);
      }

      #nexas-cookie-reject {
        background: rgba(255,255,255,.10);
        color: #fff;
      }

      #nexas-cookie-accept {
        background: linear-gradient(135deg, #7c3cff, #c084fc);
        color: #fff;
      }

      @media (max-width: 720px) {
        .nexas-cookie-box {
          flex-direction: column;
          align-items: flex-start;
        }

        .nexas-cookie-actions {
          width: 100%;
        }

        .nexas-cookie-actions button {
          width: 100%;
        }
      }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(banner);

    const prefs = document.getElementById("nexas-cookie-prefs");
    if (opts.openSettings) prefs.hidden = false;

    document.getElementById("nexas-cookie-settings").addEventListener("click", function () {
      prefs.hidden = !prefs.hidden;
    });

    document.getElementById("nexas-cookie-accept").addEventListener("click", function () {
      // Daca panoul de setari e deschis, "Accepta" salveaza alegerea din panou;
      // altfel accepta tot.
      const analytics = prefs.hidden
        ? true
        : document.getElementById("nexas-pref-analytics").checked;
      applyConsent(analytics);
      removeBanner();
    });

    document.getElementById("nexas-cookie-reject").addEventListener("click", function () {
      applyConsent(false);
      removeBanner();
    });
  }

  /* ── API public: redeschide setarile de oriunde (ex. pagina de cookies) ── */

  window.nexasCookieSettings = function () {
    createBanner({ openSettings: true });
  };

  window.nexasWithdrawConsent = function () {
    applyConsent(false);
    removeBanner();
  };

  function initConsent() {
    const consent = readConsent();

    if (consent) {
      if (consent.analytics) {
        loadGoogleAnalytics();
      } else {
        disableAnalytics();
      }
      // Lega automat orice element cu data-cookie-settings de panoul de setari
      bindSettingsLinks();
      return;
    }

    createBanner();
    bindSettingsLinks();
  }

  function bindSettingsLinks() {
    document.querySelectorAll("[data-cookie-settings]").forEach(function (el) {
      if (el.__nexasBound) return;
      el.__nexasBound = true;
      el.addEventListener("click", function (e) {
        e.preventDefault();
        window.nexasCookieSettings();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initConsent);
  } else {
    initConsent();
  }
})();
