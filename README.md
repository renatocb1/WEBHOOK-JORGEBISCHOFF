# Enviar mensagens via API oficial do WhatsApp (Meta)

App simples com interface web para enviar mensagens usando a **API oficial do WhatsApp** (WhatsApp Business Platform / Meta).

## O que você precisa

- **Token de Acesso** (temporário ou permanente) — você já tem
- **ID do Número de Telefone** (Phone Number ID) — você já tem

## Como rodar

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Na raiz do projeto, crie um arquivo chamado **`.env`** (copie do exemplo):

```bash
copy .env.example .env
```

Edite o `.env` e preencha:

- `WHATSAPP_TOKEN` = seu token do painel Meta (WhatsApp > API Setup)
- `PHONE_NUMBER_ID` = ID do número de telefone (também no API Setup)

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
