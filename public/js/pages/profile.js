// /profile
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const root = document.getElementById('profile-content');

  // ---- state ----
  let currentUser = null;

  // ---- helpers ----
  //  บัญชีช่างกับผู้ว่าจ้างแยกกันสมบูรณ์ — โชว์ให้ชัดว่าตอนนี้อยู่ฝั่งไหน
  function accountTypeOf(u) {
    return (u && u.user_account_type) || 'employer';
  }

  function roleBadge(u) {
    const parts = [];
    if (u.user_role === 'admin') parts.push('<span class="chip chip--warning">แอดมิน</span>');
    parts.push(accountTypeOf(u) === 'worker'
      ? '<span class="chip chip--success">🛠️ บัญชีช่าง</span>'
      : '<span class="chip chip--info">🔍 บัญชีผู้ว่าจ้าง</span>');
    return parts.join(' ');
  }

  function infoRow({ icon, label, value, trailHtml }) {
    return `
      <div class="card-list__item" style="cursor:default;">
        <span class="card-list__icon">${icon}</span>
        <div class="card-list__main">
          <div class="card-list__label">${UI.escapeHtml(label)}</div>
          <div class="card-list__value">${value || '-'}</div>
        </div>
        ${trailHtml || ''}
      </div>`;
  }

  function actionRow({ icon, label, href, danger }) {
    return `
      <a href="${href}" class="card-list__item" ${danger ? 'style="color: var(--danger);"' : ''}>
        <span class="card-list__icon" style="${danger ? 'color: var(--danger);' : ''}">${icon}</span>
        <div class="card-list__main">
          <div class="card-list__value">${UI.escapeHtml(label)}</div>
        </div>
        <span class="card-list__trail">›</span>
      </a>`;
  }

  // ---- header (avatar + name) ----
  function renderHeader(u) {
    return `
      <div class="text-center" style="margin-top: var(--space-md);">
        <div style="position: relative; display: inline-block;">
          ${UI.avatar({ user_name: u.user_name, user_image: u.user_image }, 'xl')}
          <button type="button" class="avatar__edit-badge" id="avatar-upload" aria-label="เปลี่ยนรูป">📷</button>
          <input type="file" id="avatar-input" accept="image/jpeg,image/png,image/webp" style="display:none;">
        </div>
        <h2 style="margin-top: var(--space-sm);">${UI.escapeHtml((u.user_name || '') + ' ' + (u.user_lastname || '')).trim() || 'ผู้ใช้'}</h2>
        <div>${roleBadge(u)}</div>
      </div>`;
  }

  // ---- view: account tab ----
  function renderAccountTab(u) {
    const emailTrail = u.user_email_verified_at
      ? '<span class="chip chip--success">✓ ยืนยันแล้ว</span>'
      : '<a href="/verify-email" class="chip chip--warning">ยืนยัน</a>';
    const phoneTrail = !u.user_phone
      ? ''
      : u.user_phone_verified_at
      ? '<span class="chip chip--success">✓ ยืนยันแล้ว</span>'
      : '<a href="/verify-phone" class="chip chip--warning">ยืนยัน</a>';

    return `
      <div class="card-list">
        ${infoRow({ icon: '✉', label: 'อีเมล', value: UI.escapeHtml(u.user_email || '-'), trailHtml: emailTrail })}
        ${infoRow({ icon: '📱', label: 'เบอร์โทร', value: UI.escapeHtml(u.user_phone || '-'), trailHtml: phoneTrail })}
        ${infoRow({ icon: '🎂', label: 'วันเกิด', value: UI.formatThaiDate(u.user_birthday) })}
        ${infoRow({ icon: '📍', label: 'ที่อยู่', value: UI.escapeHtml(u.user_address || '-') })}
        ${u.user_bio ? infoRow({ icon: 'ℹ', label: 'แนะนำตัว', value: UI.escapeHtml(u.user_bio) }) : ''}
      </div>

      <h3 class="section-title">บัญชี</h3>
      <div class="card-list">
        ${actionRow({ icon: '✏', label: 'แก้ไขข้อมูลส่วนตัว', href: '/profile/edit' })}
        ${actionRow({ icon: '🔑', label: 'เปลี่ยนรหัสผ่าน', href: '/profile/password' })}
        <button type="button" class="card-list__item" id="logout-btn">
          <span class="card-list__icon">🚪</span>
          <div class="card-list__main"><div class="card-list__value">ออกจากระบบ</div></div>
          <span class="card-list__trail">›</span>
        </button>
        <button type="button" class="card-list__item" id="close-account-btn" style="color: var(--danger);">
          <span class="card-list__icon" style="color: var(--danger);">⚠</span>
          <div class="card-list__main"><div class="card-list__value">ปิดบัญชี</div></div>
          <span class="card-list__trail">›</span>
        </button>
      </div>`;
  }

  // ---- main render ----
  //  โปรไฟล์เหลือแค่ "ข้อมูลบัญชี" อย่างเดียวทั้ง 2 ฝั่ง
  //  ของฝั่งช่าง (บัตรช่าง สถิติ ปุ่มจัดการ) ย้ายไปหน้าหลัก /worker/home หมดแล้ว
  function render() {
    const u = currentUser;
    if (!u) return;

    root.innerHTML = renderHeader(u) + renderAccountTab(u);

    bindCommonEvents();

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', confirmLogout);
    const closeBtn = document.getElementById('close-account-btn');
    if (closeBtn) closeBtn.addEventListener('click', confirmClose);
  }

  function bindCommonEvents() {
    const uploadBtn = document.getElementById('avatar-upload');
    const uploadInp = document.getElementById('avatar-input');
    if (uploadBtn && uploadInp) {
      uploadBtn.addEventListener('click', () => uploadInp.click());
      uploadInp.addEventListener('change', uploadAvatar);
    }
  }

  // ---- avatar upload ----
  async function uploadAvatar(e) {
    const picked = e.target.files[0];
    if (!picked) return;
    const u = Auth.getUser();
    if (!u) return;

    UI.showLoading('กำลังย่อรูป...');
    // รูปโปรไฟล์แสดงใหญ่สุดแค่ 96px — 512px เหลือเฟือแม้จอ retina
    const file = await ImageCompress.prepareForUpload(picked, {
      maxSize: 512, quality: 0.85,
    });
    if (!file) { UI.hideLoading(); e.target.value = ''; return; }

    UI.showLoading('กำลังอัปโหลด...');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await Api.upload('/users/' + u.user_id + '/image', fd);
      const newUser = { ...u, user_image: res.user_image };
      Auth.setUser(newUser);
      currentUser = newUser;
      UI.toast('เปลี่ยนรูปสำเร็จ', 'success');
      render();
    } catch (err) {
      UI.toast(err.message || 'อัปโหลดไม่สำเร็จ', 'danger');
    } finally {
      UI.hideLoading();
    }
  }

  // ---- logout / close account ----
  async function confirmLogout() {
    const ok = await UI.confirm({
      title: 'ออกจากระบบ',
      message: 'ยืนยันการออกจากระบบ?',
      confirmLabel: 'ออกจากระบบ',
    });
    if (ok) Auth.logout();
  }

  async function confirmClose() {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `
      <div class="modal__card">
        <h3 class="modal__title">ปิดบัญชี?</h3>
        <div class="modal__body">
          <p class="text-muted text-small">หลังปิดบัญชี คุณจะเข้าใช้งานไม่ได้และคนอื่นหาช่างของคุณไม่เจอ</p>
          <div class="field" style="margin-top: 12px;">
            <input class="input" type="password" id="close-pwd" placeholder="ยืนยันด้วยรหัสผ่าน">
          </div>
        </div>
        <div class="modal__actions">
          <button class="btn btn--ghost" data-act="cancel">ยกเลิก</button>
          <button class="btn btn--danger" data-act="confirm">ปิดบัญชี</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'cancel') wrap.remove();
      else if (act && act.dataset.act === 'confirm') {
        const pwd = document.getElementById('close-pwd').value;
        if (!pwd) {
          UI.toast('กรุณากรอกรหัสผ่าน', 'danger');
          return;
        }
        UI.showLoading();
        try {
          const u = Auth.getUser();
          await Api.delete('/users/' + u.user_id, { password: pwd });
          wrap.remove();
          UI.toast('ปิดบัญชีสำเร็จ', 'success');
          setTimeout(() => Auth.logout(), 600);
        } catch (err) {
          UI.toast(err.message || 'ปิดบัญชีไม่สำเร็จ', 'danger');
        } finally {
          UI.hideLoading();
        }
      } else if (e.target === wrap) wrap.remove();
    });
  }

  // ---- init ----
  (async () => {
    const cached = Auth.getUser();
    if (cached) {
      currentUser = cached;
      render();
    }
    try {
      const res = await Api.get('/users/' + (cached?.user_id));
      currentUser = res.user;
      Auth.setUser(res.user);
      render();
    } catch (err) {
      if (!cached) {
        root.innerHTML = `<div class="empty-state">
          <div class="empty-state__icon">⚠</div>
          <div class="empty-state__title">โหลดโปรไฟล์ไม่ได้</div>
          <p class="text-muted text-small">${UI.escapeHtml(err.message || '')}</p>
        </div>`;
      }
    }
  })();
})();
