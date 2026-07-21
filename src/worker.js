import { WorkerMailer } from 'worker-mailer';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CONTACT_EMAIL = 'contato@temempiranga.com.br';
// smtp.hostinger.com resolve para um IP da própria Cloudflare (a Hostinger
// proxia o e-mail Business via Cloudflare), e o Workers bloqueia conexões
// TCP de saída para IPs da rede Cloudflare. smtp.titan.email é o host real
// da Titan (infraestrutura por trás do e-mail Business da Hostinger),
// fora da rede da Cloudflare — mesma conta/senha, host diferente.
const CONTACT_SMTP_HOST = 'smtp.titan.email';
const CONTACT_SMTP_PORT = 465;

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=86400; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' https://www.googletagmanager.com https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://cloudflareinsights.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests",
};

const COMERCIO_PATH_RE = /^\/comercio\/([^/]+)\/?$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/turnstile-config') {
      return handleTurnstileConfig(request, env);
    }

    if (url.pathname === '/api/contact') {
      return handleContact(request, env);
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      if (url.pathname === '/sitemap.xml') {
        return handleSitemap(request, env, url);
      }

      const comercioMatch = url.pathname.match(COMERCIO_PATH_RE);
      if (comercioMatch) {
        return handleComercioPage(request, env, url, comercioMatch[1]);
      }
    }

    return env.ASSETS.fetch(request);
  },
};

/* ─── páginas individuais de comércio ─────────────────── */
async function handleComercioPage(request, env, url, rawId) {
  let id;
  try {
    id = decodeURIComponent(rawId);
  } catch (err) {
    id = rawId;
  }

  const comercios = await loadComercios(request, env);
  const item = comercios.find(c => c.id === id && c.ativo === true);

  if (!item) {
    return notFoundResponse(request, env);
  }

  const html = renderComercioPage(item, url.origin);
  return htmlResponse(html, 200, request.method);
}

async function loadComercios(request, env) {
  const dataUrl = new URL('/data/comercios.json', request.url);
  const resp = await env.ASSETS.fetch(new Request(dataUrl, { method: 'GET' }));
  if (!resp.ok) return [];
  try {
    return await resp.json();
  } catch (err) {
    return [];
  }
}

async function notFoundResponse(request, env) {
  const assetUrl = new URL('/404.html', request.url);
  const assetResp = await env.ASSETS.fetch(new Request(assetUrl, { method: 'GET' }));
  const headers = new Headers(assetResp.headers);
  applySecurityHeaders(headers);
  const body = request.method === 'HEAD' ? null : assetResp.body;
  return new Response(body, { status: 404, headers });
}

function renderComercioPage(item, origin) {
  const pageUrl = `${origin}/comercio/${encodeURIComponent(item.id)}`;
  const title = `${item.nome} — ${item.categoria} em Piranga, MG | Tem em Piranga`;
  const description = `${item.nome}: ${item.descricao} Endereço, horário e contato pelo WhatsApp. ${item.categoria} em Piranga, MG.`;
  const ogImage = `${origin}/img/social-square-white-1080.png`;

  const wppLink = `https://wa.me/${item.whatsapp}?text=${encodeURIComponent(
    `Olá! Vi o ${item.nome} no Tem em Piranga e quero saber mais.`
  )}`;
  const telLink = `tel:+55${item.telefone}`;
  const rural = item.entrega_rural
    ? '<span class="badge-rural">🌾 Entrega zona rural</span>'
    : '';
  const enderecoCompleto = item.endereco ? `${item.endereco}, ${item.bairro}` : item.bairro;
  const redes = socialLinks(item);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: item.nome,
    description: item.descricao,
    telephone: `+55${item.telefone}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: item.endereco || item.bairro,
      addressLocality: 'Piranga',
      addressRegion: 'MG',
      addressCountry: 'BR',
    },
    url: pageUrl,
  };
  if (redes.length > 0) {
    jsonLd.sameAs = redes.map(r => r.url);
  }
  const jsonLdScript = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${escapeHtml(description)}" />

  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="business.business" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />

  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />

  <link rel="preload" as="font" type="font/woff2" href="/fonts/sora-latin.woff2" crossorigin />
  <link rel="preload" as="font" type="font/woff2" href="/fonts/inter-latin.woff2" crossorigin />
  <link rel="stylesheet" href="/css/style.css" />
  <link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/img/apple-touch-icon-180.png" />
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#3A6B35" />

  <script type="application/ld+json">${jsonLdScript}</script>
</head>
<body>

  <header class="header">
    <a href="/" class="header-marca">
      <picture>
        <source type="image/webp" srcset="/img/icon-transparent.webp" />
        <img src="/img/icon-transparent.png" alt="" class="header-marca-icon" aria-hidden="true" width="28" height="38" fetchpriority="high" />
      </picture>
      <div>
        <div class="logo">Tem em <span>Piranga</span></div>
        <div class="header-sub">Guia de comércios e serviços</div>
      </div>
    </a>
    <nav class="header-nav">
      <a href="/sobre" class="header-nav-link">Sobre</a>
      <a
        class="btn-anuncie-header"
        href="https://wa.me/5531996627923?text=Olá!%20Quero%20anunciar%20meu%20negócio%20no%20Tem%20em%20Piranga."
        target="_blank"
        rel="noopener noreferrer"
      >Anuncie aqui</a>
    </nav>
  </header>

  <main class="main">
    <p style="margin-bottom:16px">
      <a href="/" style="color:var(--verde);font-weight:600;font-size:0.85rem">← Voltar para o guia</a>
    </p>

    <article class="card${item.destaque ? ' destaque' : ''}" aria-label="${escapeHtml(item.nome)}">
      <div class="card-topo">
        <span class="card-categoria">${escapeHtml(item.categoria)}</span>
        ${item.destaque ? '<span class="badge-destaque">⭐ Destaque</span>' : ''}
      </div>
      <h1 class="card-nome">${escapeHtml(item.nome)}</h1>
      <p class="card-desc">${escapeHtml(item.descricao)}</p>
      <div class="card-meta">
        <span>🕐 ${escapeHtml(item.horario)}</span>
        <span>📍 ${escapeHtml(enderecoCompleto)}</span>
        ${rural}
      </div>
      <div class="card-acoes">
        <a class="btn-wpp" href="${wppLink}" target="_blank" rel="noopener noreferrer"
           aria-label="Abrir WhatsApp de ${escapeHtml(item.nome)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </a>
        <a class="btn-ligar" href="${telLink}" aria-label="Ligar para ${escapeHtml(item.nome)}">
          📞 Ligar
        </a>
        ${redesSociaisHTML(item)}
      </div>
    </article>
  </main>

  <footer class="footer">
    <picture>
      <source type="image/webp" srcset="/img/logo-tem-em-piranga.webp" />
      <img src="/img/logo-tem-em-piranga.png" alt="Tem em Piranga" class="footer-logo" width="72" height="72" loading="lazy" />
    </picture>
    <p>temempiranga.com.br · Piranga, Minas Gerais</p>
    <p><a href="/sobre">Sobre</a> · <a href="/contato">Contato</a> · <a href="/politica-de-privacidade">Privacidade</a> · <a href="/termos-de-uso">Termos</a></p>
    <p style="margin-top:6px;font-size:.7rem">© 2025 Tem em Piranga · Todos os direitos reservados</p>
  </footer>

</body>
</html>
`;
}

/* ─── redes sociais ─────────────────────────────────────── */
function socialLinks(item) {
  const links = [];
  if (item.instagram) {
    links.push({ tipo: 'instagram', url: `https://instagram.com/${item.instagram.replace(/^@/, '')}` });
  }
  if (item.facebook) {
    links.push({ tipo: 'facebook', url: `https://facebook.com/${item.facebook.replace(/^@/, '')}` });
  }
  return links;
}

const ICONES_SOCIAL_SVG = {
  instagram: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
  facebook: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12.061C22 6.505 17.523 2 12 2S2 6.505 2 12.061c0 5.022 3.657 9.184 8.438 9.939v-7.03H7.898v-2.909h2.54V9.845c0-2.522 1.492-3.916 3.777-3.916 1.094 0 2.238.196 2.238.196v2.475h-1.26c-1.243 0-1.63.775-1.63 1.57v1.891h2.773l-.443 2.909h-2.33V22c4.78-.755 8.437-4.917 8.437-9.939z"/></svg>',
};

function redesSociaisHTML(item) {
  const links = socialLinks(item);
  if (links.length === 0) return '';
  return links
    .map(l => `<a class="btn-social" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" aria-label="${l.tipo === 'instagram' ? 'Instagram' : 'Facebook'} de ${escapeHtml(item.nome)}">${ICONES_SOCIAL_SVG[l.tipo]}</a>`)
    .join('');
}

/* ─── sitemap.xml dinâmico ─────────────────────────────── */
async function handleSitemap(request, env, url) {
  const comercios = await loadComercios(request, env);
  const origin = url.origin;

  // Google documenta que ignora changefreq/priority — o sinal que ele
  // realmente usa é lastmod. Atualize SITE_LASTMOD quando editar o
  // conteúdo das páginas estáticas (home, sobre, contato, etc.).
  const SITE_LASTMOD = '2026-07-14';

  const staticUrls = [
    { loc: '/', lastmod: SITE_LASTMOD },
    { loc: '/sobre', lastmod: SITE_LASTMOD },
    { loc: '/contato', lastmod: SITE_LASTMOD },
    { loc: '/politica-de-privacidade', lastmod: SITE_LASTMOD },
    { loc: '/termos-de-uso', lastmod: SITE_LASTMOD },
  ];

  const comercioUrls = comercios
    .filter(c => c.ativo === true)
    .map(c => ({
      loc: `/comercio/${encodeURIComponent(c.id)}`,
      lastmod: c.atualizado_em || SITE_LASTMOD,
    }));

  const allUrls = [...staticUrls, ...comercioUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    u => `  <url>
    <loc>${escapeXml(origin + u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>
`;

  const headers = new Headers({
    'Content-Type': 'application/xml; charset=utf-8',
  });
  applySecurityHeaders(headers);
  const body = request.method === 'HEAD' ? null : xml;
  return new Response(body, { status: 200, headers });
}

/* ─── helpers de resposta ──────────────────────────────── */
function htmlResponse(html, status, method) {
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
  });
  applySecurityHeaders(headers);
  const body = method === 'HEAD' ? null : html;
  return new Response(body, { status, headers });
}

function applySecurityHeaders(headers) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function handleTurnstileConfig(request, env) {
  if (request.method !== 'GET') {
    return jsonResponse({ message: 'Método não permitido.' }, 405, {
      Allow: 'GET',
    });
  }

  if (!env.TURNSTILE_SITE_KEY) {
    return jsonResponse({ message: 'TURNSTILE_SITE_KEY não configurada.' }, 500);
  }

  return jsonResponse({ siteKey: env.TURNSTILE_SITE_KEY }, 200, {
    'Cache-Control': 'no-store',
  });
}

async function handleContact(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ message: 'Método não permitido.' }, 405, {
      Allow: 'POST, OPTIONS',
    });
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return jsonResponse({ message: 'Turnstile não configurado no servidor.' }, 500);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (err) {
    return jsonResponse({ message: 'Envie os dados do formulário novamente.' }, 400);
  }

  const token = formData.get('cf-turnstile-response');
  if (!token) {
    return jsonResponse({ message: 'Confirme a verificação do Turnstile.' }, 400);
  }

  const verification = await verifyTurnstile({
    secret: env.TURNSTILE_SECRET_KEY,
    token,
    ip: request.headers.get('CF-Connecting-IP'),
  });

  if (!verification.success) {
    return jsonResponse({ message: 'Não foi possível validar o Turnstile.' }, 403);
  }

  const contato = sanitizeContact(formData);
  if (!contato.nome || !contato.email || !contato.mensagem) {
    return jsonResponse({ message: 'Preencha nome, e-mail e mensagem.' }, 400);
  }

  if (!env.CONTACT_SMTP_PASSWORD) {
    return jsonResponse({ message: 'Envio de e-mail não configurado no servidor.' }, 500);
  }

  try {
    await sendContactEmail(env, contato);
  } catch (err) {
    console.error('Falha ao enviar e-mail de contato', err);
    return jsonResponse(
      { message: 'Não foi possível enviar sua mensagem agora. Tente novamente em instantes.' },
      502
    );
  }

  return jsonResponse({
    message: 'Mensagem enviada com sucesso.',
  });
}

async function sendContactEmail(env, contato) {
  const texto = [
    `Nome: ${contato.nome}`,
    `E-mail: ${contato.email}`,
    `WhatsApp: ${contato.whatsapp || '(não informado)'}`,
    '',
    'Mensagem:',
    contato.mensagem,
  ].join('\n');

  await WorkerMailer.send(
    {
      host: CONTACT_SMTP_HOST,
      port: CONTACT_SMTP_PORT,
      secure: true,
      credentials: {
        username: CONTACT_EMAIL,
        password: env.CONTACT_SMTP_PASSWORD,
      },
      authType: ['login', 'plain'],
    },
    {
      from: { name: 'Tem em Piranga — Site', email: CONTACT_EMAIL },
      to: { email: CONTACT_EMAIL },
      reply: { name: contato.nome, email: contato.email },
      subject: `Novo contato pelo site: ${contato.nome}`,
      text: texto,
    }
  );
}

async function verifyTurnstile({ secret, token, ip }) {
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);

  const resp = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    body,
  });

  if (!resp.ok) return { success: false };
  return resp.json();
}

function sanitizeContact(formData) {
  return {
    nome: normalizeField(formData.get('nome'), 120),
    email: normalizeField(formData.get('email'), 160),
    whatsapp: normalizeField(formData.get('whatsapp'), 30),
    mensagem: normalizeField(formData.get('mensagem'), 1200),
  };
}

function normalizeField(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
