/**
 * Webhook que, ao receber o clique no botão "Ver Catálogo PDF", envia o PDF ao cliente via WhatsApp Cloud API.
 * Reformulado a partir de um app.js mínimo (GET/POST).
 *
 * Uso: renomeie para app.js no projeto WEBHOOK-JORGEBISCHOFF (ou use como está). Dependências: npm install express axios form-data
 *
 * Variáveis de ambiente (Render / .env):
 *   PORT, VERIFY_TOKEN, WHATSAPP_TOKEN, PHONE_NUMBER_ID
 *   Opcional: API_VERSION (ex: v22.0), CATALOG_PDF_PATH (caminho do PDF), BASE_URL (para enviar por link)
 *
 * Coloque o PDF em: catalogs/catalogo-padrao.pdf (ou defina CATALOG_PDF_PATH).
 * O botão enviado pela sua aplicação deve ter id "btn_catalogo".
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const token = (process.env.WHATSAPP_TOKEN || '').replace(/\s+/g, '').trim();
const phoneNumberId = (process.env.PHONE_NUMBER_ID || '').replace(/\s+/g, '').trim();
const apiVersion = (process.env.API_VERSION || 'v22.0').trim();
const baseUrl = (process.env.BASE_URL || '').trim();

// Caminho do PDF do catálogo (no repositório ou no servidor)
const defaultCatalogPath = path.join(__dirname, 'catalogs', 'catalogo-padrao.pdf');
const catalogPath = process.env.CATALOG_PDF_PATH
  ? path.resolve(__dirname, process.env.CATALOG_PDF_PATH)
  : defaultCatalogPath;

const apiUrl = () => `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

// Envia o PDF ao número via WhatsApp Cloud API
async function sendCatalogPdf(recipientPhone) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const caption = 'Aqui está o nosso catálogo!';

  if (!token || !phoneNumberId) {
    throw new Error('WHATSAPP_TOKEN e PHONE_NUMBER_ID devem estar configurados.');
  }

  const filePath = fs.existsSync(catalogPath) ? catalogPath : null;
  if (!filePath) {
    throw new Error(`PDF do catálogo não encontrado em: ${catalogPath}. Coloque catalogs/catalogo-padrao.pdf no projeto.`);
  }

  if (baseUrl) {
    const catalogUrl = `${baseUrl.replace(/\/$/, '')}/catalog`;
    await axios.post(apiUrl(), {
      messaging_product: 'whatsapp',
      to: String(recipientPhone),
      type: 'document',
      document: {
        link: catalogUrl,
        filename: 'Catalogo.pdf',
        caption
      }
    }, { headers });
  } else {
    const buffer = fs.readFileSync(filePath);
    const FormData = require('form-data');
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'application/pdf');
    form.append('file', buffer, { filename: 'catalogo.pdf' });
    const { data } = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`,
      form,
      { headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` }, maxBodyLength: Infinity, maxContentLength: Infinity }
    );
    const mediaId = data.id;
    await axios.post(apiUrl(), {
      messaging_product: 'whatsapp',
      to: String(recipientPhone),
      type: 'document',
      document: { id: mediaId, caption }
    }, { headers });
  }
}

// Rota GET: verificação do webhook (Meta envia hub.mode, hub.verify_token, hub.challenge)
app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': tokenQuery } = req.query;

  if (mode === 'subscribe' && tokenQuery === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Rota opcional: servir o PDF por URL (necessário se usar BASE_URL para enviar por link)
app.get('/catalog', (req, res) => {
  const filePath = fs.existsSync(catalogPath) ? catalogPath : null;
  if (!filePath) return res.status(404).send('Catálogo não disponível');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="catalogo.pdf"');
  res.sendFile(filePath);
});

// Rota POST: eventos do WhatsApp (quando o cliente clica no botão "Ver Catálogo PDF")
app.post('/', (req, res) => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\nWebhook received ${timestamp}\n`);
  res.status(200).end();

  const body = req.body;
  if (body?.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) return;

  for (const entry of body.entry) {
    const changes = entry.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      if (change?.field !== 'messages') continue;
      const value = change.value;
      const messages = value?.messages;
      if (!Array.isArray(messages)) continue;

      for (const msg of messages) {
        if (msg.type === 'interactive') {
          const interactive = msg.interactive;
          const buttonReply = interactive?.button_reply;
          if (interactive?.type === 'button_reply' && buttonReply?.id === 'btn_catalogo') {
            const from = msg.from;
            console.log(`Clique no catálogo detectado. Enviando PDF para ${from}`);
            sendCatalogPdf(from)
              .then(() => console.log(`PDF enviado com sucesso para ${from}`))
              .catch(err => console.error('Erro ao enviar catálogo:', err.response?.data || err.message));
          }
        }
      }
    }
  }
});

app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
  if (!verifyToken) console.log('Defina VERIFY_TOKEN para a verificação do webhook na Meta.');
  if (!token || !phoneNumberId) console.log('Defina WHATSAPP_TOKEN e PHONE_NUMBER_ID para enviar o PDF.');
  if (!fs.existsSync(catalogPath)) console.log(`Coloque o PDF em: ${catalogPath}`);
});
