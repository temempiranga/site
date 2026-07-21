# Tem em Piranga — site

Guia digital de comércios e serviços de Piranga-MG.

**Site:** [temempiranga.com.br](https://temempiranga.com.br)  
**Contato:** contato@temempiranga.com.br

---

## Estrutura

```
site/
├── index.html              ← página principal
├── css/style.css           ← estilos
├── js/main.js              ← lógica de busca e filtro
├── data/comercios.json     ← dados dos anunciantes (proprietário)
├── img/                    ← fotos dos negócios
├── _headers                ← cabeçalhos de segurança (Cloudflare Pages)
├── _redirects              ← redirecionamentos (Cloudflare Pages)
└── .github/workflows/      ← validações automáticas
```

## Como adicionar um anunciante

Edite `data/comercios.json` seguindo o modelo:

```json
{
  "id": "nome-do-negocio",
  "nome": "Nome do Negócio",
  "categoria": "Alimentação",
  "descricao": "Descrição curta do serviço.",
  "telefone": "3131999999",
  "whatsapp": "5531999999999",
  "instagram": "perfil_instagram",
  "facebook": "perfil_facebook",
  "horario": "Seg–Sex, 8h–18h",
  "bairro": "Centro",
  "entrega_rural": false,
  "destaque": false,
  "ativo": true
}
```

**Categorias disponíveis:** Alimentação · Beleza · Mecânica · Saúde · Mercados · Construção · Serviços · Agro

`instagram` e `facebook` são opcionais: informe apenas o usuário/handle (sem `@`, sem URL completa). Se o comércio não tiver a rede, omita o campo — a URL completa (`https://instagram.com/<usuário>` ou `https://facebook.com/<usuário>`) é montada automaticamente na renderização do card e da página individual, e entra no `sameAs` do schema `LocalBusiness`.

## Deploy

O site é hospedado no **Cloudflare Pages** com deploy automático a cada push na branch `main`.

## Formulário de contato com Turnstile

O formulário de contato usa **Cloudflare Turnstile** para validar envios em `/api/contact`.

O deploy usa um Worker em `src/worker.js` com binding de assets estáticos. Isso é necessário para o Cloudflare liberar **Variables and Secrets**; Workers criados apenas com static assets não aceitam variáveis pelo painel.

A `TURNSTILE_SITE_KEY` é lida pelo front via `/api/turnstile-config`. Como não é segredo (fica embutida no HTML do widget), ela é declarada em `vars` no `wrangler.jsonc` e versionada no repo — **não** cadastre-a só pelo painel: `wrangler deploy` sincroniza `vars` de forma declarativa a cada deploy e apaga qualquer variable que não esteja no arquivo.

A `TURNSTILE_SECRET_KEY` é segredo, fica só na Cloudflare (nunca no repo) e é configurada via CLI:

```sh
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Secrets (`wrangler secret put`) não sofrem esse problema de sincronização — persistem entre deploys independente do `wrangler.jsonc`.

Depois de validado pelo Turnstile, o envio é feito via [Resend](https://resend.com) (API HTTP, chamada com `fetch` — sem dependências). Tentamos primeiro enviar por SMTP direto da Hostinger (`smtp.hostinger.com`), mas esse host resolve para um IP da própria Cloudflare, e o Workers bloqueia conexões TCP de saída para IPs da rede Cloudflare; a Hostinger confirmou que não existe um host alternativo fora dessa rota, então a saída é um envio HTTP. O Worker envia como `contato@temempiranga.com.br`, com `Reply-To` para o e-mail informado no formulário — requer o domínio `temempiranga.com.br` verificado no Resend (registros SPF/DKIM adicionados no DNS da Cloudflare).

Configure a API key como secret:

```sh
npx wrangler secret put RESEND_API_KEY
```

Sem essa variável configurada, `/api/contact` responde `500` e não tenta enviar.

## Licença e dados

© 2025 Tem em Piranga — Todos os direitos reservados.  
Veja [LICENSE](./LICENSE) para detalhes.

Os dados em `data/` são proprietários e pertencem ao projeto Tem em Piranga e aos respectivos anunciantes.
