// ============================================================
//  ChaungThai Web (simulator)
//  Express + EJS - render หน้าเว็บ
//  Client เรียก API ผ่าน fetch() ใน browser + เก็บ JWT ใน localStorage
// ============================================================

require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const API_BASE_URL = process.env.API_BASE_URL || 'https://110.171.128.44/api';

// view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// static files (css, js)
app.use(express.static(path.join(__dirname, 'public')));

// ทุกหน้าได้ตัวแปร API_BASE_URL เพื่อให้ template ส่งต่อให้ client-side JS
app.use((req, res, next) => {
  res.locals.API_BASE_URL = API_BASE_URL;
  res.locals.path = req.path;
  next();
});

// ============================================================
//  Pages
// ============================================================
app.get('/', (req, res) => res.render('index', { title: 'ChaungThai' }));
app.get('/register', (req, res) => res.render('register', { title: 'สมัครสมาชิก' }));
app.get('/login', (req, res) => res.render('login', { title: 'เข้าสู่ระบบ' }));
app.get('/home', (req, res) => res.render('home', { title: 'หน้าหลัก' }));
app.get('/profile', (req, res) => res.render('profile', { title: 'โปรไฟล์' }));
app.get('/become-worker', (req, res) => res.render('become-worker', { title: 'สมัครเป็นช่าง' }));
app.get('/search-workers', (req, res) => res.render('search', { title: 'หาช่าง' }));

// health
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'chaungthai-web' }));

// 404
app.use((req, res) => res.status(404).render('404', { title: 'ไม่พบหน้า' }));

app.listen(PORT, () => {
  console.log('============================================');
  console.log(`  ChaungThai Web`);
  console.log(`  Running:  http://localhost:${PORT}`);
  console.log(`  API base: ${API_BASE_URL}`);
  console.log(`  Env:      ${process.env.NODE_ENV || 'undefined'}`);
  console.log('============================================');
});
