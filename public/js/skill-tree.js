// ============================================================
//  skill-tree.js — Reusable skill picker (multi-select tree)
//
//  Usage:
//    SkillTree.mount('#mount-el', {
//      selected: Set<int>,
//      max: 50,
//      onChange: (newSet) => {...}
//    });
// ============================================================
(function (global) {
  'use strict';

  async function mount(container, opts = {}) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;

    const max = opts.max || 50;
    const selected = new Set(opts.selected || []);
    const onChange = opts.onChange || (() => {});

    el.innerHTML = `
      <div class="loading-block"><div class="spinner"></div><div>กำลังโหลดสกิล...</div></div>
    `;

    let tree;
    try {
      tree = await Api.get('/skills');
    } catch (err) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">⚠</div>
        <div class="empty-state__title">โหลดรายการสกิลไม่ได้</div>
        <p class="text-muted text-small">${UI.escapeHtml(err.message || '')}</p>
      </div>`;
      return;
    }

    let query = '';

    function render() {
      const q = query.toLowerCase().trim();
      const summaryHtml = `
        <div class="skill-summary-bar">
          <strong style="color: ${selected.size === 0 ? 'var(--text-muted)' : 'var(--primary)'};">
            เลือก ${selected.size} / ${max} อัน
          </strong>
          ${selected.size > 0 ? '<button type="button" class="btn btn--ghost btn--sm" id="skill-clear">ล้าง</button>' : ''}
        </div>`;

      const searchHtml = `
        <div style="padding: var(--space-sm) var(--space-md);">
          <input class="input" type="search" id="skill-search" placeholder="ค้นหาสกิล..." value="${UI.escapeHtml(query)}">
        </div>
      `;

      const catsHtml = tree.categories.map((cat) => {
        const visibleSubs = cat.subcategories.map((sub) => {
          const visibleSkills = sub.skills.filter((s) =>
            !q || s.skill_name_th.toLowerCase().includes(q));
          return { sub, visibleSkills };
        }).filter((x) =>
          x.visibleSkills.length > 0 || (q && x.sub.skill_subcategory_name_th.toLowerCase().includes(q))
        );

        if (visibleSubs.length === 0 && !(q && cat.skill_category_name_th.toLowerCase().includes(q))) {
          return '';
        }
        const pickedInCat = cat.subcategories
          .flatMap((s) => s.skills)
          .filter((sk) => selected.has(sk.skill_id)).length;
        const expanded = q || pickedInCat > 0;

        const subsHtml = visibleSubs.map(({ sub, visibleSkills }) => `
          <div class="skill-sub">
            <div class="skill-sub__title">${UI.escapeHtml(sub.skill_subcategory_name_th)}</div>
            ${visibleSkills.map((sk) => `
              <label class="skill-item">
                <input type="checkbox" data-skill-id="${sk.skill_id}" ${selected.has(sk.skill_id) ? 'checked' : ''}>
                <span>${UI.escapeHtml(sk.skill_name_th)}</span>
              </label>
            `).join('')}
          </div>
        `).join('');

        return `
          <div class="skill-cat">
            <button type="button" class="skill-cat__head" aria-expanded="${expanded ? 'true' : 'false'}">
              <span>${UI.escapeHtml(cat.skill_category_name_th)}</span>
              ${pickedInCat > 0 ? `<span class="text-small text-primary" style="margin-left: 6px;">(${pickedInCat})</span>` : ''}
              <span class="skill-cat__caret">›</span>
            </button>
            <div class="skill-cat__body">${subsHtml}</div>
          </div>
        `;
      }).join('');

      el.innerHTML = summaryHtml + searchHtml + '<div class="skill-tree">' + catsHtml + '</div>';

      // events
      const searchInput = el.querySelector('#skill-search');
      searchInput.addEventListener('input', (e) => {
        query = e.target.value;
        const cursorPos = searchInput.selectionStart;
        render();
        const newInput = el.querySelector('#skill-search');
        newInput.focus();
        newInput.setSelectionRange(cursorPos, cursorPos);
      });

      el.querySelectorAll('.skill-cat__head').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cur = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', cur ? 'false' : 'true');
        });
      });

      el.querySelectorAll('input[data-skill-id]').forEach((cb) => {
        cb.addEventListener('change', () => {
          const id = Number(cb.dataset.skillId);
          if (cb.checked) {
            if (selected.size >= max) {
              cb.checked = false;
              UI.toast(`เลือกได้สูงสุด ${max} อัน`, 'warning');
              return;
            }
            selected.add(id);
          } else {
            selected.delete(id);
          }
          onChange(new Set(selected));
          // อัปเดต summary แบบไม่ rerender ทั้งหมด
          const sum = el.querySelector('.skill-summary-bar strong');
          if (sum) {
            sum.textContent = `เลือก ${selected.size} / ${max} อัน`;
            sum.style.color = selected.size === 0 ? 'var(--text-muted)' : 'var(--primary)';
          }
        });
      });

      const clearBtn = el.querySelector('#skill-clear');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          selected.clear();
          onChange(new Set(selected));
          render();
        });
      }
    }

    render();

    return {
      getSelected: () => new Set(selected),
      setSelected: (next) => {
        selected.clear();
        for (const id of next) selected.add(id);
        render();
      },
    };
  }

  global.SkillTree = { mount };
})(window);
