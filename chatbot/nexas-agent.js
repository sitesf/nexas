(function () {

  const CONFIG = {
    API_KEY: "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",
    WHATSAPP: "40764639118",
    AGENT_NAME: "Alex",
    AGENCY_NAME: "Nexas",
    PRIMARY_COLOR: "#7c3aed",
    ACCENT_COLOR: "#4f46e5",
  };

  const SYSTEM_PROMPT = `Ești Alex, asistentul virtual al agenției Nexas — o agenție digitală din România specializată în crearea de site-uri web profesionale, optimizare SEO și managementul social media.

PERSONALITATE:
- Vorbești în română, profesionist dar prietenos
- Ești concis — max 3-4 propoziții per răspuns
- Ești entuziast față de rezultate concrete pentru business-uri românești

SERVICIILE NEXAS:
1. CREARE SITE WEB — site-uri de prezentare, magazine online, landing page-uri. Prețuri de la 500€. Livrare: 7-21 zile.
2. SEO — audit, optimizare on-page, link building, rapoarte lunare. De la 200€/lună.
3. SOCIAL MEDIA — strategie, conținut, programare postări, rapoarte. De la 150€/lună.
4. AGENT AI CHATBOT — chatbot personalizat pentru site-ul clientului, 24/7. De la 200€/lună.

REGULI:
- La întrebări despre prețuri → dai prețul de pornire și trimiți la WhatsApp
- Nu promite ce nu oferim
- Dacă nu știi → trimiți la WhatsApp: +40764639118`;

  const CSS = `
    #nexas-widget*{box-sizing:border-box;margin:0;padding:0}
    @keyframes nxBounce{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}
    @keyframes nxFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes nxSlideIn{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes nxPulse{0%{box-shadow:0 0 0 0 rgba(124,58,237,.6)}70%{box-shadow:0 0 0 14px rgba(124,58,237,0)}100%{box-shadow:0 0 0 0 rgba(124,58,237,0)}}
    #nexas-widget{position:fixed;bottom:28px;right:28px;z-index:2147483647;font-family:system-ui,sans-serif}
    #nx-btn{width:62px;height:62px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 32px rgba(124,58,237,.5);transition:transform .2s,box-shadow .2s;margin-left:auto}
    #nx-btn:hover{transform:scale(1.08)}
    #nx-btn.nx-pulse{animation:nxPulse 2s infinite}
    #nx-panel{width:340px;height:500px;background:#111118;border:1px solid rgba(139,92,246,.25);border-radius:20px;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.7);margin-bottom:12px;animation:nxSlideIn .25s ease;overflow:hidden}
    #nx-panel.nx-hidden{display:none}
    .nx-header{background:linear-gradient(135deg,#1a1025,#150f2a);padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(139,92,246,.15);flex-shrink:0}
    .nx-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:white;flex-shrink:0}
    .nx-hinfo{flex:1}
    .nx-hname{font-size:14px;font-weight:700;color:#f5f3ff}
    .nx-hstatus{font-size:11px;color:#10b981;display:flex;align-items:center;gap:4px;margin-top:2px}
    .nx-dot{width:6px;height:6px;border-radius:50%;background:#10b981}
    .nx-close{background:rgba(255,255,255,.06);border:none;border-radius:8px;width:28px;height:28px;cursor:pointer;color:#9ca3af;display:flex;align-items:center;justify-content:center;font-size:16px;transition:background .15s}
    .nx-close:hover{background:rgba(255,255,255,.14);color:white}
    .nx-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:rgba(139,92,246,.2) transparent}
    .nx-msg{animation:nxFadeUp .2s ease}
    .nx-msg-a .nx-bubble{background:#1e1b2e;border:1px solid rgba(139,92,246,.15);color:#e5e7eb;border-radius:16px 16px 16px 4px;padding:10px 13px;font-size:13px;line-height:1.55;max-width:88%;display:inline-block;white-space:pre-wrap}
    .nx-msg-u{display:flex;justify-content:flex-end}
    .nx-msg-u .nx-bubble{background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;border-radius:16px 16px 4px 16px;padding:10px 13px;font-size:13px;line-height:1.55;max-width:88%;display:inline-block}
    .nx-typing{display:flex;align-items:center;gap:5px;padding:10px 13px}
    .nx-typing span{width:7px;height:7px;border-radius:50%;background:#a78bfa;animation:nxBounce 1.2s infinite}
    .nx-typing span:nth-child(2){animation-delay:.2s}
    .nx-typing span:nth-child(3){animation-delay:.4s}
    .nx-wa{display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.25);border-radius:10px;padding:7px 11px;margin-top:6px;cursor:pointer;color:#10b981;font-size:12px;font-weight:500;text-decoration:none;transition:background .15s}
    .nx-wa:hover{background:rgba(16,185,129,.22)}
    .nx-input-area{padding:10px 12px;border-top:1px solid rgba(139,92,246,.12);display:flex;gap:8px;align-items:flex-end;background:#0e0e18;flex-shrink:0}
    .nx-input{flex:1;background:#1a1a2e;border:1px solid rgba(139,92,246,.2);border-radius:12px;padding:9px 13px;color:#f5f3ff;font-family:system-ui,sans-serif;font-size:13px;resize:none;outline:none;transition:border-color .15s;max-height:88px;min-height:40px;line-height:1.5}
    .nx-input:focus{border-color:rgba(139,92,246,.5)}
    .nx-input::placeholder{color:#4b5563}
    .nx-send{width:40px;height:40px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .15s;flex-shrink:0}
    .nx-send:disabled{opacity:.35;cursor:not-allowed}
    .nx-footer{text-align:center;font-size:10px;color:#374151;padding:5px 0 8px;background:#0e0e18;flex-shrink:0}
    .nx-footer b{color:#6d28d9}
  `;

  function buildWidget() {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    const root = document.createElement("div");
    root.id = "nexas-widget";
    root.innerHTML = `
      <div id="nx-panel" class="nx-hidden">
        <div class="nx-header">
          <div class="nx-avatar">A</div>
          <div class="nx-hinfo">
            <div class="nx-hname">Alex — Nexas</div>
            <div class="nx-hstatus"><div class="nx-dot"></div>Online acum</div>
          </div>
          <button class="nx-close" id="nx-close-btn">✕</button>
        </div>
        <div class="nx-msgs" id="nx-msgs"></div>
        <div class="nx-input-area">
          <textarea class="nx-input" id="nx-input" placeholder="Scrie un mesaj..." rows="1"></textarea>
          <button class="nx-send" id="nx-send-btn" disabled>
            <svg width="17" height="17" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <div class="nx-footer">Powered by <b>Nexas AI</b></div>
      </div>
      <button id="nx-btn" class="nx-pulse">
        <svg id="nx-icon-chat" width="24" height="24" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
        </svg>
        <svg id="nx-icon-close" width="22" height="22" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24" style="display:none">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;
    document.body.appendChild(root);
    initLogic();
  }

  function initLogic() {
    const panel    = document.getElementById("nx-panel");
    const btn      = document.getElementById("nx-btn");
    const closeBtn = document.getElementById("nx-close-btn");
    const msgsEl   = document.getElementById("nx-msgs");
    const inputEl  = document.getElementById("nx-input");
    const sendBtn  = document.getElementById("nx-send-btn");
    const iconChat = document.getElementById("nx-icon-chat");
    const iconClose= document.getElementById("nx-icon-close");

    let open = false, loading = false, history = [];

    function waUrl() {
      return "https://wa.me/" + CONFIG.WHATSAPP + "?text=Salut%2C%20am%20o%20intrebare%20despre%20Nexas";
    }

    function scrollBottom() {
      setTimeout(() => { msgsEl.scrollTop = msgsEl.scrollHeight; }, 50);
    }

    function addMessage(role, text) {
      const div = document.createElement("div");
      div.className = "nx-msg nx-msg-" + (role === "assistant" ? "a" : "u");
      const bubble = document.createElement("div");
      bubble.className = "nx-bubble";
      bubble.textContent = text;
      div.appendChild(bubble);
      if (role === "assistant" && (text.toLowerCase().includes("whatsapp") || text.includes("+40"))) {
        const a = document.createElement("a");
        a.className = "nx-wa";
        a.href = waUrl();
        a.target = "_blank";
        a.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="#10b981"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Scrie-ne pe WhatsApp`;
        div.appendChild(a);
      }
      msgsEl.appendChild(div);
      scrollBottom();
    }

    function showTyping() {
      const div = document.createElement("div");
      div.className = "nx-msg nx-msg-a";
      div.id = "nx-typing";
      div.innerHTML = `<div class="nx-bubble" style="padding:0"><div class="nx-typing"><span></span><span></span><span></span></div></div>`;
      msgsEl.appendChild(div);
      scrollBottom();
    }

    function removeTyping() {
      const t = document.getElementById("nx-typing");
      if (t) t.remove();
    }

    async function sendMessage() {
      const text = inputEl.value.trim();
      if (!text || loading) return;
      inputEl.value = "";
      sendBtn.disabled = true;
      loading = true;
      history.push({ role: "user", content: text });
      addMessage("user", text);
      showTyping();
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": CONFIG.API_KEY,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 400,
            system: SYSTEM_PROMPT,
            messages: history
          })
        });
        const data = await res.json();
        const reply = (data.content && data.content[0] && data.content[0].text)
          ? data.content[0].text
          : "Îmi pare rău, a apărut o eroare. Contactează-ne pe WhatsApp.";
        history.push({ role: "assistant", content: reply });
        removeTyping();
        addMessage("assistant", reply);
      } catch(e) {
        removeTyping();
        addMessage("assistant", "A apărut o problemă tehnică. Scrie-ne pe WhatsApp 👇");
      }
      loading = false;
    }

    function togglePanel() {
      open = !open;
      panel.classList.toggle("nx-hidden", !open);
      btn.classList.remove("nx-pulse");
      iconChat.style.display = open ? "none" : "block";
      iconClose.style.display = open ? "block" : "none";
      if (open && history.length === 0) {
        addMessage("assistant", "Salut! Sunt Alex de la Nexas 👋 Te pot ajuta cu informații despre site-uri web, SEO sau social media. Ce te interesează?");
        setTimeout(() => inputEl.focus(), 100);
      }
    }

    btn.addEventListener("click", togglePanel);
    closeBtn.addEventListener("click", togglePanel);
    inputEl.addEventListener("input", function() {
      sendBtn.disabled = !this.value.trim();
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 88) + "px";
    });
    inputEl.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    sendBtn.addEventListener("click", sendMessage);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildWidget);
  } else {
    buildWidget();
  }

})();
