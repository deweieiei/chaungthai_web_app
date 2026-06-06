// /worker/:id
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const root = document.getElementById('detail-content');
  const workerId = root.dataset.workerId;

  function render(d) {
    const u = d.user;
    const w = d.worker;
    const loc = d.location || {};
    const fullName = ((u.user_name || '') + ' ' + (u.user_lastname || '')).trim() || 'ผู้ใช้';

    const verifiedBadges = [];
    if (u.user_email_verified_at) verifiedBadges.push('<span class="chip chip--success">✓ อีเมล</span>');
    if (u.user_phone_verified_at) verifiedBadges.push('<span class="chip chip--success">✓ เบอร์</span>');

    const locParts = [loc.subdistrict_name_th, loc.district_name_th, loc.province_name_th]
      .filter(Boolean).join(' · ');

    // group skills by category
    const groups = {};
    for (const s of (d.skills || [])) {
      const k = s.skill_category_name_th || 'อื่นๆ';
      (groups[k] = groups[k] || []).push(s);
    }

    const phoneSection = u.user_phone
      ? `<a href="tel:${UI.escapeHtml(u.user_phone)}" class="card-list">
           <div class="card-list__item">
             <span class="card-list__icon" style="color: var(--success); font-size: 22px;">📞</span>
             <div class="card-list__main">
               <div class="card-list__label">โทรหา</div>
               <div class="card-list__value text-bold">${UI.escapeHtml(u.user_phone)}</div>
             </div>
             <span class="card-list__trail">›</span>
           </div>
         </a>`
      : '';

    const portfolioHtml = (d.portfolio_images || []).length === 0 ? '' : `
      <div class="card">
        <div class="card__title">🖼 ผลงาน</div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
          ${d.portfolio_images.map((p) => `
            <a href="${UI.escapeHtml(resolveImageUrl(p.worker_resume_image_url))}" target="_blank"
               style="aspect-ratio: 1; border-radius: var(--radius-md); overflow: hidden; background: var(--surface-alt);">
              <img src="${UI.escapeHtml(resolveImageUrl(p.worker_resume_image_url))}" alt="" style="width:100%; height:100%; object-fit: cover;">
            </a>
          `).join('')}
        </div>
      </div>`;

    root.innerHTML = `
      <div class="text-center">
        ${UI.avatar({ user_name: u.user_name, user_image: u.user_image }, 'xl')}
        <h2 style="margin-top: var(--space-sm);">${UI.escapeHtml(fullName)}</h2>
        <div class="chip-group" style="justify-content: center;">${verifiedBadges.join('')}</div>
      </div>

      <div class="stat-grid" style="margin-top: var(--space-md);">
        <div class="stat-box">
          <div class="stat-box__icon">🎫</div>
          <div class="stat-box__value">${w.worker_job_tickets}</div>
          <div class="stat-box__label">บัตรคงเหลือ</div>
        </div>
        <div class="stat-box">
          <div class="stat-box__icon">✓</div>
          <div class="stat-box__value">${w.worker_total_jobs}</div>
          <div class="stat-box__label">รับงานทั้งหมด</div>
        </div>
      </div>

      ${phoneSection}

      <div class="card">
        <div class="card__title">📍 ที่อยู่</div>
        <div>${UI.escapeHtml(locParts || '-')}</div>
        ${loc.zip_code ? `<div class="text-small text-muted">รหัสไปรษณีย์ ${loc.zip_code}</div>` : ''}
        ${u.user_address ? `<div style="margin-top: 6px;">${UI.escapeHtml(u.user_address)}</div>` : ''}
      </div>

      ${w.worker_resume ? `
      <div class="card">
        <div class="card__title">📝 ประวัติ</div>
        <div style="white-space: pre-wrap;">${UI.escapeHtml(w.worker_resume)}</div>
      </div>` : ''}

      <div class="card">
        <div class="card__title">🛠 สกิลของช่าง (${(d.skills || []).length})</div>
        ${Object.entries(groups).map(([cat, skills]) => `
          <div style="margin-top: var(--space-sm);">
            <div class="text-tiny text-muted text-bold" style="margin-bottom: 4px;">${UI.escapeHtml(cat)}</div>
            <div class="chip-group">
              ${skills.map((s) => `<span class="chip">${UI.escapeHtml(s.skill_name_th)}</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      ${portfolioHtml}
    `;
  }

  (async () => {
    try {
      const res = await Api.get('/workers/' + workerId);
      render(res);
    } catch (err) {
      const status = err.status;
      root.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">${status === 404 ? '🚫' : '⚠'}</div>
        <div class="empty-state__title">${status === 404 ? 'ไม่พบช่าง' : 'โหลดข้อมูลไม่ได้'}</div>
        <p class="text-muted text-small">${UI.escapeHtml(err.message || '')}</p>
        <a href="/search-workers" class="btn btn--outline btn--sm" style="margin-top: 12px;">กลับไปค้นหา</a>
      </div>`;
    }
  })();
})();
