(function () {
  const STORAGE_KEY = "nexas_cookie_consent";
  const GA_ID = "G-YTY08X40FV";

  function loadGoogleAnalytics() {
    if (window.__nexasAnalyticsLoaded) return;
    window.__nexasAnalyticsLoaded = true;

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

  function createBanner() {
    if (document.getElementById("nexas-cookie-banner")) return;

    const banner = document.createElement("div");
    banner.id = "nexas-cookie-banner";

    banner.innerHTML = `
      <div class="nexas-cookie-box">
        <div class="nexas-cookie-text">
          <strong>Folosim cookie-uri</strong>
          <p>
            Folosim cookie-uri esentiale pentru functionarea site-ului si, doar cu acordul tau,
            cookie-uri de analiza pentru imbunatatirea experientei.
          </p>
          <a href="/cookies.html">Politica de cookies</a>
        </div>

        <div class="nexas-cookie-actions">
          <button type="button" id="nexas-cookie-reject">Respinge</button>
          <button type="button" id="nexas-cookie-accept">Accepta</button>
        </div>
      </div>
    `;

    const style = document.createElement("style");
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
    document.body.appendChild(banner);

    document.getElementById("nexas-cookie-accept").addEventListener("click", function () {
      localStorage.setItem(STORAGE_KEY, "accepted");
      banner.remove();
      loadGoogleAnalytics();
    });

    document.getElementById("nexas-cookie-reject").addEventListener("click", function () {
      localStorage.setItem(STORAGE_KEY, "rejected");
      banner.remove();
    });
  }

  function initConsent() {
    const consent = localStorage.getItem(STORAGE_KEY);

    if (consent === "accepted") {
      loadGoogleAnalytics();
      return;
    }

    if (consent === "rejected") {
      return;
    }

    createBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initConsent);
  } else {
    initConsent();
  }
})();
