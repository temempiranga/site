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
    </div>
  </article>`;
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
