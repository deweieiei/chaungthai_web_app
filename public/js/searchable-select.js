// ============================================================
//  searchable-select.js — เปลี่ยน <select> ให้ค้นหาได้ + เรียง ก-ฮ
//
//  วิธีใช้:
//    <select class="select select--searchable" id="province"> ... </select>
//
//  - native <select> ยังคงอยู่ (ซ่อนไว้) — value, change event, form submit เหมือนเดิม
//  - autoinit ทุก select ที่มี class `select--searchable`
//  - ถ้า JS แก้ innerHTML ของ select (เช่น loadDistricts) → component อัปเดตอัตโนมัติ
//  - ตัวเลือก value="" (placeholder) จะอยู่บนสุดเสมอ ไม่ถูก sort
// ============================================================
(function (global) {
  'use strict';

  const COLLATOR = new Intl.Collator('th', { sensitivity: 'base', numeric: true });

  function escHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function enhance(select) {
    if (select.__searchable) return;
    select.__searchable = true;

    // wrapper รอบ select
    const wrap = document.createElement('div');
    wrap.className = 'searchable-select';
    if (select.disabled) wrap.classList.add('is-disabled');
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);

    select.classList.add('searchable-select__native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    // ปุ่มแสดงค่าที่เลือก
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'searchable-select__btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `
      <span class="searchable-select__label"></span>
      <span class="searchable-select__caret" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </span>`;
    wrap.appendChild(btn);

    // panel: search input + list
    const panel = document.createElement('div');
    panel.className = 'searchable-select__panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="searchable-select__search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="text" placeholder="พิมพ์เพื่อค้นหา..." autocomplete="off" spellcheck="false">
      </div>
      <ul class="searchable-select__list" role="listbox" tabindex="-1"></ul>
      <div class="searchable-select__empty" hidden>ไม่พบรายการที่ค้นหา</div>
    `;
    wrap.appendChild(panel);

    const search = panel.querySelector('input');
    const list = panel.querySelector('ul');
    const emptyMsg = panel.querySelector('.searchable-select__empty');
    const labelEl = btn.querySelector('.searchable-select__label');

    let activeIdx = -1; // index ใน items[] ที่ highlight

    function getItems(filter) {
      const all = Array.from(select.options);
      // แยก placeholder (value="") กับตัวจริง
      const placeholder = all.filter((o) => o.value === '');
      const real = all
        .filter((o) => o.value !== '')
        .sort((a, b) => COLLATOR.compare(a.text, b.text));
      const combined = placeholder.concat(real);
      const f = (filter || '').trim().toLowerCase();
      if (!f) return combined;
      // placeholder ไม่เข้า filter
      return combined.filter((o) => {
        if (o.value === '') return false;
        return o.text.toLowerCase().includes(f);
      });
    }

    function render() {
      const items = getItems(search.value);
      activeIdx = items.findIndex((o) => o.selected && o.value !== '');
      if (activeIdx < 0) activeIdx = items.findIndex((o) => o.value !== '');
      list.innerHTML = items
        .map((o, i) => {
          const cls = [
            'searchable-select__opt',
            o.selected ? 'is-selected' : '',
            o.disabled ? 'is-disabled' : '',
            i === activeIdx ? 'is-active' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return `<li class="${cls}" role="option" data-idx="${i}" data-value="${escHtml(o.value)}" aria-selected="${o.selected ? 'true' : 'false'}">${escHtml(o.text)}</li>`;
        })
        .join('');
      emptyMsg.hidden = items.length > 0;
      // scroll active เข้าสายตา
      const activeEl = list.querySelector('.is-active');
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }

    function syncLabel() {
      const sel = select.options[select.selectedIndex];
      const text = sel ? sel.text : '';
      const isPlaceholder = !select.value;
      labelEl.textContent = text || '— เลือก —';
      labelEl.classList.toggle('is-placeholder', isPlaceholder);
    }

    function syncDisabled() {
      btn.disabled = select.disabled;
      wrap.classList.toggle('is-disabled', select.disabled);
      if (select.disabled) close();
    }

    function open() {
      if (select.disabled) return;
      // ปิด instance อื่นๆ ก่อน
      document
        .querySelectorAll('.searchable-select__panel:not([hidden])')
        .forEach((p) => {
          if (p !== panel) p.hidden = true;
        });
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      search.value = '';
      render();
      requestAnimationFrame(() => search.focus());
    }

    function close() {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }

    function pickByIdx(idx) {
      const items = getItems(search.value);
      const o = items[idx];
      if (!o || o.disabled) return;
      if (select.value === o.value) {
        close();
        return;
      }
      select.value = o.value;
      syncLabel();
      close();
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // ---------- events ----------
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.hidden ? open() : close();
    });

    search.addEventListener('input', () => {
      activeIdx = 0;
      render();
    });

    search.addEventListener('keydown', (e) => {
      const items = getItems(search.value);
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        btn.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        for (let i = activeIdx + 1; i < items.length; i++) {
          if (!items[i].disabled && items[i].value !== '') {
            activeIdx = i;
            render();
            return;
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        for (let i = activeIdx - 1; i >= 0; i--) {
          if (!items[i].disabled && items[i].value !== '') {
            activeIdx = i;
            render();
            return;
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0) pickByIdx(activeIdx);
      }
    });

    list.addEventListener('click', (e) => {
      const li = e.target.closest('.searchable-select__opt');
      if (!li) return;
      pickByIdx(Number(li.dataset.idx));
    });

    list.addEventListener('mouseover', (e) => {
      const li = e.target.closest('.searchable-select__opt');
      if (!li) return;
      const idx = Number(li.dataset.idx);
      if (idx === activeIdx) return;
      activeIdx = idx;
      // ไม่ rerender ทั้ง list — แค่ update class
      list.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
      li.classList.add('is-active');
    });

    // คลิกนอก → ปิด
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) close();
    });

    // ESC ที่ document → ปิด
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) close();
    });

    // ดู option เปลี่ยน (JS แทนที่ innerHTML) → re-sync label
    const obs = new MutationObserver(() => {
      syncLabel();
      if (!panel.hidden) render();
    });
    obs.observe(select, { childList: true, subtree: true });

    // ดู disabled เปลี่ยน
    new MutationObserver(syncDisabled).observe(select, {
      attributes: true,
      attributeFilter: ['disabled'],
    });

    select.addEventListener('change', syncLabel);

    syncLabel();
    syncDisabled();
  }

  function autoInit(root) {
    (root || document)
      .querySelectorAll('select.select--searchable')
      .forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => autoInit());
  } else {
    autoInit();
  }

  global.SearchableSelect = { enhance, autoInit };
})(window);
