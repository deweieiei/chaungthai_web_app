// ============================================================
//  worker-resolver.js — ค้นหา worker_id ของ user ปัจจุบัน
//
//  วิธีการ:
//  1. ลองอ่านจาก localStorage (Auth.getWorkerId)
//  2. เรียก GET /api/workers/by-user/:user_id — direct lookup
// ============================================================
(function (global) {
  'use strict';

  async function resolveWorkerId(user) {
    if (!user) return null;

    // 1. cache hit
    const cached = Auth.getWorkerId();
    if (cached) return cached;

    if (user.user_role !== 'worker') return null;

    // 2. direct lookup ผ่าน API ใหม่
    try {
      const res = await Api.get('/workers/by-user/' + user.user_id);
      if (res && res.worker_id) {
        Auth.setWorkerId(res.worker_id);
        return res.worker_id;
      }
    } catch (err) {
      // 404 = ไม่ใช่ worker (แม้ user_role=worker — DB inconsistent)
      if (err && err.status === 404) return null;
      console.warn('[worker-resolver] lookup failed', err);
    }

    return null;
  }

  global.resolveWorkerId = resolveWorkerId;
})(window);
