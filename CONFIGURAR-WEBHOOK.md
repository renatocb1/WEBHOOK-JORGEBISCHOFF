# Por que o PDF não chegou? Configure o Webhook

Quando o cliente **clica** em "Ver Catálogo PDF", a **Meta** envia um aviso para o **seu servidor** (webhook). Só então seu servidor envia o PDF. Se o webhook não estiver configurado ou o servidor não for acessível pela internet, **o PDF nunca é enviado**.

**Quer rodar tudo na nuvem (ex.: Render)?** O webhook e a aplicação precisam estar no **mesmo** servidor para o PDF ser enviado. Veja **[DEPLOY.md](DEPLOY.md)** para publicar a aplicação inteira e usar uma única URL.

Documentação oficial: [WhatsApp Cloud API - Webhooks (Meta)](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples)

---

## O que configurar

### 1. No seu projeto (config.ini ou .env)

Descomente e preencha:

```ini
# Token que você vai usar também no portal Meta (pode ser qualquer texto secreto)
WEBHOOK_VERIFY_TOKEN=minha_palavra_secreta_123

# Só precisa se quiser que a Meta baixe o PDF por link. Se deixar vazio, o servidor envia o PDF por upload.
# BASE_URL=https://sua-url-publica.com
```

Guarde o valor de `WEBHOOK_VERIFY_TOKEN` (ex.: `minha_palavra_secreta_123`) para colar no portal da Meta no passo 3.

---

### 2. Servidor acessível pela internet

A Meta só consegue chamar seu servidor se a URL for **pública**. Em desenvolvimento no PC:

- Use **ngrok** (ou similar):
  1. Instale: https://ngrok.com
  2. Rode seu servidor Node: `node server.js`
  3. Em outro terminal: `ngrok http 3000`
  4. Copie a URL HTTPS que aparecer (ex.: `https://abc123.ngrok.io`) — essa será sua URL pública.

Em produção, use o domínio do seu servidor (ex.: `https://api.seudominio.com`).

---

### 3. No portal da Meta (obrigatório)

1. Acesse **Meta for Developers**: https://developers.facebook.com  
2. Abra seu **App** → menu **WhatsApp** → **Configuração** (ou **Configuration**).
3. Na seção **Webhook**:
   - Clique em **Configurar** ou **Edit**.
   - **URL de callback**: `https://SUA-URL-PUBLICA/webhook`  
     Ex.: `https://abc123.ngrok.io/webhook` (com ngrok) ou `https://api.seudominio.com/webhook`.
   - **Token de verificação**: o **mesmo** valor que está em `WEBHOOK_VERIFY_TOKEN` no config.ini (ex.: `minha_palavra_secreta_123`).
   - Clique em **Verificar e salvar** (ou **Verify and save**).  
     Se der certo, o portal aceita e a URL fica configurada.
4. Em **Campos de webhook** (Webhook fields), marque **messages** e salve.

Se a verificação falhar:

- Confirme que o servidor está rodando e que a URL está correta (incluindo `/webhook`).
- Confirme que o token no portal é **idêntico** ao `WEBHOOK_VERIFY_TOKEN` do config.ini (sem espaço no fim).

---

### 4. Testar de novo

1. Reinicie o servidor Node (para carregar o `WEBHOOK_VERIFY_TOKEN`).
2. Envie de novo a mensagem com o botão "Ver Catálogo PDF" para um número de teste.
3. No WhatsApp, **clique** em "Ver Catálogo PDF".
4. No terminal do servidor você deve ver algo como: `[Webhook] Clique no catálogo detectado, enviando PDF para 5511...`.  
   O PDF deve chegar no WhatsApp em seguida.

Se o servidor estiver em **localhost** sem ngrok (ou sem URL pública), a Meta **nunca** consegue chamar o webhook e o PDF não será enviado. O webhook **precisa** ser uma URL pública acessível pela internet.
