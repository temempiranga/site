const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function onRequest(context) {
  const { request, env } = context;

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

  console.log('Contato validado pelo Turnstile', {
    nome: contato.nome,
    email: contato.email,
    whatsapp: contato.whatsapp,
    mensagem: contato.mensagem,
    turnstileHostname: verification.hostname,
  });

  return jsonResponse({
    message: 'Mensagem validada pelo Turnstile e recebida com sucesso.',
  });
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
