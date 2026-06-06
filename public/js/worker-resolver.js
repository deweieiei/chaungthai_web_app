// ============================================================
//  worker-resolver.js — ค้นหา worker_id ของ user ปัจจุบัน
//
//  วิธีการ:
//  1. ลองอ่านจาก localStorage (Auth.getWorkerId)
//  2. ถ้าไม่มี — search ผ่าน skill tree แบบ batch parallel
//     เจอแล้ว → cache ไว้ใน localStorage
//  3. ถ้ายังไม่เจอ → return null (อาจไม่ใช่ช่าง)
// ============================================================
(function (global) {
  'use strict';

  const BATCH_SIZE = 12; // parallel calls ต่อ batch — กันโหลด server หนัก

  async function resolveWorkerId(user) {
    if (!user) return null;

    // 1. cache hit
    const cached = Auth.getWorkerId();
    if (cached) return cached;

    if (user.user_role !== 'worker') return null;

    // 2. โหลด skill tree → flatten ทุก skill_id
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

    // 3. search เป็น batch — เจอแล้วหยุด
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
