// /search-workers
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const elCategory = document.getElementById('category');
  const elSubcategory = document.getElementById('subcategory');
  const elSkill = document.getElementById('skill');
  const elProvince = document.getElementById('province');
  const elDistrict = document.getElementById('district');
  const elSubdistrict = document.getElementById('subdistrict');
  const elAuto = document.getElementById('auto-expand');
  const btnSearch = document.getElementById('search-btn');
  const elResults = document.getElementById('results-area');

  // collapsible form
  const elFormWrap = document.getElementById('search-form-wrap');
  const elSummary = document.getElementById('search-summary');
  const elSummaryText = document.getElementById('search-summary-text');
  const btnEdit = document.getElementById('search-edit-btn');

  function selectedOptionText(sel) {
    if (!sel || !sel.value) return null;
    const opt = sel.options[sel.selectedIndex];
    return opt ? opt.text : null;
  }

  function collapseForm() {
    const parts = [];
    // พื้นที่
    const prov = selectedOptionText(elProvince);
    const dist = selectedOptionText(elDistrict);
    const sub = selectedOptionText(elSubdistrict);
    const areaParts = [sub, dist, prov].filter(Boolean);
    if (areaParts.length) parts.push('📍 ' + areaParts.join(' · '));
    // สกิล
    const skillText = selectedOptionText(elSkill)
      || selectedOptionText(elSubcategory)
      || selectedOptionText(elCategory);
    if (skillText) parts.push('🔧 ' + skillText);
    elSummaryText.textContent = parts.join('  ·  ') || 'ค้นหาทั้งหมด';
    elFormWrap.hidden = true;
    elSummary.hidden = false;
  }

  function expandForm() {
    elSummary.hidden = true;
    elFormWrap.hidden = false;
  }

  btnEdit.addEventListener('click', expandForm);

  // เก็บ skill tree ทั้งหมดใน memory เพื่อ cascade
  let skillTree = null;
  // index ช่วย lookup เร็ว
  const subcatById = new Map();
  const skillById = new Map();

  // ----- โหลด skill tree -----
  (async () => {
    try {
      const tree = await Api.get('/skills');
      skillTree = tree;
      // populate category dropdown
      const opts = ['<option value="">— ทั้งหมด —</option>'];
      for (const cat of tree.categories) {
        opts.push(`<option value="${cat.skill_category_id}">${UI.escapeHtml(cat.skill_category_name_th)}</option>`);
        for (const sub of cat.subcategories) {
          subcatById.set(sub.skill_subcategory_id, { sub, cat });
          for (const sk of sub.skills) {
            skillById.set(sk.skill_id, { sk, sub, cat });
          }
        }
      }
      elCategory.innerHTML = opts.join('');
    } catch (err) {
      elCategory.innerHTML = '<option value="">โหลดหมวดไม่ได้</option>';
      console.error('[search] load skill tree', err);
    }
  })();

  // ----- cascade: category → subcategory -----
  elCategory.addEventListener('change', () => {
    const catId = Number(elCategory.value);
    // reset subcat + skill
    elSubcategory.value = '';
    elSkill.value = '';
    elSkill.disabled = true;
    elSkill.innerHTML = '<option value="">— ทั้งหมด —</option>';

    if (!catId || !skillTree) {
      elSubcategory.disabled = true;
      elSubcategory.innerHTML = '<option value="">— ทั้งหมด —</option>';
      return;
    }
    const cat = skillTree.categories.find((c) => c.skill_category_id === catId);
    if (!cat) {
      elSubcategory.disabled = true;
      return;
    }
    const opts = ['<option value="">— ทั้งหมดใน ' + UI.escapeHtml(cat.skill_category_name_th) + ' —</option>'];
    for (const sub of cat.subcategories) {
      opts.push(`<option value="${sub.skill_subcategory_id}">${UI.escapeHtml(sub.skill_subcategory_name_th)}</option>`);
    }
    elSubcategory.innerHTML = opts.join('');
    elSubcategory.disabled = false;
  });

  // ----- cascade: subcategory → skill -----
  elSubcategory.addEventListener('change', () => {
    const subId = Number(elSubcategory.value);
    elSkill.value = '';
    if (!subId) {
      elSkill.disabled = true;
      elSkill.innerHTML = '<option value="">— ทั้งหมด —</option>';
      return;
    }
    const info = subcatById.get(subId);
    if (!info) {
      elSkill.disabled = true;
      return;
    }
    const opts = ['<option value="">— ทั้งหมดใน ' + UI.escapeHtml(info.sub.skill_subcategory_name_th) + ' —</option>'];
    for (const sk of info.sub.skills) {
      opts.push(`<option value="${sk.skill_id}">${UI.escapeHtml(sk.skill_name_th)}</option>`);
    }
    elSkill.innerHTML = opts.join('');
    elSkill.disabled = false;
  });

  // ----- location cascade (เหมือนเดิม) -----
  // sort ภาษาไทย (ก-ฮ) — ใช้กับทุก dropdown location
  const TH_COLLATOR = new Intl.Collator('th', { sensitivity: 'base', numeric: true });
  function sortBy(arr, key) {
    return [...arr].sort((a, b) => TH_COLLATOR.compare(a[key] || '', b[key] || ''));
  }

  (async () => {
    try {
      const res = await Api.get('/locations/provinces');
      const items = sortBy(res.provinces, 'province_name_th');
      elProvince.innerHTML = '<option value="">-- เลือกจังหวัด --</option>' +
        items.map((p) => `<option value="${p.province_id}">${UI.escapeHtml(p.province_name_th)}</option>`).join('');
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
      const items = sortBy(res.districts, 'district_name_th');
      elDistrict.innerHTML = '<option value="">-- ไม่ระบุ --</option>' +
        items.map((d) => `<option value="${d.district_id}">${UI.escapeHtml(d.district_name_th)}</option>`).join('');
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
      const items = sortBy(res.subdistricts, 'subdistrict_name_th');
      elSubdistrict.innerHTML = '<option value="">-- ไม่ระบุ --</option>' +
        items.map((s) => `<option value="${s.subdistrict_id}">${UI.escapeHtml(s.subdistrict_name_th)} (${s.subdistrict_zip_code || '-'})</option>`).join('');
    } catch {
      elSubdistrict.innerHTML = '<option value="">โหลดไม่ได้</option>';
    }
  });

  // ----- submit search -----
  btnSearch.addEventListener('click', async () => {
    UI.setFieldError('skill', null);
    if (!elProvince.value) {
      UI.toast('กรุณาเลือกจังหวัด', 'warning');
      return;
    }

    UI.setBtnLoading(btnSearch, true);
    elResults.innerHTML = '<div class="loading-block"><div class="spinner"></div><div>กำลังค้นหา...</div></div>';

    try {
      const query = { province_id: elProvince.value };
      if (elDistrict.value) query.district_id = elDistrict.value;
      if (elSubdistrict.value) query.subdistrict_id = elSubdistrict.value;
      if (elAuto.checked) query.auto_expand = 'true';

      // ส่ง filter ที่เฉพาะที่สุด (server จะใช้อันที่เฉพาะที่สุด แต่ส่งครบไปเลย)
      if (elSkill.value) query.skill_id = elSkill.value;
      else if (elSubcategory.value) query.skill_subcategory_id = elSubcategory.value;
      else if (elCategory.value) query.skill_category_id = elCategory.value;

      const res = await Api.get('/workers/search', { query });
      renderResults(res);
      // สำเร็จ → ย่อ form
      collapseForm();
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

  // เก็บ filter ปัจจุบันสำหรับ matching ใน worker card
  let currentFilter = null;

  // โหลด favorites ของฉัน (Set ของ worker_id) — ใช้แสดงสถานะปุ่มดาวในผลลัพธ์
  let favoriteIds = new Set();
  async function loadFavoriteIds() {
    try {
      const res = await Api.get('/favorites/workers');
      favoriteIds = new Set((res.favorites || []).map((f) => Number(f.worker_id)));
    } catch {
      // เงียบ — favorites ไม่ critical
    }
  }
  loadFavoriteIds();

  // toggle ดาว — กดจากในผลลัพธ์ (ไม่นำทางไปหน้าโปรไฟล์)
  async function toggleFav(workerId, btn) {
    const wid = Number(workerId);
    const wasOn = favoriteIds.has(wid);
    // optimistic
    if (wasOn) favoriteIds.delete(wid);
    else favoriteIds.add(wid);
    paintFavBtn(btn, !wasOn);
    try {
      if (wasOn) await Api.delete('/favorites/workers/' + wid);
      else await Api.post('/favorites/workers/' + wid);
    } catch (err) {
      // rollback
      if (wasOn) favoriteIds.add(wid);
      else favoriteIds.delete(wid);
      paintFavBtn(btn, wasOn);
      UI.toast(err.message || 'ทำรายการไม่สำเร็จ', 'danger');
    }
  }

  function paintFavBtn(btn, isOn) {
    btn.classList.toggle('worker-card__fav--on', isOn);
    btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    btn.setAttribute('aria-label', isOn ? 'ปลดดาว' : 'ติดดาว');
  }

  // delegated click — ปุ่มดาวในผลลัพธ์
  elResults.addEventListener('click', (e) => {
    const favBtn = e.target.closest('.worker-card__fav');
    if (!favBtn) return;
    e.preventDefault();
    e.stopPropagation();
    toggleFav(favBtn.dataset.workerId, favBtn);
  });

  function renderResults(res) {
    currentFilter = res.filter || {};
    if (!res.workers || res.workers.length === 0) {
      elResults.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">🔍</div>
        <div class="empty-state__title">ไม่พบช่างในพื้นที่นี้</div>
        <p class="text-muted text-small">${elAuto.checked ? 'ลองเปลี่ยนสกิลหรือพื้นที่' : 'ลองเปิด "ขยายค้นหาอัตโนมัติ"'}</p>
      </div>`;
      return;
    }

    // header สรุปผล
    const filterLabel = describeFilter(res.filter, res.applied_filter);
    const matchedHtml = `
      <div class="alert alert--info" style="margin-top: var(--space-md);">
        <span class="alert__icon">📍</span>
        <span>พบ <strong>${res.total}</strong> คน ${filterLabel ? '· ' + filterLabel + ' ' : ''}${res.matched_level ? 'ใน' + levelLabel(res.matched_level) : ''}</span>
      </div>`;

    const cardsHtml = res.workers.map((w) => renderWorkerCard(w, res.applied_filter)).join('');
    elResults.innerHTML = matchedHtml + cardsHtml;
  }

  function describeFilter(f, applied) {
    if (!f || !applied) return '';
    if (applied === 'skill') return `สกิล: ${UI.escapeHtml(f.skill_name_th || '')}`;
    if (applied === 'subcategory') return `สาขา: ${UI.escapeHtml(f.skill_subcategory_name_th || '')}`;
    if (applied === 'category') return `หมวด: ${UI.escapeHtml(f.skill_category_name_th || '')}`;
    return '';
  }

  // ตัดสินใจว่า skill นี้ "matched" filter ปัจจุบันไหม
  function isSkillMatched(skill, applied, filter) {
    if (!applied || !filter) return false;
    if (applied === 'skill') return skill.skill_id === filter.skill_id;
    if (applied === 'subcategory') return skill.skill_subcategory_id === filter.skill_subcategory_id;
    if (applied === 'category') return skill.skill_category_id === filter.skill_category_id;
    return false;
  }

  function renderWorkerCard(w, applied) {
    const name = ((w.user_name || '') + ' ' + (w.user_lastname || '')).trim() || 'ผู้ใช้';
    const locParts = [w.subdistrict_name_th, w.district_name_th, w.province_name_th]
      .filter(Boolean).join(' · ');

    const allSkills = Array.isArray(w.all_skills) ? w.all_skills : [];
    // แยก matched / unmatched ตาม filter
    const matched = [];
    const unmatched = [];
    for (const s of allSkills) {
      (isSkillMatched(s, applied, currentFilter) ? matched : unmatched).push(s);
    }

    // เรียง: matched ก่อน, unmatched ตาม
    const MAX_VISIBLE = 6;
    const visible = [...matched, ...unmatched].slice(0, MAX_VISIBLE);
    const moreCount = allSkills.length - visible.length;

    const chipsHtml = visible.map((s) => {
      const isMatched = matched.includes(s);
      const cls = isMatched ? 'chip chip--matched' : 'chip chip--neutral';
      const title = s.skill_subcategory_name_th
        ? `${s.skill_subcategory_name_th} · ${s.skill_category_name_th || ''}`
        : (s.skill_category_name_th || '');
      return `<span class="${cls}" title="${UI.escapeHtml(title)}">${isMatched ? '<span aria-hidden="true">✓</span> ' : ''}${UI.escapeHtml(s.skill_name_th)}</span>`;
    }).join('');
    const moreChip = moreCount > 0
      ? `<span class="chip chip--outline">+${moreCount} สกิล</span>`
      : '';

    // หา "สาขาเด่น" สำหรับโชว์ใต้ชื่อ — ใช้ category ของ matched skill อันแรก ถ้ามี
    let categoryLabel = '';
    if (matched.length > 0 && matched[0].skill_category_name_th) {
      categoryLabel = matched[0].skill_category_name_th;
    } else if (allSkills.length > 0 && allSkills[0].skill_category_name_th) {
      categoryLabel = allSkills[0].skill_category_name_th;
    }

    // หา subcategory label — ถ้า matched ทุกอันอยู่ subcat เดียวกัน แสดงชื่อนั้น
    let subcatLabel = '';
    if (matched.length > 0) {
      const uniqueSubs = [...new Set(matched.map((s) => s.skill_subcategory_name_th).filter(Boolean))];
      if (uniqueSubs.length === 1) subcatLabel = uniqueSubs[0];
    }

    const totalJobs = w.worker_total_jobs ?? 0;

    const isFav = favoriteIds.has(Number(w.worker_id));
    return `
      <a href="/worker/${w.worker_id}" class="worker-card worker-card--rich">
        <button type="button"
          class="worker-card__fav${isFav ? ' worker-card__fav--on' : ''}"
          data-worker-id="${w.worker_id}"
          aria-pressed="${isFav ? 'true' : 'false'}"
          aria-label="${isFav ? 'ปลดดาว' : 'ติดดาว'}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
        <div class="worker-card__head">
          ${UI.avatar({ user_name: w.user_name, user_image: w.user_image }, 'md')}
          <div class="worker-card__head-info">
            <h4 class="worker-card__name">${UI.escapeHtml(name)}</h4>
            ${categoryLabel
              ? `<div class="worker-card__category">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  สาขา: <strong>${UI.escapeHtml(categoryLabel)}</strong>
                </div>`
              : ''}
          </div>
        </div>

        <div class="worker-card__skills">
          <div class="worker-card__skills-label">ความสามารถ${subcatLabel ? ' · ' + UI.escapeHtml(subcatLabel) : ''} <span class="text-faint">(${allSkills.length} สกิล)</span></div>
          <div class="chip-group">
            ${chipsHtml}
            ${moreChip}
          </div>
        </div>

        <div class="worker-card__meta">
          <span class="worker-card__meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 7-8 12-8 12s-8-5-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            ${UI.escapeHtml(locParts || 'ไม่มีข้อมูล')}
          </span>
          <span class="worker-card__meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            ${totalJobs} งาน
          </span>
        </div>

        ${w.worker_resume ? `<div class="worker-card__resume">${UI.escapeHtml(w.worker_resume)}</div>` : ''}
      </a>`;
  }
})();
