---
description: "Atualiza o mapa de dependencias do satelite partners-sst-am apos uma mudanca de contrato. Executar apos: nova feature adicionada ao index.html, edge function consumida alterada, tabela do core acessada com schema alterado, RLS de anon modificada."
---

# Prompt: Atualizar Mapa de Dependencias - partners-sst-am

## Contexto

O mapa de dependencias deste satelite fica em:
- Vault: `Second Brain/AM Engenharia/Referencias/mapa-dependencias-partners-sst-am.md` (fonte autoritativa)
- Repo: `.github/instructions/mapa-dependencias.instructions.md` (versao condensada para AI)

## Quando executar

- Nova secao ou feature adicionada ao `index.html`
- Edge function consumida por este satelite foi alterada no core
- Tabela do Supabase acessada por este satelite teve schema alterado
- RPC `get_partner_public_branding` foi alterado no core
- RLS para acesso anon foi modificada em tabela usada aqui
- Nova variavel de ambiente adicionada ou renomeada

## Tarefa

1. **Identificar o que mudou** com base na alteracao recente:
   - Qual feature do index.html foi afetada?
   - Qual edge function ou RPC foi alterado no core?
   - Qual tabela ou RLS foi modificada?

2. **Atualizar a secao correspondente** em `mapa-dependencias-partners-sst-am.md`:
   - `Implementado em:` - atualizar arquivos, edge functions, tabelas
   - `Upstream (depende de):` - atualizar dependencias
   - `Downstream (alimenta):` - atualizar o que pode ser afetado
   - `Risco de mudanca:` - reavaliar se necessario

3. **Atualizar a tabela** "O que no core am-engenharia quebra este satelite" se necessario

4. **Sincronizar com o instructions file** - refletir mudancas relevantes em `.github/instructions/mapa-dependencias.instructions.md`

## Confirmacao

Reportar: feature(s) atualizada(s), campos modificados, novo risco identificado se houver.
