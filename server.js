require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const FormData = require('form-data');

const app = express();
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = (file.mimetype === 'application/pdf' || (file.originalname || '').toLowerCase().endsWith('.pdf'));
    cb(null, !!ok);
  }
});

// Pasta para o catálogo atual (usado no fluxo botão → webhook → envio do PDF)
const CATALOGS_DIR = path.join(__dirname, 'catalogs');
const CURRENT_CATALOG_PATH = path.join(CATALOGS_DIR, 'current.pdf');
if (!fs.existsSync(CATALOGS_DIR)) fs.mkdirSync(CATALOGS_DIR, { recursive: true });

const storageCatalog = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CATALOGS_DIR),
  filename: (req, file, cb) => cb(null, 'current.pdf')
});
const uploadCatalog = multer({
  storage: storageCatalog,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = (file.mimetype === 'application/pdf' || (file.originalname || '').toLowerCase().endsWith('.pdf'));
    cb(null, !!ok);
  }
});

// Servir a interface web
app.use(express.static(path.join(__dirname, 'public')));

// Rota pública para o PDF do catálogo (Meta baixa por URL ao enviar document por link)
app.get('/catalog', (req, res) => {
  if (!fs.existsSync(CURRENT_CATALOG_PATH)) return res.status(404).send('Catálogo não disponível');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="catalogo.pdf"');
  res.sendFile(CURRENT_CATALOG_PATH);
});

// Carregar config.ini (linhas key=value; comentários com # ou ;)
function loadConfigIni() {
  const iniPath = path.join(__dirname, 'config.ini');
  if (!fs.existsSync(iniPath)) return {};
  const config = {};
  const content = fs.readFileSync(iniPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    config[key] = value;
  }
  return config;
}

const ini = loadConfigIni();
// Limpar token e ID (remover espaços, quebras de linha e caracteres invisíveis)
function cleanToken(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/\s+/g, '').replace(/\r/g, '').trim();
}
const TOKEN = cleanToken(ini.WHATSAPP_TOKEN || process.env.WHATSAPP_TOKEN);
const PHONE_NUMBER_ID = cleanToken(ini.PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID);
const API_VERSION = (ini.API_VERSION || process.env.API_VERSION || 'v22.0').trim();
const BASE_URL = (ini.BASE_URL || process.env.BASE_URL || '').trim();
const WEBHOOK_VERIFY_TOKEN = (ini.WEBHOOK_VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN || 'whatsapp_verify').trim();

if (!TOKEN || !PHONE_NUMBER_ID) {
  console.warn('⚠️  Configure WHATSAPP_TOKEN e PHONE_NUMBER_ID no arquivo config.ini (ou .env)');
}

// Upload de arquivo para a API Meta e retorno do media_id
async function uploadMediaToMeta(buffer, filename, mimeType) {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType || 'application/pdf');
  form.append('file', buffer, { filename: filename || 'document.pdf' });
  const { data } = await axios.post(
    `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/media`,
    form,
    {
      headers: { ...form.getHeaders(), 'Authorization': `Bearer ${TOKEN}` },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    }
  );
  return data.id;
}

// Mensagem inicial estilo Jasper Market: envia mensagem com BOTÃO "Ver Catálogo PDF"; ao clicar (webhook), o PDF é enviado
app.post('/send-initial-message', uploadCatalog.single('catalog'), async (req, res) => {
  const to = (req.body && req.body.to) ? String(req.body.to).trim() : '';
  const bodyText = (req.body && req.body.message != null) ? String(req.body.message).trim() : 'Gostaria de conferir nossas ofertas exclusivas? Clique no botão abaixo para receber o catálogo em PDF.';
  const headerText = (req.body && req.body.header != null) ? String(req.body.header).trim() : '';
  const footerText = (req.body && req.body.footer != null) ? String(req.body.footer).trim() : 'Clique no botão abaixo para baixar.';
  const file = req.file;

  if (!TOKEN || !PHONE_NUMBER_ID) {
    return res.status(500).json({
      error: 'Configuração incompleta. Verifique config.ini ou .env (WHATSAPP_TOKEN e PHONE_NUMBER_ID).'
    });
  }

  if (!to) {
    return res.status(400).json({ error: 'Envie "to" (número do destinatário).' });
  }

  if (!file) {
    return res.status(400).json({ error: 'Envie o PDF do catálogo (campo "catalog"). O arquivo fica salvo e será enviado quando o cliente clicar no botão.' });
  }

  const phone = to.replace(/\D/g, '');
  const apiUrl = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  const interactive = {
    type: 'button',
    body: { text: bodyText },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'btn_catalogo', title: 'Ver Catálogo PDF' } }
      ]
    }
  };
  if (headerText) interactive.header = { type: 'text', text: headerText };
  if (footerText) interactive.footer = { text: footerText };

  try {
    const response = await axios.post(apiUrl, {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'interactive',
      interactive
    }, { headers });
    return res.status(200).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: error.message };
    return res.status(status).json(data);
  }
});

// Envio único: aceita JSON ou multipart (com campo document = PDF)
app.post('/send-message', (req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) return upload.single('document')(req, res, next);
  next();
}, async (req, res) => {
  const to = (req.body && req.body.to) ? String(req.body.to).trim() : '';
  const message = req.body && req.body.message != null ? String(req.body.message).trim() : '';
  const hasFile = !!req.file;

  if (!TOKEN || !PHONE_NUMBER_ID) {
    return res.status(500).json({
      error: 'Configuração incompleta. Verifique config.ini ou .env (WHATSAPP_TOKEN e PHONE_NUMBER_ID).'
    });
  }

  if (!to) {
    return res.status(400).json({ error: 'Envie "to" (número do destinatário).' });
  }

  const phone = to.replace(/\D/g, '');
  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  // Envio de documento PDF (upload para Meta e depois envio por media_id)
  if (hasFile) {
    try {
      const mediaId = await uploadMediaToMeta(
        req.file.buffer,
        req.file.originalname || 'document.pdf',
        req.file.mimetype || 'application/pdf'
      );
      const body = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'document',
        document: {
          id: mediaId,
          caption: message || undefined
        }
      };
      if (!body.document.caption) delete body.document.caption;
      const response = await axios.post(url, body, { headers });
      return res.status(200).json(response.data);
    } catch (error) {
      const status = error.response?.status || 500;
      const data = error.response?.data || { error: error.message };
      return res.status(status).json(data);
    }
  }

  // Mensagem de texto (dentro da janela de 24h após o usuário falar)
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Envie "message" (texto) ou anexe um PDF.' });
  }

  try {
    const response = await axios.post(url, {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: message.trim() }
    }, { headers });
    res.status(200).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: error.message };
    res.status(status).json(data);
  }
});

// Envio em massa: aceita JSON ou multipart (com document = PDF)
app.post('/send-bulk', (req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) return upload.single('document')(req, res, next);
  next();
}, async (req, res) => {
  const contacts = req.body && req.body.contacts != null ? String(req.body.contacts).trim() : '';
  const message = req.body && req.body.message != null ? String(req.body.message).trim() : '';
  const hasFile = !!req.file;

  if (!TOKEN || !PHONE_NUMBER_ID) {
    return res.status(500).json({
      error: 'Configuração incompleta. Verifique config.ini ou .env (WHATSAPP_TOKEN e PHONE_NUMBER_ID).'
    });
  }

  if (!contacts) {
    return res.status(400).json({ error: 'Envie "contacts" (uma linha por contato: nome;telefone).' });
  }

  if (!hasFile && (!message || !message.trim())) {
    return res.status(400).json({ error: 'Envie "message" (texto) ou anexe um PDF.' });
  }

  const lines = contacts.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const list = [];
  for (const line of lines) {
    const idx = line.indexOf(';');
    const name = idx >= 0 ? line.slice(0, idx).trim() : '';
    const phoneRaw = idx >= 0 ? line.slice(idx + 1).trim() : line.trim();
    const phone = phoneRaw.replace(/\D/g, '');
    if (phone) list.push({ name, phone });
  }

  if (list.length === 0) {
    return res.status(400).json({ error: 'Nenhum contato válido (formato: nome;telefone por linha).' });
  }

  const results = [];
  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  let mediaId = null;
  if (hasFile) {
    try {
      mediaId = await uploadMediaToMeta(
        req.file.buffer,
        req.file.originalname || 'document.pdf',
        req.file.mimetype || 'application/pdf'
      );
    } catch (err) {
      const data = err.response?.data || {};
      return res.status(err.response?.status || 500).json({
        error: 'Falha ao enviar PDF para a Meta: ' + (data.error?.message || err.message)
      });
    }
  }

  for (const { name, phone } of list) {
    try {
      const textoPersonalizado = (message || '').trim().replace(/\$nome/g, name || '');
      let body;
      if (mediaId) {
        body = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'document',
          document: { id: mediaId, caption: textoPersonalizado || undefined }
        };
        if (!body.document.caption) delete body.document.caption;
      } else {
        body = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: textoPersonalizado }
        };
      }
      const response = await axios.post(url, body, { headers });
      results.push({ phone, name, success: true, messageId: response.data?.messages?.[0]?.id });
    } catch (err) {
      const data = err.response?.data || {};
      results.push({
        phone,
        name,
        success: false,
        error: data.error?.message || data.error?.error_user_msg || err.message
      });
    }
  }

  const ok = results.filter(r => r.success).length;
  const fail = results.filter(r => !r.success).length;
  res.status(200).json({
    total: results.length,
    success: ok,
    failed: fail,
    results
  });
});

// ========== WEBHOOK META (WhatsApp Cloud API) ==========
// Ref.: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
// Fluxo: 1) Meta envia GET para verificação | 2) Contato clica no botão → Meta envia POST → enviamos o PDF

// GET /webhook — Verificação do Webhook (obrigatório no painel Meta)
// Parâmetros: hub.mode=subscribe, hub.verify_token=SEU_TOKEN, hub.challenge=NUMERO
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token && token === WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    console.log('[Webhook] Verificação OK. Meta assinou o webhook.');
  } else {
    res.sendStatus(403);
  }
});

// Envia o PDF do catálogo ao número (após o retorno do contato = clique no botão)
async function sendCatalogPdf(recipientPhone) {
  const apiUrl = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
  const caption = 'Aqui está o nosso catálogo!';

  if (BASE_URL && fs.existsSync(CURRENT_CATALOG_PATH)) {
    const catalogUrl = `${BASE_URL.replace(/\/$/, '')}/catalog`;
    await axios.post(apiUrl, {
      messaging_product: 'whatsapp',
      to: String(recipientPhone),
      type: 'document',
      document: {
        link: catalogUrl,
        filename: 'Catalogo.pdf',
        caption
      }
    }, { headers });
  } else if (fs.existsSync(CURRENT_CATALOG_PATH)) {
    const buffer = fs.readFileSync(CURRENT_CATALOG_PATH);
    const mediaId = await uploadMediaToMeta(buffer, 'catalogo.pdf', 'application/pdf');
    await axios.post(apiUrl, {
      messaging_product: 'whatsapp',
      to: String(recipientPhone),
      type: 'document',
      document: { id: mediaId, caption }
    }, { headers });
  } else {
    throw new Error('Arquivo catalogs/current.pdf não encontrado. Envie o catálogo pelo card "Mensagem inicial (catálogo)" antes.');
  }
}

// POST /webhook — Recebe eventos da Meta (retorno do contato: mensagens, cliques em botão, etc.)
// Resposta 200 imediata exigida pela Meta; processamento após.
app.post('/webhook', (req, res) => {
  res.sendStatus(200);

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
        const type = msg.type;
        const from = msg.from;

        if (type === 'interactive') {
          const interactive = msg.interactive;
          const buttonReply = interactive?.button_reply;
          if (interactive?.type === 'button_reply' && buttonReply?.id === 'btn_catalogo') {
            console.log('[Webhook] Retorno do contato: clique em "Ver Catálogo PDF" de', from);
            sendCatalogPdf(from)
              .then(() => console.log('[Webhook] PDF enviado com sucesso para', from))
              .catch(err => console.error('[Webhook] Erro ao enviar catálogo:', err.response?.data || err.message));
          }
        }
      }
    }
  }
});

const PORT = ini.PORT || process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log('--- Mensagem inicial (catálogo): para o PDF ser enviado ao clicar no botão ---');
  console.log('1. Defina WEBHOOK_VERIFY_TOKEN no config.ini (ex.: WEBHOOK_VERIFY_TOKEN=meu_token_secreto)');
  console.log('2. Use uma URL pública (ex.: ngrok http 3000) e configure no portal Meta:');
  console.log('   WhatsApp > Configuração > Webhook > URL = https://SUA-URL/webhook, Token = mesmo do config.ini');
  console.log('3. Assine o campo "messages". Veja CONFIGURAR-WEBHOOK.md para o passo a passo.');
});
