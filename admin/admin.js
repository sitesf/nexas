/* NEXAS Admin — panou de administrare pentru site static (GitHub Pages).
 *
 * Arhitectura de securitate (documentata si in README.md):
 *  - Site-ul nu are backend, deci nu exista sesiune pe server. Login-ul
 *    (user + parola PBKDF2-SHA256, 600.000 iteratii) protejeaza interfata
 *    si decripteaza token-ul GitHub salvat local (AES-GCM).
 *  - Securitatea REALA a publicarii este token-ul GitHub fine-grained
 *    (Contents: Read & Write doar pe acest repo). Token-ul nu este stocat
 *    niciodata in repo si nu paraseste browserul decat spre api.github.com.
 *  - Protectie brute force: blocare exponentiala dupa 5 incercari esuate.
 */
(function () {
  "use strict";

  var REPO = "sitesf/nexas";
  var BRANCH = "main";
  var POSTS_PATH = "blog/posts.json";
  var CONFIG_PATH = "admin/config.json";
  var UPLOADS_DIR = "blog/uploads";
  var API = "https://api.github.com";

  var SESSION_KEY = "nexas_admin_session";
  var SESSION_MINUTES = 30;
  var LOCK_KEY = "nexas_admin_lock";
  var MAX_FAILS = 5;
  var TOKEN_ENC_KEY = "nexas_admin_token_enc";

  var state = {
    config: null,      // admin/config.json
    password: null,    // tinut doar in memorie pentru criptarea token-ului
    token: null,       // token GitHub, doar in memorie / sessionStorage
    posts: [],
    postsSha: null,
    editingId: null
  };

  /* ───────────────────────── utilitare ───────────────────────── */

  function $(id) { return document.getElementById(id); }

  function showMsg(id, text, kind) {
    var el = $(id);
    el.textContent = text;
    el.className = "msg show " + (kind || "ok");
  }
  function hideMsg(id) { $(id).className = "msg"; }

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }
  function bytesToB64(bytes) {
    var bin = "";
    var arr = new Uint8Array(bytes);
    for (var i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin);
  }
  function utf8ToB64(str) {
    return bytesToB64(new TextEncoder().encode(str));
  }
  function b64ToUtf8(b64) {
    return new TextDecoder().decode(b64ToBytes(b64.replace(/\n/g, "")));
  }

  /* ───────────────────────── criptografie ───────────────────────── */

  function pbkdf2(password, saltB64, iterations) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
      .then(function (key) {
        return crypto.subtle.deriveBits(
          { name: "PBKDF2", hash: "SHA-256", salt: b64ToBytes(saltB64), iterations: iterations },
          key, 256
        );
      })
      .then(function (bits) { return bytesToB64(bits); });
  }

  function constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function deriveAesKey(password, saltBytes) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"])
      .then(function (key) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 310000 },
          key, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
        );
      });
  }

  function encryptToken(password, token) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveAesKey(password, salt).then(function (key) {
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(token));
    }).then(function (ct) {
      return JSON.stringify({ salt: bytesToB64(salt), iv: bytesToB64(iv), data: bytesToB64(ct) });
    });
  }

  function decryptToken(password, blobJson) {
    var blob;
    try { blob = JSON.parse(blobJson); } catch (e) { return Promise.resolve(null); }
    return deriveAesKey(password, b64ToBytes(blob.salt)).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(blob.iv) }, key, b64ToBytes(blob.data));
    }).then(function (pt) {
      return new TextDecoder().decode(pt);
    }).catch(function () { return null; });
  }

  /* ───────────────────────── brute force lock ───────────────────────── */

  function getLock() {
    try { return JSON.parse(localStorage.getItem(LOCK_KEY)) || { fails: 0, until: 0 }; }
    catch (e) { return { fails: 0, until: 0 }; }
  }
  function setLock(lock) {
    try { localStorage.setItem(LOCK_KEY, JSON.stringify(lock)); } catch (e) {}
  }
  function lockedSecondsLeft() {
    var lock = getLock();
    return Math.max(0, Math.ceil((lock.until - Date.now()) / 1000));
  }
  function registerFail() {
    var lock = getLock();
    lock.fails += 1;
    if (lock.fails >= MAX_FAILS) {
      // 30s dupa a 5-a incercare, apoi se dubleaza; plafon 1 ora
      var waitMs = Math.min(30000 * Math.pow(2, lock.fails - MAX_FAILS), 3600000);
      lock.until = Date.now() + waitMs;
    }
    setLock(lock);
    return lock;
  }
  function clearLock() { setLock({ fails: 0, until: 0 }); }

  /* ───────────────────────── sesiune ───────────────────────── */

  function startSession() {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ exp: Date.now() + SESSION_MINUTES * 60000 }));
  }
  function sessionValid() {
    try {
      var s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      return s && s.exp > Date.now();
    } catch (e) { return false; }
  }
  function touchSession() {
    if (sessionValid()) startSession();
  }
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem("nexas_admin_token");
    state.password = null;
    state.token = null;
    location.reload();
  }

  /* ───────────────────────── GitHub API ───────────────────────── */

  function ghHeaders() {
    return {
      "Authorization": "Bearer " + state.token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  function ghGetFile(path) {
    return fetch(API + "/repos/" + REPO + "/contents/" + path + "?ref=" + BRANCH + "&t=" + Date.now(), {
      headers: ghHeaders()
    }).then(function (res) {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("GitHub API: " + res.status);
      return res.json();
    });
  }

  function ghPutFile(path, contentB64, message, sha) {
    var body = { message: message, content: contentB64, branch: BRANCH };
    if (sha) body.sha = sha;
    return fetch(API + "/repos/" + REPO + "/contents/" + path, {
      method: "PUT",
      headers: ghHeaders(),
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (e) {
          throw new Error("GitHub API " + res.status + ": " + (e.message || "eroare"));
        });
      }
      return res.json();
    });
  }

  /* ───────────────────────── postari ───────────────────────── */

  function loadPosts() {
    // Cu token: prin API (obtinem si sha pentru salvare).
    // Fara token: fetch public, doar pentru vizualizare.
    if (state.token) {
      return ghGetFile(POSTS_PATH).then(function (file) {
        if (!file) { state.posts = []; state.postsSha = null; return; }
        state.postsSha = file.sha;
        state.posts = JSON.parse(b64ToUtf8(file.content)).posts || [];
      });
    }
    return fetch("/" + POSTS_PATH + "?t=" + Date.now())
      .then(function (res) { return res.ok ? res.json() : { posts: [] }; })
      .then(function (data) { state.posts = data.posts || []; state.postsSha = null; });
  }

  function savePosts(message) {
    if (!state.token) return Promise.reject(new Error("Adaugă mai întâi token-ul GitHub."));
    var json = JSON.stringify({ posts: state.posts }, null, 2);
    // Reluam sha-ul curent imediat inainte de PUT, ca sa evitam conflictele
    return ghGetFile(POSTS_PATH).then(function (file) {
      return ghPutFile(POSTS_PATH, utf8ToB64(json), message, file ? file.sha : null);
    }).then(function (r) {
      state.postsSha = r.content.sha;
    });
  }

  function renderPosts() {
    var box = $("posts-list");
    if (!state.posts.length) {
      box.innerHTML = '<p class="note">Nu există postări încă. Apasă „+ Postare nouă”.</p>';
      return;
    }
    box.textContent = "";
    state.posts
      .slice()
      .sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); })
      .forEach(function (post) {
        var item = document.createElement("div");
        item.className = "post-item";

        var info = document.createElement("div");
        var title = document.createElement("div");
        title.className = "post-title";
        title.textContent = post.title;
        var badge = document.createElement("span");
        badge.className = "badge " + (post.published ? "pub" : "draft");
        badge.textContent = post.published ? "publicat" : "ciornă";
        title.appendChild(badge);
        var meta = document.createElement("div");
        meta.className = "post-meta";
        meta.textContent = (post.date || "fără dată") + " · id " + post.id;
        info.appendChild(title);
        info.appendChild(meta);

        var actions = document.createElement("div");
        actions.className = "post-actions";
        var btnEdit = document.createElement("button");
        btnEdit.className = "btn-ghost btn-sm";
        btnEdit.textContent = "Editează";
        btnEdit.addEventListener("click", function () { openEditor(post.id); });
        var btnDel = document.createElement("button");
        btnDel.className = "btn-danger btn-sm";
        btnDel.textContent = "Șterge";
        btnDel.addEventListener("click", function () { deletePost(post.id); });
        actions.appendChild(btnEdit);
        actions.appendChild(btnDel);

        item.appendChild(info);
        item.appendChild(actions);
        box.appendChild(item);
      });
  }

  function openEditor(id) {
    touchSession();
    state.editingId = id || null;
    $("editor-card").classList.remove("hidden");
    $("editor-title").textContent = id ? "Editează postarea" : "Postare nouă";
    $("f-image").value = "";
    hideMsg("editor-msg");

    var post = id ? state.posts.find(function (p) { return p.id === id; }) : null;
    $("f-id").value = post ? post.id : "";
    $("f-title").value = post ? post.title : "";
    $("f-desc").value = post ? post.description : "";
    $("f-content").value = post ? post.content : "";
    $("f-date").value = post ? (post.date || "") : new Date().toISOString().slice(0, 10);
    $("f-status").value = post && !post.published ? "draft" : "published";
    $("f-image-current").textContent = post && post.image ? "Imagine curentă: " + post.image : "";
    $("editor-card").scrollIntoView({ behavior: "smooth" });
  }

  function closeEditor() {
    state.editingId = null;
    $("editor-card").classList.add("hidden");
  }

  function uploadImageIfAny() {
    var fileInput = $("f-image");
    var file = fileInput.files && fileInput.files[0];
    if (!file) return Promise.resolve(null);

    var allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (allowed.indexOf(file.type) === -1) {
      return Promise.reject(new Error("Tip de imagine nepermis. Folosește png, jpg, webp sau gif."));
    }
    if (file.size > 2 * 1024 * 1024) {
      return Promise.reject(new Error("Imaginea depășește 2 MB."));
    }
    var safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[.-]+/, "");
    var path = UPLOADS_DIR + "/" + Date.now() + "-" + safeName;

    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var b64 = String(reader.result).split(",")[1];
        ghPutFile(path, b64, "blog: imagine " + safeName, null)
          .then(function () { resolve("/" + path); })
          .catch(reject);
      };
      reader.onerror = function () { reject(new Error("Nu am putut citi fișierul.")); };
      reader.readAsDataURL(file);
    });
  }

  function savePostFromForm(e) {
    e.preventDefault();
    touchSession();
    if (!state.token) {
      showMsg("editor-msg", "Adaugă mai întâi token-ul GitHub (secțiunea de sus).", "err");
      return;
    }
    var btn = $("btn-save-post");
    btn.disabled = true;
    showMsg("editor-msg", "Se salvează…", "warn");

    uploadImageIfAny().then(function (imagePath) {
      var id = $("f-id").value || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
      var existing = state.posts.find(function (p) { return p.id === id; });
      var post = existing || { id: id, created: new Date().toISOString() };

      post.title = $("f-title").value.trim();
      post.description = $("f-desc").value.trim();
      post.content = $("f-content").value;
      post.date = $("f-date").value || new Date().toISOString().slice(0, 10);
      post.published = $("f-status").value === "published";
      post.updated = new Date().toISOString();
      if (imagePath) post.image = imagePath;

      if (!existing) state.posts.push(post);
      return savePosts((existing ? "blog: actualizare " : "blog: postare noua ") + post.title.slice(0, 60));
    }).then(function () {
      showMsg("editor-msg", "Postarea a fost salvată. Site-ul public se actualizează în 1–2 minute (GitHub Pages).", "ok");
      renderPosts();
      closeEditor();
    }).catch(function (err) {
      showMsg("editor-msg", "Eroare: " + err.message, "err");
    }).finally(function () {
      btn.disabled = false;
    });
  }

  function deletePost(id) {
    var post = state.posts.find(function (p) { return p.id === id; });
    if (!post) return;
    if (!confirm('Ștergi definitiv postarea „' + post.title + '”?')) return;
    if (!state.token) {
      showMsg("list-msg", "Adaugă mai întâi token-ul GitHub.", "err");
      return;
    }
    state.posts = state.posts.filter(function (p) { return p.id !== id; });
    savePosts("blog: stergere " + post.title.slice(0, 60)).then(function () {
      showMsg("list-msg", "Postarea a fost ștearsă.", "ok");
      renderPosts();
    }).catch(function (err) {
      state.posts.push(post);
      showMsg("list-msg", "Eroare la ștergere: " + err.message, "err");
    });
  }

  /* ───────────────────────── token ───────────────────────── */

  function saveToken() {
    var token = $("gh-token").value.trim();
    if (!token) { showMsg("token-msg", "Introdu un token.", "err"); return; }
    state.token = token;
    sessionStorage.setItem("nexas_admin_token", token);

    var done = function () {
      showMsg("token-msg", "Token salvat. Verific accesul…", "warn");
      ghGetFile(CONFIG_PATH).then(function () {
        showMsg("token-msg", "Token valid — ai acces de publicare.", "ok");
        return loadPosts().then(renderPosts);
      }).catch(function () {
        showMsg("token-msg", "Token-ul nu are acces la repo (verifică permisiunea Contents pe " + REPO + ").", "err");
      });
    };

    if ($("remember-token").checked && state.password) {
      encryptToken(state.password, token).then(function (blob) {
        try { localStorage.setItem(TOKEN_ENC_KEY, blob); } catch (e) {}
        done();
      });
    } else {
      done();
    }
  }

  function clearToken() {
    state.token = null;
    sessionStorage.removeItem("nexas_admin_token");
    try { localStorage.removeItem(TOKEN_ENC_KEY); } catch (e) {}
    $("gh-token").value = "";
    showMsg("token-msg", "Token-ul a fost uitat pe acest dispozitiv.", "ok");
  }

  function restoreToken() {
    var t = sessionStorage.getItem("nexas_admin_token");
    if (t) { state.token = t; $("gh-token").value = t; return Promise.resolve(); }
    var enc = localStorage.getItem(TOKEN_ENC_KEY);
    if (enc && state.password) {
      return decryptToken(state.password, enc).then(function (token) {
        if (token) {
          state.token = token;
          $("gh-token").value = token;
          $("remember-token").checked = true;
          sessionStorage.setItem("nexas_admin_token", token);
        }
      });
    }
    return Promise.resolve();
  }

  /* ───────────────────────── schimbare parola ───────────────────────── */

  function passwordStrong(p) {
    return p.length >= 12 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);
  }

  function changePassword(e) {
    e.preventDefault();
    touchSession();
    hideMsg("pass-msg");
    var oldP = $("p-old").value, newP = $("p-new").value, newP2 = $("p-new2").value;

    if (newP !== newP2) { showMsg("pass-msg", "Parolele noi nu coincid.", "err"); return; }
    if (!passwordStrong(newP)) {
      showMsg("pass-msg", "Parola nouă e prea slabă: minim 12 caractere, literă mare, literă mică, cifră și simbol.", "err");
      return;
    }
    if (!state.token) { showMsg("pass-msg", "Adaugă mai întâi token-ul GitHub — parola se salvează în repo.", "err"); return; }

    showMsg("pass-msg", "Se verifică și se salvează…", "warn");
    pbkdf2(oldP, state.config.salt, state.config.iterations).then(function (hash) {
      if (!constantTimeEqual(hash, state.config.hash)) {
        throw new Error("Parola actuală este greșită.");
      }
      var newSalt = bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
      var iterations = 600000;
      return pbkdf2(newP, newSalt, iterations).then(function (newHash) {
        var cfg = {
          username: state.config.username,
          algo: "PBKDF2-SHA256",
          iterations: iterations,
          salt: newSalt,
          hash: newHash
        };
        return ghGetFile(CONFIG_PATH).then(function (file) {
          return ghPutFile(CONFIG_PATH, utf8ToB64(JSON.stringify(cfg, null, 2) + "\n"),
            "admin: schimbare parola", file ? file.sha : null);
        }).then(function () {
          state.config = cfg;
          state.password = newP;
          // recripteaza token-ul memorat cu noua parola
          if (localStorage.getItem(TOKEN_ENC_KEY) && state.token) {
            return encryptToken(newP, state.token).then(function (blob) {
              try { localStorage.setItem(TOKEN_ENC_KEY, blob); } catch (e) {}
            });
          }
        });
      });
    }).then(function () {
      $("p-old").value = $("p-new").value = $("p-new2").value = "";
      showMsg("pass-msg", "Parola a fost schimbată. La următorul login folosește parola nouă (după ce GitHub Pages publică modificarea, ~1–2 minute).", "ok");
    }).catch(function (err) {
      showMsg("pass-msg", err.message, "err");
    });
  }

  /* ───────────────────────── login ───────────────────────── */

  function loadConfig() {
    return fetch("/" + CONFIG_PATH + "?t=" + Date.now()).then(function (res) {
      if (!res.ok) throw new Error("Nu am putut încărca admin/config.json");
      return res.json();
    }).then(function (cfg) { state.config = cfg; });
  }

  function doLogin(e) {
    e.preventDefault();
    hideMsg("login-msg");

    var wait = lockedSecondsLeft();
    if (wait > 0) {
      showMsg("login-msg", "Prea multe încercări eșuate. Reîncearcă în " + wait + " secunde.", "err");
      return;
    }

    var user = $("login-user").value.trim();
    var pass = $("login-pass").value;
    var btn = $("btn-login");
    btn.disabled = true;
    showMsg("login-msg", "Se verifică…", "warn");

    loadConfig().then(function () {
      return pbkdf2(pass, state.config.salt, state.config.iterations);
    }).then(function (hash) {
      var userOk = user === state.config.username;
      var passOk = constantTimeEqual(hash, state.config.hash);
      if (!userOk || !passOk) {
        var lock = registerFail();
        var left = MAX_FAILS - lock.fails;
        throw new Error(left > 0
          ? "Utilizator sau parolă greșită. Mai ai " + left + " încercări."
          : "Utilizator sau parolă greșită. Cont blocat temporar " + lockedSecondsLeft() + " secunde.");
      }
      clearLock();
      state.password = pass;
      startSession();
      return restoreToken();
    }).then(function () {
      showDashboard();
    }).catch(function (err) {
      showMsg("login-msg", err.message, "err");
    }).finally(function () {
      btn.disabled = false;
      $("login-pass").value = "";
    });
  }

  function showDashboard() {
    $("view-login").classList.add("hidden");
    $("view-dash").classList.remove("hidden");
    $("btn-logout").classList.remove("hidden");
    loadPosts().then(renderPosts).catch(function (err) {
      showMsg("list-msg", "Nu am putut încărca postările: " + err.message, "err");
    });
  }

  /* ───────────────────────── init ───────────────────────── */

  function init() {
    if (!window.crypto || !crypto.subtle) {
      document.body.textContent = "Browser neacceptat: lipsește WebCrypto.";
      return;
    }

    $("login-form").addEventListener("submit", doLogin);
    $("btn-logout").addEventListener("click", logout);
    $("btn-new").addEventListener("click", function () { openEditor(null); });
    $("btn-cancel-edit").addEventListener("click", closeEditor);
    $("post-form").addEventListener("submit", savePostFromForm);
    $("pass-form").addEventListener("submit", changePassword);
    $("btn-save-token").addEventListener("click", saveToken);
    $("btn-clear-token").addEventListener("click", clearToken);

    // expira sesiunea
    setInterval(function () {
      if (!$("view-dash").classList.contains("hidden") && !sessionValid()) logout();
    }, 30000);

    if (sessionValid()) {
      startSession();
      restoreToken().then(showDashboard);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
