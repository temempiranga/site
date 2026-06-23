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
  "horario": "Seg–Sex, 8h–18h",
  "bairro": "Centro",
  "entrega_rural": false,
  "destaque": false,
  "ativo": true
}
```

**Categorias disponíveis:** Alimentação · Beleza · Mecânica · Saúde · Mercados · Construção · Serviços · Agro

## Deploy

O site é hospedado no **Cloudflare Pages** com deploy automático a cada push na branch `main`.

## Licença e dados

© 2025 Tem em Piranga — Todos os direitos reservados.  
Veja [LICENSE](./LICENSE) para detalhes.

Os dados em `data/` são proprietários e pertencem ao projeto Tem em Piranga e aos respectivos anunciantes.
