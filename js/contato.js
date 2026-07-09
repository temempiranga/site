'use strict';

let turnstileSiteKey = '';

document.addEventListener('DOMContentLoaded', async () => {
  bindContato();
  await carregarTurnstileConfig();
  if (turnstileSiteKey) {
    carregarTurnstile();
  }
});

function bindContato() {
  const form   = document.getElementById('contato-form');
  const status = document.getElementById('contato-status');
  if (!form || !status) return;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const formData  = new FormData(form);

    status.textContent = '';
    status.className   = 'form-status';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try {
      const resp = await fetch(form.action, { method: 'POST', body: formData });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.message || 'Não foi possível enviar sua mensagem.');
      form.reset();
      if (window.turnstile) window.turnstile.reset();
      status.textContent = data.message || 'Mensagem enviada com sucesso.';
      status.classList.add('sucesso');
    } catch (err) {
      status.textContent = err.message;
      status.classList.add('erro');
      if (window.turnstile) window.turnstile.reset();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar mensagem';
    }
  });
}

async function carregarTurnstileConfig() {
  const widget = document.getElementById('turnstile-widget');
  if (!widget) return;
  try {
    const resp = await fetch('/api/turnstile-config');
    const data = await resp.json();
    if (!resp.ok || !data.siteKey) throw new Error(data.message || 'Turnstile não configurado.');
    turnstileSiteKey = data.siteKey;
  } catch (err) {
    const widget = document.getElementById('turnstile-widget');
    if (widget) widget.innerHTML = '<p class="form-status erro">' + escapeHtml(err.message) + '</p>';
  }
}

function carregarTurnstile() {
  const s  = document.createElement('script');
  s.src    = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.async  = true;
  s.onload = function () {
    const widget = document.getElementById('turnstile-widget');
    if (widget && window.turnstile) {
      window.turnstile.render(widget, { sitekey: turnstileSiteKey, theme: 'light' });
    }
  };
  document.head.appendChild(s);
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
