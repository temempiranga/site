export function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return jsonResponse({ message: 'Método não permitido.' }, 405, {
      Allow: 'GET',
    });
  }

  if (!env.TURNSTILE_SITE_KEY) {
    return jsonResponse({ message: 'TURNSTILE_SITE_KEY não configurada.' }, 500);
  }

  return jsonResponse({ siteKey: env.TURNSTILE_SITE_KEY });
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}
