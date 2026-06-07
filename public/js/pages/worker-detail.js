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
    // crime check status chip
    const crimeStatus = w.worker_crime_check_status;
    if (crimeStatus === 'approved') {
      verifiedBadges.push('<span class="chip chip--success">✓ ตรวจประวัติ</span>');
    } else if (crimeStatus === 'rejected') {
      verifiedBadges.push('<span class="chip chip--danger">✗ ไม่ผ่านการตรวจ</span>');
    } else if (crimeStatus === 'pending' || w.worker_crime_checked_at) {
      verifiedBadges.push('<span class="chip chip--info">⏳ รอตรวจประวัติ</span>');
    } else {
      verifiedBadges.push('<span class="chip chip--warning">⚠ ยังไม่ตรวจประวัติ</span>');
    }

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

    // สถานะตรวจประวัติอาชญากรรม (card)
    const crimeStatusCard = (() => {
      const submitted = !!w.worker_crime_checked_at;
      const st = w.worker_crime_check_status;
      let strokeColor = 'var(--warning)';
      let iconPath = '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/>';
      let title = 'ยังไม่ได้ยืนยัน';
      let cls = 'text-muted';
      if (st === 'approved') {
        strokeColor = 'var(--success)';
        iconPath = '<path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>';
        title = 'ผ่านการตรวจสอบ';
        cls = '';
      } else if (st === 'rejected') {
        strokeColor = 'var(--danger)';
        iconPath = '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>';
        title = 'ไม่ผ่านการตรวจสอบ';
        cls = '';
      } else if (st === 'pending' || submitted) {
        strokeColor = 'var(--info)';
        iconPath = '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>';
        title = 'รอเจ้าหน้าที่ตรวจสอบ';
        cls = '';
      }

      const dateText = submitted
        ? `ยื่นเมื่อ ${UI.formatThaiDate(w.worker_crime_checked_at)}`
        : '';

      return `<div class="card">
          <div class="card__title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPath}</svg>
            ประวัติอาชญากรรม
          </div>
          <p class="text-small ${cls}" style="margin: 0; ${st === 'approved' ? 'color: var(--success);' : st === 'rejected' ? 'color: var(--danger);' : ''}">
            <strong>${title}</strong>${dateText ? ' · ' + dateText : ''}
          </p>
        </div>`;
    })();

    // ผลงาน (portfolio) — ถ้าว่าง โชว์ empty state
    const hasResume = !!w.worker_resume;
    const hasImages = (d.portfolio_images || []).length > 0;

    let portfolioCard = '';
    if (!hasResume && !hasImages) {
      portfolioCard = `
        <div class="card">
          <div class="card__title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
            รีซูเม่ / ผลงาน
          </div>
          <div class="empty-state" style="padding: var(--space-md) 0;">
            <div class="empty-state__icon" style="font-size: 40px;">📭</div>
            <div class="empty-state__title">ไม่มีรีซูเม่ หรือผลงาน</div>
            <p class="text-muted text-small">ช่างยังไม่ได้เพิ่มข้อมูลผลงานในตอนนี้</p>
          </div>
        </div>`;
    } else {
      const resumeBlock = hasResume ? `
        <div class="card">
          <div class="card__title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
            ประวัติ / รีซูเม่
          </div>
          <div style="white-space: pre-wrap;">${UI.escapeHtml(w.worker_resume)}</div>
        </div>` : '';

      const imagesBlock = hasImages ? `
        <div class="card">
          <div class="card__title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
            ผลงาน (${d.portfolio_images.length})
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: var(--space-sm);">
            ${d.portfolio_images.map((p) => `
              <a href="${UI.escapeHtml(resolveImageUrl(p.worker_resume_image_url))}" target="_blank"
                 style="aspect-ratio: 1; border-radius: var(--radius-md); overflow: hidden; background: var(--surface-alt); display: block;">
                <img src="${UI.escapeHtml(resolveImageUrl(p.worker_resume_image_url))}" alt="${UI.escapeHtml(p.worker_resume_image_caption || '')}" style="width:100%; height:100%; object-fit: cover;">
              </a>
            `).join('')}
          </div>
        </div>` : '';

      portfolioCard = resumeBlock + imagesBlock;
    }

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

      ${crimeStatusCard}

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

      ${portfolioCard}
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
