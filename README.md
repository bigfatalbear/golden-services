# Golden Services — Gestão de Serviços (PWA)

App premium de gestão para prestadores de serviços: agenda, clientes, orçamentos e painel.

## 🔐 Camada de segurança (e-mails autorizados)
Apenas **e-mails autorizados pelo proprietário** podem acessar:

- `authorized.json` contém os **hashes SHA-256** dos e-mails autorizados (nunca os e-mails em claro)
- O app compara o hash do e-mail digitado com a lista — sem correspondência, o acesso é bloqueado
- **Admin:** no portão, toque em "Acesso do admin →" e digite a **senha master** para liberar/gerenciar e-mails no aparelho
- Para autorizar em outros aparelhos: Admin → **⬇️ Baixar authorized.json** → commite no repo

### Senha master
Definida pelo proprietário (hash no `authorized.json`). Para trocar: gere o hash da nova senha em `/generate-hash.html` e substitua o campo `adminPassHash`.

## ✨ Recursos
- 📊 Painel com KPIs (agendamentos do dia, receita do mês, orçamentos pendentes, clientes)
- 📅 Agenda com data/hora e valor
- 👥 Clientes com telefone
- 🧾 Orçamentos com status e envio por WhatsApp
- 📴 Funciona offline (PWA)

## Instalar
GitHub Pages → "Adicionar à tela inicial".

⚠️ Conteúdo: os dados ficam no aparelho (localStorage). Autorização por topo do arquivo não substitui autenticação em servidor — adequada para uso doméstico/equipe pequena.
