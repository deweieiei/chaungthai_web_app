// /jobs — list งาน (3 tabs: ฉันรับ / ฉันจ้าง / ประวัติ)
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const me = Auth.getUser();
  const meId = me && me.user_id;

  const ACTIVE_STATUS = 'pending,not_started,in_progress';
  const HISTORY_STATUS = 'completed,declined,cancelled';

  const TAB_CONFIG = {
    worker:   { role: 'worker',   status: ACTIVE_STATUS },
    employer: { role: 'employer', status: ACTIVE_STATUS },
    history:  { role: null,       status: HISTORY_STATUS },
  };

  const tabs = document.querySelectorAll('#job-tabs .tab-segment__btn');
  const elList = document.getElementById('job-list');
  let currentTab = 'worker';

  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabs.forEach((b) => b.classList.remove('tab-segment__btn--active'));
      btn.classList.add('tab-segment__btn--active');
      currentTab = btn.dataset.tab;
      load();
    });
  });

  // หา "อีกฝ่าย" (peer) — ผู้ว่าจ้างถ้าเราเป็นช่าง, ช่างถ้าเราเป็นผู้ว่าจ้าง
  function peerOf(j) {
    if (j.job_worker_id === meId) {
      return {
        name: ((j.employer_name || '') + ' ' + (j.employer_lastname || '')).trim(),
        image: j.employer_image,
        peerLabel: 'ผู้ว่าจ้าง',
        myRole: 'worker',     // ฉันคือช่าง (ถูกจ้าง)
      };
    }
    return {
      name: ((j.worker_name || '') + ' ' + (j.worker_lastname || '')).trim(),
      image: j.worker_image,
      peerLabel: 'ช่าง',
      myRole: 'employer',     // ฉันคือผู้ว่าจ้าง
    };
  }

  // ป้าย "ยกเลิกโดยใคร" — เปลี่ยน user_id เป็น role ของคนในงาน
  function cancelledByLabel(j) {
    if (j.job_status !== 'cancelled' && j.job_status !== 'declined') return null;
    if (!j.job_cancelled_by) return null;
    const byId = j.job_cancelled_by;
    const role = byId === j.job_employer_id ? 'employer' : 'worker';
    const youOrThem = byId === meId
      ? 'คุณ'
      : (role === 'employer' ? 'ผู้ว่าจ้าง' : 'ช่าง');
    if (j.job_status === 'declined') return `ปฏิเสธโดย${youOrThem}`;
    return `ยกเลิกโดย${youOrThem}`;
  }

  function renderCard(j) {
    const peer = peerOf(j);
    const cancelText = cancelledByLabel(j);

    // chip บอก role ของฉันในงานนี้ (เด่นชัด สำหรับแท็บประวัติที่ปนกัน)
    const roleChip = peer.myRole === 'employer'
      ? '<span class="job-card__role job-card__role--employer">💼 ฉันจ้าง</span>'
      : '<span class="job-card__role job-card__role--worker">🔨 ฉันรับ</span>';

    const cardCls = 'job-card' +
      (peer.myRole === 'employer' ? ' job-card--employer' : ' job-card--worker');

    return `
      <a href="/jobs/${j.job_id}" class="${cardCls}">
        <div class="job-card__role-row">
          ${roleChip}
          ${JobHelpers.statusBadge(j.job_status)}
        </div>
        <div class="job-card__head">
          ${UI.avatar({ user_name: peer.name, user_image: peer.image }, 'sm')}
          <div class="job-card__head-info">
            <div class="text-tiny text-muted">${peer.peerLabel}</div>
            <div class="job-card__peer">${UI.escapeHtml(peer.name || 'ผู้ใช้')}</div>
          </div>
        </div>
        <div class="job-card__detail">${UI.escapeHtml(j.job_detail.length > 100 ? j.job_detail.slice(0, 100) + '...' : j.job_detail)}</div>
        <div class="job-card__meta">
          <span><strong>${JobHelpers.formatPrice(j.job_price)}</strong> บาท</span>
          <span class="text-muted">·</span>
          <span class="text-muted text-small">${JobHelpers.formatDate(j.job_start_date)} → ${JobHelpers.formatDate(j.job_deadline)}</span>
        </div>
        ${cancelText ? `<div class="job-card__cancel-note">⚠ ${UI.escapeHtml(cancelText)}</div>` : ''}
      </a>
    `;
  }

  function emptyMessage() {
    if (currentTab === 'worker') {
      return {
        title: 'ยังไม่มีงานที่กำลังดำเนินอยู่',
        sub: 'รอรับงานจากลูกค้า — งานที่จบแล้วดูได้ที่แท็บ "ประวัติ"',
        cta: '',
      };
    }
    if (currentTab === 'employer') {
      return {
        title: 'ยังไม่ได้จ้างใคร',
        sub: 'กดหาช่างเพื่อเริ่มจ้างงานแรก',
        cta: '<a href="/search-workers" class="btn btn--primary" style="margin-top: var(--space-md);">หาช่าง</a>',
      };
    }
    return {
      title: 'ยังไม่มีประวัติงาน',
      sub: 'งานที่เสร็จ, ปฏิเสธ, หรือยกเลิกจะมาแสดงที่นี่',
      cta: '',
    };
  }

  async function load() {
    elList.innerHTML = '<div class="loading-block"><div class="spinner"></div></div>';
    const cfg = TAB_CONFIG[currentTab];
    const query = { status: cfg.status };
    if (cfg.role) query.role = cfg.role;

    try {
      const res = await Api.get('/jobs', { query });
      const jobs = res.jobs || [];
      if (jobs.length === 0) {
        const e = emptyMessage();
        elList.innerHTML = `
          <div class="empty-state" style="margin-top: var(--space-xl);">
            <div class="empty-state__icon" aria-hidden="true">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-3V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>
            </div>
            <div class="empty-state__title">${UI.escapeHtml(e.title)}</div>
            <p class="text-muted text-small">${UI.escapeHtml(e.sub)}</p>
            ${e.cta}
          </div>`;
        return;
      }
      elList.innerHTML = jobs.map(renderCard).join('');
    } catch (err) {
      elList.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">⚠</div>
        <div class="empty-state__title">โหลดงานไม่สำเร็จ</div>
        <p class="text-muted text-small">${UI.escapeHtml(err.message || '')}</p>
      </div>`;
    }
  }

  load();
})();
