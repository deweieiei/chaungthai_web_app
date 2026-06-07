// /chat/:user_id — ห้องแชต 1-on-1
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const elBody = document.getElementById('chat-body');
  const elPeerName = document.getElementById('chat-peer-name');
  const elPeerAvatar = document.getElementById('chat-peer-avatar');
  const elPeerLink = document.getElementById('chat-peer-link');
  const elInput = document.getElementById('chat-input');
  const elSend = document.getElementById('chat-send');
  const elComposer = document.getElementById('chat-composer');
  const elHireBtn = document.getElementById('chat-hire-btn');

  const targetUserId = Number(elBody.dataset.targetUserId);
  const me = Auth.getUser();
  const meId = me && me.user_id;

  if (!Number.isInteger(targetUserId) || targetUserId < 1) {
    elBody.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠</div><div class="empty-state__title">user_id ไม่ถูกต้อง</div></div>`;
    return;
  }
  if (targetUserId === meId) {
    elBody.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🙂</div><div class="empty-state__title">ไม่สามารถแชตกับตัวเองได้</div><a href="/chat" class="btn btn--outline btn--sm" style="margin-top: 12px;">กลับ</a></div>`;
    return;
  }

  // ---------- state ----------
  let convId = null;
  let peer = null;
  let oldestMsgId = null;
  let hasMore = false;
  let loading = false;
  let socket = null;

  // ---------- date/time helper ----------
  function timeOnly(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  }

  function dayLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) return 'วันนี้';
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (
      d.getFullYear() === y.getFullYear() &&
      d.getMonth() === y.getMonth() &&
      d.getDate() === y.getDate()
    ) return 'เมื่อวาน';
    return UI.formatThaiDate(iso);
  }

  function sameDay(a, b) {
    if (!a || !b) return false;
    const da = new Date(a);
    const db = new Date(b);
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  }

  // ---------- DOM build ----------
  function buildShell() {
    elBody.innerHTML = `
      <div class="chat-load-more" id="chat-load-more" hidden>
        <button class="btn btn--ghost btn--sm" type="button" id="chat-load-more-btn">โหลดข้อความก่อนหน้า</button>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
    `;
    document.getElementById('chat-load-more-btn').addEventListener('click', loadOlder);
  }

  function systemBubbleHtml(m) {
    // payload ใน msg_content เป็น JSON
    let p = null;
    try { p = JSON.parse(m.msg_content); } catch {}
    if (!p || !p.type) {
      return `<div class="chat-system">${UI.escapeHtml(m.msg_content || '')}</div>`;
    }
    const time = timeOnly(m.msg_created_at);
    if (p.type === 'job_created') {
      const priceText = JobHelpers
        ? JobHelpers.formatPrice(p.price) + ' บาท'
        : (p.price + ' บาท');
      const dates = `${JobHelpers ? JobHelpers.formatDate(p.start_date) : p.start_date} → ${JobHelpers ? JobHelpers.formatDate(p.deadline) : p.deadline}`;
      return `
        <a class="chat-system-card" href="/jobs/${p.job_id}">
          <div class="chat-system-card__head">
            <span class="chat-system-card__icon">💼</span>
            <span class="chat-system-card__title">${UI.escapeHtml((p.employer_name || 'ผู้ว่าจ้าง'))} จ้างงาน</span>
          </div>
          <div class="chat-system-card__detail">${UI.escapeHtml(p.detail || '')}</div>
          <div class="chat-system-card__meta">
            <span class="text-bold">${priceText}</span> · <span class="text-muted">${dates}</span>
          </div>
          <div class="chat-system-card__cta">ดูรายละเอียด →</div>
          <div class="chat-system-card__time">${UI.escapeHtml(time)}</div>
        </a>`;
    }
    if (p.type === 'job_status_changed') {
      return `
        <a class="chat-system-line" href="/jobs/${p.job_id}">
          <span class="chat-system-line__dot"></span>
          <span>💼 ${UI.escapeHtml(p.label || 'อัปเดตสถานะงาน')}</span>
          <span class="chat-system-line__time">${UI.escapeHtml(time)}</span>
        </a>`;
    }
    return `<div class="chat-system">${UI.escapeHtml(p.label || m.msg_content || '')}</div>`;
  }

  function bubbleHtml(m, opts) {
    if (m.msg_type === 'system') return systemBubbleHtml(m);
    const isMine = m.msg_sender_id === meId;
    const cls = 'chat-bubble' + (isMine ? ' chat-bubble--mine' : ' chat-bubble--theirs');
    const time = timeOnly(m.msg_created_at);
    const readMark = isMine && m.msg_read_at ? '<span class="chat-bubble__read" title="อ่านแล้ว">✓✓</span>' : '';
    const content = m.msg_type === 'image'
      ? `<img class="chat-bubble__image" src="${UI.escapeHtml(m.msg_content)}" alt="">`
      : `<div class="chat-bubble__text">${UI.escapeHtml(m.msg_content || '')}</div>`;
    return `
      <div class="${cls}" data-msg-id="${m.msg_id}">
        ${content}
        <div class="chat-bubble__meta">
          <span class="chat-bubble__time">${UI.escapeHtml(time)}</span>
          ${readMark}
        </div>
      </div>`;
  }

  function daySeparatorHtml(iso) {
    return `<div class="chat-day-sep"><span>${UI.escapeHtml(dayLabel(iso))}</span></div>`;
  }

  // Append messages (chronological order)
  function appendMessages(messages) {
    const wrap = document.getElementById('chat-messages');
    if (!wrap) return;
    let lastDate = null;
    // หา date ของข้อความสุดท้ายที่อยู่ใน DOM แล้ว เพื่อเช็คว่าต้องใส่ day-sep ไหม
    const lastEl = wrap.lastElementChild;
    if (lastEl && lastEl.dataset && lastEl.dataset.msgTime) {
      lastDate = lastEl.dataset.msgTime;
    }
    const html = [];
    for (const m of messages) {
      if (!lastDate || !sameDay(lastDate, m.msg_created_at)) {
        html.push(daySeparatorHtml(m.msg_created_at));
      }
      html.push(bubbleHtml(m));
      lastDate = m.msg_created_at;
    }
    wrap.insertAdjacentHTML('beforeend', html.join(''));
    // เก็บ msg_created_at ของ element สุดท้ายไว้ใน dataset
    const newLast = wrap.lastElementChild;
    if (newLast && messages.length) {
      newLast.dataset.msgTime = messages[messages.length - 1].msg_created_at;
    }
  }

  // Prepend (สำหรับโหลดเก่ากว่า) — กลุ่ม day-sep คำนวณใหม่หมด
  function rerenderAll(messages) {
    const wrap = document.getElementById('chat-messages');
    if (!wrap) return;
    let lastDate = null;
    const html = [];
    for (const m of messages) {
      if (!lastDate || !sameDay(lastDate, m.msg_created_at)) {
        html.push(daySeparatorHtml(m.msg_created_at));
      }
      html.push(bubbleHtml(m));
      lastDate = m.msg_created_at;
    }
    wrap.innerHTML = html.join('');
    const newLast = wrap.lastElementChild;
    if (newLast && messages.length) {
      newLast.dataset.msgTime = messages[messages.length - 1].msg_created_at;
    }
  }

  // ---------- API calls ----------
  let allMessages = []; // เก็บ state เพื่อ re-render ตอน load older

  async function openOrCreateConversation() {
    const res = await Api.get('/chat/conversations/with/' + targetUserId);
    convId = res.conv_id;
    peer = res.other_user;

    // อัปเดต header
    const fullName = ((peer.user_name || '') + ' ' + (peer.user_lastname || '')).trim() || 'ผู้ใช้';
    elPeerName.textContent = fullName;
    elPeerAvatar.innerHTML = UI.avatar(
      { user_name: peer.user_name, user_image: peer.user_image },
      'sm'
    );

    // resolve worker_id ของ peer (ไม่บล็อก) → กดดูโปรไฟล์ช่างได้
    // ถ้า peer ไม่ใช่ช่าง — กันไม่ให้ click พาไปหน้าไหน + ซ่อนปุ่มจ้างงาน
    elPeerLink.href = '#';
    Api.get('/workers/by-user/' + peer.user_id)
      .then((r) => {
        if (r && r.worker_id) {
          elPeerLink.href = '/worker/' + r.worker_id;
          // peer เป็นช่าง → เปิดปุ่มจ้างงาน
          if (elHireBtn) {
            elHireBtn.hidden = false;
            elHireBtn.disabled = false;
          }
        }
      })
      .catch(() => {
        // ไม่ใช่ช่าง (404) — ปิด pointer
        elPeerLink.classList.add('chat-header__peer--no-link');
        elPeerLink.removeAttribute('aria-label');
      });

    elPeerLink.addEventListener('click', (e) => {
      // ถ้ายัง resolve ไม่เสร็จ (href ยัง #) — block
      if (elPeerLink.getAttribute('href') === '#') e.preventDefault();
    });
  }

  async function loadInitial() {
    if (loading) return;
    loading = true;
    try {
      const res = await Api.get(`/chat/conversations/${convId}/messages`, {
        query: { limit: 30 },
      });
      allMessages = res.messages || [];
      hasMore = !!res.has_more;
      oldestMsgId = allMessages.length ? allMessages[0].msg_id : null;
      rerenderAll(allMessages);
      document.getElementById('chat-load-more').hidden = !hasMore;
      // scroll ลงล่างสุด
      requestAnimationFrame(() => {
        elBody.scrollTop = elBody.scrollHeight;
      });
    } finally {
      loading = false;
    }
  }

  async function loadOlder() {
    if (loading || !hasMore || !oldestMsgId) return;
    loading = true;
    const btn = document.getElementById('chat-load-more-btn');
    UI.setBtnLoading(btn, true);
    const prevHeight = elBody.scrollHeight;
    try {
      const res = await Api.get(`/chat/conversations/${convId}/messages`, {
        query: { limit: 30, before_id: oldestMsgId },
      });
      const older = res.messages || [];
      if (older.length === 0) {
        hasMore = false;
        document.getElementById('chat-load-more').hidden = true;
        return;
      }
      allMessages = older.concat(allMessages);
      oldestMsgId = allMessages[0].msg_id;
      hasMore = !!res.has_more;
      rerenderAll(allMessages);
      document.getElementById('chat-load-more').hidden = !hasMore;
      // คงตำแหน่ง scroll (รักษาว่าผู้ใช้เห็นข้อความที่เห็นอยู่)
      requestAnimationFrame(() => {
        elBody.scrollTop = elBody.scrollHeight - prevHeight;
      });
    } catch (err) {
      UI.toast(err.message || 'โหลดข้อความก่อนหน้าไม่สำเร็จ', 'danger');
    } finally {
      UI.setBtnLoading(btn, false);
      loading = false;
    }
  }

  async function sendMessage(content) {
    if (!convId) return;
    try {
      // ไม่ optimistic ก่อน — รอ socket broadcast กลับ (ทั้ง 2 ฝั่งได้ผ่าน socket)
      await Api.post(`/chat/conversations/${convId}/messages`, { content });
    } catch (err) {
      UI.toast(err.message || 'ส่งข้อความไม่สำเร็จ', 'danger');
      // คืนข้อความใน input
      elInput.value = content;
      elInput.focus();
    }
  }

  // ---------- Socket ----------
  function setupSocket() {
    const token = Auth.getToken();
    socket = io({
      path: '/api/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect_error', (err) => {
      console.warn('[socket] connect_error:', err.message);
    });

    socket.on('chat:message', (m) => {
      // เฉพาะข้อความใน conv นี้
      if (m.msg_conv_id !== convId) {
        // ถ้าเป็นข้อความจาก peer ในห้องอื่น (เปิดแชตอื่นพร้อมกัน) — ignore
        return;
      }
      // กัน duplicate ถ้า message id ซ้ำ
      if (allMessages.some((x) => x.msg_id === m.msg_id)) return;
      allMessages.push(m);
      appendMessages([m]);
      // ถ้าเป็นข้อความจากเรา → scroll ลงล่าง
      // ถ้าเป็นข้อความจาก peer → scroll ถ้า user อยู่ใกล้ล่าง (ไม่ขัด user ที่อ่านย้อนหลัง)
      const nearBottom =
        elBody.scrollHeight - elBody.scrollTop - elBody.clientHeight < 100;
      if (m.msg_sender_id === meId || nearBottom) {
        requestAnimationFrame(() => {
          elBody.scrollTop = elBody.scrollHeight;
        });
      }
      // ถ้าเป็นข้อความจาก peer และเราดูอยู่ → mark read
      if (m.msg_sender_id !== meId) {
        socket.emit('chat:read', { conv_id: convId });
      }
    });

    socket.on('chat:read', (data) => {
      // เพื่อน mark ว่าอ่านข้อความเราแล้ว → อัปเดต ✓✓
      if (data.conv_id !== convId) return;
      if (data.by_user_id === meId) return; // ไม่ใช่ event จากเรา
      const wrap = document.getElementById('chat-messages');
      if (!wrap) return;
      // ทุก bubble ของเราที่ยังไม่ read → set read
      let changed = false;
      for (const m of allMessages) {
        if (m.msg_sender_id === meId && !m.msg_read_at) {
          m.msg_read_at = data.read_at;
          changed = true;
        }
      }
      if (changed) rerenderAll(allMessages);
    });

  }

  // ---------- Composer ----------
  function enableComposer() {
    elInput.disabled = false;
    elSend.disabled = false;
    elInput.focus();
  }

  elInput.addEventListener('input', () => {
    // auto-grow
    elInput.style.height = 'auto';
    elInput.style.height = Math.min(elInput.scrollHeight, 120) + 'px';
  });

  elInput.addEventListener('keydown', (e) => {
    // Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      elComposer.requestSubmit();
    }
  });

  elComposer.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = elInput.value.trim();
    if (!text) return;
    elInput.value = '';
    elInput.style.height = 'auto';
    sendMessage(text);
  });

  // ปุ่มจ้างงานในแชต
  if (elHireBtn) {
    elHireBtn.addEventListener('click', () => {
      if (!peer || !convId) return;
      const fullName = ((peer.user_name || '') + ' ' + (peer.user_lastname || '')).trim() || 'ช่าง';
      JobHelpers.openHireModal({
        workerUserId: peer.user_id,
        workerName: fullName,
        convId: convId,
      });
    });
  }

  // ---------- Bootstrap ----------
  (async () => {
    buildShell();
    try {
      await openOrCreateConversation();
      await loadInitial();
      setupSocket();
      enableComposer();
      // mark read ทันทีหลังเปิดห้อง (REST ก็ mark แล้ว แต่ socket จะ broadcast ให้ peer)
      setTimeout(() => {
        try {
          if (socket && socket.connected) {
            socket.emit('chat:read', { conv_id: convId });
          }
        } catch {}
      }, 300);
    } catch (err) {
      const status = err && err.status;
      elBody.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">${status === 404 ? '🚫' : '⚠'}</div>
        <div class="empty-state__title">${status === 404 ? 'ไม่พบผู้ใช้' : 'เปิดห้องแชตไม่สำเร็จ'}</div>
        <p class="text-muted text-small">${UI.escapeHtml((err && err.message) || '')}</p>
        <a href="/chat" class="btn btn--outline btn--sm" style="margin-top: 12px;">กลับไปกล่องแชต</a>
      </div>`;
    }
  })();

  // cleanup socket ตอนออกจากหน้า
  window.addEventListener('beforeunload', () => {
    if (socket) {
      try { socket.disconnect(); } catch {}
    }
  });
})();
