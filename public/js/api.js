// ============================================================
//  api.js — fetch wrapper สำหรับ /api/* (ผ่าน proxy ของ server.js)
//  - แนบ Bearer token อัตโนมัติถ้ามี
//  - ถ้าได้ 401 → ล้าง storage + ส่งไป /login
//  - error message เป็นไทยจาก backend ทั้งหมด
// ============================================================
(function (global) {
  'use strict';

  const BASE = '/api';

  function authHeader() {
    const token = global.Auth && global.Auth.getToken();
    return token ? { Authorization: 'Bearer ' + token } : {};
  }

  async function request(method, path, { body, headers, query, isForm } = {}) {
    let url = BASE + path;
    if (query) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === '') continue;
        qs.append(k, String(v));
      }
      const qsStr = qs.toString();
      if (qsStr) url += '?' + qsStr;
    }

    const init = {
      method,
      headers: {
        Accept: 'application/json',
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...authHeader(),
        ...(headers || {}),
      },
    };
    if (body !== undefined) {
      init.body = isForm ? body : JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(url, init);
    } catch (err) {
      // network error
      throw new ApiError(0, 'การเชื่อมต่อมีปัญหา ลองอีกครั้ง', err.message);
    }

    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try { data = await res.json(); } catch { data = null; }
    } else {
      try { data = await res.text(); } catch { data = null; }
    }

    if (!res.ok) {
      const message =
        (data && typeof data === 'object' && data.error) ||
        defaultMessageFor(res.status);

      // 401 → invalidate token + redirect
      if (res.status === 401 && global.Auth) {
        global.Auth.clear();
        const here = location.pathname;
        const isAuthPath = /^\/(login|register|forgot-password|reset-password|$|index)/.test(
          here
        );
        if (!isAuthPath) {
          location.replace('/login');
          // throw แบบเงียบเพื่อหยุด flow
          throw new ApiError(401, message);
        }
      }

      throw new ApiError(res.status, message, data && data.detail, data);
    }
    return data;
  }

  function defaultMessageFor(status) {
    switch (status) {
      case 0: return 'การเชื่อมต่อมีปัญหา';
      case 400: return 'ข้อมูลไม่ถูกต้อง';
      case 401: return 'กรุณาเข้าสู่ระบบอีกครั้ง';
      case 403: return 'ไม่มีสิทธิ์เข้าถึง';
      case 404: return 'ไม่พบข้อมูล';
      case 409: return 'ข้อมูลซ้ำกับที่มีอยู่';
      case 413: return 'ไฟล์ใหญ่เกินกำหนด';
      case 429: return 'ขอบ่อยเกินไป กรุณารอสักครู่';
      case 500: return 'เซิร์ฟเวอร์มีปัญหา';
      case 502: return 'เซิร์ฟเวอร์ภายในขัดข้อง';
      default: return 'เกิดข้อผิดพลาด';
    }
  }

  class ApiError extends Error {
    constructor(status, message, detail, data) {
      super(message);
      this.status = status;
      this.detail = detail;
      this.data = data;
    }
  }

  const Api = {
    get: (path, opts) => request('GET', path, opts),
    post: (path, body, opts) => request('POST', path, { ...opts, body }),
    put: (path, body, opts) => request('PUT', path, { ...opts, body }),
    patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
    delete: (path, body, opts) => request('DELETE', path, { ...opts, body }),
    upload: (path, formData) =>
      request('POST', path, { body: formData, isForm: true }),
  };

  /** ส่งคืน URL รูปแบบเต็ม (เผื่อ backend ส่งกลับเป็น /api/uploads/...) */
  function resolveImageUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//.test(path)) return path;
    // ใช้ relative — Express proxy /api/uploads/... → backend serve static
    return path;
  }

  global.Api = Api;
  global.ApiError = ApiError;
  global.resolveImageUrl = resolveImageUrl;
})(window);
