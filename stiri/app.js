const grid = document.getElementById('newsGrid');
const lastUpdated = document.getElementById('lastUpdated');

let allNews = [];
let visibleCount = 9;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[char]));
}

function formatDate(value) {
  if (!value) return 'Data necunoscuta';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function card(item, index) {
  const hashtags = Array.isArray(item.hashtags) ? item.hashtags.join(' ') : '';

  return `
    <article class="news-card">
      <div class="card-body">
        <div class="card-top">
          <span class="badge">${escapeHtml(item.category || 'Tech')}</span>
          <span class="source">${escapeHtml(item.source || 'Sursa')} · ${formatDate(item.date)}</span>
        </div>

        <h3>${escapeHtml(item.title || `Stire ${index + 1}`)}</h3>

        <p class="summary">${escapeHtml(item.summary || '')}</p>

        <div class="actions">
          <a class="btn" href="${escapeHtml(item.url || '#')}" target="_blank" rel="noopener noreferrer">
            Citeste sursa
          </a>
        </div>

        <span class="source">${escapeHtml(hashtags)}</span>
      </div>
    </article>
  `;
}

function renderNews() {
  grid.innerHTML = allNews.slice(0, visibleCount).map(card).join('');

  const oldButton = document.getElementById('loadMoreNews');
  if (oldButton) {
    oldButton.remove();
  }

  if (visibleCount < allNews.length) {
    const btn = document.createElement('button');
    btn.id = 'loadMoreNews';
    btn.className = 'btn load-more';
    btn.textContent = 'Mai multe stiri';

    btn.addEventListener('click', () => {
      visibleCount += 6;
      renderNews();
    });

    grid.insertAdjacentElement('afterend', btn);
  }
}

async function loadNews() {
  try {
    const response = await fetch('stiri.json?v=' + Date.now(), {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Nu pot incarca stiri.json');
    }

    const data = await response.json();
    allNews = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];

    const updated = data.updated_at || new Date().toISOString();

    lastUpdated.textContent = 'Actualizat: ' + new Date(updated).toLocaleString('ro-RO', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    renderNews();

  } catch (error) {
    lastUpdated.textContent = 'Stirile nu sunt disponibile acum';

    grid.innerHTML = `
      <article class="news-card">
        <div class="card-body">
          <h3>Nu pot incarca stirile</h3>
          <p class="summary">Verifica daca fisierul stiri.json exista in folderul /stiri.</p>
        </div>
      </article>
    `;

    console.error(error);
  }
}

loadNews();
