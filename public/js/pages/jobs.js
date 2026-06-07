// /jobs — list งาน (2 tabs: ที่ฉันรับ / ที่ฉันจ้าง)
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const tabs = document.querySelectorAll('#job-tabs .tab-segment__btn');
  const elList = document.getElementById('job-list');
  let currentRole = 'worker'; // default tab

  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabs.forEach((b) => b.classList.remove('tab-segment__btn--active'));
      btn.classList.add('tab-segment__btn--active');
      currentRole = btn.dataset.tab;
      load();
    });
  });

  function renderCard(j) {
    const peer = currentRole === 'worker'
      ? { name: (j.employer_name || '') + ' ' + (j.employer_lastname || ''), image: j.employer_image, label: 'ผู้ว่าจ้าง' }
      : { name: (j.worker_name || '') + ' ' + (j.worker_lastname || ''), image: j.worker_image, label: 'ช่าง' };
    return `
      <a href="/jobs/${j.job_id}" class="job-card">
        <div class="job-card__head">
          ${UI.avatar({ user_name: peer.name, user_image: peer.image }, 'sm')}
          <div class="job-card__head-info">
            <div class="text-tiny text-muted">${peer.label}</div>
            <div class="job-card__peer">${UI.escapeHtml(peer.name.trim() || 'ผู้ใช้')}</div>
          </div>
          ${JobHelpers.statusBadge(j.job_status)}
        </div>
        <div class="job-card__detail">${UI.escapeHtml(j.job_detail.length > 100 ? j.job_detail.slice(0, 100) + '...' : j.job_detail)}</div>
        <div class="job-card__meta">
          <span><strong>${JobHelpers.formatPrice(j.job_price)}</strong> บาท</span>
          <span class="text-muted">·</span>
          <span class="text-muted text-small">${JobHelpers.formatDate(j.job_start_date)} → ${JobHelpers.formatDate(j.job_deadline)}</span>
        </div>
      </a>
    `;
  }

  async function load() {
    elList.innerHTML = '<div class="loading-block"><div class="spinner"></div></div>';
    try {
      const res = await Api.get('/jobs', { query: { role: currentRole } });
      const jobs = res.jobs || [];
      if (jobs.length === 0) {
        elList.innerHTML = `
          <div class="empty-state" style="margin-top: var(--space-xl);">
            <div class="empty-state__icon" aria-hidden="true">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-3V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>
            </div>
            <div class="empty-state__title">ยังไม่มีงาน</div>
            <p class="text-muted text-small">
              ${currentRole === 'worker' ? 'รอรับงานจากลูกค้า' : 'ยังไม่ได้จ้างใคร'}
            </p>
            ${currentRole === 'employer' ? '<a href="/search-workers" class="btn btn--primary" style="margin-top: var(--space-md);">หาช่าง</a>' : ''}
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
