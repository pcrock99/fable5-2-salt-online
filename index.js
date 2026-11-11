require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const compression = require('compression');
const apiRouter = require('./routes/api');
const { attachMultiplayer } = require('./realtime/multiplayer');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ASSET_VERSION = '20261111-comms';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

// 安全默认：只允许同源页面通过 iframe 嵌入。
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self';script-src 'self' 'unsafe-inline';style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;img-src 'self' data: blob:;connect-src 'self' ws: wss:;font-src 'self' data: https://fonts.gstatic.com;media-src 'self' data: blob:;worker-src 'self' blob:;frame-ancestors 'self';base-uri 'self';form-action 'self';object-src 'none';script-src-attr 'none';upgrade-insecure-requests"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(compression({ threshold: 1024 }));

const locales = {
  'zh-CN': require('./locales/zh-CN.json'),
  'en-US': require('./locales/en-US.json')
};

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  String(header).split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const rawKey = pair.slice(0, idx).trim();
      const rawValue = pair.slice(idx + 1).trim();
      try {
        cookies[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
      } catch (err) {
        cookies[rawKey] = rawValue;
      }
    }
  });
  return cookies;
}

function parseAcceptLanguage(header) {
  const value = String(header || '').split(',')[0] || '';
  return value.trim().toLowerCase();
}

// i18n 中间件：解析 lang cookie 与 Accept-Language，提供 req.lang / req.t(key)
app.use((req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  const accepted = parseAcceptLanguage(req.headers['accept-language']);
  let lang = cookies.lang;
  if (lang !== 'zh-CN' && lang !== 'en-US') {
    lang = accepted === 'en-us' || accepted.startsWith('en') ? 'en-US' : 'zh-CN';
  }
  req.lang = lang;
  req.t = (key) => {
    const dict = locales[req.lang] || locales['zh-CN'];
    return String(key || '').split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), dict) || String(key || '');
  };
  next();
});

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: '5m'
}));

app.use('/api', apiRouter);

app.get('/', (req, res) => {
  const queryLang = req.query && req.query.lang;
  const lang = queryLang === 'en-US' || queryLang === 'zh-CN' ? queryLang : req.lang;
  if (lang !== req.lang) {
    res.cookie('lang', lang, { httpOnly: false, sameSite: 'lax', maxAge: 365 * 24 * 3600 * 1000 });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.render('index', {
    t: (key) => {
      const dict = locales[lang] || locales['zh-CN'];
      return String(key || '').split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), dict) || String(key || '');
    },
    lang,
    messages: locales[lang] || locales['zh-CN'],
    assetVersion: ASSET_VERSION
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, message: req.t('msg.apiNotFound') });
});

app.use((req, res) => {
  res.status(404).send(req.t('msg.pageNotFound'));
});

app.use((err, req, res, next) => {
  console.error('[server]', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  const t = typeof req.t === 'function' ? req.t : (key) => key;
  const status = Number(err && (err.status || err.statusCode)) || 500;
  const message = status >= 500 ? t('msg.serverError') : t('msg.badRequest');
  if (req.path.startsWith('/api/')) {
    return res.status(status).json({ ok: false, message: message });
  }
  res.status(status).send(message);
});

const server = http.createServer(app);
attachMultiplayer(server);

server.listen(PORT, HOST, () => {
  console.log('Server running at http://' + HOST + ':' + PORT);
  console.log('Multiplayer WebSocket ready at ws://' + HOST + ':' + PORT + '/ws');
});
