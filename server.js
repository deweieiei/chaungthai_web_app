// ============================================================
//  ChaungThai Web — Mobile-first web app
//  Express 5 + EJS + Vanilla JS
//  - หน้าเว็บ render ฝั่ง server (EJS)
//  - Client เรียก API ผ่าน fetch() ที่ /api/* → proxy ไป backend
//  - JWT เก็บใน localStorage (auth.js จัดการ)
// ============================================================

require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 8086;
const API_TARGET = process.env.API_TARGET || 'http://localhost:3000';
const IS_DEV = (process.env.NODE_ENV || 'development') !== 'production';
const ALLOW_SELF_SIGNED =
  (process.env.ALLOW_SELF_SIGNED || (IS_DEV ? 'true' : 'false')) === 'true';

if (ALLOW_SELF_SIGNED) {
  console.warn('[warn] ALLOW_SELF_SIGNED=true — proxy ข้าม TLS verification');
}

const TARGET_URL = new URL(API_TARGET);
const isHttps = TARGET_URL.protocol === 'https:';

// version สำหรับ cache busting (?v=...) — เปลี่ยนทุกครั้งที่ restart
const ASSET_VERSION = process.env.ASSET_VERSION || String(Date.now());

// Agent ใช้ keep-alive ต่อกับ backend
const upstreamAgent = isHttps
  ? new https.Agent({ keepAlive: true, rejectUnauthorized: !ALLOW_SELF_SIGNED })
  : new http.Agent({ keepAlive: true });

// ============================================================
//  View engine
// ============================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

// ตัวแปรที่ทุก EJS template (รวม partials ที่ include) เข้าถึงได้
app.locals.assetV = ASSET_VERSION;
app.locals.isDev = IS_DEV;

// ============================================================
//  Static
// ============================================================
app.use(
  '/static',
  express.static(path.join(__dirname, 'public'), {
    // เปลี่ยน max-age สั้นลง (1 ชม.) — ถ้าใช้ ?v= cache busting แล้ว
    // browser จะโหลดใหม่ทันทีเมื่อ version เปลี่ยน
    maxAge: IS_DEV ? 0 : '1h',
    etag: true,
  })
);

// ============================================================
//  API Proxy — /api/* → backend
//
//  เขียนเอง (ไม่ใช้ http-proxy-middleware) เพราะ:
//  - ต้องคุม TLS agent เพื่อข้าม self-signed cert ของ backend
//  - ต้อง pipe body แบบ raw stream (ไม่ใช้ express.json ก่อน)
// ============================================================
app.use('/api', (req, res) => {
  const lib = isHttps ? https : http;
  const upstreamPath = '/api' + req.url;

  const reqOpts = {
    hostname: TARGET_URL.hostname,
    port: TARGET_URL.port || (isHttps ? 443 : 80),
    method: req.method,
    path: upstreamPath,
    headers: {
      ...req.headers,
      host: TARGET_URL.host,
    },
    // ใช้ agent ที่ตั้ง rejectUnauthorized ไว้แล้ว
    // (ถ้า agent ถูก set แล้ว, rejectUnauthorized ของ reqOpts จะถูก ignore)
    agent: upstreamAgent,
    timeout: 30000,
  };

  const upstreamReq = lib.request(reqOpts, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
    upstreamRes.pipe(res);
  });

  upstreamReq.on('error', (err) => {
    console.error('[API proxy error]', err.code, err.message, '|', req.method, req.url);
    if (!res.headersSent) {
      res.status(502).json({
        error: 'การเชื่อมต่อเซิร์ฟเวอร์ภายในมีปัญหา ลองอีกครั้ง',
        detail: IS_DEV ? err.message : undefined,
      });
    }
  });

  upstreamReq.on('timeout', () => {
    upstreamReq.destroy(new Error('timeout'));
  });

  // pipe body จาก client → upstream (รองรับ POST/PUT/PATCH/multipart)
  req.pipe(upstreamReq);

  req.on('aborted', () => upstreamReq.destroy());
});

// ============================================================
//  Page helpers
// ============================================================
function page(req, res, view, opts = {}) {
  res.render(view, {
    title: opts.title || 'ChaungThai',
    activeTab: opts.activeTab || null,
    isDev: IS_DEV,
    path: req.path,
    assetV: ASSET_VERSION,
    ...opts,
  });
}

// ============================================================
//  Routes — Auth
// ============================================================
app.get('/', (req, res) => page(req, res, 'index', { title: 'ChaungThai' }));
app.get('/login', (req, res) => page(req, res, 'auth/login', { title: 'เข้าสู่ระบบ' }));
app.get('/register', (req, res) =>
  page(req, res, 'auth/register', { title: 'สมัครสมาชิก' })
);
app.get('/forgot-password', (req, res) =>
  page(req, res, 'auth/forgot-password', { title: 'ลืมรหัสผ่าน' })
);
app.get('/reset-password', (req, res) =>
  page(req, res, 'auth/reset-password', {
    title: 'ตั้งรหัสผ่านใหม่',
    token: req.query.token || '',
  })
);

// ============================================================
//  Routes — Main
// ============================================================
app.get('/home', (req, res) =>
  page(req, res, 'home', { title: 'หน้าหลัก', activeTab: 'home' })
);
app.get('/profile', (req, res) =>
  page(req, res, 'profile/index', { title: 'โปรไฟล์', activeTab: 'profile' })
);
app.get('/profile/edit', (req, res) =>
  page(req, res, 'profile/edit', { title: 'แก้ไขโปรไฟล์' })
);
app.get('/profile/password', (req, res) =>
  page(req, res, 'profile/password', { title: 'เปลี่ยนรหัสผ่าน' })
);
app.get('/verify-email', (req, res) =>
  page(req, res, 'verify/email', { title: 'ยืนยันอีเมล' })
);
app.get('/verify-phone', (req, res) =>
  page(req, res, 'verify/phone', { title: 'ยืนยันเบอร์โทร' })
);
app.get('/become-worker', (req, res) =>
  page(req, res, 'worker/become', { title: 'สมัครเป็นช่าง' })
);
app.get('/worker/edit-skills', (req, res) =>
  page(req, res, 'worker/edit-skills', { title: 'แก้ไขสกิล' })
);
app.get('/worker/:id', (req, res) =>
  page(req, res, 'worker/detail', {
    title: 'รายละเอียดช่าง',
    workerId: req.params.id,
  })
);
app.get('/search-workers', (req, res) =>
  page(req, res, 'search', { title: 'หาช่าง', activeTab: 'search' })
);
app.get('/chat', (req, res) =>
  page(req, res, 'chat', { title: 'แชต', activeTab: 'chat' })
);

// ============================================================
//  Health
// ============================================================
app.get('/healthz', (req, res) =>
  res.json({ status: 'ok', service: 'chaungthai-web', uptime: process.uptime() })
);

// ============================================================
//  404
// ============================================================
app.use((req, res) => {
  res.status(404);
  if (req.accepts('html')) {
    return page(req, res, '404', { title: 'ไม่พบหน้า' });
  }
  res.json({ error: 'Not Found' });
});

// ============================================================
//  Error handler
// ============================================================
app.use((err, req, res, _next) => {
  console.error('[server error]', err.stack || err);
  res.status(500);
  if (req.accepts('html')) {
    return page(req, res, '500', {
      title: 'ระบบมีปัญหา',
      error: IS_DEV ? err.message : undefined,
    });
  }
  res.json({ error: 'Internal Server Error' });
});

// ============================================================
//  Start
// ============================================================
app.listen(PORT, () => {
  console.log('============================================');
  console.log(`  ChaungThai Web v0.2.0`);
  console.log(`  ${new Date().toISOString()}`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  API proxy → ${API_TARGET}/api/*`);
  console.log(`  Env: ${process.env.NODE_ENV || 'development'}`);
  console.log('============================================');
});
