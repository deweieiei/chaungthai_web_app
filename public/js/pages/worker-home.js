// /worker/home — หน้าหลักของ "บัญชีช่าง"
//
// ฝั่งช่างไม่มีแผนที่หาช่าง (นั่นเป็นเครื่องมือของผู้ว่าจ้าง)
// หน้านี้แทนที่ด้วยสิ่งที่ช่างต้องรู้จริง: สถานะตัวเอง งานที่รอตอบ และโปรไฟล์ครบหรือยัง
// ทุกตัวเลขมาจาก API จริงทั้งหมด ไม่มีข้อมูลสมมติ
(function () {
  'use strict';
  if (!Auth.guard()) return;

  // บัญชีผู้ว่าจ้างหลงเข้ามา → ส่งกลับแผนที่
  if (!Auth.isWorkerAccount()) {
    location.replace('/home');
    return;
  }

  const root = document.getElementById('worker-home');
  const user = Auth.getUser() || {};

  function card(inner) {
    return '<div class="card">' + inner + '</div>';
  }

  function checkRow(ok, label, href, hint) {
    return (
      '<a href="' + href + '" class="card-list__item">' +
        '<span class="card-list__icon">' + (ok ? '✅' : '⬜') + '</span>' +
        '<div class="card-list__main">' +
          '<div class="card-list__value">' + UI.escapeHtml(label) + '</div>' +
          (hint ? '<div class="card-list__label">' + UI.escapeHtml(hint) + '</div>' : '') +
        '</div>' +
        '<span class="card-list__trail">›</span>' +
      '</a>'
    );
  }

  (async function start() {
    const workerId = await resolveWorkerId(user);

    // ยังไม่ได้ตั้งโปรไฟล์ช่าง
    if (!workerId) {
      root.innerHTML =
        '<div class="empty-state" style="margin-top:var(--space-xl)">' +
          '<div class="empty-state__icon">🛠️</div>' +
          '<div class="empty-state__title">ยังตั้งโปรไฟล์ช่างไม่เสร็จ</div>' +
          '<p class="text-muted text-small">เลือกสกิลและปักหมุดจุดรับงาน แล้วคุณจะขึ้นบนแผนที่ให้คนแถวนั้นเห็น</p>' +
          '<a href="/become-worker" class="btn btn--primary btn--lg" style="margin-top:var(--space-lg)">ตั้งโปรไฟล์ช่าง</a>' +
        '</div>';
      return;
    }

    let d = null;
    try {
      d = await Api.get('/workers/' + workerId);
    } catch (err) {
      root.innerHTML =
        '<div class="empty-state"><div class="empty-state__icon">⚠</div>' +
        '<div class="empty-state__title">โหลดข้อมูลไม่สำเร็จ</div>' +
        '<p class="text-muted text-small">' + UI.escapeHtml(err.message || '') + '</p></div>';
      return;
    }

    const w = d.worker || {};
    const u = d.user || {};
    const skills = d.skills || [];
    const schedule = d.schedule || [];
    const isBusy = w.worker_availability === 'busy';
    const hasPin = w.worker_lat != null && w.worker_lng != null;

    // ---- งานที่รอเราตอบ ----
    let pendingCount = 0;
    try {
      const jobs = await Api.get('/jobs', {
        query: { role: 'worker', status: 'pending', limit: 50 },
      });
      pendingCount = (jobs.jobs || []).length;
    } catch (err) {
      // ไม่ critical — ปล่อยเป็น 0
    }

    const statusChip = isBusy
      ? '<span class="chip chip--warning">กำลังรับงานอยู่</span>'
      : '<span class="chip chip--success">ว่างรับงาน</span>';

    const onMap = !isBusy && hasPin;

    root.innerHTML =
      // ---- หัวข้อ ----
      '<div style="margin-bottom: var(--space-md);">' +
        '<h2 style="margin-bottom:4px;">สวัสดี ' + UI.escapeHtml(u.user_name || 'คุณช่าง') + '</h2>' +
        '<p class="text-small text-muted" style="margin:0;">ภาพรวมงานและโปรไฟล์ของคุณ</p>' +
      '</div>' +

      // ---- สถานะบนแผนที่ ----
      card(
        '<div class="card__title">สถานะตอนนี้ ' + statusChip + '</div>' +
        '<p class="text-small text-muted" style="margin:0;">' +
          (onMap
            ? 'คุณกำลังแสดงบนแผนที่ให้คนที่กำลังหาช่างแถวคุณเห็นอยู่'
            : isBusy
              ? 'ระหว่างรับงานอยู่ คุณจะไม่แสดงบนแผนที่ พอปิดงานแล้วจะกลับมาเอง'
              : 'คุณยังไม่แสดงบนแผนที่ เพราะยังไม่ได้ปักหมุดจุดรับงาน') +
        '</p>' +
        '<div class="card-list" style="margin-top:var(--space-sm)">' +
          '<div class="card-list__item" style="cursor:default">' +
            '<span class="card-list__icon">🎫</span>' +
            '<div class="card-list__main">' +
              '<div class="card-list__label">บัตรรับงานคงเหลือ</div>' +
              '<div class="card-list__value text-bold">' + (w.worker_job_tickets ?? 0) + ' ใบ</div>' +
            '</div>' +
          '</div>' +
          '<div class="card-list__item" style="cursor:default">' +
            '<span class="card-list__icon">✅</span>' +
            '<div class="card-list__main">' +
              '<div class="card-list__label">งานที่รับไปแล้วทั้งหมด</div>' +
              '<div class="card-list__value text-bold">' + (w.worker_total_jobs ?? 0) + ' งาน</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      ) +

      // ---- งานที่รอตอบ ----
      card(
        '<div class="card__title">💼 งานที่รอคุณตอบรับ</div>' +
        (pendingCount > 0
          ? '<p style="margin:0 0 var(--space-sm)">มี <strong>' + pendingCount + ' งาน</strong> รออยู่</p>' +
            '<a href="/jobs" class="btn btn--primary btn--block">ดูงานที่รออยู่</a>'
          : '<p class="text-small text-muted" style="margin:0">ยังไม่มีงานใหม่รออยู่ — มีคนจ้างเมื่อไหร่จะขึ้นตรงนี้</p>')
      ) +

      // ---- ความครบถ้วนของโปรไฟล์ ----
      card(
        '<div class="card__title">📋 ความพร้อมของโปรไฟล์</div>' +
        '<p class="text-small text-muted" style="margin:0 0 var(--space-sm)">' +
          'ยิ่งครบ ลูกค้ายิ่งกล้าจ้าง</p>' +
        '<div class="card-list">' +
          checkRow(skills.length > 0, 'ความสามารถ', '/worker/edit-skills',
            skills.length > 0 ? 'เลือกแล้ว ' + skills.length + ' อย่าง' : 'ยังไม่ได้เลือก') +
          checkRow(hasPin, 'จุดรับงานบนแผนที่', '/profile',
            hasPin ? 'รับงานในรัศมี ' + (w.worker_service_radius_km || 10) + ' กม.' : 'ยังไม่ได้ปักหมุด') +
          checkRow(schedule.length > 0, 'เวลาที่รับงานได้', '/worker/schedule',
            window.SchedulePicker ? SchedulePicker.describe(schedule) : '') +
          checkRow(Boolean(u.user_identity_verified_at), 'ยืนยันตัวตน', '/profile',
            u.user_identity_verified_at ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน — ยืนยันแล้วลูกค้าเห็นตำแหน่งคุณชัดขึ้น') +
          checkRow(w.worker_crime_check_status === 'approved', 'ประวัติอาชญากรรม', '/worker/crime-document',
            crimeHint(w)) +
          checkRow((d.portfolio_images || []).length > 0, 'รูปผลงาน', '/worker/portfolio',
            (d.portfolio_images || []).length > 0
              ? 'มี ' + d.portfolio_images.length + ' รูป' : 'ยังไม่มีรูป') +
        '</div>'
      ) +

      // ---- ปุ่มจัดการ (ย้ายมาจากแท็บช่างในโปรไฟล์) ----
      card(
        '<div class="card__title">⚙️ จัดการโปรไฟล์ช่าง</div>' +
        '<div class="card-list">' +
          actionRow('🛠', 'แก้ไขความสามารถ', '/worker/edit-skills') +
          actionRow('🕘', 'เวลาที่รับงานได้', '/worker/schedule') +
          actionRow('🪪', 'อัปโหลดประวัติอาชญากรรม', '/worker/crime-document') +
          actionRow('🖼', 'อัปโหลดรีซูเม่ / ผลงาน', '/worker/portfolio') +
          actionRow('📍', 'ย้ายจุดรับงาน / รัศมี', '/profile/edit') +
          actionRow('👁', 'ดูโปรไฟล์แบบที่ลูกค้าเห็น', '/worker/' + workerId) +
        '</div>'
      );
  })();

  function actionRow(icon, label, href) {
    return (
      '<a href="' + href + '" class="card-list__item">' +
        '<span class="card-list__icon">' + icon + '</span>' +
        '<div class="card-list__main"><div class="card-list__value">' +
          UI.escapeHtml(label) + '</div></div>' +
        '<span class="card-list__trail">›</span>' +
      '</a>'
    );
  }

  function crimeHint(w) {
    if (w.worker_crime_check_status === 'approved') return 'ผ่านการตรวจแล้ว';
    if (w.worker_crime_check_status === 'rejected') return 'ไม่ผ่าน — ส่งใหม่ได้';
    if (w.worker_crime_checked_at) return 'รอเจ้าหน้าที่ตรวจ';
    return 'ยังไม่ได้ส่งเอกสาร';
  }
})();
