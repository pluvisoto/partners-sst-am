# AGENTS.md - partners-sst-am (satelite de parceiros)

## Antes de qualquer alteracao

Consultar `.github/instructions/mapa-dependencias.instructions.md` para identificar o que pode quebrar, especialmente dependencias no core am-engenharia.

## Regra de isolamento (nao negociavel)

Este satelite usa APENAS `SUPABASE_ANON_KEY`. Nunca incluir service role, nunca copiar logica central do core, nunca criar dependencia alem de env.js com anon key.

## Instructions disponíveis em .github/instructions/

- `mapa-dependencias.instructions.md` - dependencias deste satelite e impacto do core (carregar SEMPRE)

## Vault do projeto

O vault do ecossistema fica em `Second Brain/AM Engenharia/`.
Mapa de dependencias deste satelite: `Second Brain/AM Engenharia/Referencias/mapa-dependencias-partners-sst-am.md`

## Checklist antes de publicar

- `env.js` aponta para producao (URL e anon key corretos)?
- Slug de parceiro real carrega branding corretamente?
- Formulario de registro funciona end-to-end?
- Redirect pos-cadastro vai para `SST_APP_URL/cliente`?
- Lead aparece vinculado ao parceiro correto no painel admin?

## Convencoes

- Tecnologia: HTML5 + JS vanilla (arquivo unico index.html)
- Roteamento SPA via Vercel (todas as rotas para index.html)
- Texto em portugues (pt-BR)
- Sem travessoes - sempre hifen simples -
- `env.js` nunca commitado (esta no .gitignore)
- Campo `partner_ref` SEMPRE preservado no registro de lead (vinculo de comissao)
