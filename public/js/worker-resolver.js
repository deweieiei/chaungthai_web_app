// ============================================================
//  worker-resolver.js — ค้นหา worker_id ของ user ปัจจุบัน
//
//  วิธีการ (เร็วและถูกต้องกว่าเดิม):
//  1. ลองอ่านจาก localStorage (Auth.getWorkerId)
//  2. เรียก GET /api/workers/by-user/:user_id (ใหม่ — direct lookup)
//  3. fallback: ถ้า endpoint ไม่มี (server เก่า) — search ผ่าน skill tree
// ============================================================
(function (global) {
  'use strict';

  const BATCH_SIZE = 12;

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
      // 5xx หรือ network error → ลอง fallback
      console.warn('[worker-resolver] direct lookup failed, fallback to skill search', err);
    }

    // 3. fallback: search ผ่าน skill tree (เผื่อ server ยังไม่ deploy by-user endpoint)
    let tree;
    try {
      tree = await Api.get('/skills');
    } catch (e) {
      return null;
    }
    const allSkillIds = [];
    for (const cat of tree.categories) {
      for (const sub of cat.subcategories) {
        for (const sk of sub.skills) {
          allSkillIds.push(sk.skill_id);
        }
      }
    }
    const provinceId = user.user_province_id || 1;

    for (let i = 0; i < allSkillIds.length; i += BATCH_SIZE) {
      const batch = allSkillIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (sid) => {
          try {
            const sRes = await Api.get('/workers/search', {
              query: {
                skill_id: sid,
                province_id: provinceId,
                auto_expand: 'true',
                limit: 100,
              },
            });
            const me = (sRes.workers || []).find(
              (w) => w.worker_user_id === user.user_id
            );
            return me ? me.worker_id : null;
          } catch {
            return null;
          }
        })
      );
      const found = results.find((r) => r !== null);
      if (found) {
        Auth.setWorkerId(found);
        return found;
      }
    }

    return null;
  }

  global.resolveWorkerId = resolveWorkerId;
})(window);
