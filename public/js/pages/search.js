// /search-workers
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const elCategory = document.getElementById('category');
  const elSubcategory = document.getElementById('subcategory');
  const elSkill = document.getElementById('skill');
  const elRadius = document.getElementById('radius');
  const elCoord = document.getElementById('area-coord');
  const btnHere = document.getElementById('btn-here');
  const btnSearch = document.getElementById('search-btn');
  const elResults = document.getElementById('results-area');

  // ---------- Collapsible field ----------
  // เมื่อ <select> มีค่า → ซ่อน <select> + แสดง summary pill (icon + label + value + ✎)
  // กด pill → กลับมาขยาย <select> และเปิด dropdown ให้เลย
  function makeCollapsible(select, icon, labelText) {
    const field = select.closest('.field');
    if (!field) return;
    field.classList.add('field--collapsible');

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'field__pill';
    pill.innerHTML = `
      <span class="field__pill-icon">${icon}</span>
      <span class="field__pill-label">${UI.escapeHtml(labelText)}:</span>
      <span class="field__pill-value"></span>
      <svg class="field__pill-edit" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
    `;
    field.appendChild(pill);

    const valueEl = pill.querySelector('.field__pill-value');

    function paint() {
      const opt = select.options[select.selectedIndex];
      const val = select.value;
      const text = (val && opt) ? opt.text : '';
      if (text && val) {
        valueEl.textContent = text;
        field.classList.add('field--collapsed');
      } else {
        field.classList.remove('field--collapsed');
      }
    }

    pill.addEventListener('click', () => {
      field.classList.remove('field--collapsed');
      // focus + เปิด dropdown ทันที (รองรับ browser ใหม่)
      requestAnimationFrame(() => {
        select.focus();
        if (typeof select.showPicker === 'function') {
          try { select.showPicker(); } catch {}
        }
      });
    });

    select.addEventListener('change', paint);
    // sync ทันที (เผื่อมีค่า default)
    paint();
  }

  // apply กับ dropdown สกิล 3 ชั้น (พื้นที่ใช้แผนที่แทนแล้ว)
  makeCollapsible(elCategory, '🔧', 'หมวด');
  makeCollapsible(elSubcategory, '🔧', 'สาขา');
  makeCollapsible(elSkill, '🔧', 'สกิล');

  // ---------- Collapsible card ----------
  // title กดเพื่อ toggle เปิด/ปิด — auto collapse เมื่อเลือกครบทุก dropdown ใน card
  function makeCardCollapsible(card) {
    const title = card.querySelector('.card__title');
    if (!title) return null;
    title.classList.add('card__title--clickable');

    // wrap children ที่ไม่ใช่ title ใน card__body
    const body = document.createElement('div');
    body.className = 'card__body';
    Array.from(card.children).forEach((child) => {
      if (child === title) return;
      body.appendChild(child);
    });
    card.appendChild(body);

    // chevron ปลาย title
    const chevron = document.createElement('span');
    chevron.className = 'card__chevron';
    chevron.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
    title.appendChild(chevron);

    function collapse() { card.classList.add('card--collapsed'); }
    function expand()   { card.classList.remove('card--collapsed'); }
    function toggle()   {
      if (card.classList.contains('card--collapsed')) expand();
      else collapse();
    }

    title.addEventListener('click', toggle);
    return { collapse, expand, toggle };
  }

  // card 1: ความสามารถที่ต้องการ
  const skillsCard = elCategory.closest('.card');
  const skillsCtrl = skillsCard && makeCardCollapsible(skillsCard);

  // auto collapse เมื่อ "เลือกครบทั้ง 3 dropdown" ใน card
  function maybeCollapse(ctrl, selects) {
    if (!ctrl) return;
    const allFilled = selects.every((s) => s.value);
    if (allFilled) ctrl.collapse();
  }
  [elCategory, elSubcategory, elSkill].forEach((sel) =>
    sel.addEventListener('change', () =>
      maybeCollapse(skillsCtrl, [elCategory, elSubcategory, elSkill])
    )
  );

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

  // ----- เลือกพื้นที่บนแผนที่ (แทน dropdown จังหวัด/อำเภอ/ตำบลเดิม) -----
  let areaMap = null;
  let areaMarker = null;
  let areaCircle = null;
  let center = null;   // [lat, lng] จุดกึ่งกลางที่จะค้นหารอบ ๆ

  function paintCoord() {
    if (!center) {
      elCoord.textContent = 'ยังไม่ได้เลือกจุด';
      return;
    }
    elCoord.textContent =
      'จุดที่เลือก: ' + center[0].toFixed(4) + ', ' + center[1].toFixed(4) +
      ' · รัศมี ' + elRadius.value + ' กม.';
  }

  function moveTo(lat, lng, zoom) {
    center = [lat, lng];
    if (areaMarker) areaMarker.setLatLng(center);
    if (areaCircle) areaCircle.setLatLng(center);
    if (zoom) areaMap.setView(center, zoom);
    paintCoord();
  }

  function paintCircle() {
    if (areaCircle) areaCircle.setRadius(Number(elRadius.value) * 1000);
    paintCoord();
  }

  elRadius.addEventListener('change', paintCircle);

  btnHere.addEventListener('click', async function () {
    btnHere.disabled = true;
    const pos = await CtMap.locate();
    btnHere.disabled = false;
    if (!pos) {
      UI.toast('ขอตำแหน่งไม่สำเร็จ — เปิดสิทธิ์ตำแหน่งในเบราว์เซอร์ก่อน', 'warning');
      return;
    }
    moveTo(pos[0], pos[1], 13);
  });

  (async function initAreaMap() {
    try {
      await CtMap.ensureLeaflet();
    } catch (err) {
      elCoord.textContent = 'โหลดแผนที่ไม่สำเร็จ';
      return;
    }

    // จุดเริ่ม: พิกัดในโปรไฟล์ → GPS → กรุงเทพ
    const u = Auth.getUser();
    let start = (u && u.user_lat != null && u.user_lng != null)
      ? [Number(u.user_lat), Number(u.user_lng)]
      : null;
    if (!start) start = await CtMap.locate(6000);
    if (!start) start = CtMap.DEFAULT_CENTER;

    areaMap = CtMap.create('#area-map', { center: start, zoom: 12, scrollWheelZoom: false });
    areaCircle = L.circle(start, {
      radius: Number(elRadius.value) * 1000,
      color: '#970000',
      weight: 1.5,
      fillColor: '#970000',
      fillOpacity: 0.08,
    }).addTo(areaMap);
    areaMarker = CtMap.pinMarker(areaMap, start, function (lat, lng) {
      moveTo(lat, lng);
    });

    center = start;
    paintCoord();
  })();

  // ----- submit search -----
  btnSearch.addEventListener('click', async () => {
    UI.setFieldError('skill', null);
    if (!center) {
      UI.toast('กรุณาเลือกจุดบนแผนที่ก่อน', 'warning');
      return;
    }

    UI.setBtnLoading(btnSearch, true);
    elResults.innerHTML = '<div class="loading-block"><div class="spinner"></div><div>กำลังค้นหา...</div></div>';

    try {
      const query = {
        lat: center[0],
        lng: center[1],
        radius_km: elRadius.value,
        limit: 100,
      };

      // ส่ง filter ที่เฉพาะที่สุด (server จะใช้อันที่เฉพาะที่สุด แต่ส่งครบไปเลย)
      if (elSkill.value) query.skill_id = elSkill.value;
      else if (elSubcategory.value) query.skill_subcategory_id = elSubcategory.value;
      else if (elCategory.value) query.skill_category_id = elCategory.value;

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
        <p class="text-muted text-small">ลองขยายระยะทาง เลื่อนจุดบนแผนที่ หรือเอาตัวกรองสกิลออก</p>
      </div>`;
      return;
    }

    // header สรุปผล
    const filterLabel = describeFilter(res.filter, res.applied_filter);
    const matchedHtml = `
      <div class="alert alert--info" style="margin-top: var(--space-md);">
        <span class="alert__icon">📍</span>
        <span>พบ <strong>${res.total}</strong> คน ${filterLabel ? '· ' + filterLabel + ' ' : ''}ในรัศมี ${elRadius.value} กม. · เรียงจากใกล้สุด</span>
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
    // เดิมโชว์ ตำบล·อำเภอ·จังหวัด — ตอนนี้ใช้ระยะทางจากจุดที่เลือกแทน
    const locParts = w.distance_km != null
      ? 'ห่างประมาณ ' + w.distance_km + ' กม.'
      : '';

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
