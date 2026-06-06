// /search-workers
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const elSkill = document.getElementById('skill');
  const elProvince = document.getElementById('province');
  const elDistrict = document.getElementById('district');
  const elSubdistrict = document.getElementById('subdistrict');
  const elAuto = document.getElementById('auto-expand');
  const btnSearch = document.getElementById('search-btn');
  const elResults = document.getElementById('results-area');

  // โหลด skill tree → flatten เป็น dropdown แบบ optgroup
  (async () => {
    try {
      const tree = await Api.get('/skills');
      const opts = ['<option value="">-- เลือกสกิล --</option>'];
      for (const cat of tree.categories) {
        opts.push(`<optgroup label="${UI.escapeHtml(cat.category_name_th)}">`);
        for (const sub of cat.subcategories) {
          for (const s of sub.skills) {
            opts.push(`<option value="${s.skill_id}">${UI.escapeHtml(s.skill_name_th)} (${UI.escapeHtml(sub.subcategory_name_th)})</option>`);
          }
        }
        opts.push('</optgroup>');
      }
      elSkill.innerHTML = opts.join('');
    } catch (err) {
      elSkill.innerHTML = '<option value="">โหลดสกิลไม่ได้</option>';
    }
  })();

  // จังหวัด → อำเภอ → ตำบล
  (async () => {
    try {
      const res = await Api.get('/locations/provinces');
      elProvince.innerHTML = '<option value="">-- เลือกจังหวัด --</option>' +
        res.provinces.map((p) => `<option value="${p.province_id}">${UI.escapeHtml(p.province_name_th)}</option>`).join('');
    } catch (err) {
      elProvince.innerHTML = '<option value="">โหลดไม่ได้</option>';
    }
  })();

  elProvince.addEventListener('change', async () => {
    const id = elProvince.value;
    elSubdistrict.disabled = true;
    elSubdistrict.innerHTML = '<option value="">เลือกอำเภอก่อน</option>';
    if (!id) {
      elDistrict.disabled = true;
      elDistrict.innerHTML = '<option value="">เลือกจังหวัดก่อน</option>';
      return;
    }
    elDistrict.disabled = false;
    elDistrict.innerHTML = '<option value="">กำลังโหลด...</option>';
    try {
      const res = await Api.get('/locations/districts', { query: { province_id: id } });
      elDistrict.innerHTML = '<option value="">-- ไม่ระบุ --</option>' +
        res.districts.map((d) => `<option value="${d.district_id}">${UI.escapeHtml(d.district_name_th)}</option>`).join('');
    } catch {
      elDistrict.innerHTML = '<option value="">โหลดไม่ได้</option>';
    }
  });

  elDistrict.addEventListener('change', async () => {
    const id = elDistrict.value;
    if (!id) {
      elSubdistrict.disabled = true;
      elSubdistrict.innerHTML = '<option value="">เลือกอำเภอก่อน</option>';
      return;
    }
    elSubdistrict.disabled = false;
    elSubdistrict.innerHTML = '<option value="">กำลังโหลด...</option>';
    try {
      const res = await Api.get('/locations/subdistricts', { query: { district_id: id } });
      elSubdistrict.innerHTML = '<option value="">-- ไม่ระบุ --</option>' +
        res.subdistricts.map((s) => `<option value="${s.subdistrict_id}">${UI.escapeHtml(s.subdistrict_name_th)} (${s.subdistrict_zip_code || '-'})</option>`).join('');
    } catch {
      elSubdistrict.innerHTML = '<option value="">โหลดไม่ได้</option>';
    }
  });

  btnSearch.addEventListener('click', async () => {
    UI.setFieldError('skill', null);
    if (!elSkill.value) {
      UI.setFieldError('skill', 'กรุณาเลือกสกิล');
      return;
    }
    if (!elProvince.value) {
      UI.toast('กรุณาเลือกจังหวัด', 'warning');
      return;
    }

    UI.setBtnLoading(btnSearch, true);
    elResults.innerHTML = '<div class="loading-block"><div class="spinner"></div><div>กำลังค้นหา...</div></div>';

    try {
      const query = {
        skill_id: elSkill.value,
        province_id: elProvince.value,
      };
      if (elDistrict.value) query.district_id = elDistrict.value;
      if (elSubdistrict.value) query.subdistrict_id = elSubdistrict.value;
      if (elAuto.checked) query.auto_expand = 'true';

      const res = await Api.get('/workers/search', { query });
      renderResults(res);
    } catch (err) {
      elResults.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">⚠</div>
        <div class="empty-state__title">ค้นหาไม่สำเร็จ</div>
        <p class="text-muted text-small">${UI.escapeHtml(err.message || '')}</p>
      </div>`;
    } finally {
      UI.setBtnLoading(btnSearch, false);
    }
  });

  function levelLabel(level) {
    if (level === 'subdistrict') return 'ตำบลที่เลือก';
    if (level === 'district') return 'อำเภอที่เลือก';
    if (level === 'province') return 'จังหวัดที่เลือก';
    return 'พื้นที่';
  }

  function renderResults(res) {
    if (!res.workers || res.workers.length === 0) {
      elResults.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">🔍</div>
        <div class="empty-state__title">ไม่พบช่างในพื้นที่นี้</div>
        <p class="text-muted text-small">${elAuto.checked ? 'ลองเปลี่ยนสกิลหรือพื้นที่' : 'ลองเปิด "ขยายค้นหาอัตโนมัติ"'}</p>
      </div>`;
      return;
    }

    const matchedHtml = res.matched_level ? `
      <div class="alert alert--info" style="margin-top: var(--space-md);">
        <span class="alert__icon">📍</span>
        <span>พบ <strong>${res.total}</strong> คน ใน${levelLabel(res.matched_level)}</span>
      </div>` : '';

    const cardsHtml = res.workers.map((w) => {
      const name = ((w.user_name || '') + ' ' + (w.user_lastname || '')).trim() || 'ผู้ใช้';
      const locParts = [w.subdistrict_name_th, w.district_name_th, w.province_name_th]
        .filter(Boolean).join(' · ');
      return `
        <a href="/worker/${w.worker_id}" class="worker-card">
          ${UI.avatar({ user_name: w.user_name, user_image: w.user_image }, 'md')}
          <div class="worker-card__info">
            <h4 class="worker-card__name">${UI.escapeHtml(name)}</h4>
            <span class="chip">${UI.escapeHtml(w.skill_name_th)}</span>
            <div class="worker-card__location">📍 ${UI.escapeHtml(locParts || 'ไม่มีข้อมูล')}</div>
            ${w.worker_resume ? `<div class="worker-card__resume">${UI.escapeHtml(w.worker_resume)}</div>` : ''}
          </div>
        </a>`;
    }).join('');

    elResults.innerHTML = matchedHtml + cardsHtml;
  }
})();
