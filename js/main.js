'use strict';

/* ─── CSS não-crítico: injeta após parse do HTML ──────── */
/* cssReady resolve quando o style.css completo (.card, .btn-wpp etc.)
   termina de aplicar — ou depois de 2s, o que vier primeiro. Isso evita
   que os cards reais substituam o skeleton antes do CSS estar pronto
   (o que deixava os cards "pelados" em conexões mais lentas). */
var cssReady = new Promise(function (resolve) {
  var l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = '/css/style.css';
  l.onload = resolve;
  l.onerror = function () {
    console.error('Falha ao carregar /css/style.css');
    resolve(); // não trava a página pra sempre se o CSS falhar
  };
  document.head.appendChild(l);
  setTimeout(resolve, 2000); // failsafe de rede muito lenta/instável
});

/* ─── GA4: carrega quando o browser estiver ocioso ───── */
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
function _carregarGA4() {
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-LLMHPW575C';
  document.head.appendChild(s);
  s.onload = function () {
    gtag('js', new Date());
    gtag('config', 'G-LLMHPW575C');
  };
}
if ('requestIdleCallback' in window) {
  requestIdleCallback(_carregarGA4, { timeout: 5000 });
} else {
  window.addEventListener('load', _carregarGA4);
}

/* ─── constantes ─────────────────────────────────────── */
const CATEGORIAS = [
  'Todos', 'Alimentação', 'Beleza', 'Mecânica',
  'Saúde', 'Mercados', 'Construção', 'Serviços', 'Agro'
];

const ICONES_CAT = {
  'Alimentação': '🍽',
  'Beleza':      '💇',
  'Mecânica':    '🔧',
  'Saúde':       '💊',
  'Mercados':    '🛒',
  'Construção':  '🏗',
  'Serviços':    '⚙️',
  'Agro':        '🌿',
};

/* ─── estado ─────────────────────────────────────────── */
let todosOsNegocios = [];
let categoriaAtiva  = 'Todos';
let termoBusca      = '';

/* ─── init ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  renderCategorias();
  await carregarNegocios();
  bindBusca();
  bindAnalytics();
});

/* ─── carrega dados ──────────────────────────────────── */
async function carregarNegocios() {
  try {
    const resp = await fetch('data/comercios.json');
    if (!resp.ok) throw new Error('Falha ao carregar dados');
    todosOsNegocios = await resp.json();
    await cssReady; // garante que .card/.btn-wpp já estão estilizados antes de sair do skeleton
    renderCards();
  } catch (err) {
    console.error(err);
    document.getElementById('cards-grid').innerHTML =
      '<p style="color:#c00;padding:20px">Erro ao carregar os dados. Tente novamente.</p>';
  }
}

/* ─── filtro ─────────────────────────────────────────── */
function filtrados() {
  return todosOsNegocios
    .filter(n => n.ativo)
    .filter(n => categoriaAtiva === 'Todos' || n.categoria === categoriaAtiva)
    .filter(n => {
      if (!termoBusca) return true;
      const t = termoBusca.toLowerCase();
      return (
        n.nome.toLowerCase().includes(t) ||
        n.descricao.toLowerCase().includes(t) ||
        n.categoria.toLowerCase().includes(t) ||
        n.bairro.toLowerCase().includes(t) ||
        (n.endereco || '').toLowerCase().includes(t)
      );
    })
    .sort((a, b) => b.destaque - a.destaque);
}

/* ─── render categorias ──────────────────────────────── */
function renderCategorias() {
  const el = document.getElementById('categorias');
  el.innerHTML = CATEGORIAS.map(cat => {
    const icone = ICONES_CAT[cat] ? `${ICONES_CAT[cat]} ` : '';
    return `<button
      class="cat-btn${cat === categoriaAtiva ? ' ativo' : ''}"
      data-cat="${escapeHtml(cat)}"
      aria-pressed="${cat === categoriaAtiva}"
    >${icone}${escapeHtml(cat)}</button>`;
  }).join('');

  el.addEventListener('click', e => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    categoriaAtiva = btn.dataset.cat;
    document.querySelectorAll('.cat-btn').forEach(b => {
      b.classList.toggle('ativo', b.dataset.cat === categoriaAtiva);
      b.setAttribute('aria-pressed', b.dataset.cat === categoriaAtiva);
    });
    renderCards();
  });
}

/* ─── render cards ───────────────────────────────────── */
function renderCards() {
  const lista   = filtrados();
  const grid    = document.getElementById('cards-grid');
  const vazio   = document.getElementById('vazio');
  const infoEl  = document.getElementById('resultados-info');

  infoEl.textContent = lista.length === 0
    ? ''
    : `${lista.length} resultado${lista.length !== 1 ? 's' : ''} encontrado${lista.length !== 1 ? 's' : ''}`;

  if (lista.length === 0) {
    grid.innerHTML  = '';
    vazio.style.display = 'block';
    return;
  }
  vazio.style.display = 'none';
  grid.innerHTML = lista.map(cardHTML).join('');
}

function cardHTML(n) {
  const wppLink  = `https://wa.me/${n.whatsapp}?text=${encodeURIComponent('Olá! Vi seu negócio no Tem em Piranga e quero saber mais.')}`;
  const telLink  = `tel:+55${n.telefone}`;
  const rural    = n.entrega_rural
    ? '<span class="badge-rural">🌾 Entrega zona rural</span>' : '';
  const redes    = redesSociaisHTML(n);

  return `
  <article class="card${n.destaque ? ' destaque' : ''}" aria-label="${escapeHtml(n.nome)}">
    <div class="card-topo">
      <span class="card-categoria">${escapeHtml(n.categoria)}</span>
      ${n.destaque ? '<span class="badge-destaque">⭐ Destaque</span>' : ''}
    </div>
    <h2 class="card-nome"><a href="/comercio/${encodeURIComponent(n.id)}">${escapeHtml(n.nome)}</a></h2>
    <p class="card-desc">${escapeHtml(n.descricao)}</p>
    <div class="card-meta">
      <span>🕐 ${escapeHtml(n.horario)}</span>
      <span>📍 ${escapeHtml(n.endereco ? n.endereco + ', ' + n.bairro : n.bairro)}</span>
      ${rural}
    </div>
    <div class="card-acoes">
      <a class="btn-wpp" href="${wppLink}" target="_blank" rel="noopener noreferrer"
         aria-label="Abrir WhatsApp de ${escapeHtml(n.nome)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        WhatsApp
      </a>
      <a class="btn-ligar" href="${telLink}" aria-label="Ligar para ${escapeHtml(n.nome)}">
        📞
      </a>
      ${redes}
    </div>
  </article>`;
}

/* ─── redes sociais ──────────────────────────────────── */
function socialLinks(n) {
  const links = [];
  if (n.instagram) {
    links.push({ tipo: 'instagram', url: `https://instagram.com/${n.instagram.replace(/^@/, '')}` });
  }
  if (n.facebook) {
    links.push({ tipo: 'facebook', url: `https://facebook.com/${n.facebook.replace(/^@/, '')}` });
  }
  return links;
}

const ICONES_SOCIAL_SVG = {
  instagram: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
  facebook: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12.061C22 6.505 17.523 2 12 2S2 6.505 2 12.061c0 5.022 3.657 9.184 8.438 9.939v-7.03H7.898v-2.909h2.54V9.845c0-2.522 1.492-3.916 3.777-3.916 1.094 0 2.238.196 2.238.196v2.475h-1.26c-1.243 0-1.63.775-1.63 1.57v1.891h2.773l-.443 2.909h-2.33V22c4.78-.755 8.437-4.917 8.437-9.939z"/></svg>',
};

function redesSociaisHTML(n) {
  const links = socialLinks(n);
  if (links.length === 0) return '';
  return links
    .map(l => `<a class="btn-social" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" aria-label="${l.tipo === 'instagram' ? 'Instagram' : 'Facebook'} de ${escapeHtml(n.nome)}">${ICONES_SOCIAL_SVG[l.tipo]}</a>`)
    .join('');
}

/* ─── busca ──────────────────────────────────────────── */
function bindBusca() {
  const input = document.getElementById('busca-input');
  const btn   = document.getElementById('busca-btn');

  const executar = () => {
    termoBusca = input.value.trim();
    renderCards();
  };

  btn.addEventListener('click', executar);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') executar(); });
  input.addEventListener('input', () => {
    if (input.value === '') { termoBusca = ''; renderCards(); }
  });
}

/* ─── analytics ─────────────────────────────────────── */
function bindAnalytics() {
  const grid = document.getElementById('cards-grid');
  if (!grid) return;

  grid.addEventListener('click', e => {
    const link = e.target.closest('.btn-wpp, .btn-ligar');
    if (!link || typeof gtag !== 'function') return;

    const card = link.closest('.card');
    const nome = card ? card.querySelector('.card-nome')?.textContent : '';
    const tipo = link.classList.contains('btn-wpp') ? 'whatsapp' : 'telefone';

    gtag('event', 'clique_contato', {
      tipo_contato: tipo,
      nome_comercio: nome,
    });
  });
}

/* ─── segurança: escape HTML ─────────────────────────── */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
