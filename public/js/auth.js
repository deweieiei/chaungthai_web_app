// ============================================================
//  auth.js — JWT storage + auto guard
//
//  - เก็บ token + user ใน localStorage (เว็บ — ไม่มี SecureStorage)
//  - guard(): redirect ไป /login ถ้ายังไม่ login
//  - guestOnly(): redirect ไป /home ถ้า login แล้ว
// ============================================================
(function (global) {
  'use strict';

  const KEY_TOKEN = 'chaungthai_token';
  const KEY_USER = 'chaungthai_user';

  function getToken() {
    try { return localStorage.getItem(KEY_TOKEN); } catch { return null; }
  }

  function setToken(t) {
    try { localStorage.setItem(KEY_TOKEN, t); } catch {}
  }

  function getUser() {
    try {
      const s = localStorage.getItem(KEY_USER);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }

  function setUser(u) {
    try { localStorage.setItem(KEY_USER, JSON.stringify(u)); } catch {}
  }

  function clear() {
    try {
      localStorage.removeItem(KEY_TOKEN);
      localStorage.removeItem(KEY_USER);
    } catch {}
  }

  /** ตรวจ JWT exp (base64 decode payload) */
  function isTokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp) return false;
      return payload.exp * 1000 < Date.now();
    } catch { return true; }
  }

  function isLoggedIn() {
    const t = getToken();
    if (!t) return false;
    return !isTokenExpired(t);
  }

  /** ใช้บนหน้าที่ต้อง login — redirect ถ้าไม่ได้ login */
  function guard() {
    if (!isLoggedIn()) {
      clear();
      location.replace('/login');
      return false;
    }
    return true;
  }

  /** ใช้บนหน้า guest (login/register) — redirect ถ้า login แล้ว */
  function guestOnly() {
    if (isLoggedIn()) {
      location.replace('/home');
      return false;
    }
    return true;
  }

  function logout() {
    clear();
    location.replace('/login');
  }

  global.Auth = {
    getToken,
    setToken,
    getUser,
    setUser,
    clear,
    isLoggedIn,
    isTokenExpired,
    guard,
    guestOnly,
    logout,
  };
})(window);
