---
description: "Mapa de dependencias do satelite partners-sst-am. Consultar ANTES de qualquer alteracao neste repo OU nas dependencias do core que este satelite consome."
applyTo: "**"
---

# Mapa de Dependencias - partners-sst-am

## REGRA DE ISOLAMENTO (nao negociavel)

Este satelite usa APENAS `SUPABASE_ANON_KEY`. Nunca incluir service role, nunca copiar logica central do core, nunca criar dependencia alem de env.js com anon key.

## PROTOCOLO OBRIGATORIO ANTES DE ALTERAR

**Passo 1** - Identificar se a mudanca e neste satelite ou no core am-engenharia.
**Passo 2** - Se for no core: verificar na tabela abaixo se a area afetada impacta este satelite.
**Passo 3** - Verificar `env.js` antes de qualquer publicacao.
**Passo 4** - Apos alterar: testar branding de parceiro (slug na URL) e formulario de registro.

---

## Features do satelite

### env.js / Configuracao de Ambiente
- **Depende de:** Vercel env vars, Supabase URL + ANON_KEY
- **Alimenta:** TODO O SATELITE - sem env.js nada funciona
- **Critico:** `env.js` nunca deve ser commitado com valores reais (esta no .gitignore)

### index.html - Landing Page Branded por Parceiro
- **Depende de:** env.js, RPC `get_partner_public_branding(referral_code)`, tabela `sales_page_config` (countdown)
- **Alimenta:** Captacao de leads pelos parceiros, experiencia do cliente prospectado
- **Atencao:** Slug da URL e o `referral_code` - slug invalido = pagina sem branding

### index.html - Registro de Lead
- **Depende de:** env.js, edge function `register-lead`, tabela `sales_leads`
- **Alimenta:** Criacao de usuario no core, vinculo lead-parceiro (comissao futura)
- **Critico:** Campo `partner_ref` deve ser preservado - e o vinculo para comissao

---

## O que no core am-engenharia quebra este satelite

| Mudanca no core | Feature afetada aqui | Risco |
|---|---|---|
| Edge function `register-lead` (payload/resposta) | Formulario de registro | CRITICO |
| RPC `get_partner_public_branding` (remocao ou schema) | Todas as paginas sem branding | CRITICO |
| Tabela `partners` (referral_code, logo, nome, cores) | Branding nao carrega | ALTO |
| Tabela `sales_leads` (schema) | Leads nao registrados | ALTO |
| Tabela `sales_page_config` (schema) | Countdown nao carrega | MEDIO |
| RLS anon em `partners` ou `sales_page_config` | Pagina carrega em branco | CRITICO |
| Campo `partner_ref` removido da criacao de usuario | Leads sem vinculo com parceiro | CRITICO |
| Rotacao do ANON_KEY sem redeploy | Todo o satelite para | CRITICO |

---

## Checklist antes de publicar

- [ ] `env.js` esta apontando para producao (URL e anon key corretos)?
- [ ] Slug de parceiro real carrega branding corretamente?
- [ ] Formulario de registro funciona end-to-end?
- [ ] Redirect pos-cadastro vai para `SST_APP_URL/cliente`?
- [ ] Lead aparece vinculado ao parceiro correto no painel admin?

---

## Mapa completo no vault

`Second Brain/AM Engenharia/Referencias/mapa-dependencias-partners-sst-am.md`
