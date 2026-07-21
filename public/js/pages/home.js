// /home — แผนที่ช่างว่าง "รอบตัวเรา" (สูงสุด 50 กม.)
//
// ต่างจากรอบก่อน: ไม่โหลดตามกรอบแผนที่ที่เลื่อนไปแล้ว
// เพราะพี่ดิวขอปิดระบบดูช่างทั้งประเทศ — ดูได้แค่รอบตัวเอง
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const MAX_RADIUS_KM = 50;

  const countEl = document.getElementById('map-count');
  const radiusEl = document.getElementById('radius');
  const listView = document.getElementById('list-view');
  const emptyEl = document.getElementById('map-empty');
  const mapEl = document.getElementById('map');
  const filterLabel = document.getElementById('filter-label');
  const clearBtn = document.getElementById('btn-filter-clear');

  let map = null;
  let circle = null;
  let meMarker = null;
  let me = null;              // [lat, lng] ตำแหน่งของเรา
  let skillIds = new Set();   // ตัวกรองความสามารถ (เลือกได้หลายอัน)
  let lastWorkers = [];
  let loadSeq = 0;

  const radiusKm = () => Number(radiusEl.value);

  // ------------------------------------------------------------
  //  ตำแหน่งของเรา: พิกัดที่บันทึกในโปรไฟล์ → GPS → กรุงเทพ
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
  //  โหลดช่างรอบตัว
  // ------------------------------------------------------------
  async function loadWorkers() {
    if (!me) return;
    const seq = ++loadSeq;
    countEl.textContent = 'กำลังโหลด…';

    try {
      const res = await Api.get('/workers/search', {
        query: {
          lat: me[0],
          lng: me[1],
          radius_km: radiusKm(),
          skill_ids: skillIds.size ? Array.from(skillIds).join(',') : undefined,
          limit: 200,
        },
      });
      if (seq !== loadSeq) return;   // มีคำขอใหม่กว่าแล้ว

      lastWorkers = res.workers || [];
      CtMap.renderWorkers(map, lastWorkers);
      renderList(lastWorkers);
      zoomToWorkers();

      const far = lastWorkers.length
        ? Math.max(...lastWorkers.map((w) => w.distance_km || 0))
        : 0;
      countEl.textContent = lastWorkers.length
        ? 'ช่างว่าง ' + lastWorkers.length + ' คน (ใกล้สุดในรัศมี ' + far + ' กม.)'
        : 'ไม่พบช่างในรัศมีนี้';
      emptyEl.hidden = lastWorkers.length > 0 || !listView.hidden;
    } catch (err) {
      if (seq !== loadSeq) return;
      countEl.textContent = 'โหลดไม่สำเร็จ';
      console.warn('[home] search failed', err.message);
    }
  }

  // ------------------------------------------------------------
  //  วงรัศมี + หมุดตำแหน่งเรา
  // ------------------------------------------------------------
  function paintArea(fit) {
    if (!map || !me) return;
    const meters = radiusKm() * 1000;

    if (!circle) {
      circle = L.circle(me, {
        radius: meters,
        color: '#970000', weight: 1.5,
        fillColor: '#970000', fillOpacity: 0.05,
      }).addTo(map);
    } else {
      circle.setLatLng(me).setRadius(meters);
    }

    if (!meMarker) {
      meMarker = L.marker(me, {
        icon: L.divIcon({
          className: '',
          html: '<div class="ct-me"></div>',
          iconSize: [18, 18], iconAnchor: [9, 9],
        }),
        interactive: false,
      }).addTo(map);
    } else {
      meMarker.setLatLng(me);
    }

    // ให้วงรัศมีพอดีจอ จะได้เห็นขอบเขตที่ดูได้จริง
    if (fit) map.fitBounds(circle.getBounds(), { padding: [24, 24] });
  }

  /**
   * ซูมให้พอดีกับหมุดที่เจอจริง ไม่ใช่พอดีกับวงรัศมี
   *
   * ในพื้นที่ที่ช่างหนาแน่น ระบบจะได้ครบ 200 คนตั้งแต่รัศมีไม่กี่ร้อยเมตร
   * ถ้าซูมตามวงรัศมี 50 กม. หมุดทั้งหมดจะกระจุกเป็นจุดเดียวกลางจอ
   * ซูมตามหมุดแทน คนใช้จะเห็นช่างกระจายตัวจริง ๆ
   */
  function zoomToWorkers() {
    if (!map || !lastWorkers.length) return;
    const pts = lastWorkers
      .filter((w) => w.worker_lat != null && w.worker_lng != null)
      .map((w) => [Number(w.worker_lat), Number(w.worker_lng)]);
    if (!pts.length) return;

    pts.push(me);   // รวมตำแหน่งเราด้วย จะได้เห็นว่าใครอยู่รอบเรา
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
  }

  // ------------------------------------------------------------
  //  มุมมองลิสต์
  // ------------------------------------------------------------
  function renderList(workers) {
    if (!workers.length) {
      listView.innerHTML =
        '<p class="text-muted text-center" style="padding:var(--space-xl)">' +
        'ไม่พบช่างในรัศมีนี้ ลองขยายรัศมีหรือเอาตัวกรองออก</p>';
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
        ? '<span class="badge--success">✅ ยืนยันแล้ว</span>' : '';

      return (
        '<a class="worker-row" href="/worker/' + w.worker_id + '">' +
          UI.avatar({ user_name: w.user_name, user_image: w.user_image }, 'md') +
          '<div class="worker-row__body">' +
            '<div class="worker-row__name">' + UI.escapeHtml(fullName) + ' ' + verified + '</div>' +
            '<div class="worker-row__skills">' + skills + more + '</div>' +
            '<div class="worker-row__meta">ห่าง ' + (w.distance_km ?? '-') + ' กม. · ' +
              'รับงานไปแล้ว ' + (w.worker_total_jobs || 0) + ' งาน</div>' +
          '</div>' +
          '<span class="worker-row__go" aria-hidden="true">›</span>' +
        '</a>'
      );
    }).join('');
  }

  // ------------------------------------------------------------
  //  แผงกรองความสามารถ — ใช้ SkillTree ตัวเดียวกับหน้าสมัครเป็นช่าง
  // ------------------------------------------------------------
  const panel = document.getElementById('filter-panel');
  let picker = null;
  let draft = new Set();      // ที่เลือกค้างไว้ ยังไม่กด "ดูช่าง"

  function paintFilterLabel() {
    if (skillIds.size === 0) {
      filterLabel.textContent = 'กรองความสามารถ';
      clearBtn.hidden = true;
    } else {
      filterLabel.textContent = 'กรองอยู่ ' + skillIds.size + ' อย่าง';
      clearBtn.hidden = false;
    }
  }

  async function openFilter() {
    panel.hidden = false;
    draft = new Set(skillIds);
    if (!picker) {
      picker = await SkillTree.mount('#filter-mount', {
        selected: Array.from(draft),
        max: 50,
        onChange: (s) => { draft = s; },
      });
    } else {
      picker.setSelected(draft);
    }
  }

  function closeFilter() { panel.hidden = true; }

  document.getElementById('btn-filter').addEventListener('click', openFilter);
  panel.querySelectorAll('[data-close]').forEach((el) =>
    el.addEventListener('click', closeFilter));

  document.getElementById('filter-apply').addEventListener('click', function () {
    skillIds = new Set(draft);
    paintFilterLabel();
    closeFilter();
    loadWorkers();
  });

  document.getElementById('filter-reset').addEventListener('click', function () {
    draft = new Set();
    if (picker) picker.setSelected(draft);
  });

  clearBtn.addEventListener('click', function () {
    skillIds = new Set();
    draft = new Set();
    if (picker) picker.setSelected(draft);
    paintFilterLabel();
    loadWorkers();
  });

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

      if (!wantList && map) setTimeout(() => map.invalidateSize(), 50);
    });
  });

  // ------------------------------------------------------------
  //  เปลี่ยนรัศมี / ปุ่มใกล้ฉัน
  // ------------------------------------------------------------
  radiusEl.addEventListener('change', function () {
    if (radiusKm() > MAX_RADIUS_KM) radiusEl.value = String(MAX_RADIUS_KM);
    paintArea(false);     // ไม่ต้อง fit วง เดี๋ยว zoomToWorkers จัดให้
    loadWorkers();
  });

  document.getElementById('btn-locate').addEventListener('click', async function () {
    this.disabled = true;
    const pos = await CtMap.locate();
    this.disabled = false;
    if (!pos) {
      UI.toast('ขอตำแหน่งไม่สำเร็จ — เปิดสิทธิ์ตำแหน่งในเบราว์เซอร์ก่อน', 'warning');
      return;
    }
    me = pos;
    paintArea(true);
    loadWorkers();
  });

  // ------------------------------------------------------------
  //  เริ่ม
  // ------------------------------------------------------------
  (async function start() {
    paintFilterLabel();

    try {
      await CtMap.ensureLeaflet();
    } catch (err) {
      countEl.textContent = 'โหลดแผนที่ไม่สำเร็จ';
      mapEl.innerHTML = '<p class="text-muted text-center" style="padding:var(--space-xl)">' +
        UI.escapeHtml(err.message) + '</p>';
      return;
    }

    me = await initialCenter();
    map = CtMap.create('#map', { center: me, zoom: 13 });
    map.invalidateSize();     // กัน Leaflet จำขนาดผิดตอน layout ยังไม่นิ่ง

    paintArea(true);
    loadWorkers();
  })();
})();
