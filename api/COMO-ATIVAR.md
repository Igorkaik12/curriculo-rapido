# Currículo Rápido — Pix na página + envio por e-mail e WhatsApp

Cliente preenche → CPF e WhatsApp → paga o Pix na própria página → o servidor confirma, gera o PDF
e envia por **e-mail e WhatsApp**. O botão "Baixar PDF" também aparece como reserva.

## 1. Subir no GitHub
Na raiz do repositório devem ficar: `index.html`, `imprimir.html`, `package.json`, `vercel.json` e a pasta `api/`.
- Pelo site: repositório → Add file → Upload files → arraste TODOS os arquivos e a pasta `api` → Commit.
- **Apague** `api/criar-cobranca.js` e `api/confirmar.js` (eram da InfinitePay).
- A Vercel publica sozinha quando o GitHub recebe o commit.

## 2. Variáveis na Vercel (Settings → Environment Variables → All Environments)
| Variável | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | Access Token de produção do Mercado Pago |
| `SITE_URL` | endereço do site com https, sem barra no final |
| `RESEND_API_KEY` | chave do Resend |
| `EMAIL_FROM` | ex.: `Currículo Rápido <contato@seudominio.com.br>` (domínio verificado no Resend) |
| `ZAPI_INSTANCE_ID` | id da instância Z-API |
| `ZAPI_TOKEN` | token da instância Z-API |
| `ZAPI_CLIENT_TOKEN` | token de segurança da conta Z-API |

O Redis já existe no projeto (`KV_REST_API_URL` e `KV_REST_API_TOKEN`) e é usado automaticamente.
Depois de salvar as variáveis, faça **Redeploy**.

## 3. Contas
- **Resend** (resend.com): criar conta, verificar um domínio seu, gerar a chave.
- **Z-API** (z-api.io): criar instância e conectar o WhatsApp lendo o QR Code. Use um número só para isso.

## 4. Teste
Pedido real do modelo mais barato → QR Code → pagar → mensagem "Pagamento confirmado" → PDF no e-mail e no WhatsApp.
Se algo falhar, os logs de `api/status` e `api/webhook` na Vercel mostram o motivo.

## Atenção
- Não consegui testar com Mercado Pago, Resend e Z-API de verdade: confirme na primeira compra de teste.
- Z-API não é a API oficial da Meta: há risco de bloqueio do número se enviar muito para quem nunca falou com ele.
- Preços: `api/_lib/modelos.js` e lista `T` do `index.html` (altere nos dois).
- O CPF vai direto ao Mercado Pago e não é guardado. Os dados do currículo ficam no Redis por até 30 dias.
