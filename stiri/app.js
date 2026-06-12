const grid = document.getElementById('newsGrid');
const lastUpdated = document.getElementById('lastUpdated');
const categoryFilter = document.getElementById('categoryFilter');
const searchInput = document.getElementById('searchInput');

let allNews = [];
let filteredNews = [];
let visibleCount = 9;

const CATEGORY_ICONS = {
  "AI & Tech":     "🤖",
  "Sport":         "⚽",
  "Sanatate":      "💊",
  "Business":      "💼",
  "International": "🌍",
  "Entertainment": "🎬",
  "Romania":       "🏛️",
  "Stiinta":       "🔬",
};

// ============================================================
// UTILITIES
// ============================================================
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function isNew(dateStr) {
  if (!dateStr) return false;
  return (Date.now() - new Date(dateStr).getTime()) < 3 * 3600 * 1000;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  if (dStart.getTime() === todayStart.getTime()) return `azi, ${time}`;
  if (dStart.getTime() === yesterdayStart.getTime()) return `ieri, ${time}`;
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long' }) + `, ${time}`;
}

function dayLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dStart.getTime() === todayStart.getTime()) return 'Astăzi';
  if (dStart.getTime() === yesterdayStart.getTime()) return 'Ieri';
  return d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function getDayKey(dateStr) {
  if (!dateStr) return 'unknown';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isOld(dateStr) {
  if (!dateStr) return false;
  return (Date.now() - new Date(dateStr).getTime()) > 7 * 24 * 3600 * 1000;
}

// ============================================================
// RENDER
// ============================================================
function card(item) {
  const icon = CATEGORY_ICONS[item.category] || '📰';
  const nowBadge = isNew(item.date) ? '<span class="badge-new">NOU</span>' : '';
  const oldBadge = isOld(item.date) ? '<span class="badge-archive">Arhivă</span>' : '';

  return `
    <article class="news-card">
      <div class="card-body">
        <div class="card-top">
          <div class="card-badges">
            <span class="badge">${icon} ${escapeHtml(item.category || 'Știri')}</span>
            ${nowBadge}${oldBadge}
          </div>
          <span class="source">${escapeHtml(item.source || '')}</span>
        </div>
        <h3>${escapeHtml(item.title || '')}</h3>
        <p class="summary">${escapeHtml(item.summary || '')}</p>
        <div class="card-date">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          ${escapeHtml(formatDate(item.date))}
          &nbsp;·&nbsp; ${escapeHtml(item.source || '')}
        </div>
        <div class="actions">
          <a class="btn" href="${escapeHtml(item.url || '#')}" target="_blank" rel="noopener noreferrer">
            Citește sursa →
          </a>
        </div>
      </div>
    </article>`;
}

function daySeparator(dateStr) {
  return `<div class="day-sep"><span class="day-sep-label">${escapeHtml(dayLabel(dateStr))}</span></div>`;
}

function renderNews() {
  const visible = filteredNews.slice(0, visibleCount);

  if (visible.length === 0) {
    grid.innerHTML = `<div class="no-results">
      <div style="font-size:36px;margin-bottom:12px">🔍</div>
      <p>Nu au fost găsite știri pentru această selecție.</p>
    </div>`;
    removeLoadMoreBtn();
    return;
  }

  let html = '';
  let lastDayKey = null;

  visible.forEach(item => {
    const dk = getDayKey(item.date);
    if (dk !== lastDayKey) {
      html += daySeparator(item.date);
      lastDayKey = dk;
    }
    html += card(item);
  });

  grid.innerHTML = html;
  removeLoadMoreBtn();

  const remaining = filteredNews.length - visibleCount;
  if (remaining > 0) {
    const btn = document.createElement('button');
    btn.id = 'loadMoreNews';
    btn.className = 'btn load-more';
    btn.textContent = `Mai multe știri (${remaining} rămase)`;
    btn.addEventListener('click', () => {
      visibleCount += 9;
      renderNews();
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    grid.insertAdjacentElement('afterend', btn);
  }
}

function removeLoadMoreBtn() {
  const btn = document.getElementById('loadMoreNews');
  if (btn) btn.remove();
}

// ============================================================
// FILTER + SEARCH
// ============================================================
function applyFilter() {
  const cat = categoryFilter.value;
  const search = searchInput.value.toLowerCase().trim();

  filteredNews = allNews.filter(item => {
    const matchCat = cat === 'all' || item.category === cat;
    const matchSearch = !search ||
      (item.title || '').toLowerCase().includes(search) ||
      (item.summary || '').toLowerCase().includes(search) ||
      (item.source || '').toLowerCase().includes(search);
    return matchCat && matchSearch;
  });

  visibleCount = 9;
  renderNews();

  // Update results count
  const countEl = document.getElementById('resultsCount');
  if (countEl) {
    countEl.textContent = filteredNews.length > 0
      ? `${filteredNews.length} ${filteredNews.length === 1 ? 'știre' : 'știri'}`
      : '';
  }
}

// ============================================================
// POPULATE DROPDOWN
// ============================================================
function populateDropdown() {
  const counts = {};
  allNews.forEach(item => {
    const cat = item.category || 'Altele';
    counts[cat] = (counts[cat] || 0) + 1;
  });

  let options = `<option value="all">📰 Toate știrile (${allNews.length})</option>`;

  const order = ["AI & Tech","Sport","Romania","Business","International","Entertainment","Sanatate","Stiinta"];
  const sorted = [
    ...order.filter(c => counts[c]),
    ...Object.keys(counts).filter(c => !order.includes(c))
  ];

  sorted.forEach(cat => {
    if (!counts[cat]) return;
    const ico = CATEGORY_ICONS[cat] || '📰';
    options += `<option value="${escapeHtml(cat)}">${ico} ${escapeHtml(cat)} (${counts[cat]})</option>`;
  });

  categoryFilter.innerHTML = options;
}

// ============================================================
// LOAD (with retry)
// ============================================================
async function fetchWithRetry(url, retries = 3, delayMs = 1500) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
}

async function loadNews() {
  try {
    const res = await fetchWithRetry('stiri.json?v=' + Date.now());
    const data = await res.json();
    allNews = Array.isArray(data.items) ? data.items
            : Array.isArray(data) ? data
            : [];

    allNews.sort((a, b) => new Date(b.date) - new Date(a.date));

    const updated = data.updated_at || new Date().toISOString();
    lastUpdated.textContent = 'Actualizat: ' + new Date(updated).toLocaleString('ro-RO', {
      dateStyle: 'medium', timeStyle: 'short'
    });

    if (data.run_log) {
      // run_log available for debugging purposes
    }

    populateDropdown();
    filteredNews = [...allNews];
    renderNews();

  } catch (err) {
    lastUpdated.textContent = 'Știrile nu sunt disponibile acum.';
    grid.innerHTML = `
      <article class="news-card">
        <div class="card-body">
          <h3>Nu pot încărca știrile</h3>
          <p class="summary">A apărut o problemă temporară. Reîncarcă pagina sau revino în câteva minute.</p>
          <div class="actions"><button class="btn" onclick="location.reload()">Reîncearcă</button></div>
        </div>
      </article>`;
  }
}

// ============================================================
// EVENTS
// ============================================================
categoryFilter.addEventListener('change', applyFilter);

searchInput.addEventListener('input', () => {
  clearTimeout(searchInput._t);
  searchInput._t = setTimeout(applyFilter, 280);
});

// Sticky filter bar
const filterBar = document.getElementById('filterBar');
if (filterBar) {
  const sentinel = document.getElementById('filterSentinel');
  if (sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      filterBar.classList.toggle('is-stuck', !e.isIntersecting);
    }).observe(sentinel);
  }
}

loadNews();
