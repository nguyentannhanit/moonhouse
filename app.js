/* =====================================================================
   Moon House — app.js
   Giao diện lấy từ mockup đã duyệt (mockup/index.html). Dữ liệu thật:
   đọc từ kho trong máy (store.js), ghi vào máy trước rồi gửi ngầm (sync.js).
   ===================================================================== */

/* ---------- Tiện ích chung ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
// Chống chèn HTML khi in chữ người dùng gõ
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Định dạng tiền: 3250000 -> 3.250.000₫
const money = n => String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '₫';
const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const WD_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const dayOffset = n => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; };
const daysTo = d => Math.round((d - TODAY) / 86400000);
const dm = d => d.getDate() + '/' + (d.getMonth() + 1);
const toIso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
// 'YYYY-MM-DD' → Date (nửa đêm giờ máy); chuỗi rỗng/sai → null
const fromIso = s => { if (!s || !/^\d{4}-\d{2}-\d{2}/.test(String(s))) return null; const d = new Date(String(s).slice(0, 10) + 'T00:00'); return isNaN(d) ? null : d; };
const sameDay = (a, b) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
// Bỏ dấu + chữ thường để tìm kiếm
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();
const matchText = (text, q) => { const t = norm(text); return norm(q).split(/\s+/).filter(Boolean).every(w => t.includes(w)); };
// Mã duy nhất cho bản ghi mới, có tiền tố để nhìn vào Sheets biết là gì
const uid = p => p + '_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
// URL ảnh thumbnail của Drive
const thumb = (id, w) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w || 400}`;
const hhmm = iso => { const d = new Date(iso); return isNaN(d) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

/* ---------- Hằng ---------- */
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Số đo'];
const STATUS = ['Đặt', 'Đã về', 'Đã giao'];
const ORDER_STATUS = ['Đang đặt', 'Đã về đủ', 'Đã giao'];
const CHANNELS = ['Fb', 'Zalo', 'Khác'];
const APPT_KINDS = ['Thử váy', 'Báo khách', 'Ngày cưới', 'Khác'];
const STOCK_STATUS = ['Sẵn', 'Đã bán'];
const TONES = ['#EBD9DE', '#E6D6E0', '#F1DDD3', '#DDE3DA', '#EDE4D8', '#E3D8E8', '#F3D9DF', '#D9E1E4'];
const NOPIC = '<svg viewBox="0 0 24 24"><path d="M8.6 2.6c.9 2 2 3 3.4 3s2.5-1 3.4-3l1.3 5.6c-1.5.9-3.1 1.3-4.7 1.3s-3.2-.4-4.7-1.3z"/><path d="M7.3 8.9C5.6 12.4 4.4 16.1 3.9 19.9c2.6.9 5.3 1.4 8.1 1.4s5.5-.5 8.1-1.4c-.5-3.8-1.7-7.5-3.4-11-1.5.9-3.1 1.3-4.7 1.3s-3.2-.4-4.7-1.3z"/></svg>';

/* ---------- Trạng thái giao diện + mô hình trong bộ nhớ ---------- */
const state = {
  sources: [], sourceRecs: [], customers: [], orders: [], stock: [],
  stack: [{ v: 'today' }],
  filter: { q: '', cq: '', status: 'all', source: 'all', sort: 'new' },
  sfilter: { q: '', status: 'all', source: 'all' },
  daySel: TODAY,
  cal: { month: new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), sel: TODAY },
  draft: null,       // đơn đang nhập ở luồng Thêm đơn
  tmp: {},           // dữ liệu tạm cho các bảng trượt
  imgUrls: {}        // id dòng → URL tạm của ảnh đang chờ gửi
};

/* =====================================================================
   MÔ HÌNH: dựng từ các bảng trong máy (bỏ bản ghi đã xóa)
   ===================================================================== */
const groupBy = (arr, k) => arr.reduce((m, r) => ((m[r[k]] = m[r[k]] || []).push(r), m), {});
// Màu ô ảnh giả theo id (ổn định giữa các lần vẽ)
const toneFor = id => TONES[[...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length];
// Ảnh để hiện: đang chờ gửi thì URL tạm, đã lên Drive thì thumbnail, chưa có thì null
const imgFor = (id, anhId, w) => state.imgUrls[id] || (anhId ? thumb(anhId, w || 400) : null);

function dressFromRec(r, i) {
  const st = STATUS.indexOf(r.trangThai);
  return { id: r.id, no: +r.thuTu || i + 1, price: +r.giaTien || 0, cost: +r.giaNhap || null, size: r.size || '', source: r.kho || '',
    note: r.ghiChuVay || '', status: st < 0 ? 0 : st, anhId: r.anhId || '', img: imgFor(r.id, r.anhId), tone: toneFor(r.id), stockId: r.hangHoaId || '', noteGoc: r.noteGoc || '' };
}
function stockFromRec(r) {
  return { id: r.id, price: +r.giaTien || 0, cost: +r.giaNhap || null, size: r.size || '', source: r.kho || '', note: r.ghiChu || '',
    status: r.trangThai === 'Đã bán' ? 'Đã bán' : 'Sẵn', oid: r.donHangId || null, anhId: r.anhId || '', img: imgFor(r.id, r.anhId), tone: toneFor(r.id) };
}
// Đọc mọi bảng → state.*; chạy khi mở app và sau mỗi lần lưu / đồng bộ
async function loadModel() {
  const tabs = {};
  for (const t of SYNC_TABS) tabs[t] = (await Store.all(t)).filter(r => !r.daXoa);
  // Ảnh chờ gửi → URL tạm (giữ URL cũ nếu đã tạo)
  const pend = await Store.all('images');
  const keep = {};
  pend.forEach(p => { keep[p.id] = state.imgUrls[p.id] || URL.createObjectURL(p.blob); });
  Object.keys(state.imgUrls).forEach(id => { if (!keep[id]) URL.revokeObjectURL(state.imgUrls[id]); });
  state.imgUrls = keep;

  state.sourceRecs = tabs.Nguon.sort((a, b) => (+a.thuTu || 0) - (+b.thuTu || 0));
  state.sources = state.sourceRecs.map(r => r.ten).filter(Boolean);
  state.customers = tabs.KhachHang.map(r => ({ id: r.id, name: r.ten || '(chưa có tên)', channel: r.kenh || 'Khác', phone: r.sdt || '', note: r.ghiChu || '' }));
  const dr = groupBy(tabs.ChiTietDon, 'donHangId'), py = groupBy(tabs.ThanhToan, 'donHangId'), ap = groupBy(tabs.LichHen, 'donHangId');
  state.orders = tabs.DonHang.map(r => ({
    id: r.id, cid: r.khachId, date: fromIso(r.ngayDat) || TODAY, due: fromIso(r.hanGiao), note: r.note || '', sheetGoc: r.sheetGoc || '',
    dresses: (dr[r.id] || []).sort((a, b) => (+a.thuTu || 0) - (+b.thuTu || 0)).map(dressFromRec),
    pays: (py[r.id] || []).map(p => ({ id: p.id, date: fromIso(p.ngay) || TODAY, amount: +p.soTien || 0, kind: p.loai || 'Thanh toán' })).sort((a, b) => a.date - b.date),
    appts: (ap[r.id] || []).map(a => ({ id: a.id, date: fromIso(a.ngay), kind: a.loai || 'Khác', note: a.ghiChu || '' })).filter(a => a.date)
  }));
  state.stock = tabs.HangHoa.map(stockFromRec);
}

/* ---------- Tính toán từ mô hình ---------- */
const orderTotal = o => o.dresses.reduce((s, d) => s + (d.price || 0), 0);
const orderPaid = o => o.pays.reduce((s, p) => s + p.amount, 0);
const orderOwed = o => Math.max(0, orderTotal(o) - orderPaid(o));
// Trạng thái đơn = váy chậm nhất trong đơn (đơn không có váy coi như đang đặt)
const orderStatus = o => !o.dresses.length ? 0 : o.dresses.every(d => d.status === 2) ? 2 : o.dresses.every(d => d.status >= 1) ? 1 : 0;
const customerOf = o => state.customers.find(c => c.id === o.cid) || { id: o.cid, name: '(khách đã xóa)', channel: '' };
const ordersOf = c => state.orders.filter(o => o.cid === c.id);
const orderById = id => state.orders.find(o => o.id === id);

/* =====================================================================
   GHI DỮ LIỆU: ghi vào máy trước (hiện ngay), xếp hàng gửi lên Sheets sau
   ===================================================================== */
// Ghi 1 bản ghi đầy đủ
async function save(tab, rec) {
  rec.updatedAt = new Date().toISOString();
  if (rec.daXoa === undefined) rec.daXoa = false;
  await Store.put(tab, rec);
  await Store.outboxAdd({ tab, rec });
}
// Sửa vài cột của bản ghi có sẵn (giữ nguyên cột khác, ví dụ anhId)
async function upd(tab, id, changes) {
  const cur = (await Store.get(tab, id)) || { id };
  await save(tab, Object.assign(cur, changes));
}
// Đánh dấu xóa
const remove = (tab, id) => upd(tab, id, { daXoa: true });
// Sau khi ghi: dựng lại mô hình, vẽ lại, gửi ngầm
async function commit(keepScroll = true, msg) {
  await loadModel();
  render(keepScroll);
  if (msg) toast(msg);
  Sync.schedule();
}
// Lưu có trì hoãn cho ô gõ chữ (note...) — gõ xong 600ms mới ghi
const pendingWrites = {};
function debounced(key, fn) { clearTimeout(pendingWrites[key]); pendingWrites[key] = setTimeout(fn, 600); }

/* ---------- Ảnh: nén rồi giữ trong máy, gửi ngầm ---------- */
// Nén ảnh: cạnh dài ≤1200px, JPEG 0.82 — đủ nét để xem váy, nhẹ để gửi và lưu Drive
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1200 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error('Không nén được ảnh')), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh')); };
    img.src = url;
  });
}
// Gắn ảnh vào 1 dòng đã có id (váy trong đơn hoặc hàng hóa): giữ blob trong máy + xếp hàng gửi
async function attachImage(tab, id, file) {
  const blob = await compressImage(file);
  await Store.imagePut(id, blob);
  if (state.imgUrls[id]) URL.revokeObjectURL(state.imgUrls[id]);
  state.imgUrls[id] = URL.createObjectURL(blob);
  await Store.outboxAdd({ kind: 'image', tab, id });
}

/* =====================================================================
   BIỂU TƯỢNG, Ô ẢNH, THANH TRÊN
   ===================================================================== */
// Trăng hình cầu theo tiến trình váy: 0 = mờ (Đặt), 1 = nửa vàng (Đã về), 2 = tròn xanh lá (Đã giao)
const moon = s => `<svg class="moon m${s}" viewBox="0 0 20 20" aria-hidden="true">
  <circle cx="10" cy="10" r="8.5" fill="url(#${s === 0 ? 'mg-new' : s === 1 ? 'mg-dark' : 'mg-done'})"/>
  ${s === 1 ? '<path d="M10 1.5a8.5 8.5 0 0 0 0 17z" fill="url(#mg-lit)"/>' : ''}
  ${s !== 1 ? '<ellipse cx="7.3" cy="6.6" rx="2.6" ry="1.7" fill="#fff" opacity=".55" transform="rotate(-30 7.3 6.6)"/>' : ''}
  <circle cx="10" cy="10" r="8.5" fill="none" stroke="${s === 0 ? '#B08E9A' : s === 1 ? '#6E4F5B' : '#1F6B44'}" stroke-width=".8"/></svg>`;
// Màu thanh tiến độ: chưa đủ thì đỏ → cam → vàng, đủ 100% mới xanh lá
const progColor = pct => pct >= 100 ? 'var(--green)' : `hsl(${Math.round(pct * .48)} 70% 46%)`;
const ICONS = {
  today: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  orders: '<path d="M5 6h14M5 12h14M5 18h9"/>',
  customers: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>',
  settings: '<path d="M4 8h16M4 16h16"/><circle cx="9" cy="8" r="2.4"/><circle cx="15" cy="16" r="2.4"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none"/>',
  stock: '<path d="M12 9V7.6a2.1 2.1 0 1 0-2.1-2.1"/><path d="M12 9l8.6 6.2a1 1 0 0 1-.6 1.8H4a1 1 0 0 1-.6-1.8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>'
};
const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

// Ô ảnh: có ảnh thì hiện ảnh, chưa có thì ô màu với hình váy mờ
const tile = (d, cls = '', withMoon = false) => {
  const bg = d.img ? `background-image:url(${d.img})` : `--tone:${d.tone}`;
  return `<div class="tile ${cls} ${d.img ? '' : 'nopic'}" style="${bg}">${d.img ? '' : NOPIC}${withMoon ? `<span class="mb">${moon(d.status)}</span>` : ''}</div>`;
};

// Thanh trên cùng: tiêu đề + viên trạng thái đồng bộ
const topbar = ({ title, sub, back }) => `
  <header class="top">
    ${back ? `<button class="back" data-act="back"><b>‹</b> ${esc(back)}</button>` : ''}
    <div class="top-row">
      <div><h1>${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
      <button class="pill ${syncClass()}" id="sync" data-act="sync-now">${syncText()}</button>
    </div>
  </header>`;
// Chữ và màu của viên đồng bộ theo trạng thái Sync
function syncText() {
  if (!Api.ready()) return 'Chưa kết nối';
  if (Sync.busy) return 'Đang đồng bộ…';
  if (Sync.pending) return Sync.pending + ' chờ gửi';
  if (Sync.error) return 'Lỗi đồng bộ';
  return Sync.lastAt ? 'Đã đồng bộ ' + hhmm(Sync.lastAt) : 'Chưa đồng bộ';
}
function syncClass() { return !Api.ready() ? 'off' : Sync.busy ? 'busy' : (Sync.pending || Sync.error) ? 'err' : ''; }
// Cập nhật viên đồng bộ tại chỗ (không vẽ lại cả màn)
function refreshSyncPill() { const el = $('#sync'); if (el) { el.textContent = syncText(); el.className = 'pill ' + syncClass(); } }

let toastTimer;
// Thông báo ngắn phía dưới
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- Ô nhập tiền theo nghìn: gõ 3200 = 3.200.000₫ ---------- */
function moneyField(key, vnd, placeholder = '0') {
  return `<label class="kfield"><input inputmode="numeric" data-k="${key}" value="${vnd ? Math.round(vnd / 1000) : ''}" placeholder="${placeholder}"><i>.000₫</i></label>
          <span class="kfull" data-kfull="${key}">${vnd ? '= ' + money(vnd) : ''}</span>`;
}
// Ghi số tiền gõ vào đúng chỗ theo key: dep = cọc, dpN/dcN = giá/giá nhập váy N trong đơn mới, còn lại vào tmp
function setMoney(key, vnd) {
  const d = state.draft;
  if (key === 'dep') d.deposit = vnd;
  else if (key.startsWith('dp')) d.dresses[+key.slice(2)].price = vnd;
  else if (key.startsWith('dc')) d.dresses[+key.slice(2)].cost = vnd;
  else state.tmp[key] = vnd;
  const full = document.querySelector(`[data-kfull="${key}"]`);
  if (full) full.textContent = vnd ? '= ' + money(vnd) : '';
  if (topView().v === 'new') refreshDraftSummary();
}
const topView = () => state.stack[state.stack.length - 1];

/* =====================================================================
   SỰ KIỆN CÓ NGÀY: hạn giao + lịch hẹn
   ===================================================================== */
function allEvents() {
  const evs = [];
  state.orders.forEach(o => {
    const c = customerOf(o), open = o.dresses.filter(d => d.status < 2).length;
    if (o.due && open) evs.push({ date: o.due, kind: 'Hạn giao', note: open + ' váy chưa giao', oid: o.id, cname: c.name });
    o.appts.forEach(a => evs.push({ date: a.date, kind: a.kind, note: a.note, oid: o.id, cname: c.name }));
  });
  return evs.sort((a, b) => a.date - b.date);
}
const eventsOn = d => allEvents().filter(e => sameDay(e.date, d));
const evColor = e => e.kind === 'Hạn giao' ? 'var(--amber)' : e.kind === 'Ngày cưới' ? 'var(--ink)' : 'var(--rose)';
const eventRow = e => `<button class="row" data-act="open-order" data-id="${e.oid}"><i class="dot" style="background:${evColor(e)}"></i>
  <div class="main"><b>${esc(e.cname)}</b><span>${esc(e.kind)}${e.note ? ' · ' + esc(e.note) : ''}</span></div><div class="side"><span class="muted">${dm(e.date)}</span></div></button>`;
// Dải 7 ngày kể từ hôm nay, mỗi ngày có chấm màu theo sự kiện
function weekStrip(sel) {
  return `<div class="week">${Array.from({ length: 7 }, (_, i) => {
    const d = dayOffset(i), evs = eventsOn(d);
    return `<button class="wd ${sameDay(d, sel) ? 'on' : ''} ${i === 0 ? 'today' : ''}" data-act="pick-day" data-iso="${toIso(d)}"><span>${i === 0 ? 'Nay' : WD_SHORT[d.getDay()]}</span><b>${d.getDate()}</b><i class="dots">${evs.slice(0, 3).map(e => `<u style="background:${evColor(e)}"></u>`).join('')}</i></button>`;
  }).join('')}</div>`;
}
const legend = () => `<div class="legend"><span><i style="background:var(--amber)"></i>Hạn giao</span><span><i style="background:var(--rose)"></i>Hẹn khách</span><span><i style="background:var(--ink)"></i>Ngày cưới</span></div>`;
// Nhãn nút quay lại = tên màn hình ngay dưới trong ngăn xếp
function backLabel() {
  const p = state.stack[state.stack.length - 2]; if (!p) return 'Quay lại';
  return { today: 'Hôm nay', orders: 'Đơn hàng', calendar: 'Lịch', stock: 'Hàng hóa', customers: 'Khách hàng', settings: 'Cài đặt', order: 'Đơn', customer: (state.customers.find(c => c.id === p.id) || {}).name }[p.v] || 'Quay lại';
}
// Nhắc cài đặt kết nối nếu chưa có
const setupBanner = () => Api.ready() ? '' : `<div class="banner"><b>Chưa kết nối Google Sheets</b>Dữ liệu chỉ nằm trong máy này. Vào Cài đặt dán URL Web App và mã bí mật.<br><button data-act="tab" data-val="settings">Mở Cài đặt</button></div>`;

/* =====================================================================
   1. HÔM NAY
   ===================================================================== */
function viewToday() {
  const sel = state.daySel, selN = daysTo(sel), dayEvs = eventsOn(sel);
  const selLabel = selN === 0 ? 'Hôm nay' : selN === 1 ? 'Ngày mai' : WEEKDAYS[sel.getDay()] + ' ' + dm(sel);
  const owedOrders = state.orders.filter(o => orderOwed(o) > 0).sort((a, b) => orderOwed(b) - orderOwed(a));
  const totalOwed = owedOrders.reduce((s, o) => s + orderOwed(o), 0);
  const due = state.orders.filter(o => o.due && daysTo(o.due) <= 7 && o.dresses.some(d => d.status < 2)).sort((a, b) => a.due - b.due);
  let lastKey = null, dueHtml = '';
  due.forEach(o => {
    const n = daysTo(o.due), key = n < 0 ? 'late' : String(n);
    if (key !== lastKey) { dueHtml += `<div class="dayhead ${n < 0 ? 'late' : ''}">${n < 0 ? 'Quá hạn' : n === 0 ? 'Hôm nay' : n === 1 ? 'Ngày mai' : WEEKDAYS[o.due.getDay()] + ', ' + dm(o.due)}</div>`; lastKey = key; }
    const open = o.dresses.filter(d => d.status < 2), owe = orderOwed(o);
    dueHtml += `<button class="due" data-act="open-order" data-id="${o.id}">
      <div class="thumbs">${open.slice(0, 2).map(d => tile(d, '', true)).join('')}${open.length > 2 ? `<span class="more">+${open.length - 2}</span>` : ''}</div>
      <div class="main"><b>${esc(customerOf(o).name)}</b>
        <span>${open.length} váy chưa giao${n < 0 ? ` · <span class="owe" style="display:inline">quá ${-n} ngày</span>` : ''}</span>
        ${owe > 0 ? `<span class="owe">Còn ${money(owe)}</span>` : `<span class="ok">Đã thu đủ</span>`}
      </div></button>`;
  });
  const owedRows = owedOrders.map(o => {
    const pct = Math.min(100, Math.round(orderPaid(o) / (orderTotal(o) || 1) * 100));
    return `<button class="row" data-act="open-order" data-id="${o.id}">
      <div class="main"><b>${esc(customerOf(o).name)}</b><span>${o.dresses.length} váy · đã thu ${pct}%</span><div class="bar"><i style="width:${pct}%;--pc:${progColor(pct)}"></i></div></div>
      <div class="side"><b class="owe">${money(orderOwed(o))}</b></div></button>`;
  }).join('');
  const wd = WEEKDAYS[TODAY.getDay()] + ', ' + dm(TODAY) + '/' + TODAY.getFullYear();
  const empty = !state.orders.length ? `<div class="banner" style="background:rgba(199,96,122,.1);color:var(--ink)"><b>Chưa có đơn nào</b>Bấm nút giữa → Thêm đơn mới. ${Api.ready() ? 'Nếu đã có dữ liệu trên Sheets, vào Cài đặt → Đồng bộ lại toàn bộ.' : ''}</div>` : '';
  return topbar({ title: 'Hôm nay', sub: wd }) + setupBanner() + empty + `
    <div class="hero tilt"><i class="orb"></i><div class="lbl">Tổng còn phải thu</div>
      <div class="num" id="owed-num" data-val="${totalOwed}">${money(totalOwed)}</div><div class="note">${owedOrders.length} đơn chưa thu đủ</div>
      <div class="foot"><span>Cần giao trong 7 ngày</span><b>${due.reduce((s, o) => s + o.dresses.filter(d => d.status < 2).length, 0)} váy</b></div></div>
    ${weekStrip(sel)}${legend()}
    <section class="block" style="margin-top:14px"><h2>${selLabel} <small><button class="linkbtn" data-act="open-calendar" style="min-height:auto">Xem cả tháng ›</button></small></h2>
      <div class="group">${dayEvs.map(eventRow).join('') || '<div class="empty">Không có lịch hẹn hay hạn giao</div>'}</div>
      ${state.orders.length ? `<button class="btn ghost" style="margin-top:10px" data-act="add-appt" data-iso="${toIso(sel)}">＋ Thêm lịch hẹn</button>` : ''}</section>
    <section class="block"><h2>Sắp tới hạn giao <small>7 ngày tới</small></h2>${dueHtml || '<div class="empty group">Không có váy nào tới hạn</div>'}</section>
    <section class="block"><h2>Đơn chưa thu đủ <small>nhiều nhất trước</small></h2><div class="group">${owedRows || '<div class="empty">Không có đơn nào còn nợ</div>'}</div></section>`;
}

/* ---------- Dòng đơn dùng chung ---------- */
function orderRow(o, showName = true) {
  const owe = orderOwed(o);
  return `<button class="row" data-act="open-order" data-id="${o.id}">
    <div class="main"><b>${showName ? esc(customerOf(o).name) : dm(o.date) + ' · ' + o.dresses.length + ' váy'}</b>
      <span>${showName ? dm(o.date) + ' · ' + o.dresses.length + ' váy' : ''}${o.due ? (showName ? ' · ' : '') + 'hạn ' + dm(o.due) : ''}</span>
      <div class="moons">${o.dresses.map(d => moon(d.status)).join('')}</div></div>
    <div class="side"><b>${money(orderTotal(o))}</b>${owe > 0 ? `<span class="owe">Còn ${money(owe)}</span>` : '<span class="ok">Đủ</span>'}</div></button>`;
}

/* =====================================================================
   2. ĐƠN HÀNG: danh sách + lọc + tìm
   ===================================================================== */
function viewOrders() {
  const f = state.filter;
  return topbar({ title: 'Đơn hàng', sub: `<span id="order-count"></span>` }) + `
    <div class="search"><input class="field" id="order-q" type="search" placeholder="Gõ vài chữ: tên khách, kho, ghi chú…" value="${esc(f.q)}" autocomplete="off"></div>
    <div class="names" id="order-names"></div>
    <div class="fbar">
      <button class="fbtn ${f.status !== 'all' ? 'on' : ''}" data-act="pick-status"><span>Trạng thái</span><b>${f.status === 'all' ? 'Tất cả' : ORDER_STATUS[+f.status]}</b></button>
      <button class="fbtn ${f.source !== 'all' ? 'on' : ''}" data-act="pick-source"><span>Kho</span><b>${f.source === 'all' ? 'Tất cả' : esc(f.source)}</b></button>
      <button class="fbtn" data-act="sort"><span>Ngày</span><b>${f.sort === 'new' ? 'Mới nhất' : 'Cũ nhất'}</b></button>
    </div>
    <div class="block" style="margin-top:12px"><div class="group" id="order-list"></div></div>`;
}
// Tên khách khớp với chữ đang gõ → dải nút gợi ý
function nameSuggest(q) {
  if (!q.trim()) return '';
  return state.customers.filter(c => matchText(c.name, q) && norm(c.name) !== norm(q)).slice(0, 6)
    .map(c => `<button data-act="sugg-name" data-val="${esc(c.name)}">${esc(c.name)}</button>`).join('');
}
function renderOrderList() {
  const f = state.filter, q = f.q.trim();
  const hay = o => [customerOf(o).name, o.note, ...o.dresses.map(d => d.note + ' ' + d.source + ' ' + d.size)].join(' ');
  const list = state.orders.filter(o => (!q || matchText(hay(o), q)) && (f.status === 'all' || orderStatus(o) === +f.status) && (f.source === 'all' || o.dresses.some(d => d.source === f.source)))
    .sort((a, b) => f.sort === 'new' ? b.date - a.date : a.date - b.date);
  $('#order-list').innerHTML = list.map(o => orderRow(o)).join('') || '<div class="empty">Không có đơn phù hợp</div>';
  $('#order-count').textContent = list.length + ' đơn';
  $('#order-names').innerHTML = nameSuggest(q);
}
// Bảng chọn trạng thái / kho, kèm số đơn
function sheetFilter(kind) {
  const f = state.filter, isS = kind === 'status';
  const opts = [['all', 'Tất cả'], ...(isS ? ORDER_STATUS.map((l, i) => [i, l]) : state.sources.map(s => [s, s]))];
  const count = v => v === 'all' ? state.orders.length : isS ? state.orders.filter(o => orderStatus(o) === +v).length : state.orders.filter(o => o.dresses.some(d => d.source === v)).length;
  const cur = isS ? f.status : f.source;
  openSheet(`<h3>${isS ? 'Trạng thái đơn' : 'Kho (nguồn váy)'}</h3><p class="sub" style="margin:0">Chọn một để lọc</p>
    <div class="opt-grid">${opts.map(([v, l]) => `<button class="opt ${String(cur) === String(v) ? 'on' : ''}" data-act="set-${kind}" data-val="${esc(v)}"><b>${esc(l)}</b><span>${count(v)} đơn</span></button>`).join('')}</div>`);
}

/* =====================================================================
   3. CHI TIẾT ĐƠN
   ===================================================================== */
function viewOrder(v) {
  const o = orderById(v.id);
  if (!o) { state.stack.pop(); return viewOrders(); }
  const c = customerOf(o), total = orderTotal(o), paid = orderPaid(o), owe = orderOwed(o);
  const pct = total ? Math.min(100, Math.round(paid / total * 100)) : 0;
  const dueN = o.due ? daysTo(o.due) : null;
  const dueTag = o.due ? `<span class="tag ${dueN < 0 ? 'late' : dueN <= 2 ? 'soon' : ''}">${dueN < 0 ? 'quá ' + -dueN + ' ngày' : dueN === 0 ? 'hôm nay' : 'còn ' + dueN + ' ngày'}</span>` : '';
  const dresses = o.dresses.map((d, i) => `
    <div class="dcard">
      <button data-act="view-img" data-id="${o.id}" data-i="${i}" aria-label="Xem ảnh váy ${i + 1}">${tile(d, 'lg')}</button>
      <button class="info" data-act="edit-dress" data-id="${o.id}" data-i="${i}">
        <div class="price">${money(d.price)}</div>
        <div class="meta">${esc(d.size || 'Chưa có size')} · ${esc(d.source || 'Chưa có kho')}</div>
        <div class="cost">${d.cost ? 'Giá nhập ' + money(d.cost) : 'Chưa ghi giá nhập'}</div>
        ${d.note ? `<span class="dnote">${esc(d.note)}</span>` : '<span class="dnote empty">＋ Ghi chú váy</span>'}
      </button>
      <button class="moonbtn" data-act="cycle" data-id="${o.id}" data-i="${i}" aria-label="Đổi trạng thái váy ${i + 1}">${moon(d.status)}${STATUS[d.status]}</button>
    </div>`).join('');
  const pays = o.pays.map(p => `<button class="kv" data-act="del-pay" data-id="${o.id}" data-pid="${p.id}"><span>${dm(p.date)} · ${esc(p.kind)}</span><b>${money(p.amount)}</b></button>`).join('');
  const appts = o.appts.slice().sort((a, b) => a.date - b.date).map(a => { const n = daysTo(a.date);
    return `<button class="kv" data-act="del-appt" data-id="${o.id}" data-aid="${a.id}"><span style="display:flex;align-items:center;gap:8px"><i class="dot" style="background:${evColor(a)}"></i>${esc(a.kind)}${a.note ? ' · ' + esc(a.note) : ''}</span><b>${dm(a.date)}${n < 0 ? '' : ` <span class="tag ${n <= 2 ? 'soon' : ''}">${n === 0 ? 'hôm nay' : 'còn ' + n + ' ngày'}</span>`}</b></button>`; }).join('');
  return topbar({ title: c.name, sub: `Đặt ${dm(o.date)} · ${esc(c.channel)}${o.sheetGoc ? ' · từ sheet ' + esc(o.sheetGoc) : ''}`, back: backLabel() }) + `
    <div class="money tilt"><div class="line">Còn lại</div><div class="rest ${owe > 0 ? 'owe' : 'ok'}">${owe > 0 ? money(owe) : 'Đã thu đủ'}</div>
      <div class="bar"><i style="width:${pct}%;--pc:${progColor(pct)}"></i></div>
      <div class="line">Tổng ${money(total)} · đã thu ${money(paid)}</div></div>
    <section class="block"><div class="group">
      <button class="kv" data-act="edit-due" data-id="${o.id}"><span>Hạn giao</span><span class="val">${o.due ? dm(o.due) + ' ' + dueTag : 'Chưa hẹn'}</span></button>
    </div></section>
    <section class="block"><h2>Lịch hẹn</h2><div class="group">${appts || '<div class="empty">Chưa có lịch hẹn</div>'}</div>
      <button class="btn ghost" style="margin-top:10px" data-act="add-appt" data-id="${o.id}">＋ Thêm lịch hẹn</button></section>
    <section class="block"><h2>Váy trong đơn <small>${o.dresses.length} váy</small></h2><p class="sub" style="margin:-4px 0 10px">Chạm trăng để đổi trạng thái · chạm ảnh để xem to · chạm chữ để sửa</p>
      <div class="group">${dresses || '<div class="empty">Đơn chưa có váy</div>'}</div>
      <button class="btn ghost" style="margin-top:10px" data-act="add-dress-to-order" data-id="${o.id}">＋ Thêm váy vào đơn</button></section>
    <section class="block"><h2>Thanh toán</h2><div class="group">${pays || '<div class="empty">Chưa có khoản nào</div>'}</div>
      <button class="btn ghost" style="margin-top:10px" data-act="add-pay" data-id="${o.id}">＋ Thêm thanh toán</button></section>
    <section class="block"><h2>Note đơn</h2><textarea class="field" data-in="order-note" data-id="${o.id}" placeholder="Ví dụ: Trước 5/8, khách báo qua Fb">${esc(o.note)}</textarea>
      ${o.dresses.some(d => d.noteGoc) ? `<p class="small-note">Note gốc từ Excel: ${o.dresses.map(d => d.noteGoc).filter(Boolean).map(esc).join(' · ')}</p>` : ''}</section>
    <section class="block"><button class="linkbtn danger" data-act="del-order" data-id="${o.id}">Xoá đơn này</button></section>`;
}

/* =====================================================================
   5. KHÁCH HÀNG
   ===================================================================== */
function viewCustomers() {
  return topbar({ title: 'Khách hàng', sub: state.customers.length + ' khách' }) + `
    <div class="search"><input class="field" id="cust-search" type="search" placeholder="Gõ vài chữ, không cần dấu…" value="${esc(state.filter.cq || '')}" autocomplete="off"></div>
    <div class="names" id="cust-names"></div>
    <div class="block" style="margin-top:12px"><div class="group" id="cust-list"></div></div>`;
}
function renderCustomerList() {
  const q = (state.filter.cq || '').trim();
  const list = state.customers.filter(c => !q || matchText(c.name + ' ' + c.channel + ' ' + c.phone, q)).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  $('#cust-names').innerHTML = nameSuggest(q);
  $('#cust-list').innerHTML = list.map(c => {
    const os = ordersOf(c), owe = os.reduce((s, o) => s + orderOwed(o), 0);
    return `<button class="row" data-act="open-customer" data-id="${c.id}">
      <div class="main"><b>${esc(c.name)}</b><span>${esc(c.channel)}${c.phone ? ' · ' + esc(c.phone) : ''} · ${os.length} đơn · ${os.reduce((s, o) => s + o.dresses.length, 0)} váy</span></div>
      <div class="side">${owe > 0 ? `<b class="owe">${money(owe)}</b><span class="muted">còn nợ</span>` : ''}</div></button>`;
  }).join('') || '<div class="empty">Chưa có khách nào</div>';
}
function viewCustomer(v) {
  const c = state.customers.find(x => x.id === v.id);
  if (!c) { state.stack.pop(); return viewCustomers(); }
  const os = ordersOf(c).sort((a, b) => b.date - a.date), owe = os.reduce((s, o) => s + orderOwed(o), 0);
  return topbar({ title: c.name, sub: `${os.length} đơn · ${os.reduce((s, o) => s + o.dresses.length, 0)} váy` + (owe > 0 ? ` · còn nợ <span class="owe">${money(owe)}</span>` : ''), back: backLabel() }) + `
    <section class="block"><div class="group">
      <button class="kv" data-act="edit-customer" data-id="${c.id}"><span>Kênh liên hệ</span><span class="val">${esc(c.channel)}</span></button>
      <button class="kv" data-act="edit-customer" data-id="${c.id}"><span>Số điện thoại</span><span class="val">${esc(c.phone) || 'Chưa có'}</span></button>
      <button class="kv" data-act="edit-customer" data-id="${c.id}"><span>Ghi chú</span><span class="val">${esc(c.note) || '—'}</span></button>
    </div></section>
    <section class="block"><h2>Lịch sử đơn</h2><div class="group">${os.map(o => orderRow(o, false)).join('') || '<div class="empty">Chưa có đơn</div>'}</div></section>`;
}
// Bảng sửa khách: tên, kênh, số điện thoại, ghi chú
function sheetCustomer() {
  const t = state.tmp;
  openSheet(`<h3>Sửa khách</h3>
    <label class="lab">Tên</label><input class="field" data-in="cu-name" value="${esc(t.name)}" autocomplete="off">
    <label class="lab">Kênh liên hệ</label><div class="chips wrap">${CHANNELS.map(ch => `<button class="chip ${t.channel === ch ? 'on' : ''}" data-act="cu-channel" data-val="${ch}">${ch}</button>`).join('')}</div>
    <label class="lab">Số điện thoại</label><input class="field" data-in="cu-phone" inputmode="tel" value="${esc(t.phone)}" autocomplete="off">
    <label class="lab">Ghi chú</label><textarea class="field" data-in="cu-note">${esc(t.note)}</textarea>
    <button class="btn" style="margin-top:16px" data-act="save-customer">Lưu</button>`);
}

/* =====================================================================
   7. LỊCH
   ===================================================================== */
function viewCalendar() {
  const m = state.cal.month, sel = state.cal.sel;
  const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const lead = (new Date(m.getFullYear(), m.getMonth(), 1).getDay() + 6) % 7;   // tuần bắt đầu Thứ Hai
  let cells = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(w => `<div class="wdh">${w}</div>`).join('');
  for (let i = 0; i < lead; i++) cells += '<div class="cd pad"></div>';
  for (let n = 1; n <= days; n++) {
    const d = new Date(m.getFullYear(), m.getMonth(), n), evs = eventsOn(d);
    cells += `<button class="cd ${sameDay(d, TODAY) ? 'today' : ''} ${sameDay(d, sel) ? 'on' : ''}" data-act="cal-pick" data-iso="${toIso(d)}">${n}<i class="dots">${evs.slice(0, 3).map(e => `<u style="background:${evColor(e)}"></u>`).join('')}</i></button>`;
  }
  const monthEvs = allEvents().filter(e => e.date.getMonth() === m.getMonth() && e.date.getFullYear() === m.getFullYear());
  const dayEvs = eventsOn(sel);
  return topbar({ title: 'Lịch', sub: `${monthEvs.length} sự kiện trong tháng`, back: state.stack.length > 1 ? backLabel() : null }) + `
    <div class="cal"><div class="cal-head"><button data-act="cal-prev" aria-label="Tháng trước">‹</button><b>Tháng ${m.getMonth() + 1}/${m.getFullYear()}</b><button data-act="cal-next" aria-label="Tháng sau">›</button></div>
      <div class="cal-grid">${cells}</div></div>
    ${legend()}
    <section class="block" style="margin-top:14px"><h2>${sameDay(sel, TODAY) ? 'Hôm nay' : WEEKDAYS[sel.getDay()] + ', ' + dm(sel)} <small>${sameDay(sel, TODAY) ? '' : '<button class="linkbtn" data-act="cal-today" style="min-height:auto">Về hôm nay</button>'}</small></h2>
      <div class="group">${dayEvs.map(eventRow).join('') || '<div class="empty">Không có gì trong ngày này</div>'}</div>
      ${state.orders.length ? `<button class="btn ghost" style="margin-top:10px" data-act="add-appt" data-iso="${toIso(sel)}">＋ Thêm lịch hẹn ngày ${dm(sel)}</button>` : ''}</section>`;
}
// Bảng thêm lịch hẹn
function sheetAppt() {
  const t = state.tmp, o = orderById(t.oid);
  openSheet(`<h3>Thêm lịch hẹn</h3>
    ${t.lock ? `<p class="sub" style="margin:0">${esc(customerOf(o).name)}</p>` : `<label class="lab">Đơn của khách</label><select class="field" data-in="ap-oid">${state.orders.slice().sort((a, b) => b.date - a.date).map(x => `<option value="${x.id}" ${x.id === t.oid ? 'selected' : ''}>${esc(customerOf(x).name)} · đặt ${dm(x.date)}</option>`).join('')}</select>`}
    <label class="lab">Loại</label><div class="chips wrap">${APPT_KINDS.map(k => `<button class="chip ${t.kind === k ? 'on' : ''}" data-act="ap-kind" data-val="${k}">${k}</button>`).join('')}</div>
    <label class="lab">Ngày</label><input class="field" type="date" data-in="ap-date" value="${t.date}">
    <label class="lab">Ghi chú</label><input class="field" data-in="ap-note" value="${esc(t.note)}" placeholder="Ví dụ: thử lần 2, mang giày, 15h" autocomplete="off">
    <button class="btn" style="margin-top:16px" data-act="save-appt">Lưu lịch hẹn</button>`);
}

/* =====================================================================
   8. HÀNG HÓA: váy có sẵn trong shop, chưa gắn đơn
   ===================================================================== */
function viewStock() {
  const f = state.sfilter, avail = state.stock.filter(s => s.status === 'Sẵn').length;
  return topbar({ title: 'Hàng hóa', sub: `${avail} váy sẵn · ${state.stock.length - avail} đã bán` }) + `
    <div class="search"><input class="field" id="stock-q" type="search" placeholder="Tìm theo size, kho, ghi chú…" value="${esc(f.q)}" autocomplete="off"></div>
    <div class="fbar">
      <button class="fbtn ${f.status !== 'all' ? 'on' : ''}" data-act="stock-filter" data-val="status"><span>Trạng thái</span><b>${f.status === 'all' ? 'Tất cả' : f.status}</b></button>
      <button class="fbtn ${f.source !== 'all' ? 'on' : ''}" data-act="stock-filter" data-val="source"><span>Mua từ</span><b>${f.source === 'all' ? 'Tất cả' : esc(f.source)}</b></button>
    </div>
    <div class="block" style="margin-top:12px"><button class="btn" data-act="stock-edit">＋ Thêm hàng mới</button></div>
    <div class="stock-grid" id="stock-grid"></div>`;
}
function renderStockGrid() {
  const f = state.sfilter, q = f.q.trim();
  const list = state.stock.filter(s => (f.status === 'all' || s.status === f.status) && (f.source === 'all' || s.source === f.source) && (!q || matchText([s.size, s.source, s.note, s.status].join(' '), q)));
  $('#stock-grid').innerHTML = list.map(s => { const o = s.oid && orderById(s.oid);
    return `<button class="sc ${s.status === 'Đã bán' ? 'sold' : ''}" data-act="stock-edit" data-id="${s.id}">
      <div class="sc-img ${s.img ? '' : 'nopic'}" style="${s.img ? `background-image:url(${s.img})` : `background:${s.tone}`}">${s.img ? '' : NOPIC}</div>
      <b>${money(s.price)}</b><span>${esc(s.size || 'chưa có size')} · ${esc(s.source || '—')}</span><span>${s.cost ? 'Nhập ' + money(s.cost) : 'Chưa ghi giá nhập'}</span>
      ${s.status === 'Đã bán' ? `<em class="tag">Đã bán${o ? ' · ' + esc(customerOf(o).name) : ''}</em>` : s.note ? `<em class="dnote">${esc(s.note)}</em>` : ''}</button>`; }).join('')
    || '<div class="empty" style="grid-column:1/-1">Chưa có hàng nào</div>';
}
function sheetStockFilter(kind) {
  const f = state.sfilter, isS = kind === 'status';
  const opts = [['all', 'Tất cả'], ...(isS ? STOCK_STATUS : state.sources).map(s => [s, s])];
  const count = v => state.stock.filter(s => v === 'all' || (isS ? s.status === v : s.source === v)).length;
  const cur = isS ? f.status : f.source;
  openSheet(`<h3>${isS ? 'Trạng thái hàng' : 'Mua từ đâu'}</h3><div class="opt-grid">${opts.map(([v, l]) => `<button class="opt ${String(cur) === String(v) ? 'on' : ''}" data-act="set-s${kind}" data-val="${esc(v)}"><b>${esc(l)}</b><span>${count(v)} váy</span></button>`).join('')}</div>`);
}
// Bảng thêm/sửa 1 món hàng (ảnh gắn ngay khi chọn nếu đã có id; hàng mới thì gắn sau khi lưu)
function sheetStock() {
  const t = state.tmp;
  openSheet(`<h3>${t.id ? 'Sửa hàng' : 'Thêm hàng mới'}</h3>
    <div class="photo-row" style="margin-top:8px"><div class="tile xl ${t.img ? '' : 'nopic'}" style="${t.img ? `background-image:url(${t.img})` : '--tone:#F3E4E8'}">${t.img ? '' : NOPIC + 'Chưa có ảnh'}</div>
      <div class="col"><label class="lab" style="margin-top:0">Giá tiền</label>${moneyField('sp', t.sp)}</div></div>
    <div class="photo-btns"><label>Chụp ảnh<input type="file" accept="image/*" capture="environment" data-sphoto="1"></label><label>Chọn từ thư viện<input type="file" accept="image/*" data-sphoto="1"></label></div>
    <label class="lab">Size</label><div class="chips wrap">${SIZES.map(x => `<button class="chip ${t.size === x ? 'on' : ''}" data-act="ss-size" data-val="${x}">${x}</button>`).join('')}</div>
    <label class="lab">Mua từ (kho)</label><div class="chips wrap">${state.sources.map(x => `<button class="chip ${t.source === x ? 'on' : ''}" data-act="ss-source" data-val="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <label class="lab">Giá nhập</label>${moneyField('sc', t.sc)}
    <label class="lab">Ghi chú</label><textarea class="field" data-in="ss-note" placeholder="Màu, tình trạng, đã sửa gì…">${esc(t.note)}</textarea>
    ${t.id && t.status === 'Đã bán' ? `<p class="small-note">Đã bán${t.oid && orderById(t.oid) ? ' cho ' + esc(customerOf(orderById(t.oid)).name) : ''}. <button class="linkbtn" data-act="stock-unsell" style="min-height:auto">Đánh dấu còn sẵn</button></p>` : ''}
    <button class="btn" style="margin-top:16px" data-act="save-stock">Lưu</button>
    ${t.id ? `<button class="btn ghost" style="margin-top:8px" data-act="del-stock">Xoá khỏi hàng hóa</button>` : ''}`);
}
// Bảng chọn hàng sẵn để đưa vào đơn đang thêm
function sheetPickStock() {
  const avail = state.stock.filter(s => s.status === 'Sẵn');
  openSheet(`<h3>Chọn từ hàng có sẵn</h3><p class="sub" style="margin:0">${avail.length} váy đang sẵn trong shop</p>
    <div class="group" style="margin-top:12px">${avail.map(s => `<button class="row" data-act="pick-stock" data-id="${s.id}">${tile(s)}
      <div class="main"><b>${money(s.price)}</b><span>${esc(s.size || '—')} · ${esc(s.source || '—')}${s.note ? ' · ' + esc(s.note) : ''}</span></div></button>`).join('') || '<div class="empty">Chưa có hàng sẵn</div>'}</div>`);
}

/* =====================================================================
   6. CÀI ĐẶT
   ===================================================================== */
function viewSettings() {
  const c = Api.cfg(), t = state.tmp.cfg || (state.tmp.cfg = { url: c.url, key: c.key });
  return topbar({ title: 'Cài đặt' }) + `
    <section class="block"><h2>Kết nối Google Sheets</h2>
      <label class="lab" style="margin-top:0">URL Web App</label><input class="field" data-in="cfg-url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(t.url)}" autocomplete="off" spellcheck="false">
      <label class="lab">Mã bí mật</label><input class="field" type="password" data-in="cfg-key" placeholder="Lấy từ Execution log khi chạy setup()" value="${esc(t.key)}" autocomplete="off">
      <button class="btn" style="margin-top:14px" data-act="cfg-save">Lưu và kiểm tra kết nối</button>
      <p class="small-note">Cách lấy 2 thứ này: xem apps-script/README.md. Mã chỉ lưu trong máy này.</p></section>
    <section class="block"><h2>Đồng bộ</h2>
      <div class="group"><div class="kv" style="cursor:default"><span>Lần cuối</span><span class="val">${Sync.lastAt ? new Date(Sync.lastAt).toLocaleString('vi-VN') : 'Chưa'}</span></div>
      <div class="kv" style="cursor:default"><span>Thay đổi chờ gửi</span><span class="val ${Sync.pending ? 'owe' : 'ok'}">${Sync.pending}</span></div>
      ${Sync.error ? `<div class="kv" style="cursor:default"><span>Lỗi</span><span class="val owe">${esc(Sync.error)}</span></div>` : ''}</div>
      <button class="btn ghost" style="margin-top:10px" data-act="sync-now">Đồng bộ ngay</button>
      <button class="btn ghost" style="margin-top:8px" data-act="resync">Đồng bộ lại toàn bộ (tải lại hết từ Sheets)</button>
      <p class="small-note">"Đồng bộ lại toàn bộ" gửi hết thay đổi đang chờ trước, rồi xóa bản sao trong máy và tải lại. Dùng khi bạn sửa nhiều trên Sheets hoặc thấy số liệu lệch.</p></section>
    <section class="block"><h2>Kho (nguồn váy)</h2>
      <div class="group">${state.sourceRecs.map(r => `<div class="kv" style="cursor:default"><span style="color:var(--ink)">${esc(r.ten)}</span><button class="linkbtn danger" data-act="del-source" data-id="${r.id}">Xoá</button></div>`).join('') || '<div class="empty">Chưa có kho nào</div>'}</div>
      <div style="display:flex;gap:8px;margin-top:10px"><input class="field" id="new-source" placeholder="Tên kho mới" autocomplete="off"><button class="btn small" data-act="add-source">Thêm</button></div></section>
    <section class="block"><p class="small-note">Moon House · phiên bản 1.0 · ${state.orders.length} đơn, ${state.customers.length} khách, ${state.stock.length} hàng trong máy</p></section>`;
}

/* =====================================================================
   4. THÊM ĐƠN NHANH (một trang cuộn, nút Lưu dính đáy)
   ===================================================================== */
const newDress = prev => ({ price: 0, size: prev ? prev.size : '', source: prev ? prev.source : '', cost: 0, note: '', img: null, blob: null, stockId: null, stockImgId: '' });
function startDraft() {
  state.draft = { cid: null, name: '', channel: 'Fb', dresses: [newDress()], deposit: 0, due: '', note: '' };
  navDir = 'push'; state.stack.push({ v: 'new' }); render();
}
function viewNew() {
  const d = state.draft;
  return topbar({ title: 'Đơn mới' }).replace('<header class="top">', '<header class="top"><button class="back" data-act="cancel-new"><b>‹</b> Huỷ</button>') + `
    <section class="block" style="margin-top:8px"><h2>Khách</h2>
      <input class="field" id="cust-q" placeholder="Gõ tên khách…" value="${esc(d.name)}" autocomplete="off">
      <div id="cust-sugg" class="sugg"></div></section>
    <section class="block"><h2>Váy <small id="dress-count"></small></h2><div class="group" id="dress-forms"></div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost" data-act="add-dress">＋ Thêm váy nữa</button><button class="btn ghost" data-act="pick-stock-open">Chọn từ hàng sẵn</button></div></section>
    <section class="block"><h2>Cọc và hạn giao</h2>
      <label class="lab" style="margin-top:0">Cọc</label>${moneyField('dep', d.deposit)}
      <div class="chips wrap" style="margin-top:8px"><button class="chip" data-act="pay-full">Đã thanh toán đủ</button></div>
      <label class="lab">Hạn giao (không bắt buộc)</label><input class="field" type="date" data-in="draft-due" value="${d.due}">
      <label class="lab">Note đơn</label><textarea class="field" data-in="draft-note" placeholder="Ví dụ: Trước 5/8, khách báo qua Fb">${esc(d.note)}</textarea></section>
    <div class="savebar"><div class="sumline"><span id="sum-left"></span><span id="sum-right"></span></div>
      <button class="btn" id="save-order" data-act="save-order">Lưu đơn</button></div>`;
}
// Gợi ý khách theo chữ đang gõ + tạo khách mới
function renderCustomerSuggest() {
  const d = state.draft, q = d.name.trim();
  let html = '';
  if (d.cid) html = `<div class="group"><div class="row" style="cursor:default"><div class="main"><b>${esc(d.name)}</b><span>Khách cũ · ${esc(d.channel)}</span></div><span class="ok">✓ Đã chọn</span></div></div>`;
  else if (q) {
    const found = state.customers.filter(c => matchText(c.name, q)).slice(0, 4);
    html = `<div class="group">${found.map(c => `<button class="row" data-act="pick-customer" data-id="${c.id}"><div class="main"><b>${esc(c.name)}</b><span>${esc(c.channel)} · ${ordersOf(c).length} đơn</span></div></button>`).join('')}
      ${found.some(c => norm(c.name) === norm(q)) ? '' : `<div class="row" style="cursor:default;align-items:flex-start;flex-direction:column;gap:8px"><b style="font-weight:600">＋ Khách mới “${esc(q)}” — kênh liên hệ:</b>
        <div class="chips wrap">${CHANNELS.map(ch => `<button class="chip ${d.channel === ch ? 'on' : ''}" data-act="draft-channel" data-val="${ch}">${ch}</button>`).join('')}</div></div>`}</div>`;
  }
  $('#cust-sugg').innerHTML = html;
}
function renderDressForms() {
  const d = state.draft;
  $('#dress-forms').innerHTML = d.dresses.map((dr, i) => `
    <div class="dform">
      <div class="head"><b>Váy ${i + 1}${dr.stockId ? ' <span class="tag">Hàng sẵn</span>' : ''}</b>${d.dresses.length > 1 ? `<button class="linkbtn danger" data-act="del-dress" data-i="${i}">Xoá</button>` : ''}</div>
      <div class="photo-row">
        <div class="tile xl ${dr.img ? '' : 'nopic'}" style="${dr.img ? `background-image:url(${dr.img})` : '--tone:#F3E4E8'}">${dr.img ? '' : NOPIC + 'Chưa có ảnh'}</div>
        <div class="col"><label class="lab" style="margin-top:0">Giá tiền</label>${moneyField('dp' + i, dr.price)}</div>
      </div>
      <div class="photo-btns">
        <label>Chụp ảnh<input type="file" accept="image/*" capture="environment" data-photo="${i}"></label>
        <label>Chọn từ thư viện<input type="file" accept="image/*" data-photo="${i}"></label>
      </div>
      <label class="lab">Size</label>
      <div class="chips wrap">${SIZES.map(s => `<button class="chip ${dr.size === s ? 'on' : ''}" data-act="draft-size" data-i="${i}" data-val="${s}">${s}</button>`).join('')}</div>
      <label class="lab">Kho</label>
      <div class="chips wrap">${state.sources.map(s => `<button class="chip ${dr.source === s ? 'on' : ''}" data-act="draft-source" data-i="${i}" data-val="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <label class="lab">Ghi chú váy</label>
      <textarea class="field" data-in="draft-dnote" data-i="${i}" placeholder="Những gì trước đây bạn ghi lên ảnh: số đo, sửa gì, màu...">${esc(dr.note)}</textarea>
      <details class="cost"><summary>＋ Giá nhập (không bắt buộc)</summary>${moneyField('dc' + i, dr.cost)}</details>
    </div>`).join('');
  refreshDraftSummary();
}
function refreshDraftSummary() {
  const d = state.draft, total = d.dresses.reduce((s, x) => s + x.price, 0);
  const ready = (d.cid || d.name.trim()) && d.dresses.some(x => x.price > 0);
  $('#dress-count').textContent = d.dresses.length + ' váy';
  $('#sum-left').innerHTML = `Tổng <b>${money(total)}</b>`;
  $('#sum-right').innerHTML = `Còn lại <b>${money(Math.max(0, total - d.deposit))}</b>`;
  const btn = $('#save-order'); btn.disabled = !ready;
  btn.textContent = ready ? `Lưu đơn · ${d.dresses.length} váy` : 'Nhập tên khách và giá ít nhất 1 váy';
}
// Lưu đơn mới: khách (nếu mới) + đơn + từng váy + cọc + ảnh + hàng sẵn đã bán; rồi mở chi tiết đơn ngay
async function saveDraft() {
  const d = state.draft, btn = $('#save-order');
  btn.disabled = true; btn.textContent = 'Đang lưu…';
  let cid = d.cid;
  if (!cid) { cid = uid('kh'); await save('KhachHang', { id: cid, ten: d.name.trim(), kenh: d.channel, sdt: '', ghiChu: '' }); }
  const oid = uid('dh');
  await save('DonHang', { id: oid, khachId: cid, ngayDat: toIso(TODAY), hanGiao: d.due || '', note: d.note.trim(), sheetGoc: '' });
  const dresses = d.dresses.filter(x => x.price > 0);
  let thuTu = 0, total = 0;
  for (const x of dresses) {
    const id = uid('ct'); thuTu++; total += x.price;
    await save('ChiTietDon', { id, donHangId: oid, thuTu, giaTien: x.price, giaNhap: x.cost || '', size: x.size, kho: x.source, anhId: x.stockImgId || '',
      ghiChuVay: x.note.trim(), trangThai: x.stockId ? 'Đã về' : 'Đặt', hangHoaId: x.stockId || '', noteGoc: '' });
    if (x.blob) { await Store.imagePut(id, x.blob); state.imgUrls[id] = x.img; await Store.outboxAdd({ kind: 'image', tab: 'ChiTietDon', id }); }
    if (x.stockId) await upd('HangHoa', x.stockId, { trangThai: 'Đã bán', donHangId: oid });
  }
  if (d.deposit > 0) await save('ThanhToan', { id: uid('tt'), donHangId: oid, ngay: toIso(TODAY), soTien: d.deposit, loai: d.deposit >= total ? 'Thanh toán đủ' : 'Cọc' });
  state.draft = null; state.stack.pop(); state.stack.push({ v: 'order', id: oid });
  navDir = 'push';
  await commit(false, 'Đã lưu đơn' + (Api.ready() ? ' · đang gửi lên Sheets' : ''));
}

/* =====================================================================
   BẢNG TRƯỢT
   ===================================================================== */
function openSheet(html) { $('#sheet').innerHTML = `<div class="sheet-back" data-act="close-sheet"></div><div class="sheet-panel">${html}</div>`; $('#sheet').classList.add('open'); }
function closeSheet() { $('#sheet').classList.remove('open'); $('#sheet').innerHTML = ''; }
const sheetOpen = () => $('#sheet').classList.contains('open');
// Bảng sửa 1 váy trong đơn (ảnh chọn ở đây gắn ngay vào váy)
function sheetDress() {
  const t = state.tmp;
  openSheet(`<h3>Sửa váy ${t.i + 1}</h3>
    <div class="photo-btns" style="margin-top:8px"><label>Chụp ảnh mới<input type="file" accept="image/*" capture="environment" data-dphoto="1"></label><label>Chọn từ thư viện<input type="file" accept="image/*" data-dphoto="1"></label></div>
    <label class="lab">Giá tiền</label>${moneyField('ep', t.ep)}
    <label class="lab">Size</label><div class="chips wrap">${SIZES.map(s => `<button class="chip ${t.size === s ? 'on' : ''}" data-act="ed-size" data-val="${s}">${s}</button>`).join('')}</div>
    <label class="lab">Kho</label><div class="chips wrap">${state.sources.map(s => `<button class="chip ${t.source === s ? 'on' : ''}" data-act="ed-source" data-val="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <label class="lab">Giá nhập</label>${moneyField('ec', t.ec)}
    <label class="lab">Ghi chú váy</label><textarea class="field" data-in="ed-note" placeholder="Những gì trước đây bạn ghi lên ảnh">${esc(t.note)}</textarea>
    <button class="btn" style="margin-top:16px" data-act="save-dress">Lưu</button>
    <button class="btn ghost" style="margin-top:8px" data-act="del-dress-order">Xoá váy này khỏi đơn</button>`);
}

/* =====================================================================
   XEM ẢNH PHÓNG TO
   ===================================================================== */
function openViewer(oid, i) { state.tmp.view = { oid, i }; renderViewer(true); }
function closeViewer() { $('#viewer').classList.remove('open'); $('#viewer').innerHTML = ''; }
function renderViewer(first) {
  const { oid, i } = state.tmp.view, o = orderById(oid), d = o.dresses[i], c = customerOf(o), n = o.dresses.length;
  const big = state.imgUrls[d.id] || (d.anhId ? thumb(d.anhId, 1200) : null);
  const v = $('#viewer');
  v.innerHTML = `<div class="vw-top"><b>${esc(c.name)} · váy ${i + 1}/${n}</b><button class="vw-close" data-act="viewer-close" aria-label="Đóng">×</button></div>
    <div class="vw-stage">
      ${n > 1 ? `<button class="vw-arrow l" data-act="viewer-nav" data-val="-1" aria-label="Váy trước">‹</button><button class="vw-arrow r" data-act="viewer-nav" data-val="1" aria-label="Váy sau">›</button>` : ''}
      ${big ? `<img class="vw-photo" src="${big}" alt="">` : `<div class="vw-img nopic" style="background:${d.tone}">Chưa có ảnh</div>`}
    </div>
    <div class="vw-cap"><b>${money(d.price)}</b><span>${esc(d.size || 'chưa có size')} · ${esc(d.source || 'chưa có kho')} · ${STATUS[d.status]}</span>${d.note ? `<span class="dnote">${esc(d.note)}</span>` : ''}
      <div class="vw-dots">${o.dresses.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div></div>`;
  v.classList.add('open'); vz.s = 1; vz.x = 0; vz.y = 0;
  if (REDUCE) return;
  v.querySelector('.vw-photo,.vw-img').animate([{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'none' }], { duration: first ? 380 : 220, easing: 'cubic-bezier(.2,.9,.3,1.15)' });
}
function viewerNav(step) { const t = state.tmp.view, n = orderById(t.oid).dresses.length; t.i = (t.i + step + n) % n; renderViewer(); }
// Chạm trên ảnh: 2 ngón phóng to, 1 ngón kéo khi đã phóng, vuốt ngang qua váy khác, chạm 2 lần phóng 2.5x, chạm nhẹ đóng
const vz = { s: 1, x: 0, y: 0, pts: new Map(), start: null, pinch: null, lastTap: 0, tapTimer: 0, moved: false };
function vzApply() { const el = document.querySelector('#viewer .vw-photo,#viewer .vw-img'); if (el) el.style.transform = vz.s === 1 ? '' : `translate(${vz.x}px,${vz.y}px) scale(${vz.s})`; }
function vzReset() { vz.s = 1; vz.x = 0; vz.y = 0; vzApply(); }
document.addEventListener('pointerdown', e => {
  const st = e.target.closest('.vw-stage'); if (!st || e.target.closest('.vw-arrow')) return;
  if (st.setPointerCapture) try { st.setPointerCapture(e.pointerId); } catch (_) {}
  vz.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); vz.moved = false;
  if (vz.pts.size === 1) vz.start = { x: e.clientX, y: e.clientY, tx: vz.x, ty: vz.y, t: performance.now() };
  if (vz.pts.size === 2) { const [a, b] = [...vz.pts.values()]; vz.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: vz.s, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, tx: vz.x, ty: vz.y }; clearTimeout(vz.tapTimer); }
});
document.addEventListener('pointermove', e => {
  if (!vz.pts.has(e.pointerId)) return;
  vz.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (vz.pts.size === 2 && vz.pinch) {
    const [a, b] = [...vz.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    vz.s = Math.min(4, Math.max(1, vz.pinch.s * d / vz.pinch.d));
    vz.x = vz.pinch.tx + (a.x + b.x) / 2 - vz.pinch.cx; vz.y = vz.pinch.ty + (a.y + b.y) / 2 - vz.pinch.cy;
    vz.moved = true; vzApply();
  } else if (vz.pts.size === 1 && vz.start) {
    const dx = e.clientX - vz.start.x, dy = e.clientY - vz.start.y;
    if (Math.hypot(dx, dy) > 8) vz.moved = true;
    if (vz.s > 1) { vz.x = vz.start.tx + dx; vz.y = vz.start.ty + dy; vzApply(); }
  }
});
['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, e => {
  if (!vz.pts.has(e.pointerId)) return;
  vz.pts.delete(e.pointerId);
  if (vz.pts.size) { vz.pinch = null; vz.start = null; return; }
  if (vz.s <= 1.02) { vz.s = 1; vz.x = 0; vz.y = 0; vzApply(); }
  const st = vz.start; vz.start = null; vz.pinch = null;
  if (!st || ev === 'pointercancel') return;
  const dx = e.clientX - st.x, dt = performance.now() - st.t;
  if (vz.s === 1 && Math.abs(dx) > 50) { viewerNav(dx < 0 ? 1 : -1); return; }
  if (vz.moved || dt > 300) return;
  const now = performance.now();
  if (now - vz.lastTap < 320) {
    clearTimeout(vz.tapTimer); vz.lastTap = 0;
    if (vz.s > 1) vzReset();
    else { const r = e.target.closest('.vw-stage').getBoundingClientRect(); vz.s = 2.5; vz.x = (r.left + r.width / 2 - e.clientX) * 1.5; vz.y = (r.top + r.height / 2 - e.clientY) * 1.5; vzApply(); }
  } else { vz.lastTap = now; if (vz.s === 1) vz.tapTimer = setTimeout(closeViewer, 320); }
}));

/* =====================================================================
   MENU GIỮA + ĐIỀU HƯỚNG + VẼ
   ===================================================================== */
const MENU = [['today', 'Hôm nay'], ['calendar', 'Lịch'], ['orders', 'Đơn hàng'], ['stock', 'Hàng hóa'], ['customers', 'Khách hàng'], ['settings', 'Cài đặt']];
function menuSub(k) {
  const in7 = allEvents().filter(e => { const n = daysTo(e.date); return n >= 0 && n <= 6; }).length;
  return { today: WEEKDAYS[TODAY.getDay()] + ', ' + dm(TODAY), calendar: in7 + ' việc trong 7 ngày', orders: state.orders.length + ' đơn · ' + state.orders.filter(o => orderOwed(o) > 0).length + ' chưa thu đủ',
    stock: state.stock.filter(s => s.status === 'Sẵn').length + ' váy sẵn trong shop', customers: state.customers.length + ' khách', settings: syncText() }[k];
}
function renderMenu() {
  const cur = state.stack[0].v;
  if (!$('#menu').children.length) $('#menu').innerHTML = `<div class="menu-back" data-act="menu-close"></div><div class="menu-grid">
    ${MENU.map(([k, l]) => `<button class="mi" data-act="tab" data-val="${k}"><i class="ic">${icon(k)}</i><b>${l}</b><span data-sub="${k}"></span></button>`).join('')}
    <button class="mi primary" data-act="new-order"><i class="ic">${icon('plus')}</i><b>Thêm đơn mới</b><span>Khách → váy → cọc</span></button></div>`;
  $$('#menu .mi[data-val]').forEach(b => { b.classList.toggle('on', b.dataset.val === cur); b.querySelector('[data-sub]').textContent = menuSub(b.dataset.val); });
}
function openMenu() {
  renderMenu(); $('#menu').classList.add('open'); $('#fab').classList.add('open'); $('#fab').classList.remove('tuck');
  if (REDUCE) return;
  const f = $('#fab').getBoundingClientRect(), fx = f.left + f.width / 2, fy = f.top + f.height / 2;
  $$('#menu .mi').forEach((el, i) => {
    const r = el.getBoundingClientRect();
    el.animate([{ opacity: 0, transform: `translate(${fx - (r.left + r.width / 2)}px,${fy - (r.top + r.height / 2)}px) scale(.2)` }, { opacity: 1, transform: 'none' }],
      { duration: 520, delay: i * 45, easing: 'cubic-bezier(.2,.9,.3,1.15)', fill: 'backwards' });
  });
}
function closeMenu() { $('#menu').classList.remove('open'); $('#fab').classList.remove('open'); }
const menuOpen = () => $('#menu').classList.contains('open');
// Cuộn xuống thì nút giữa nép góc phải, cuộn lên thì về giữa
let lastScrollY = 0;
$('#app').addEventListener('scroll', () => {
  const y = $('#app').scrollTop, dy = y - lastScrollY;
  if (Math.abs(dy) < 6) return;
  if (!menuOpen()) $('#fab').classList.toggle('tuck', dy > 0 && y > 80);
  lastScrollY = y;
}, { passive: true });

let navDir = 'tab';
// Vẽ màn hình hiện tại; giữ vị trí cuộn khi chỉ đổi dữ liệu tại chỗ
function render(keepScroll) {
  const y = $('#app').scrollTop, v = topView();
  const map = { today: viewToday, orders: viewOrders, order: viewOrder, customers: viewCustomers, customer: viewCustomer, settings: viewSettings, new: viewNew, calendar: viewCalendar, stock: viewStock };
  $('#view').innerHTML = map[v.v](v);
  $('#fab').style.display = v.v === 'new' ? 'none' : 'grid';
  if (topView().v === 'orders') renderOrderList();
  if (topView().v === 'customers') renderCustomerList();
  if (topView().v === 'stock') renderStockGrid();
  if (topView().v === 'new') { renderCustomerSuggest(); renderDressForms(); }
  $('#app').scrollTop = keepScroll ? y : 0;
  if (!keepScroll) enterScreen(topView().v);
  navDir = 'tab';
}
const push = v => { navDir = 'push'; state.stack.push(v); render(); };

/* ---------- Hiệu ứng (tự chạy tắt nếu máy bật "giảm chuyển động") ---------- */
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
function enterScreen(viewName) {
  if (REDUCE) return;
  const dir = navDir === 'back' ? -1 : 1, tilt = navDir === 'tab' ? 0 : 9 * dir, shift = navDir === 'tab' ? 0 : 34 * dir;
  [...$('#view').children].filter(el => !el.classList.contains('savebar')).forEach((el, i) => {
    el.animate([{ opacity: 0, transform: `perspective(900px) translate3d(${shift}px,14px,-40px) rotateY(${-tilt}deg)` }, { opacity: 1, transform: 'none' }],
      { duration: 460, delay: Math.min(i, 8) * 45, easing: 'cubic-bezier(.2,.9,.3,1.05)', fill: 'backwards' });
  });
  if (viewName === 'today') countUp($('#owed-num'));
}
function countUp(el) {
  if (!el || REDUCE) return;
  const end = +el.dataset.val, t0 = performance.now();
  const step = t => { const p = Math.min(1, (t - t0) / 800), e = 1 - Math.pow(1 - p, 3); el.textContent = money(end * e); if (p < 1) requestAnimationFrame(step); else el.textContent = money(end); };
  requestAnimationFrame(step);
}
function popMoon(i) { if (REDUCE) return; const m = document.querySelector(`.moonbtn[data-i="${i}"] .moon`); if (m) m.classList.add('pop'); }
// Gợn sóng khi chạm
document.addEventListener('pointerdown', e => {
  const host = e.target.closest('.btn,.chip,.row,.due,.kv,.moonbtn,.linkbtn,.mi,.fbtn,.opt,.wd,.cd,.sc,.names button');
  if (!host) return;
  const r = host.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2, w = document.createElement('span');
  w.className = 'ripple'; w.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  host.appendChild(w); setTimeout(() => w.remove(), 650);
});
// Thẻ "tilt" nghiêng theo ngón tay
document.addEventListener('pointermove', e => {
  const el = e.target.closest('.tilt'); if (!el) return;
  const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
  el.style.transform = `perspective(700px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg)`;
});
['pointerup', 'pointercancel', 'pointerout'].forEach(ev => document.addEventListener(ev, e => {
  const el = e.target.closest && e.target.closest('.tilt');
  if (el && !(e.relatedTarget && el.contains(e.relatedTarget))) el.style.transform = '';
}));

/* =====================================================================
   SỰ KIỆN BẤM (gom một chỗ)
   ===================================================================== */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, val = el.dataset.val, id = el.dataset.id, i = +el.dataset.i;
  const cur = topView(), d = state.draft;
  const order = () => orderById(id || cur.id);
  try {
    switch (a) {
      /* Điều hướng */
      case 'menu-toggle': menuOpen() ? closeMenu() : openMenu(); break;
      case 'menu-close': closeMenu(); break;
      case 'tab': closeMenu(); state.stack = [{ v: val }]; render(); break;
      case 'back': navDir = 'back'; state.stack.pop(); render(); break;
      case 'open-order': push({ v: 'order', id }); break;
      case 'open-customer': push({ v: 'customer', id }); break;
      case 'new-order': closeMenu(); startDraft(); break;
      case 'cancel-new': if (d.dresses.some(x => x.price || x.img) && !confirm('Bỏ đơn đang nhập?')) break; navDir = 'back'; state.draft = null; state.stack.pop(); render(); break;
      case 'close-sheet': closeSheet(); break;
      case 'sync-now': if (!Api.ready()) { state.stack = [{ v: 'settings' }]; render(); break; } toast('Đang đồng bộ…'); if (await Sync.run()) { await loadModel(); render(true); toast('Đã đồng bộ'); } else toast(Sync.error || 'Không đồng bộ được'); break;

      /* Lọc, tìm, sắp xếp */
      case 'pick-status': sheetFilter('status'); break;
      case 'pick-source': sheetFilter('source'); break;
      case 'set-status': state.filter.status = val; closeSheet(); render(true); break;
      case 'set-source': state.filter.source = val; closeSheet(); render(true); break;
      case 'sort': state.filter.sort = state.filter.sort === 'new' ? 'old' : 'new'; render(true); break;
      case 'sugg-name': { const inp = $('#order-q') || $('#cust-search'); inp.value = val;
        if (inp.id === 'order-q') { state.filter.q = val; renderOrderList(); } else { state.filter.cq = val; renderCustomerList(); } break; }

      /* Lịch */
      case 'pick-day': state.daySel = fromIso(el.dataset.iso); render(true); break;
      case 'open-calendar': state.cal.sel = state.daySel; state.cal.month = new Date(state.daySel.getFullYear(), state.daySel.getMonth(), 1); push({ v: 'calendar' }); break;
      case 'cal-pick': state.cal.sel = fromIso(el.dataset.iso); render(true); break;
      case 'cal-prev': state.cal.month = new Date(state.cal.month.getFullYear(), state.cal.month.getMonth() - 1, 1); render(true); break;
      case 'cal-next': state.cal.month = new Date(state.cal.month.getFullYear(), state.cal.month.getMonth() + 1, 1); render(true); break;
      case 'cal-today': state.cal.sel = TODAY; state.cal.month = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); render(true); break;
      case 'add-appt': { if (!state.orders.length) { toast('Chưa có đơn nào để gắn lịch hẹn'); break; }
        const latest = state.orders.slice().sort((a, b) => b.date - a.date)[0];
        state.tmp = { oid: id || latest.id, lock: !!id, kind: 'Thử váy', date: el.dataset.iso || toIso(TODAY), note: '' }; sheetAppt(); break; }
      case 'ap-kind': state.tmp.kind = val; sheetAppt(); break;
      case 'save-appt': { const t = state.tmp; if (!t.date) { toast('Chọn ngày'); break; }
        await save('LichHen', { id: uid('lh'), donHangId: t.oid, ngay: t.date, loai: t.kind, ghiChu: t.note.trim() });
        closeSheet(); await commit(true, 'Đã thêm lịch hẹn'); break; }
      case 'del-appt': if (confirm('Xoá lịch hẹn này?')) { await remove('LichHen', el.dataset.aid); await commit(true, 'Đã xoá lịch hẹn'); } break;

      /* Chi tiết đơn */
      case 'cycle': { const dr = order().dresses[i]; await upd('ChiTietDon', dr.id, { trangThai: STATUS[(dr.status + 1) % 3] }); await commit(true); popMoon(i); break; }
      case 'view-img': openViewer(order().id, i); break;
      case 'viewer-close': closeViewer(); break;
      case 'viewer-nav': viewerNav(+val); break;
      case 'edit-dress': { const dr = order().dresses[i];
        state.tmp = { oid: order().id, did: dr.id, i, ep: dr.price, ec: dr.cost || 0, size: dr.size, source: dr.source, note: dr.note }; sheetDress(); break; }
      case 'ed-size': state.tmp.size = val; sheetDress(); break;
      case 'ed-source': state.tmp.source = val; sheetDress(); break;
      case 'save-dress': { const t = state.tmp;
        await upd('ChiTietDon', t.did, { giaTien: t.ep, giaNhap: t.ec || '', size: t.size, kho: t.source, ghiChuVay: (t.note || '').trim() });
        closeSheet(); await commit(true, 'Đã lưu váy'); break; }
      case 'del-dress-order': if (confirm('Xoá váy này khỏi đơn?')) { await remove('ChiTietDon', state.tmp.did); await Store.imageDel(state.tmp.did); closeSheet(); await commit(true, 'Đã xoá váy'); } break;
      case 'add-dress-to-order': { const o = order(), last = o.dresses[o.dresses.length - 1];
        await save('ChiTietDon', { id: uid('ct'), donHangId: o.id, thuTu: o.dresses.length + 1, giaTien: 0, giaNhap: '', size: last ? last.size : '', kho: last ? last.source : '', anhId: '', ghiChuVay: '', trangThai: 'Đặt', hangHoaId: '', noteGoc: '' });
        await commit(true, 'Đã thêm váy — chạm vào để nhập giá'); break; }
      case 'add-pay': { const o = order(); state.tmp = { oid: o.id, pay: 0 };
        openSheet(`<h3>Thêm thanh toán</h3><p class="sub" style="margin-bottom:0">Còn lại ${money(orderOwed(o))}</p>
          <label class="lab">Số tiền</label>${moneyField('pay', 0)}
          <div class="chips wrap" style="margin-top:8px"><button class="chip" data-act="pay-rest">Thu đủ phần còn lại</button></div>
          <label class="lab">Ngày</label><input class="field" type="date" data-in="pay-date" value="${toIso(TODAY)}">
          <button class="btn" style="margin-top:16px" data-act="save-pay">Lưu</button>`); break; }
      case 'pay-rest': { const v = orderOwed(orderById(state.tmp.oid)); state.tmp.pay = v; document.querySelector('[data-k="pay"]').value = Math.round(v / 1000); setMoney('pay', v); break; }
      case 'save-pay': { const o = orderById(state.tmp.oid), amt = state.tmp.pay || 0;
        if (!amt) { toast('Nhập số tiền'); break; }
        await save('ThanhToan', { id: uid('tt'), donHangId: o.id, ngay: state.tmp.payDate || toIso(TODAY), soTien: amt, loai: amt >= orderOwed(o) ? 'Thanh toán đủ' : (o.pays.length ? 'Thanh toán' : 'Cọc') });
        closeSheet(); await commit(true, 'Đã thêm thanh toán'); break; }
      case 'del-pay': if (confirm('Xoá khoản thanh toán này?')) { await remove('ThanhToan', el.dataset.pid); await commit(true, 'Đã xoá'); } break;
      case 'edit-due': { const o = order(); state.tmp = { oid: o.id };
        openSheet(`<h3>Hạn giao</h3><label class="lab">Chọn ngày</label><input class="field" type="date" id="due-input" value="${o.due ? toIso(o.due) : ''}">
          <button class="btn" style="margin-top:16px" data-act="save-due">Lưu</button>
          <button class="btn ghost" style="margin-top:8px" data-act="clear-due">Bỏ hạn giao</button>`); break; }
      case 'save-due': await upd('DonHang', state.tmp.oid, { hanGiao: $('#due-input').value || '' }); closeSheet(); await commit(true); break;
      case 'clear-due': await upd('DonHang', state.tmp.oid, { hanGiao: '' }); closeSheet(); await commit(true); break;
      case 'del-order': { const o = order(); if (!confirm(`Xoá đơn của ${customerOf(o).name} (${o.dresses.length} váy)? Dữ liệu vẫn còn trên Sheets với dấu đã xoá.`)) break;
        for (const x of o.dresses) { await remove('ChiTietDon', x.id); if (x.stockId) await upd('HangHoa', x.stockId, { trangThai: 'Sẵn', donHangId: '' }); }
        for (const p of o.pays) await remove('ThanhToan', p.id);
        for (const ap of o.appts) await remove('LichHen', ap.id);
        await remove('DonHang', o.id);
        navDir = 'back'; state.stack.pop(); await commit(false, 'Đã xoá đơn'); break; }

      /* Khách */
      case 'edit-customer': { const c = state.customers.find(x => x.id === id); state.tmp = { cid: c.id, name: c.name, channel: c.channel, phone: c.phone, note: c.note }; sheetCustomer(); break; }
      case 'cu-channel': state.tmp.channel = val; sheetCustomer(); break;
      case 'save-customer': { const t = state.tmp; if (!t.name.trim()) { toast('Nhập tên'); break; }
        await upd('KhachHang', t.cid, { ten: t.name.trim(), kenh: t.channel, sdt: t.phone.trim(), ghiChu: t.note.trim() }); closeSheet(); await commit(true, 'Đã lưu khách'); break; }

      /* Hàng hóa */
      case 'stock-filter': sheetStockFilter(val); break;
      case 'set-sstatus': state.sfilter.status = val; closeSheet(); render(true); break;
      case 'set-ssource': state.sfilter.source = val; closeSheet(); render(true); break;
      case 'stock-edit': { const st = id && state.stock.find(x => x.id === id);
        state.tmp = st ? { id: st.id, sp: st.price, sc: st.cost || 0, size: st.size, source: st.source, note: st.note, img: st.img, status: st.status, oid: st.oid, file: null }
                       : { id: null, sp: 0, sc: 0, size: '', source: '', note: '', img: null, status: 'Sẵn', file: null };
        sheetStock(); break; }
      case 'ss-size': state.tmp.size = val; sheetStock(); break;
      case 'ss-source': state.tmp.source = val; sheetStock(); break;
      case 'stock-unsell': await upd('HangHoa', state.tmp.id, { trangThai: 'Sẵn', donHangId: '' }); closeSheet(); await commit(true, 'Đã đánh dấu còn sẵn'); break;
      case 'save-stock': { const t = state.tmp; if (!t.sp) { toast('Nhập giá tiền'); break; }
        const sid = t.id || uid('hh');
        if (t.id) await upd('HangHoa', sid, { giaTien: t.sp, giaNhap: t.sc || '', size: t.size, kho: t.source, ghiChu: t.note.trim() });
        else await save('HangHoa', { id: sid, giaTien: t.sp, giaNhap: t.sc || '', size: t.size, kho: t.source, anhId: '', ghiChu: t.note.trim(), trangThai: 'Sẵn', donHangId: '' });
        if (t.file) await attachImage('HangHoa', sid, t.file);
        closeSheet(); await commit(true, t.id ? 'Đã lưu hàng' : 'Đã thêm hàng mới'); break; }
      case 'del-stock': if (confirm('Xoá món hàng này?')) { await remove('HangHoa', state.tmp.id); await Store.imageDel(state.tmp.id); closeSheet(); await commit(true, 'Đã xoá'); } break;
      case 'pick-stock-open': sheetPickStock(); break;
      case 'pick-stock': { const st = state.stock.find(x => x.id === id), last = d.dresses[d.dresses.length - 1];
        const dr = { price: st.price, size: st.size, source: st.source, cost: st.cost || 0, note: st.note, img: st.img, blob: null, stockId: st.id, stockImgId: st.anhId };
        if (last && !last.price && !last.img) d.dresses[d.dresses.length - 1] = dr; else d.dresses.push(dr);
        closeSheet(); renderDressForms(); toast('Đã đưa hàng sẵn vào đơn'); break; }

      /* Thêm đơn */
      case 'pick-customer': { const c = state.customers.find(x => x.id === id); d.cid = c.id; d.name = c.name; d.channel = c.channel; $('#cust-q').value = c.name; renderCustomerSuggest(); refreshDraftSummary(); break; }
      case 'draft-channel': d.channel = val; renderCustomerSuggest(); break;
      case 'draft-size': d.dresses[i].size = val; renderDressForms(); break;
      case 'draft-source': d.dresses[i].source = val; renderDressForms(); break;
      case 'add-dress': d.dresses.push(newDress(d.dresses[d.dresses.length - 1])); renderDressForms();
        setTimeout(() => { const f = $$('.dform'); f[f.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 0); break;
      case 'del-dress': d.dresses.splice(i, 1); renderDressForms(); break;
      case 'pay-full': { const total = d.dresses.reduce((s, x) => s + x.price, 0); d.deposit = total; document.querySelector('[data-k="dep"]').value = Math.round(total / 1000); setMoney('dep', total); break; }
      case 'save-order': await saveDraft(); break;

      /* Cài đặt */
      case 'cfg-save': { const t = state.tmp.cfg; if (!t.url || !t.key) { toast('Nhập cả URL và mã bí mật'); break; }
        Api.save(t.url, t.key); toast('Đang kiểm tra…');
        try { const r = await Api.get('ping'); toast('Kết nối OK: ' + r.sheet); Sync.error = ''; await Sync.run(!(await Store.metaGet('lastSync'))); await loadModel(); render(true); }
        catch (err) { toast('Không kết nối được: ' + err.message); render(true); } break; }
      case 'resync': { if (!Api.ready()) { toast('Chưa có URL và mã'); break; }
        if (!confirm('Tải lại toàn bộ từ Sheets? Thay đổi đang chờ sẽ được gửi trước.')) break;
        toast('Đang gửi thay đổi chờ…');
        try { await Sync.push(); } catch (err) { toast('Không gửi được: ' + err.message); break; }
        await Store.clearData(); state.orders = []; state.customers = []; state.stock = [];
        toast('Đang tải lại…'); if (await Sync.run(true)) { await loadModel(); render(true); toast('Đã tải lại từ Sheets'); } else toast('Lỗi: ' + Sync.error); break; }
      case 'add-source': { const v = $('#new-source').value.trim(); if (!v) break; if (state.sources.some(s => norm(s) === norm(v))) { toast('Đã có kho này'); break; }
        await save('Nguon', { id: uid('ng'), ten: v, thuTu: state.sourceRecs.length + 1 }); await commit(true, 'Đã thêm kho'); break; }
      case 'del-source': if (confirm('Xoá kho này khỏi danh sách? Váy đã ghi kho này vẫn giữ tên.')) { await remove('Nguon', id); await commit(true); } break;
    }
  } catch (err) {
    console.error(err); toast('Lỗi: ' + (err.message || err));
  }
});

// Gõ vào các ô: tiền theo nghìn, tìm kiếm, ghi chú, cài đặt
document.addEventListener('input', e => {
  const t = e.target, inn = t.dataset.in;
  if (t.dataset.k) { const digits = t.value.replace(/\D/g, '').slice(0, 7); t.value = digits; setMoney(t.dataset.k, (+digits || 0) * 1000); }
  else if (t.id === 'order-q') { state.filter.q = t.value; renderOrderList(); }
  else if (t.id === 'cust-search') { state.filter.cq = t.value; renderCustomerList(); }
  else if (t.id === 'stock-q') { state.sfilter.q = t.value; renderStockGrid(); }
  else if (t.id === 'cust-q') { const d = state.draft; d.name = t.value; d.cid = null; renderCustomerSuggest(); refreshDraftSummary(); }
  else if (inn === 'order-note') { const id = t.dataset.id, v = t.value; debounced('note' + id, async () => { await upd('DonHang', id, { note: v.trim() }); const o = orderById(id); if (o) o.note = v; Sync.schedule(); }); }
  else if (inn === 'draft-note') state.draft.note = t.value;
  else if (inn === 'draft-dnote') state.draft.dresses[+t.dataset.i].note = t.value;
  else if (inn === 'draft-due') state.draft.due = t.value;
  else if (inn === 'ed-note') state.tmp.note = t.value;
  else if (inn === 'ss-note') state.tmp.note = t.value;
  else if (inn === 'ap-date') state.tmp.date = t.value;
  else if (inn === 'ap-note') state.tmp.note = t.value;
  else if (inn === 'ap-oid') state.tmp.oid = t.value;
  else if (inn === 'pay-date') state.tmp.payDate = t.value;
  else if (inn === 'cu-name') state.tmp.name = t.value;
  else if (inn === 'cu-phone') state.tmp.phone = t.value;
  else if (inn === 'cu-note') state.tmp.note = t.value;
  else if (inn === 'cfg-url') state.tmp.cfg.url = t.value;
  else if (inn === 'cfg-key') state.tmp.cfg.key = t.value;
});

// Chọn/chụp ảnh: nén ngay, hiện ngay; gửi Drive ngầm khi có id
document.addEventListener('change', async e => {
  const t = e.target, file = t.files && t.files[0];
  if (!file) return;
  try {
    if (t.dataset.photo !== undefined) {                   // váy trong đơn đang nhập: giữ blob, gắn khi lưu đơn
      const dr = state.draft.dresses[+t.dataset.photo];
      dr.blob = await compressImage(file); dr.img = URL.createObjectURL(dr.blob); dr.stockImgId = '';
      renderDressForms();
    } else if (t.dataset.dphoto) {                         // váy đã có trong đơn: gắn ngay
      await attachImage('ChiTietDon', state.tmp.did, file); closeSheet(); await commit(true, 'Đã đổi ảnh');
    } else if (t.dataset.sphoto) {                         // hàng hóa: có id thì gắn ngay, hàng mới thì gắn khi lưu
      if (state.tmp.id) { await attachImage('HangHoa', state.tmp.id, file); await loadModel(); state.tmp.img = state.imgUrls[state.tmp.id]; sheetStock(); Sync.schedule(); }
      else { state.tmp.file = file; state.tmp.img = URL.createObjectURL(file); sheetStock(); }
    }
  } catch (err) { toast('Lỗi ảnh: ' + err.message); }
});

/* =====================================================================
   KHỞI ĐỘNG: vẽ từ máy ngay, đồng bộ ngầm sau
   ===================================================================== */
(async function boot() {
  await Store.open();
  Sync.lastAt = (await Store.metaGet('lastSync')) || '';
  await loadModel();
  await Sync.emit();
  if (!Api.ready() && !state.orders.length) state.stack = [{ v: 'settings' }];   // lần đầu mở: đưa thẳng tới Cài đặt
  render();
  // Trạng thái đồng bộ đổi → cập nhật viên; có dữ liệu mới về → vẽ lại nếu không đang nhập
  Sync.onChange(async s => {
    refreshSyncPill();
    if (s.changed && !s.busy && topView().v !== 'new' && !sheetOpen()) { await loadModel(); render(true); }
  });
  Sync.start();
  if (Api.ready()) Sync.run(!Sync.lastAt);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
