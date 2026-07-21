// /home — หน้าหลัก = แผนที่ช่างว่างรอบตัว
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const countEl = document.getElementById('map-count');
  const catScroll = document.getElementById('cat-scroll');
  const listView = document.getElementById('list-view');
  const emptyEl = document.getElementById('map-empty');
  const mapEl = document.getElementById('map');

  let map = null;
  let categoryId = null;   // หมวดงานที่กรองอยู่ (null = ทุกหมวด)
  let lastWorkers = [];
  let loadSeq = 0;         // กันผลลัพธ์เก่ามาทับผลใหม่

  // เปิดมาจากลิงก์ /home?category=3 (หน้าแรกสาธารณะส่งมา)
  const fromUrl = Number(new URLSearchParams(location.search).get('category'));
  if (Number.isInteger(fromUrl) && fromUrl > 0) categoryId = fromUrl;

  // ------------------------------------------------------------
  //  จุดเริ่มต้นของแผนที่
  //  1) พิกัดที่ผู้ใช้เคยบันทึกไว้ในโปรไฟล์  2) GPS  3) กรุงเทพ
  // ------------------------------------------------------------
  async function initialCenter() {
    const u = Auth.getUser();
    if (u && u.user_lat != null && u.user_lng != null) {
      return [Number(u.user_lat), Number(u.user_lng)];
    }
    const gps = await CtMap.locate(6000);
    return gps || CtMap.DEFAULT_CENTER;
  }

  // ------------------------------------------------------------
  //  โหลดช่างในกรอบที่เห็นอยู่
  // ------------------------------------------------------------
  async function loadWorkers() {
    if (!map) return;
    const seq = ++loadSeq;
    countEl.textContent = 'กำลังโหลด…';

    try {
      const res = await Api.get('/workers/search', {
        query: {
          bbox: CtMap.bboxOf(map),
          skill_category_id: categoryId || undefined,
          limit: 200,
        },
      });
      if (seq !== loadSeq) return;  // มีการเลื่อนแผนที่ใหม่กว่านี้แล้ว

      lastWorkers = res.workers || [];
      CtMap.renderWorkers(map, lastWorkers);
      renderList(lastWorkers);

      countEl.textContent = lastWorkers.length
        ? 'ช่างว่าง ' + lastWorkers.length + ' คน'
        : 'ไม่พบช่างในพื้นที่นี้';
      emptyEl.hidden = lastWorkers.length > 0 || !mapEl.offsetParent;
    } catch (err) {
      if (seq !== loadSeq) return;
      countEl.textContent = 'โหลดไม่สำเร็จ';
      console.warn('[home] search failed', err.message);
    }
  }

  // ------------------------------------------------------------
  //  มุมมองลิสต์
  // ------------------------------------------------------------
  function renderList(workers) {
    if (!workers.length) {
      listView.innerHTML =
        '<p class="text-muted text-center" style="padding:var(--space-xl)">' +
        'ไม่พบช่างในพื้นที่นี้ ลองซูมออกหรือเลื่อนแผนที่</p>';
      return;
    }

    listView.innerHTML = workers.map(function (w) {
      const fullName = ((w.user_name || '') + ' ' + (w.user_lastname || '')).trim() || 'ช่าง';
      const skills = (w.all_skills || []).slice(0, 3)
        .map((s) => '<span class="chip chip--sm">' + UI.escapeHtml(s.skill_name_th) + '</span>')
        .join('');
      const more = (w.skill_count || 0) > 3
        ? '<span class="chip chip--sm">+' + ((w.skill_count || 0) - 3) + '</span>' : '';
      const verified = w.is_identity_verified
        ? '<span class="badge badge--success">✅ ยืนยันแล้ว</span>' : '';

      return (
        '<a class="worker-row" href="/worker/' + w.worker_id + '">' +
          UI.avatar({ user_name: w.user_name, user_image: w.user_image }, 'md') +
          '<div class="worker-row__body">' +
            '<div class="worker-row__name">' + UI.escapeHtml(fullName) + ' ' + verified + '</div>' +
            '<div class="worker-row__skills">' + skills + more + '</div>' +
            '<div class="worker-row__meta">รับงานไปแล้ว ' + (w.worker_total_jobs || 0) + ' งาน</div>' +
          '</div>' +
          '<span class="worker-row__go" aria-hidden="true">›</span>' +
        '</a>'
      );
    }).join('');
  }

  // ------------------------------------------------------------
  //  ชิปหมวดงาน
  // ------------------------------------------------------------
  async function loadCategories() {
    try {
      const data = await Api.get('/skills');
      const cats = data.categories || [];
      catScroll.innerHTML = '';

      cats.forEach(function (c) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'catbtn' + (categoryId === c.skill_category_id ? ' is-on' : '');
        btn.dataset.cat = c.skill_category_id;
        const icon = CtMap.CATEGORY_ICONS[c.skill_category_name_th] || '🛠️';
        btn.textContent = icon + ' ' + c.skill_category_name_th.replace(/^งาน|^บริการ/, '');
        btn.addEventListener('click', function () {
          // กดซ้ำที่หมวดเดิม = ยกเลิกตัวกรอง
          categoryId = categoryId === c.skill_category_id ? null : c.skill_category_id;
          catScroll.querySelectorAll('.catbtn').forEach((b) => {
            b.classList.toggle('is-on', Number(b.dataset.cat) === categoryId);
          });
          loadWorkers();
        });
        catScroll.appendChild(btn);
      });
    } catch (err) {
      catScroll.innerHTML = '<span class="mapbar__loading">โหลดหมวดงานไม่สำเร็จ</span>';
    }
  }

  // ------------------------------------------------------------
  //  สลับ แผนที่ ↔ ลิสต์
  // ------------------------------------------------------------
  document.querySelectorAll('.mapbar__toggle button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const wantList = btn.dataset.view === 'list';
      document.querySelectorAll('.mapbar__toggle button').forEach((b) => b.classList.remove('is-on'));
      btn.classList.add('is-on');

      mapEl.hidden = wantList;
      listView.hidden = !wantList;
      emptyEl.hidden = wantList || lastWorkers.length > 0;

      // Leaflet ต้องคำนวณขนาดใหม่หลังถูกซ่อนแล้วโชว์
      if (!wantList && map) setTimeout(() => map.invalidateSize(), 50);
    });
  });

  // ------------------------------------------------------------
  //  ปุ่มใกล้ฉัน
  // ------------------------------------------------------------
  document.getElementById('btn-locate').addEventListener('click', async function () {
    const btn = this;
    btn.disabled = true;
    const pos = await CtMap.locate();
    btn.disabled = false;
    if (!pos) {
      UI.toast('ขอตำแหน่งไม่สำเร็จ — เปิดสิทธิ์ตำแหน่งในเบราว์เซอร์ก่อน', 'warning');
      return;
    }
    map.setView(pos, 14);   // moveend จะไปเรียก loadWorkers เอง
  });

  // ------------------------------------------------------------
  //  เริ่ม
  // ------------------------------------------------------------
  (async function start() {
    loadCategories();

    try {
      await CtMap.ensureLeaflet();
    } catch (err) {
      countEl.textContent = 'โหลดแผนที่ไม่สำเร็จ';
      mapEl.innerHTML = '<p class="text-muted text-center" style="padding:var(--space-xl)">' +
        UI.escapeHtml(err.message) + '</p>';
      return;
    }

    const center = await initialCenter();
    map = CtMap.create('#map', { center: center, zoom: 13 });

    CtMap.onViewChange(map, loadWorkers);
    loadWorkers();
  })();
})();
