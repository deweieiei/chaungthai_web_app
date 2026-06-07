// /profile
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const root = document.getElementById('profile-content');

  // ---- state ----
  let currentUser = null;
  let currentWorker = null;      // detail.worker จาก /api/workers/:id
  let currentWorkerLoaded = false;
  let activeTab = 'account';     // 'account' | 'worker'

  // ---- helpers ----
  function roleBadge(role) {
    if (role === 'admin') return '<span class="chip chip--warning">แอดมิน</span>';
    if (role === 'worker') return '<span class="chip chip--success">ช่าง</span>';
    return '<span class="chip chip--info">สมาชิก</span>';
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
        <div>${roleBadge(u.user_role)}</div>
      </div>`;
  }

  // ---- tab bar ----
  function renderTabBar() {
    return `
      <div class="tab-bar" role="tablist" style="margin-top: var(--space-lg);">
        <button type="button" class="tab-bar__item ${activeTab === 'account' ? 'tab-bar__item--active' : ''}" data-tab="account" role="tab" aria-selected="${activeTab === 'account'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          บัญชี
        </button>
        <button type="button" class="tab-bar__item ${activeTab === 'worker' ? 'tab-bar__item--active' : ''}" data-tab="worker" role="tab" aria-selected="${activeTab === 'worker'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/></svg>
          ช่าง
        </button>
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

  // ---- view: worker tab (not a worker yet — show terms) ----
  function renderWorkerTermsTab() {
    return `
      <div class="alert alert--info">
        <span class="alert__icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        </span>
        <span>คุณยังไม่ได้สมัครเป็นช่าง อ่านเงื่อนไขด้านล่างและสมัครได้เลย</span>
      </div>

      <div class="card card--elevated">
        <h3 class="card__title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
          เงื่อนไขและข้อตกลงการเป็นช่าง
        </h3>

        <div class="terms-section" style="margin-top: var(--space-md);">
          <h4 style="font-size: 0.95rem; color: var(--primary); margin-bottom: 6px;">1. การใช้งานบัตรรับงาน</h4>
          <p class="text-small text-muted" style="margin: 0 0 var(--space-sm);">
            ช่างทุกคนจะได้รับ <strong style="color: var(--text);">บัตรรับงาน 25 ใบต่อเดือน</strong>
            (รีเซ็ตทุกวันที่ 1 ของเดือน) ใช้ได้ 1 ใบต่อการรับ 1 งาน บัตรที่ใช้แล้วจะไม่คืนแม้ยกเลิกงาน
            หากต้องการบัตรเพิ่มต้องซื้อแพ็กเสริม
          </p>
        </div>

        <div class="terms-section" style="margin-top: var(--space-md);">
          <h4 style="font-size: 0.95rem; color: var(--primary); margin-bottom: 6px;">2. การรับผิดชอบในงาน</h4>
          <p class="text-small text-muted" style="margin: 0 0 var(--space-sm);">
            ช่างต้องรับผิดชอบในงานที่รับเองทั้งหมด รวมถึงคุณภาพ ความปลอดภัย และความเสียหายที่อาจเกิดขึ้น
            หากเกิดข้อพิพาท ChaungThai จะเป็นผู้ตัดสินขั้นต้น แต่ไม่รับผิดชอบต่อความเสียหายโดยตรง
            ทั้งนี้ช่างควรมีประกันความเสียหายของตัวเอง
          </p>
        </div>

        <div class="terms-section" style="margin-top: var(--space-md);">
          <h4 style="font-size: 0.95rem; color: var(--primary); margin-bottom: 6px;">3. ข้อมูลและตัวตน</h4>
          <p class="text-small text-muted" style="margin: 0 0 var(--space-sm);">
            ช่างต้องให้ข้อมูลที่เป็นจริง ทั้งชื่อ-นามสกุล เบอร์ติดต่อ ที่อยู่ บัตรประชาชน
            และทักษะที่ตนเองมี ระบบจะตรวจสอบประวัติอาชญากรรมและยืนยันตัวตนก่อนเปิดให้รับงาน
            ข้อมูลเท็จจะถูกระงับบัญชีทันที
          </p>
        </div>

        <div class="terms-section" style="margin-top: var(--space-md);">
          <h4 style="font-size: 0.95rem; color: var(--primary); margin-bottom: 6px;">4. ค่าบริการและการชำระเงิน</h4>
          <p class="text-small text-muted" style="margin: 0 0 var(--space-sm);">
            ช่างเป็นผู้กำหนดค่าบริการกับลูกค้าโดยตรง ChaungThai ไม่เก็บค่าคอมมิชชั่นจากงาน
            แต่หักค่าธรรมเนียม "บัตรรับงาน" ตามแพ็กเสริมที่ซื้อ และจะมีค่าบริการ premium ในอนาคต
          </p>
        </div>

        <div class="terms-section" style="margin-top: var(--space-md);">
          <h4 style="font-size: 0.95rem; color: var(--primary); margin-bottom: 6px;">5. การยกเลิกบัญชีช่าง</h4>
          <p class="text-small text-muted" style="margin: 0;">
            ช่างสามารถปิดสถานะรับงานได้ตลอดเวลา แต่หากต้องการลบบัญชีช่างถาวร
            ต้องไม่มีงานค้างและไม่มีข้อพิพาทกับลูกค้า
          </p>
        </div>

        <p class="text-tiny text-faint" style="margin-top: var(--space-md); font-style: italic;">
          * เงื่อนไขนี้เป็นตัวอย่างเบื้องต้น จะปรับให้สมบูรณ์ก่อนเปิดใช้งานจริง
        </p>
      </div>

      <div class="card">
        <label class="check">
          <input type="checkbox" id="agree-worker-terms">
          <span class="check__box" aria-hidden="true"></span>
          <span class="check__label">
            ฉันได้อ่านและ<strong>ยอมรับเงื่อนไขและข้อตกลง</strong>การเป็นช่างทั้งหมด
          </span>
        </label>
        <button type="button" class="btn btn--primary btn--block btn--lg" id="continue-worker-btn" disabled style="margin-top: var(--space-md);">
          ดำเนินการสมัครเป็นช่าง
        </button>
      </div>`;
  }

  // ---- view: worker tab (already a worker — dashboard) ----
  function renderWorkerDashboardTab(u, w) {
    // บัตรรับงาน — ใช้ข้อมูลจริงจาก DB
    const totalTickets = 25;
    const ticketsRemain = w ? Number(w.worker_job_tickets ?? 0) : 0;
    const ticketsUsed = Math.max(0, totalTickets - ticketsRemain);
    const ticketsPct = Math.round((ticketsRemain / totalTickets) * 100);

    const totalJobs = w ? Number(w.worker_total_jobs ?? 0) : 0;
    // จำนวนงานที่รับ % — สมมุติว่าเทียบกับ 100 งาน
    const jobsPct = Math.min(100, Math.round((totalJobs / 100) * 100));

    // % เอกสารยื่นสมัคร — คำนวณจากข้อมูลจริงที่ user กรอก
    let docsPct = 0;
    if (u.user_phone) docsPct += 20;
    if (u.user_phone_verified_at) docsPct += 10;
    if (u.user_email_verified_at) docsPct += 10;
    if (u.user_address) docsPct += 15;
    if (u.user_birthday) docsPct += 5;
    if (u.user_image) docsPct += 10;
    if (w && w.worker_resume) docsPct += 15;
    if (w && w.worker_crime_checked_at) docsPct += 15;
    docsPct = Math.min(100, docsPct);

    // คะแนนความประพฤติ — ใส่ 100/100 ก่อน (รอ rating system)
    const conductScore = 100;
    const conductMax = 100;

    // เลขบัตรช่าง — สร้างจาก worker_id แบบ CT-0000-0001
    const workerNo = w
      ? `CT-${String(w.worker_id || 0).padStart(8, '0').match(/.{1,4}/g).join('-')}`
      : 'CT-0000-0000';
    const memberSince = w && w.worker_created_at
      ? UI.formatThaiDate(w.worker_created_at)
      : '-';

    return `
      <!-- บัตรประชาชนช่าง -->
      <div class="worker-id-card">
        <div class="worker-id-card__head">
          <div class="worker-id-card__brand">ChaungThai · Worker ID</div>
          <div class="worker-id-card__logo">
            <img src="/static/images/logo.png" alt="">
          </div>
        </div>
        <div class="worker-id-card__body">
          <div class="worker-id-card__no-label">เลขประจำตัวช่าง</div>
          <div class="worker-id-card__no">${workerNo}</div>
          <div style="margin-top: 14px;">
            <div class="worker-id-card__no-label">ชื่อ-นามสกุล</div>
            <h3 class="worker-id-card__name">${UI.escapeHtml((u.user_name || '') + ' ' + (u.user_lastname || '')).trim() || 'ช่าง'}</h3>
          </div>
        </div>
        <div class="worker-id-card__foot">
          <span>สมาชิกตั้งแต่ ${memberSince}</span>
          <span>✓ ${w && w.worker_crime_checked_at ? 'ตรวจประวัติแล้ว' : 'รอตรวจประวัติ'}</span>
        </div>
      </div>

      <!-- บัตรรับงานคงเหลือ -->
      <h3 class="section-title">บัตรรับงาน</h3>
      <div class="stat-card">
        <div class="stat-card__icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 0 0 6v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 0 0-6Z"/><path d="M13 5v2M13 17v2M13 11v2"/></svg>
        </div>
        <div class="stat-card__main">
          <div>
            <span class="stat-card__value">${ticketsRemain}</span><span class="stat-card__value-suffix">/ ${totalTickets} ใบ</span>
          </div>
          <div class="stat-card__label">บัตรคงเหลือเดือนนี้ · ใช้แล้ว ${ticketsUsed} ใบ</div>
          <div class="stat-card__bar">
            <div class="stat-card__bar-fill" style="width: ${ticketsPct}%;"></div>
          </div>
        </div>
      </div>

      <!-- จำนวนงานที่รับ -->
      <h3 class="section-title">สถิติงาน</h3>
      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--success">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <div class="stat-card__main">
          <div>
            <span class="stat-card__value">${totalJobs}</span><span class="stat-card__value-suffix">งาน · ${jobsPct}%</span>
          </div>
          <div class="stat-card__label">จำนวนงานที่รับทั้งหมด</div>
          <div class="stat-card__bar">
            <div class="stat-card__bar-fill stat-card__bar-fill--success" style="width: ${jobsPct}%;"></div>
          </div>
        </div>
      </div>

      <!-- % เอกสารสมัครช่าง -->
      <h3 class="section-title">การยื่นเอกสารสมัครช่าง</h3>
      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--info">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
        </div>
        <div class="stat-card__main">
          <div>
            <span class="stat-card__value">${docsPct}</span><span class="stat-card__value-suffix">%</span>
          </div>
          <div class="stat-card__label">${docsPct >= 100 ? 'ครบถ้วน' : docsPct >= 70 ? 'เกือบครบ' : 'ยังไม่ครบ'} · แก้ไขที่ "แก้ไขข้อมูลส่วนตัว"</div>
          <div class="stat-card__bar">
            <div class="stat-card__bar-fill ${docsPct >= 100 ? 'stat-card__bar-fill--success' : 'stat-card__bar-fill--warning'}" style="width: ${docsPct}%;"></div>
          </div>
        </div>
      </div>

      <!-- คะแนนความประพฤติ -->
      <h3 class="section-title">คะแนนความประพฤติ</h3>
      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--warning">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div class="stat-card__main">
          <div>
            <span class="stat-card__value">${conductScore}</span><span class="stat-card__value-suffix">/ ${conductMax}</span>
          </div>
          <div class="stat-card__label">${conductScore >= 90 ? 'ยอดเยี่ยม' : conductScore >= 75 ? 'ดี' : conductScore >= 60 ? 'พอใช้' : 'ควรปรับปรุง'} · จากการประเมินของลูกค้า</div>
          <div class="stat-card__bar">
            <div class="stat-card__bar-fill stat-card__bar-fill--success" style="width: ${conductScore}%;"></div>
          </div>
        </div>
      </div>

      <!-- actions -->
      <h3 class="section-title">จัดการช่าง</h3>
      <div class="card-list">
        ${actionRow({ icon: '🛠', label: 'แก้ไขสกิลของฉัน', href: '/worker/edit-skills' })}
        ${actionRow({ icon: '👁', label: 'ดูโปรไฟล์สาธารณะ', href: w ? '/worker/' + w.worker_id : '#' })}
      </div>

      <p class="text-tiny text-faint text-center" style="margin-top: var(--space-md);">
        * ตัวเลขบางส่วนเป็นข้อมูลตัวอย่าง รอเชื่อมต่อระบบประเมินจริง
      </p>`;
  }

  // ---- main render ----
  function render() {
    const u = currentUser;
    if (!u) return;
    const isWorker = u.user_role === 'worker';

    let body = '';
    if (activeTab === 'account') {
      body = renderAccountTab(u);
    } else {
      // worker tab
      if (!isWorker) {
        body = renderWorkerTermsTab();
      } else if (!currentWorkerLoaded) {
        body = `<div class="loading-block"><div class="spinner"></div><div>กำลังโหลดข้อมูลช่าง...</div></div>`;
      } else {
        body = renderWorkerDashboardTab(u, currentWorker);
      }
    }

    root.innerHTML = renderHeader(u) + renderTabBar() + body;

    bindCommonEvents();
    bindTabEvents();
    bindTabSpecificEvents();
  }

  function bindCommonEvents() {
    const uploadBtn = document.getElementById('avatar-upload');
    const uploadInp = document.getElementById('avatar-input');
    if (uploadBtn && uploadInp) {
      uploadBtn.addEventListener('click', () => uploadInp.click());
      uploadInp.addEventListener('change', uploadAvatar);
    }
  }

  function bindTabEvents() {
    document.querySelectorAll('.tab-bar__item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.tab;
        if (t === activeTab) return;
        activeTab = t;
        render();
        if (activeTab === 'worker' && currentUser.user_role === 'worker' && !currentWorkerLoaded) {
          loadWorkerDetail();
        }
      });
    });
  }

  function bindTabSpecificEvents() {
    if (activeTab === 'account') {
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) logoutBtn.addEventListener('click', confirmLogout);
      const closeBtn = document.getElementById('close-account-btn');
      if (closeBtn) closeBtn.addEventListener('click', confirmClose);
    } else if (activeTab === 'worker' && currentUser.user_role !== 'worker') {
      const agree = document.getElementById('agree-worker-terms');
      const cont = document.getElementById('continue-worker-btn');
      if (agree && cont) {
        agree.addEventListener('change', () => {
          cont.disabled = !agree.checked;
        });
        cont.addEventListener('click', () => {
          if (agree.checked) location.href = '/become-worker';
        });
      }
    }
  }

  // ---- avatar upload ----
  async function uploadAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;
    const u = Auth.getUser();
    if (!u) return;
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

  // ---- worker detail loader ----
  async function loadWorkerDetail() {
    try {
      const wid = await resolveWorkerId(currentUser);
      if (!wid) {
        currentWorker = null;
        currentWorkerLoaded = true;
        if (activeTab === 'worker') render();
        return;
      }
      const detail = await Api.get('/workers/' + wid);
      currentWorker = { ...detail.worker, all_skills: detail.skills };
      currentWorkerLoaded = true;
      if (activeTab === 'worker') render();
    } catch (err) {
      console.warn('[profile] load worker detail', err);
      currentWorker = null;
      currentWorkerLoaded = true;
      if (activeTab === 'worker') render();
    }
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
      // preload worker detail ถ้าเป็นช่าง (จะใช้ตอนเปิด tab ช่าง)
      if (res.user.user_role === 'worker') {
        loadWorkerDetail();
      }
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
