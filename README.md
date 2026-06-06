# ChaungThai Web

เว็บแอป **ChaungThai** — แพลตฟอร์มจับคู่คนเก่งกับคนมีปัญหา

> ดีไซน์ mobile-first ใช้ดีไซน์เดียวกับ Flutter app (ขาว + #970000 + Sarabun)

## 🧰 Tech Stack

- **Node.js 22** + **Express 5** + **EJS** + **Vanilla JS** (ไม่มี frontend framework — เบาที่สุด)
- API call via `fetch()` → proxy ผ่าน `/api/*` ไปยัง backend (`http-proxy-middleware`)
- JWT เก็บใน `localStorage`
- รัน PM2 ที่ port **8086**

## 🚀 รัน local

```bash
# 1. ติดตั้ง deps
npm install

# 2. แก้ .env (copy จาก .env.example)
#    บน local ไม่มี backend → ใช้ API_TARGET=https://110.171.128.44
#    (browser อาจ block self-signed cert ตอน proxy — ใช้ NODE_TLS_REJECT_UNAUTHORIZED=0 ในกรณี dev)

# 3. รัน dev (auto reload)
npm run dev

# หรือรัน prod
npm start
```

เปิด: http://localhost:8086

## 📋 หน้าที่มี

| Path | ใช้ทำอะไร |
|---|---|
| `/` | Landing — ถ้า login แล้ว → /home |
| `/login`, `/register` | ฟอร์ม auth |
| `/forgot-password`, `/reset-password` | ลืม + รีเซ็ตรหัสผ่าน |
| `/home` | หน้าหลัก + bottom nav |
| `/profile` | ดูโปรไฟล์ |
| `/profile/edit` | แก้ข้อมูล + cascading location |
| `/profile/password` | เปลี่ยนรหัสผ่าน |
| `/verify-email`, `/verify-phone` | ยืนยัน (รองรับ dev mock) |
| `/become-worker` | สมัครเป็นช่าง + skill picker |
| `/worker/edit-skills` | แก้สกิลของช่าง |
| `/worker/:id` | รายละเอียดช่าง |
| `/search-workers` | ค้นหา |

## 🏗 โครงสร้าง

```
chaungthai_web/
├── server.js                  # Express + EJS + proxy
├── ecosystem.config.js        # PM2 config
├── .env / .env.example
├── views/                     # EJS templates
│   ├── partials/              # head, header, bottom-nav, foot
│   ├── auth/                  # login, register, ...
│   ├── profile/
│   ├── verify/
│   ├── worker/
│   ├── index.ejs, home.ejs, search.ejs, 404.ejs, 500.ejs
├── public/                    # static
│   ├── css/theme.css, components.css
│   ├── js/api.js, auth.js, ui.js, skill-tree.js
│   └── js/pages/<หน้า>.js     # logic แต่ละหน้า
└── package.json
```

## 🌐 API Proxy

server.js ใช้ `http-proxy-middleware` forward `/api/*` → `API_TARGET`

- **บน server** (production): `API_TARGET=http://localhost:3000` (เร็ว, ไม่มี cert issue)
- **บน local**: `API_TARGET=https://110.171.128.44` แต่ Node อาจ reject self-signed cert
  - แก้: รันด้วย `NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev` (dev เท่านั้น!)

## 📦 Deploy บน Server

```bash
# 1. SSH ไป server
ssh dew_server1@110.171.128.44 -p 9544

# 2. cd ไป path ของโปรเจกต์
cd ~/chaungthai_web

# 3. Pull ใหม่
git pull

# 4. npm install (ถ้ามี dep ใหม่)
npm ci --omit=dev

# 5. Restart PM2
pm2 reload chaungthai-web

# หรือถ้าครั้งแรก:
pm2 start ecosystem.config.js
pm2 save
```

## 🔐 บัญชีทดสอบ

| email | password | role |
|---|---|---|
| `test1@example.com` | `testpass1234` | worker |
