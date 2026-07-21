// /worker/:id
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const root = document.getElementById('detail-content');
  const workerId = root.dataset.workerId;

  function render(d) {
    const u = d.user;
    const w = d.worker;
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

    // พื้นที่รับงาน — ตอนนี้เป็นหมุดบนแผนที่ + รัศมี ไม่ใช่จังหวัด/อำเภอ/ตำบลแล้ว
    const hasPin = w.worker_lat != null && w.worker_lng != null;
    const areaText = hasPin
      ? 'รับงานในรัศมี ' + (w.worker_service_radius_km || 10) + ' กม. จากจุดที่ปักไว้'
      : 'ยังไม่ได้ปักหมุดจุดรับงาน';
    const availText = w.worker_availability === 'busy'
      ? '<span class="chip chip--warning">กำลังรับงานอยู่</span>'
      : '<span class="chip chip--success">ว่างรับงาน</span>';

    // group skills by category
    const groups = {};
    for (const s of (d.skills || [])) {
      const k = s.skill_category_name_th || 'อื่นๆ';
      (groups[k] = groups[k] || []).push(s);
    }

    // เช็คว่าเป็น "ตัวเอง" ไหม — ไม่งั้นโชว์ปุ่มแชตกับตัวเองได้
    const meUser = Auth.getUser();
    const isSelf = meUser && meUser.user_id === u.user_id;

    const phoneRow = u.user_phone
      ? `<a href="tel:${UI.escapeHtml(u.user_phone)}" class="card-list__item">
           <span class="card-list__icon" style="color: var(--success); font-size: 22px;">📞</span>
           <div class="card-list__main">
             <div class="card-list__label">โทรหา</div>
             <div class="card-list__value text-bold">${UI.escapeHtml(u.user_phone)}</div>
           </div>
           <span class="card-list__trail">›</span>
         </a>`
      : '';

    const chatRow = !isSelf
      ? `<a href="/chat/${u.user_id}" class="card-list__item">
           <span class="card-list__icon" style="color: var(--primary); font-size: 22px;">💬</span>
           <div class="card-list__main">
             <div class="card-list__label">ส่งข้อความ</div>
             <div class="card-list__value text-bold">พูดคุยทางแชต</div>
           </div>
           <span class="card-list__trail">›</span>
         </a>`
      : '';

    const hireRow = !isSelf
      ? `<button type="button" class="card-list__item" id="hire-btn" style="background:transparent;border:0;width:100%;text-align:left;cursor:pointer;">
           <span class="card-list__icon" style="color: var(--success); font-size: 22px;">💼</span>
           <div class="card-list__main">
             <div class="card-list__label">จ้างงาน</div>
             <div class="card-list__value text-bold">สร้างงานให้ช่างคนนี้</div>
           </div>
           <span class="card-list__trail">›</span>
         </button>`
      : '';

    const phoneSection = (phoneRow || chatRow || hireRow)
      ? `<div class="card-list">${phoneRow}${chatRow}${hireRow}</div>`
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

    // ปุ่มดาว — ใต้รูป (ซ่อนถ้าเป็นตัวเอง)
    const favButtonHtml = !isSelf ? `
      <div style="display: flex; justify-content: center; margin-top: var(--space-sm);">
        <button type="button" class="fav-pill" id="fav-btn" aria-pressed="false" aria-label="ติดดาวช่าง">
          <svg class="fav-pill__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span class="fav-pill__label">ติดดาว</span>
        </button>
      </div>` : '';

    root.innerHTML = `
      <div class="text-center">
        ${UI.avatar({ user_name: u.user_name, user_image: u.user_image }, 'xl')}
        ${favButtonHtml}
        <h2 style="margin-top: var(--space-sm);">${UI.escapeHtml(fullName)}</h2>
        <div class="chip-group" style="justify-content: center;">${verifiedBadges.join('')}</div>
      </div>

      <div class="stat-grid" style="margin-top: var(--space-md);">
        <div class="stat-box">
          <div class="stat-box__icon">✓</div>
          <div class="stat-box__value">${w.worker_total_jobs}</div>
          <div class="stat-box__label">รับงานทั้งหมด</div>
        </div>
        <div class="stat-box">
          <div class="stat-box__icon" style="opacity: ${u.user_identity_verified_at ? '1' : '0.4'};">🪪</div>
          <div class="stat-box__value" style="font-size: 1.1rem; color: ${u.user_identity_verified_at ? 'var(--success)' : 'var(--text-muted)'};">
            ${u.user_identity_verified_at ? '✓ ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}
          </div>
          <div class="stat-box__label">บัตรประชาชน</div>
        </div>
      </div>

      ${phoneSection}

      <div class="card">
        <div class="card__title">🕘 เวลาที่รับงาน</div>
        <div>${UI.escapeHtml(
          window.SchedulePicker
            ? SchedulePicker.describe(d.schedule)
            : 'ไม่ได้ระบุเวลา'
        )}</div>
      </div>

      <div class="card">
        <div class="card__title">📍 พื้นที่รับงาน ${availText}</div>
        <div>${UI.escapeHtml(areaText)}</div>
        ${hasPin ? '<div class="pinbox" style="margin-top:10px"><div class="pinbox__map" id="worker-map" style="height:200px"></div></div>' : ''}
        ${w.location_is_blurred ? '<div class="text-small text-muted" style="margin-top:6px">แสดงเป็นพื้นที่คร่าว ๆ · ยืนยันตัวตนแล้วจะเห็นชัดขึ้น</div>' : ''}
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

    if (hasPin) renderWorkerMap(w);
  }

  // แผนที่เล็กโชว์พื้นที่รับงานของช่าง
  async function renderWorkerMap(w) {
    const el = document.getElementById('worker-map');
    if (!el || !window.CtMap) return;
    try {
      await CtMap.ensureLeaflet();
    } catch {
      el.parentElement.remove();
      return;
    }
    const at = [Number(w.worker_lat), Number(w.worker_lng)];
    const map = CtMap.create('#worker-map', { center: at, zoom: 13, scrollWheelZoom: false });
    L.circle(at, {
      radius: (w.worker_service_radius_km || 10) * 1000,
      color: '#970000', weight: 1.5, fillColor: '#970000', fillOpacity: 0.08,
    }).addTo(map);
    L.marker(at, {
      icon: L.divIcon({
        className: '',
        html: '<div class="ct-pin"><span>🛠️</span></div>',
        iconSize: [38, 38], iconAnchor: [19, 38],
      }),
    }).addTo(map);
  }

  function bindHireButton(d) {
    const btn = document.getElementById('hire-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const fullName = ((d.user.user_name || '') + ' ' + (d.user.user_lastname || '')).trim() || 'ช่าง';
      JobHelpers.openHireModal({
        workerUserId: d.user.user_id,
        workerName: fullName,
      });
    });
  }

  function bindFavoriteButton(d) {
    const btn = document.getElementById('fav-btn');
    if (!btn) return;

    let isFav = !!d.is_favorited;
    const labelEl = btn.querySelector('.fav-pill__label');
    function paint() {
      btn.classList.toggle('fav-pill--on', isFav);
      btn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
      btn.setAttribute('aria-label', isFav ? 'ปลดดาวช่าง' : 'ติดดาวช่าง');
      if (labelEl) labelEl.textContent = isFav ? 'ติดดาวแล้ว' : 'ติดดาว';
    }
    paint();

    btn.addEventListener('click', async () => {
      const prev = isFav;
      isFav = !isFav;
      paint();
      try {
        if (isFav) {
          await Api.post('/favorites/workers/' + workerId);
          UI.toast('ติดดาวช่างคนนี้แล้ว', 'success');
        } else {
          await Api.delete('/favorites/workers/' + workerId);
          UI.toast('ปลดดาวแล้ว', 'info');
        }
      } catch (err) {
        // rollback
        isFav = prev;
        paint();
        UI.toast(err.message || 'ทำรายการไม่สำเร็จ', 'danger');
      }
    });
  }

  (async () => {
    try {
      const res = await Api.get('/workers/' + workerId);
      render(res);
      bindHireButton(res);
      bindFavoriteButton(res);
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
