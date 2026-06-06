// PM2 ecosystem config — สำหรับ deploy บน server
//
// ใช้:
//   pm2 start ecosystem.config.js
//   pm2 reload chaungthai-web
//   pm2 logs chaungthai-web
//   pm2 save

module.exports = {
  apps: [
    {
      name: 'chaungthai-web',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8086,
        API_TARGET: 'http://localhost:3000',
      },
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
