// /chat — inbox: รายการบทสนทนา
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const root = document.getElementById('chat-inbox');

  // --- helper: render เวลาแบบสั้น ---
  function shortTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    }
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return 'เมื่อวาน';
    if (diffDays < 7) return d.toLocaleDateString('th-TH', { weekday: 'short' });
    return UI.formatThaiDate(iso);
  }

  function snippet(item) {
    const me = Auth.getUser();
    const meId = me && me.user_id;
    const isMine = item.last_msg_sender_id === meId;
    let content = item.last_msg_content || '';
    if (item.last_msg_type === 'image') content = '📷 รูปภาพ';
    if (content.length > 60) content = content.slice(0, 60) + '...';
    return (isMine ? 'คุณ: ' : '') + content;
  }

  function renderItem(c) {
    const fullName = ((c.other_user_name || '') + ' ' + (c.other_user_lastname || '')).trim() || 'ผู้ใช้';
    const time = shortTime(c.last_msg_created_at);
    const unread = Number(c.unread_count || 0);
    const badge = unread > 0
      ? `<span class="chat-list__badge">${unread > 99 ? '99+' : unread}</span>`
      : '';

    return `
      <a href="/chat/${c.other_user_id}" class="chat-list__item${unread > 0 ? ' chat-list__item--unread' : ''}">
        ${UI.avatar({ user_name: c.other_user_name, user_image: c.other_user_image }, 'md')}
        <div class="chat-list__main">
          <div class="chat-list__top">
            <div class="chat-list__name">${UI.escapeHtml(fullName)}</div>
            <div class="chat-list__time text-tiny text-muted">${UI.escapeHtml(time)}</div>
          </div>
          <div class="chat-list__bottom">
            <div class="chat-list__snippet">${UI.escapeHtml(snippet(c))}</div>
            ${badge}
          </div>
        </div>
      </a>
    `;
  }

  (async () => {
    try {
      const res = await Api.get('/chat/conversations');
      const items = res.conversations || [];
      if (items.length === 0) {
        root.innerHTML = `
          <div class="empty-state" style="margin-top: var(--space-xl);">
            <div class="empty-state__icon" aria-hidden="true">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="empty-state__title">ยังไม่มีบทสนทนา</div>
            <p class="text-muted text-small">ลองเข้าโปรไฟล์ช่างแล้วกด "ส่งข้อความ" เพื่อเริ่มแชต</p>
            <a href="/search-workers" class="btn btn--primary" style="margin-top: var(--space-md);">หาช่าง</a>
          </div>`;
        return;
      }
      root.innerHTML = `<div class="chat-list">${items.map(renderItem).join('')}</div>`;
    } catch (err) {
      root.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">⚠</div>
        <div class="empty-state__title">โหลดบทสนทนาไม่สำเร็จ</div>
        <p class="text-muted text-small">${UI.escapeHtml(err.message || '')}</p>
      </div>`;
    }
  })();
})();
