/* Blog public NEXAS — randeaza postarile din blog/posts.json.
 * Continutul este tratat strict ca TEXT (textContent), niciodata ca HTML,
 * deci o postare nu poate injecta scripturi in pagina (protectie XSS). */
(function () {
  "use strict";

  var box = document.getElementById("posts");

  function renderPost(post) {
    var article = document.createElement("article");
    article.className = "post";

    var h2 = document.createElement("h2");
    h2.textContent = post.title || "";
    article.appendChild(h2);

    var date = document.createElement("div");
    date.className = "date";
    date.textContent = formatDate(post.date);
    article.appendChild(date);

    if (post.image && /^\/blog\/uploads\//.test(post.image)) {
      var img = document.createElement("img");
      img.src = post.image;
      img.alt = post.title || "";
      img.loading = "lazy";
      article.appendChild(img);
    }

    if (post.description) {
      var desc = document.createElement("div");
      desc.className = "desc";
      desc.textContent = post.description;
      article.appendChild(desc);
    }

    String(post.content || "").split(/\n\s*\n/).forEach(function (para) {
      if (!para.trim()) return;
      var p = document.createElement("p");
      p.textContent = para.trim();
      article.appendChild(p);
    });

    return article;
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso + "T00:00:00").toLocaleDateString("ro-RO", {
        year: "numeric", month: "long", day: "numeric"
      });
    } catch (e) { return iso; }
  }

  fetch("/blog/posts.json?t=" + Date.now())
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      var posts = (data.posts || [])
        .filter(function (p) { return p.published; })
        .sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });

      box.textContent = "";
      if (!posts.length) {
        box.innerHTML = '<p class="empty">Nu există postări publicate încă.</p>';
        return;
      }
      posts.forEach(function (p) { box.appendChild(renderPost(p)); });
    })
    .catch(function () {
      box.innerHTML = '<p class="empty">Postările nu au putut fi încărcate.</p>';
    });
})();
