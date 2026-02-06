# Deploy completo na web (Render, etc.)

## Por que rodar tudo na nuvem?

O **webhook** que a Meta chama quando o cliente clica em "Ver Catálogo PDF" roda no **servidor que você publicou** (ex.: Render). Esse mesmo servidor precisa **ter o PDF** que foi enviado pelo card "Mensagem inicial (catálogo)".

- Se você usa a **interface na sua máquina** (localhost) e só o webhook no Render: o PDF fica salvo no seu PC. Quando o cliente clica, a Meta chama o Render, e o Render **não tem** esse arquivo → o PDF não é enviado.
- Se **toda a aplicação** roda na nuvem (uma única URL): você abre a interface no navegador (ex.: `https://sua-app.onrender.com`), envia o catálogo por lá, e quando o cliente clicar no botão, o **mesmo** servidor que tem o PDF recebe o webhook e envia o arquivo.

**Conclusão:** para o fluxo do catálogo funcionar de ponta a ponta, **publique a aplicação inteira** e use sempre a URL pública (não localhost) para enviar mensagens e configurar o webhook.

---

## Deploy no Render

1. **Repositório no GitHub**  
   Suba o projeto (sem `config.ini` e sem `.env` no repositório; use variáveis de ambiente no Render).

2. **Criar Web Service no Render**  
   - Connect GitHub → selecione o repositório.  
   - **Build Command:** `npm install`  
   - **Start Command:** `npm start`  
   - **Instance Type:** Free (ou pago, se quiser).

3. **Variáveis de ambiente (Environment)**  
   No painel do serviço, em **Environment**, defina:

   | Variável | Descrição |
   |----------|-----------|
   | `WHATSAPP_TOKEN` | Token da API WhatsApp (Meta) |
   | `PHONE_NUMBER_ID` | ID do número de telefone (Meta) |
   | `WEBHOOK_VERIFY_TOKEN` | Token que você coloca no portal Meta no Webhook |
   | `BASE_URL` | **URL do seu app no Render** (ex.: `https://sua-app.onrender.com`) — sem barra no final |

   Não commite `config.ini` nem `.env`; use só essas variáveis no Render.

4. **Deploy**  
   Após o deploy, sua app fica em algo como:  
   `https://sua-app.onrender.com`  
   - Interface: `https://sua-app.onrender.com`  
   - Webhook para a Meta: `https://sua-app.onrender.com/webhook`

5. **Configurar o Webhook na Meta**  
   - **Callback URL:** `https://sua-app.onrender.com/webhook`  
   - **Verify token:** o mesmo valor de `WEBHOOK_VERIFY_TOKEN`  
   - Assine o campo **messages**.

6. **Uso do catálogo**  
   - Abra **sempre** a interface pela URL do Render (não use localhost).  
   - No card "Mensagem inicial (catálogo)", envie o PDF e a mensagem com botão.  
   - O arquivo fica no servidor do Render; quando o cliente clicar, o webhook (no mesmo servidor) envia o PDF.

---

## Aviso: disco efêmero no Render (Free)

No plano **Free**, o disco do Render é **efêmero**: ao reiniciar ou “adormecer” o serviço, arquivos em `catalogs/` (como `current.pdf`) podem ser perdidos.

- Se o PDF sumir, **reenvie o catálogo** pelo card "Mensagem inicial (catálogo)" pela interface no Render antes de testar de novo.  
- Em planos pagos, o Render pode oferecer disco persistente; consulte a documentação deles.

---

## Resumo

| Onde roda a aplicação | Onde você usa a interface | Onde a Meta chama o webhook | O PDF está onde? | Envio do PDF ao clicar? |
|------------------------|---------------------------|-----------------------------|------------------|--------------------------|
| Só local (PC)          | localhost                 | Não alcança                 | No seu PC        | Não                      |
| Webhook no Render, UI no PC | localhost           | Render                      | No seu PC        | Não                      |
| **Tudo no Render**     | **URL do Render**         | **Render**                  | **No Render**    | **Sim**                  |

Use **uma única URL** (a do deploy) para acessar a interface, enviar mensagens e configurar o webhook. Assim, o mesmo servidor que guarda o PDF é o que recebe o clique e envia o arquivo.
