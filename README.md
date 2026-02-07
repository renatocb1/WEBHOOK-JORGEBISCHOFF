# Enviar mensagens via API oficial do WhatsApp (Meta)

App com interface web para enviar mensagens, envio em massa e mensagem inicial com botão "Ver Catálogo PDF" (webhook) usando a **API oficial do WhatsApp** (Meta).

---

## Deploy: só fazer upload no GitHub

Para rodar na nuvem (Render) **basta subir o projeto no GitHub** e conectar ao Render:

1. **Coloque o PDF do catálogo no repositório**  
   Adicione o arquivo `catalogs/catalogo-padrao.pdf` (pasta `catalogs` já existe; veja `catalogs/README.md`).

2. **Envie tudo para o GitHub**  
   `git add .` → `git commit -m "Deploy"` → `git push`.

3. **No Render**  
   - Conecte o repositório do GitHub.  
   - Build: `npm install` | Start: `npm start` (já vêm do `package.json`).  
   - Em **Environment**, defina:  
     `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, `WEBHOOK_VERIFY_TOKEN`, `BASE_URL` (URL do seu app no Render, ex.: `https://seu-app.onrender.com`).

4. **Na Meta**  
   Webhook: URL = `https://seu-app.onrender.com/webhook`, Token = o mesmo de `WEBHOOK_VERIFY_TOKEN`. Assine o campo **messages**.

5. **Uso**  
   Acesse a URL do Render, use o card "Mensagem inicial (catálogo)" e escolha **"Usar catálogo do repositório"**. O PDF que está no GitHub será usado ao clicar no botão.

Detalhes: veja **DEPLOY.md** e **CONFIGURAR-WEBHOOK.md**.

---

## Rodar na sua máquina (local)

### O que você precisa

- **Token de Acesso** (temporário ou permanente) — painel Meta
- **ID do Número de Telefone** (Phone Number ID) — painel Meta

## Como rodar

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Na raiz do projeto, crie **`.env`** (copie de `.env.example`) ou use **`config.ini`**. O app usa variáveis de ambiente (Render, etc.) ou `config.ini` em local.

Edite e preencha:

- `WHATSAPP_TOKEN` = token do painel Meta (WhatsApp > API Setup)
- `PHONE_NUMBER_ID` = ID do número de telefone (API Setup)
- Para webhook/catálogo: `WEBHOOK_VERIFY_TOKEN`, `BASE_URL` (veja `.env.example`)

### 3. Iniciar o servidor

```bash
npm start
```

### 4. Abrir a interface

No navegador: **http://localhost:3000**

Informe o número (com DDI, ex: `5511999999999`) e a mensagem, depois clique em **Enviar**.

## Regras da API oficial

- **Janela de 24 horas:** mensagem de texto livre só pode ser enviada se o destinatário tiver falado com você nas últimas 24 horas.
- **Iniciar conversa:** para mensagem proativa (iniciar você), é preciso usar **Message Templates** pré-aprovados pela Meta.
- **Custos:** a Meta cobra por “conversas” (marketing, utilidade, autenticação, serviço). Números de teste no painel costumam ser gratuitos.

## Estrutura do projeto

- `server.js` — backend Express; rota `POST /send-message` chama a API do WhatsApp
- `public/index.html` — interface web para enviar mensagens
- `.env` — suas credenciais (não commitar; use `.env.example` como modelo)

## Webhook (próximo passo)

Se quiser **receber** respostas e eventos (entregue, lido, etc.) no seu app, é preciso configurar um Webhook no painel da Meta apontando para uma URL pública do seu servidor. Posso te guiar nisso depois.
