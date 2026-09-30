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
// Khoá so trùng tên khách: chữ thường, mỗi chữ = chữ cái gốc + các dấu (xếp lại) → "thuỳ" = "thùy", "hương" ≠ "hường"
const nameKey = s => String(s || '').toLowerCase().normalize('NFD').trim().split(/\s+/).filter(Boolean)
  .map(w => [...w].filter(ch => !/[\u0300-\u036f]/.test(ch)).join('') + '|' + [...w].filter(ch => /[\u0300-\u036f]/.test(ch)).sort().join('')).join(' ');
const matchText = (text, q) => { const t = norm(text); return norm(q).split(/\s+/).filter(Boolean).every(w => t.includes(w)); };
// Mã duy nhất cho bản ghi mới, có tiền tố để nhìn vào Sheets biết là gì
// Mã bắt đầu bằng thời điểm tạo → sắp theo mã là đúng thứ tự tạo (dùng để đánh số lần đặt cùng ngày)
const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
// Ngày hiện ra, đơn cũ không có ngày thì ghi rõ chứ không lấy tạm hôm nay
const dateLabel = d => d ? dm(d) : 'Chưa có ngày';
// So 2 ngày, ngày trống luôn nằm cuối; dir = 1 tăng dần, -1 giảm dần
const cmpDate = (a, b, dir) => (!a && !b) ? 0 : !a ? 1 : !b ? -1 : dir * (a - b);
// URL ảnh thumbnail của Drive
const thumb = (id, w) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w || 400}`;
const hhmm = iso => { const d = new Date(iso); return isNaN(d) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

/* ---------- Hằng ---------- */
const APP_VERSION = '1.5';           // tăng cùng CACHE trong sw.js mỗi lần sửa app
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Số đo'];
const STATUS = ['Đặt', 'Đã về', 'Đã giao'];
const ORDER_STATUS = ['Đang đặt', 'Đã về đủ', 'Đã giao'];
const CHANNELS = ['Fb', 'Zalo', 'Khác'];
const APPT_KINDS = ['Thử váy', 'Báo khách', 'Ngày cưới', 'Khác'];
const PAY_KINDS = ['Cọc', 'Thanh toán', 'Thanh toán đủ'];
const CUSTOMER_TYPES = ['Sỉ', 'Lẻ'];
const STOCK_STATUS = ['Sẵn', 'Đã bán'];
const TONES = ['#EBD9DE', '#E6D6E0', '#F1DDD3', '#DDE3DA', '#EDE4D8', '#E3D8E8', '#F3D9DF', '#D9E1E4'];
const CHEV = '<svg class="chev" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4l6 6-6 6"/></svg>';   // mũi tên của danh sách xổ xuống
const NOPIC = '<svg viewBox="0 0 24 24"><path d="M8.6 2.6c.9 2 2 3 3.4 3s2.5-1 3.4-3l1.3 5.6c-1.5.9-3.1 1.3-4.7 1.3s-3.2-.4-4.7-1.3z"/><path d="M7.3 8.9C5.6 12.4 4.4 16.1 3.9 19.9c2.6.9 5.3 1.4 8.1 1.4s5.5-.5 8.1-1.4c-.5-3.8-1.7-7.5-3.4-11-1.5.9-3.1 1.3-4.7 1.3s-3.2-.4-4.7-1.3z"/></svg>';

/* ---------- Trạng thái giao diện + mô hình trong bộ nhớ ---------- */
const state = {
  sources: [], sourceRecs: [], customers: [], orders: [], stock: [],
  groups: [],        // đơn = nhóm các lần đặt (dòng DonHang) cùng donChungId
  stack: [{ v: 'today' }],
  filter: { q: '', cq: '', status: 'all', source: 'all', sort: 'new' },
  sfilter: { q: '', status: 'all', source: 'all' },
  daySel: TODAY,
  cal: { month: new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), sel: TODAY },
  draft: null,       // đơn đang nhập ở luồng Thêm đơn
  tmp: {},           // dữ liệu tạm cho các bảng trượt
  imgUrls: {},       // id dòng → URL tạm của ảnh đang chờ gửi
  serverVersion: ''  // phiên bản Code.gs bên Google, hỏi khi mở Cài đặt
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
    note: r.ghiChuVay || '', status: st < 0 ? 0 : st, date: fromIso(r.ngayThem), anhId: r.anhId || '', img: imgFor(r.id, r.anhId), tone: toneFor(r.id), stockId: r.hangHoaId || '', noteGoc: r.noteGoc || '' };
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
  state.customers = tabs.KhachHang.map(r => ({ id: r.id, name: r.ten || '(chưa có tên)', channel: r.kenh || 'Khác', phone: r.sdt || '', note: r.ghiChu || '',
    type: r.loaiKhach || '', address: r.diaChi || '', link: r.lienKet || '', ship: r.guiQua || '' }));
  const dr = groupBy(tabs.ChiTietDon, 'donHangId'), py = groupBy(tabs.ThanhToan, 'donHangId'), ap = groupBy(tabs.LichHen, 'donHangId');
  state.orders = tabs.DonHang.map(r => ({
    id: r.id, gid: r.donChungId || r.id, cid: r.khachId, date: fromIso(r.ngayDat), due: fromIso(r.hanGiao), note: r.note || '', sheetGoc: r.sheetGoc || '',
    dresses: (dr[r.id] || []).sort((a, b) => (+a.thuTu || 0) - (+b.thuTu || 0)).map(dressFromRec),
    pays: (py[r.id] || []).map(p => ({ id: p.id, date: fromIso(p.ngay) || TODAY, amount: +p.soTien || 0, kind: p.loai || 'Thanh toán' })).sort((a, b) => a.date - b.date),
    appts: (ap[r.id] || []).map(a => ({ id: a.id, date: fromIso(a.ngay), kind: a.loai || 'Khác', note: a.ghiChu || '' })).filter(a => a.date)
  }));
  state.stock = tabs.HangHoa.map(stockFromRec);
  // Gom các lần đặt cùng donChungId thành một đơn; đánh số lần theo ngày đặt rồi theo thứ tự tạo
  const byG = groupBy(state.orders, 'gid');
  state.groups = Object.keys(byG).map(gid => {
    const lans = byG[gid].sort((a, b) => cmpDate(a.date, b.date, 1) || (a.id < b.id ? -1 : 1));
    lans.forEach((o, i) => { o.lanNo = i + 1; o.lanCount = lans.length; });
    const dated = lans.filter(o => o.date);
    return { id: gid, cid: lans[0].cid, lans, first: dated.length ? dated[0].date : null, last: dated.length ? dated[dated.length - 1].date : null };
  });
}

/* ---------- Tính toán từ mô hình ---------- */
const orderTotal = o => o.dresses.reduce((s, d) => s + (d.price || 0), 0);
const orderPaid = o => o.pays.reduce((s, p) => s + p.amount, 0);
const orderOwed = o => Math.max(0, orderTotal(o) - orderPaid(o));
// Trạng thái đơn = váy chậm nhất trong đơn (đơn không có váy coi như đang đặt)
const orderStatus = o => !o.dresses.length ? 0 : o.dresses.every(d => d.status === 2) ? 2 : o.dresses.every(d => d.status >= 1) ? 1 : 0;
const customerOf = o => state.customers.find(c => c.id === o.cid) || { id: o.cid, name: '(khách đã xóa)', channel: '' };
const orderById = id => state.orders.find(o => o.id === id);
/* ---------- Đơn (nhóm lần đặt) ---------- */
const groupById = id => state.groups.find(g => g.id === id) || state.groups.find(g => g.lans.some(o => o.id === id));
const groupsOf = c => state.groups.filter(g => g.cid === c.id);
// Khách có sẵn trùng tên với tên đang gõ (bỏ qua khách đang sửa)
const sameNameCustomer = (name, exceptId) => state.customers.find(c => c.id !== exceptId && nameKey(c.name) === nameKey(name));
// Các nhóm khách cũ đã trùng tên
const duplicateCustomers = () => Object.values(groupBy(state.customers.map(c => Object.assign({ k: nameKey(c.name) }, c)), 'k')).filter(x => x.length > 1);
// Khung nhắc gộp khách trùng tên (hiện ở Đơn hàng và Khách hàng khi có)
function dupBanner() {
  const d = duplicateCustomers(); if (!d.length) return '';
  return `<div class="banner"><b>Có ${d.length} tên khách bị trùng</b>${d.map(x => esc(x[0].name) + ' (' + x.length + ')').join(', ')}. Gộp để mỗi khách chỉ còn một, đơn của các bản trùng chuyển về chung.<br><button data-act="merge-dups">Gộp khách trùng tên</button></div>`;
}
const groupDresses = g => g.lans.flatMap(o => o.dresses);
const groupTotal = g => g.lans.reduce((s, o) => s + orderTotal(o), 0);
const groupPaid = g => g.lans.reduce((s, o) => s + orderPaid(o), 0);
const groupOwed = g => Math.max(0, groupTotal(g) - groupPaid(g));
const groupStatus = g => orderStatus({ dresses: groupDresses(g) });
const groupOpen = g => groupDresses(g).some(d => d.status < 2);                  // còn váy chưa giao
// Hạn giao gần nhất của các lần còn váy chưa giao
const nextDue = g => g.lans.filter(o => o.due && o.dresses.some(d => d.status < 2)).map(o => o.due).sort((a, b) => a - b)[0] || null;
const groupDateLabel = g => !g.first ? 'Chưa có ngày' : sameDay(g.first, g.last) ? dm(g.first) : dm(g.first) + ' → ' + dm(g.last);
const lanTag = o => o.lanCount > 1 ? ' · lần ' + o.lanNo : '';
// Ngày của váy: ngày thêm nếu có, không thì ngày đặt của đơn; "thêm sau" khi khác ngày đặt
const dressDay = (d, o) => d.date || o.date;
const addedLater = (d, o) => !!(d.date && o.date && !sameDay(d.date, o.date));
const dayTag = (d, o) => { const day = dressDay(d, o); return day ? `<span class="day-tag ${addedLater(d, o) ? 'later' : ''}">Ngày ${dm(day)}${addedLater(d, o) ? ' · thêm sau' : ''}</span>` : ''; };
// Tiền cọc của một lần = các khoản ghi "Cọc"
const lanDeposit = o => o.pays.filter(p => p.kind === 'Cọc').reduce((s, p) => s + p.amount, 0);

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
  if (Sync.imgBusy) return 'Đang gửi ảnh…';
  if (Sync.pending) return Sync.pending + ' chờ gửi';
  if (Sync.error) return 'Lỗi đồng bộ';
  return Sync.lastAt ? 'Đã đồng bộ ' + hhmm(Sync.lastAt) : 'Chưa đồng bộ';
}
function syncClass() { return !Api.ready() ? 'off' : Sync.busy || Sync.imgBusy ? 'busy' : (Sync.pending || Sync.error) ? 'err' : ''; }
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
  if (full) full.textContent = key === 'dep' ? depositNote() : vnd ? '= ' + money(vnd) : '';
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
    if (o.due && open) evs.push({ date: o.due, kind: 'Hạn giao', note: open + ' váy chưa giao', oid: o.gid, cname: c.name + lanTag(o) });
    o.appts.forEach(a => evs.push({ date: a.date, kind: a.kind, note: a.note, oid: o.gid, cname: c.name }));
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
// Nhắc cài đặt kết nối nếu chưa có; đồng bộ lỗi thì nói rõ lý do (dữ liệu trên Google không bị ảnh hưởng)
const setupBanner = () => !Api.ready()
  ? `<div class="banner"><b>Chưa kết nối Google Sheets</b>Dữ liệu chỉ nằm trong máy này. Vào Cài đặt dán URL Web App và mã bí mật.<br><button data-act="tab" data-val="settings">Mở Cài đặt</button></div>`
  : Sync.error && Sync.error !== 'Mất mạng'
  ? `<div class="banner err"><b>Không đồng bộ được với Google Sheets</b>${esc(Sync.error)}. Dữ liệu trên Google vẫn an toàn.<br><button data-act="sync-now">Thử lại</button></div>` : '';

/* ---------- Khối gọn dùng chung ---------- */
// Nhớ mục xổ xuống nào đang mở; trình duyệt chặn bộ nhớ (chế độ riêng tư) thì dùng mặc định
const DISC = (() => { try { return JSON.parse(localStorage.getItem('mh_disc') || '{}'); } catch (e) { return {}; } })();
// Danh sách xổ xuống: một dòng tiêu đề (tên, tóm tắt bên phải, mũi tên), chạm để mở / đóng; o.add = nút nhỏ cạnh tiêu đề
function disc(key, title, sum, body, o = {}) {
  const open = o.force || (key in DISC ? DISC[key] : !!o.open);
  return `<section class="disc${open ? ' open' : ''}${o.sub ? ' sub' : ''}"><div class="disc-h"><button class="disc-tg" data-act="disc" data-val="${key}" aria-expanded="${open}">
    <span class="${o.sub ? 't2' : 't'}">${title}</span><span class="c ${o.tone || ''}"${o.sumId ? ` id="${o.sumId}"` : ''}>${sum}</span>${CHEV}</button>${o.add || ''}</div>
    <div class="disc-b"><div class="disc-in">${body}</div></div></section>`;
}
// Danh sách dài: hiện n dòng đầu, phần còn lại nằm sau nút "Xem thêm"
function moreList(rows, n, label) {
  if (rows.length <= n) return rows.join('');
  return rows.slice(0, n).join('') + `<div class="more-b" hidden>${rows.slice(n).join('')}</div><button class="more-row" data-act="more" data-val="${esc(label)}">${esc(label)}</button>`;
}
// Nút thêm nhỏ nằm cạnh tiêu đề một phần
const addBtn = (act, label, attrs = '') => `<button class="h-add" data-act="${act}" ${attrs}>${label}</button>`;
// Đếm váy của một đơn: "n chưa giao · m đã về", kèm thanh ba màu (đã về · đặt · đã giao) khi từ 5 váy
function stLine(dr) {
  const n = [0, 1, 2].map(k => dr.filter(d => d.status === k).length), left = n[0] + n[1];
  const txt = !dr.length ? 'Chưa có váy' : !left ? '<span class="ok">Đã giao đủ</span>'
    : `<b>${left}</b> chưa giao${n[1] ? ' · ' + n[1] + ' đã về' : ''}${n[2] ? ' · ' + n[2] + ' đã giao' : ''}`;
  const bar = dr.length >= 5 ? `<div class="stbar">${[[1, 'v'], [0, 'd'], [2, 'g']].filter(([k]) => n[k]).map(([k, c]) => `<i class="${c}" style="flex:${n[k]}"></i>`).join('')}</div>` : '';
  return bar + `<div class="stline">${txt}</div>`;
}

/* =====================================================================
   1. HÔM NAY
   ===================================================================== */
function viewToday() {
  const sel = state.daySel, selN = daysTo(sel), dayEvs = eventsOn(sel);
  const selLabel = selN === 0 ? 'Hôm nay' : selN === 1 ? 'Ngày mai' : WEEKDAYS[sel.getDay()] + ' ' + dm(sel);
  // Khách còn nợ: gộp mọi đơn của một khách thành một dòng, nợ nhiều nhất trước
  const owers = state.customers.map(c => {
    const gs = groupsOf(c);
    return { c, gs, owe: gs.reduce((s, g) => s + groupOwed(g), 0), total: gs.reduce((s, g) => s + groupTotal(g), 0), paid: gs.reduce((s, g) => s + groupPaid(g), 0), n: gs.reduce((s, g) => s + groupDresses(g).length, 0) };
  }).filter(x => x.owe > 0).sort((a, b) => b.owe - a.owe);
  const totalOwed = owers.reduce((s, x) => s + x.owe, 0);
  const due = state.orders.filter(o => o.due && daysTo(o.due) <= 7 && o.dresses.some(d => d.status < 2)).sort((a, b) => a.due - b.due);
  const late = due.filter(o => daysTo(o.due) < 0).length;
  const dueRows = due.map(o => {
    const n = daysTo(o.due), open = o.dresses.filter(d => d.status < 2), owe = orderOwed(o);
    return `<button class="row" data-act="open-order" data-id="${o.gid}">${tile(open[0], '', true)}
      <div class="main"><b>${esc(customerOf(o).name + lanTag(o))}</b><span>${open.length} váy chưa giao · <em class="${n < 0 ? 'late' : n <= 2 ? 'soon' : ''}">${dueText(o.due)}</em></span></div>
      <div class="side">${owe > 0 ? `<b class="owe">${money(owe)}</b><span class="muted">còn nợ</span>` : '<span class="ok">Đã thu đủ</span>'}</div></button>`;
  });
  const oweRows = owers.map(x => {
    const pct = Math.min(100, Math.round(x.paid / (x.total || 1) * 100)), one = x.gs.length === 1;
    return `<button class="row" data-act="${one ? 'open-order' : 'open-customer'}" data-id="${one ? x.gs[0].id : x.c.id}">
      <div class="main"><b>${esc(x.c.name)}${one ? '' : ` <span class="multi cust">${x.gs.length} đơn</span>`}</b><span>${x.n} váy · đã thu ${pct}%</span><div class="bar"><i style="width:${pct}%;--pc:${progColor(pct)}"></i></div></div>
      <div class="side"><b class="owe">${money(x.owe)}</b></div></button>`;
  });
  const wd = WEEKDAYS[TODAY.getDay()] + ', ' + dm(TODAY) + '/' + TODAY.getFullYear();
  const empty = !state.orders.length ? `<div class="banner" style="background:rgba(199,96,122,.1);color:var(--ink)"><b>Chưa có đơn nào</b>Bấm nút giữa → Thêm đơn mới. ${Api.ready() ? 'Nếu đã có dữ liệu trên Sheets, vào Cài đặt → Đồng bộ lại toàn bộ.' : ''}</div>` : '';
  return topbar({ title: 'Hôm nay', sub: wd }) + setupBanner() + empty + `
    <div class="hero"><i class="orb"></i><div class="lbl">Tổng còn phải thu</div>
      <div class="num" id="owed-num" data-val="${totalOwed}">${money(totalOwed)}</div><div class="note">${owers.length} khách còn nợ</div>
      <div class="foot"><span>Cần giao trong 7 ngày</span><b>${due.reduce((s, o) => s + o.dresses.filter(d => d.status < 2).length, 0)} váy</b></div></div>
    ${weekStrip(sel)}${legend()}
    ${disc('today-day', selLabel, dayEvs.length ? dayEvs.length + ' việc' : 'Không có gì',
      `<div class="group">${dayEvs.map(eventRow).join('') || '<div class="empty">Không có lịch hẹn hay hạn giao</div>'}<button class="more-row" data-act="open-calendar">Xem cả tháng ›</button></div>`,
      { open: true, add: state.orders.length ? addBtn('add-appt', '＋ Hẹn', `data-iso="${toIso(sel)}"`) : '' })}
    ${disc('today-due', 'Cần giao', late ? late + ' đơn quá hạn' : due.length ? due.length + ' đơn trong 7 ngày' : 'Không có',
      `<div class="group">${moreList(dueRows, 3, 'Xem thêm ' + (dueRows.length - 3) + ' đơn') || '<div class="empty">Không có váy nào tới hạn</div>'}</div>`, { open: true, tone: late ? 'owe' : '' })}
    ${disc('today-owe', 'Khách còn nợ', owers.length ? owers.length + ' khách' : 'Không ai nợ',
      `<div class="group">${moreList(oweRows, 5, 'Xem cả ' + owers.length + ' khách') || '<div class="empty">Không có khách nào còn nợ</div>'}</div>`, { open: true })}`;
}

/* ---------- Dòng một khách có nhiều đơn: bấm vào mở trang đơn của khách ---------- */
function customerOrdersRow(c, gs) {
  const dr = gs.flatMap(groupDresses), owe = gs.reduce((s, g) => s + groupOwed(g), 0), total = gs.reduce((s, g) => s + groupTotal(g), 0);
  const days = gs.map(g => g.last).filter(Boolean).sort((a, b) => a - b);
  const range = !days.length ? 'Chưa có ngày' : days.length === 1 ? dm(days[0]) : dm(days[0]) + ' → ' + dm(days[days.length - 1]);
  return `<button class="row" data-act="open-customer" data-id="${c.id}">
    <div class="main"><b>${esc(c.name)} <span class="multi cust">${gs.length} đơn</span></b><span>${range} · ${dr.length} váy</span>
      ${stLine(dr)}</div>
    <div class="side"><b>${money(total)}</b>${owe > 0 ? `<span class="owe">Còn ${money(owe)}</span>` : '<span class="ok">Đủ</span>'}</div></button>`;
}
/* ---------- Dòng đơn dùng chung (một thẻ cho cả đơn, đếm váy theo trạng thái) ---------- */
const multiTag = g => g.lans.length > 1 ? ` <span class="multi">${g.lans.length} lần</span>` : '';
function orderRow(g, showName = true) {
  const owe = groupOwed(g), n = groupDresses(g).length, due = nextDue(g);
  const dueTxt = due ? 'hạn ' + (g.lans.length > 1 ? 'gần nhất ' : '') + dm(due) : '';
  const sub = [showName ? groupDateLabel(g) : '', n + ' váy', dueTxt].filter(Boolean).join(' · ');
  return `<button class="row" data-act="open-order" data-id="${g.id}">
    <div class="main"><b>${showName ? esc(customerOf(g).name) : groupDateLabel(g)}${multiTag(g)}</b><span>${sub}</span>
      ${stLine(groupDresses(g))}</div>
    <div class="side"><b>${money(groupTotal(g))}</b>${owe > 0 ? `<span class="owe">Còn ${money(owe)}</span>` : '<span class="ok">Đủ</span>'}</div></button>`;
}

/* =====================================================================
   2. ĐƠN HÀNG: danh sách + lọc + tìm
   ===================================================================== */
function viewOrders() {
  const f = state.filter;
  return topbar({ title: 'Đơn hàng', sub: `<span id="order-count"></span>` }) + dupBanner() + `
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
  const hay = g => [customerOf(g).name, ...g.lans.map(o => o.note), ...groupDresses(g).map(d => d.note + ' ' + d.source + ' ' + d.size)].join(' ');
  const list = state.groups.filter(g => (!q || matchText(hay(g), q)) && (f.status === 'all' || groupStatus(g) === +f.status) && (f.source === 'all' || groupDresses(g).some(d => d.source === f.source)))
    .sort((a, b) => cmpDate(a.last, b.last, f.sort === 'new' ? -1 : 1));
  // Gom theo khách, giữ thứ tự đơn mới nhất của mỗi khách; khách 1 đơn hiện thẳng đơn đó
  const byCust = [];
  list.forEach(g => { const b = byCust.find(x => x.cid === g.cid); b ? b.gs.push(g) : byCust.push({ cid: g.cid, gs: [g] }); });
  $('#order-list').innerHTML = byCust.map(b => b.gs.length > 1 ? customerOrdersRow(customerOf(b.gs[0]), b.gs) : orderRow(b.gs[0])).join('') || '<div class="empty">Không có đơn phù hợp</div>';
  $('#order-count').textContent = byCust.length + ' khách · ' + list.length + ' đơn';
  $('#order-names').innerHTML = nameSuggest(q);
}
// Bảng chọn trạng thái / kho, kèm số đơn
function sheetFilter(kind) {
  const f = state.filter, isS = kind === 'status';
  const opts = [['all', 'Tất cả'], ...(isS ? ORDER_STATUS.map((l, i) => [i, l]) : state.sources.map(s => [s, s]))];
  const count = v => v === 'all' ? state.groups.length : isS ? state.groups.filter(g => groupStatus(g) === +v).length : state.groups.filter(g => groupDresses(g).some(d => d.source === v)).length;
  const cur = isS ? f.status : f.source;
  openSheet(`<h3>${isS ? 'Trạng thái đơn' : 'Kho (nguồn váy)'}</h3><p class="sub" style="margin:0">Chọn một để lọc</p>
    <div class="opt-grid">${opts.map(([v, l]) => `<button class="opt ${String(cur) === String(v) ? 'on' : ''}" data-act="set-${kind}" data-val="${esc(v)}"><b>${esc(l)}</b><span>${count(v)} đơn</span></button>`).join('')}</div>`);
}

/* =====================================================================
   3. CHI TIẾT ĐƠN: đơn một lần giữ bố cục cũ; đơn nhiều lần có khung riêng cho từng lần
   ===================================================================== */
function viewOrder(v) {
  const g = groupById(v.id);
  if (!g) { state.stack.pop(); return viewOrders(); }
  return g.lans.length > 1 ? viewGroup(g) : viewSingle(g, g.lans[0]);
}
// Thẻ tiền cả đơn
function moneyCard(label, total, paid) {
  const owe = Math.max(0, total - paid), pct = total ? Math.min(100, Math.round(paid / total * 100)) : 0;
  return `<div class="money"><div class="line">${label}</div><div class="rest ${owe > 0 ? 'owe' : 'ok'}">${owe > 0 ? money(owe) : 'Đã thu đủ'}</div>
    <div class="bar"><i style="width:${pct}%;--pc:${progColor(pct)}"></i></div>
    <div class="line">Tổng ${money(total)} · đã thu ${money(paid)}</div></div>`;
}
// Nhãn hạn giao: quá hạn / hôm nay / còn n ngày
const dueText = d => { const n = daysTo(d); return n < 0 ? 'quá ' + -n + ' ngày' : n === 0 ? 'hôm nay' : 'còn ' + n + ' ngày'; };
// Lịch hẹn của cả đơn: thu thành một dòng, nút ＋ Hẹn cạnh tiêu đề
function apptSection(g) {
  const list = g.lans.flatMap(o => o.appts.map(a => Object.assign({ oid: o.id }, a))).sort((a, b) => a.date - b.date);
  const rows = list.map(a => { const n = daysTo(a.date);
    return `<button class="kv" data-act="edit-appt" data-aid="${a.id}"><span style="display:flex;align-items:center;gap:8px"><i class="dot" style="background:${evColor(a)}"></i>${esc(a.kind)}${a.note ? ' · ' + esc(a.note) : ''}</span><b>${dm(a.date)}${n < 0 ? '' : ` <span class="tag ${n <= 2 ? 'soon' : ''}">${dueText(a.date)}</span>`}</b></button>`; }).join('');
  const next = list.find(a => daysTo(a.date) >= 0);
  return disc('order-appt', 'Lịch hẹn', !list.length ? 'Chưa có' : next ? 'Gần nhất ' + dm(next.date) : list.length + ' lịch đã qua',
    `<div class="group">${rows || '<div class="empty">Chưa có lịch hẹn</div>'}</div>`, { add: addBtn('add-appt', '＋ Hẹn', `data-id="${g.lans[0].id}"`) });
}
// Các lần thu tiền thu thành một dòng có tóm tắt đã thu
function payDisc(title, rows, paid, total, add) {
  return disc('order-pay', title, !paid ? 'Chưa thu' : paid >= total ? 'Đã thu đủ' : 'Đã thu ' + money(paid),
    `<div class="group">${rows || '<div class="empty">Chưa có khoản nào</div>'}</div>`, { tone: !paid ? 'owe' : paid >= total ? 'ok' : '', add });
}
// Nút cuối trang chung cho mọi đơn: thêm lần đặt, gộp, xoá
function groupFooter(g) {
  const others = groupsOf(customerOf(g)).filter(x => x.id !== g.id).length;
  return `<section class="block"><button class="btn ghost" data-act="add-lan" data-id="${g.id}">＋ Thêm lần đặt mới</button>
    <div style="display:flex;justify-content:space-between;gap:10px;margin-top:8px"><span style="display:flex;gap:14px">
      ${others ? `<button class="linkbtn" data-act="merge-open" data-id="${g.id}" style="justify-content:flex-start">Gộp với đơn khác</button>` : ''}
      <button class="linkbtn" data-act="change-cust" data-id="${g.id}" style="justify-content:flex-start">Đổi khách</button></span>
      <button class="linkbtn danger" data-act="del-order" data-id="${g.id}">Xoá ${g.lans.length > 1 ? 'cả đơn' : 'đơn này'}</button></div></section>`;
}
// Đơn chỉ có một lần: váy lên đầu, ngày đặt / hạn giao thành hai ô nhỏ, thanh toán / lịch hẹn / note thu gọn
function viewSingle(g, o) {
  const c = customerOf(o);
  const dresses = dressList(g, o, (d, i, sel) => `
    <div class="dcard${sel ? ' picked' : ''}">
      <button data-act="view-img" data-id="${o.id}" data-i="${i}" aria-label="Xem ảnh váy ${i + 1}">${tile(d, 'lg')}</button>
      <button class="info" data-act="${sel == null ? 'edit-dress' : 'sel-toggle'}" data-did="${d.id}" data-id="${o.id}" data-i="${i}">
        <div class="price">${money(d.price)}</div>
        <div class="meta">${esc(d.size || 'Chưa có size')} · ${esc(d.source || 'Chưa có kho')}</div>
        <div class="cost">${d.cost ? 'Giá nhập ' + money(d.cost) : 'Chưa ghi giá nhập'}</div>
        ${dayTag(d, o)}
        ${d.note ? `<span class="dnote">${esc(d.note)}</span>` : '<span class="dnote empty">＋ Ghi chú váy</span>'}
      </button>
      ${sel == null ? `<button class="moonbtn" data-act="cycle" data-id="${o.id}" data-i="${i}" aria-label="Đổi trạng thái váy ${i + 1}">${moon(d.status)}${STATUS[d.status]}</button>`
        : `<button class="moonbtn" data-act="sel-toggle" data-did="${d.id}" aria-label="Chọn váy ${i + 1}"><i class="check ${sel ? 'on' : ''}"></i>${STATUS[d.status]}</button>`}
    </div>`);
  const pays = o.pays.map(p => `<button class="kv" data-act="edit-pay" data-id="${o.id}" data-pid="${p.id}"><span>${dm(p.date)} · ${esc(p.kind)}</span><b>${money(p.amount)}</b></button>`).join('');
  const dueTag = o.due ? ` <span class="tag ${daysTo(o.due) < 0 ? 'late' : daysTo(o.due) <= 2 ? 'soon' : ''}">${dueText(o.due)}</span>` : '';
  const noteGoc = o.dresses.map(d => d.noteGoc).filter(Boolean);
  return topbar({ title: c.name, sub: `${o.dresses.length} váy · ${esc(c.channel)}${o.sheetGoc ? ' · từ sheet ' + esc(o.sheetGoc) : ''}`, back: backLabel() }) +
    moneyCard('Còn lại', orderTotal(o), orderPaid(o)) + `
    <div class="facts2"><button class="fct" data-act="edit-lan" data-id="${o.id}">Ngày đặt<b>${dateLabel(o.date)}</b></button>
      <button class="fct" data-act="edit-lan" data-id="${o.id}">Hạn giao<b>${o.due ? dm(o.due) + dueTag : 'Chưa hẹn'}</b></button></div>
    <section class="block"><h2>Váy trong đơn ${addBtn('add-dress-to-order', '＋ Thêm váy', `data-id="${o.id}"`)}</h2>
      ${dressTools(g)}<div class="group">${dresses || '<div class="empty">Đơn chưa có váy</div>'}</div></section>
    ${payDisc('Thanh toán', pays, orderPaid(o), orderTotal(o), addBtn('add-pay', '＋ Thu tiền', `data-id="${o.id}"`))}
    ${apptSection(g)}
    ${disc('order-note', 'Note đơn', o.note ? esc(o.note.slice(0, 28)) + (o.note.length > 28 ? '…' : '') : noteGoc.length ? 'Có note gốc từ Excel' : 'Trống',
      `<textarea class="field" data-in="order-note" data-id="${o.id}" placeholder="Ví dụ: Trước 5/8, khách báo qua Fb">${esc(o.note)}</textarea>${noteGoc.length ? `<p class="small-note">Note gốc từ Excel: ${noteGoc.map(esc).join(' · ')}</p>` : ''}`)}
    ${groupFooter(g)}${selBar(g)}`;
}
// Trạng thái váy chụp lúc mở đơn: váy vừa đổi trạng thái nằm yên chỗ cũ đến khi rời đơn, chạm nhầm còn sửa ngay được
function snapOf(g) {
  const v = topView();
  if (!state.dsnap || state.dsnap.view !== v) state.dsnap = { view: v, st: {}, mode: 'need', open: new Set(), sel: null };
  groupDresses(g).forEach(d => { if (!(d.id in state.dsnap.st)) state.dsnap.st[d.id] = d.status; });
  return state.dsnap;
}
// Thứ tự váy một lần: "Cần giao trước" = Đã về → Đặt, váy đã giao tách riêng; hoặc giữ thứ tự nhập; hoặc chỉ một trạng thái
function dressPlan(s, o) {
  const items = o.dresses.map((d, i) => ({ d, i, st: s.st[d.id] }));
  if (s.mode === 'input') return { show: items, done: [] };
  if (s.mode !== 'need') return { show: items.filter(x => x.st === s.mode), done: [] };
  const RANK = [1, 0, 2];                                             // Đặt xếp sau Đã về
  const open = items.filter(x => x.st < 2).sort((a, b) => RANK[a.st] - RANK[b.st] || a.i - b.i), done = items.filter(x => x.st === 2);
  return open.length ? { show: open, done } : { show: done, done: [] };   // lần đã giao hết thì hiện bình thường, không gom
}
// Vẽ váy của một lần; váy đã giao gom vào một dòng ở cuối, chạm để mở ra
function dressList(g, o, row) {
  const s = snapOf(g), plan = dressPlan(s, o), pick = d => s.sel ? s.sel.has(d.id) : null;
  let html = plan.show.map(x => row(x.d, x.i, pick(x.d))).join('');
  if (plan.done.length) {
    const open = s.open.has(o.id);
    html += `<button class="done-row" data-act="done-toggle" data-id="${o.id}">${moon(2)}<span>Đã giao ${plan.done.length} váy</span><b>${open ? 'Thu gọn' : 'Xem'}</b></button>`
      + (open ? plan.done.map(x => row(x.d, x.i, pick(x.d))).join('') : '');
  }
  return html || (o.dresses.length ? `<div class="empty">Không có váy ${STATUS[s.mode]} ở đây</div>` : '');
}
// Nút "Xem theo" (mở bảng chọn) + nút Chọn nhiều; chỉ hiện ở đơn từ 5 váy trở lên
function dressTools(g) {
  const s = snapOf(g);
  if (groupDresses(g).length < 5) return '';
  return `<div class="dtools-row"><button class="fbtn ${s.mode !== 'need' ? 'on' : ''}" data-act="dview-open" data-id="${g.id}"><span>Xem theo</span><b>${DVIEW.find(x => x[0] === s.mode)[1]}</b></button>
    <button class="linkbtn" data-act="${s.sel ? 'sel-cancel' : 'sel-start'}">${s.sel ? 'Thôi chọn' : 'Chọn nhiều váy'}</button></div>`;
}
// Các cách xem váy trong đơn
const DVIEW = [['need', 'Cần giao trước', 'Đã về lên đầu, đã giao gom cuối'], ['input', 'Thứ tự nhập', 'Đủ váy như lúc nhập'], [1, 'Chỉ Đã về'], [0, 'Chỉ Đặt'], [2, 'Chỉ Đã giao']];
// Bảng chọn cách xem váy, kèm số váy từng trạng thái
function sheetDview(g) {
  const s = snapOf(g), all = groupDresses(g), cnt = k => all.filter(d => d.status === k).length;
  openSheet(`<h3>Xem váy theo</h3><div class="opt-grid">${DVIEW.map(([k, l, hint]) => `<button class="opt ${s.mode === k ? 'on' : ''}" data-act="dview" data-val="${k}"><b>${l}</b><span>${typeof k === 'number' ? cnt(k) + ' váy' : hint}</span></button>`).join('')}</div>`);
}
// Thanh đáy khi đang chọn nhiều: đổi cả loạt váy đã chọn sang một trạng thái
function selBar(g) {
  const s = snapOf(g);
  if (!s.sel) return '';
  return `<div style="height:150px"></div><div class="savebar"><div class="sumline"><span>Đã chọn <b>${s.sel.size}</b> váy</span>
      <span><button class="linkbtn" style="min-height:auto" data-act="sel-all">Chọn hết đang hiện</button> · <button class="linkbtn" style="min-height:auto" data-act="sel-cancel">Huỷ</button></span></div>
    <div class="selset">${STATUS.map((t, k) => `<button class="btn ${k === 2 ? '' : 'ghost'}" data-act="sel-set" data-val="${k}" ${s.sel.size ? '' : 'disabled'}>${t}</button>`).join('')}</div></div>`;
}
// Một khung "Lần n": ngày, cọc và tỷ lệ, hạn, tiền riêng, ghi chú, váy, nút
function lanCard(o) {
  const t = orderTotal(o), p = orderPaid(o), dep = lanDeposit(o);
  const payFact = dep ? `<span class="fact coc">Cọc ${money(dep)} · ${t ? Math.round(dep / t * 100) : 0}%</span>`
    : p && p >= t ? '<span class="fact ok">Đã thu đủ</span>' : p ? `<span class="fact coc">Đã thu ${money(p)}</span>` : '<span class="fact">Chưa cọc</span>';
  const dueFact = o.due ? `<span class="fact ${daysTo(o.due) <= 7 && o.dresses.some(d => d.status < 2) ? 'soon' : ''}">Hạn ${dm(o.due)} · ${dueText(o.due)}</span>` : '<span class="fact">Chưa hẹn giao</span>';
  const rows = dressList(groupById(o.gid), o, (d, i, sel) => `<div class="mini${sel ? ' picked' : ''}">
      <button data-act="view-img" data-id="${o.id}" data-i="${i}" aria-label="Xem ảnh váy">${tile(d)}</button>
      <button class="info" data-act="${sel == null ? 'edit-dress' : 'sel-toggle'}" data-did="${d.id}" data-id="${o.id}" data-i="${i}"><b>${money(d.price)}</b>${esc(d.size || '—')} · ${esc(d.source || '—')}${d.note ? ' · ' + esc(d.note) : ''}<br>${dayTag(d, o)}</button>
      ${sel == null ? `<button class="st" data-act="cycle" data-id="${o.id}" data-i="${i}" aria-label="Đổi trạng thái">${moon(d.status)}${STATUS[d.status]}</button>`
        : `<button class="st" data-act="sel-toggle" data-did="${d.id}" aria-label="Chọn váy"><i class="check ${sel ? 'on' : ''}"></i>${STATUS[d.status]}</button>`}</div>`);
  return `<div class="lan">
    <div class="lan-head">
      <div class="lan-title"><b>Lần ${o.lanNo} · đặt ${dateLabel(o.date)}</b><span>${o.dresses.length} váy</span></div>
      <div class="facts">${payFact}${dueFact}</div>
      <div class="lan-money"><span>Giá trị<b>${money(t)}</b></span><span>Đã thu<b>${money(p)}</b></span><span>Còn<b class="${t > p ? 'owe' : ''}">${money(Math.max(0, t - p))}</b></span></div>
      ${o.note ? `<span class="dnote">${esc(o.note)}</span>` : ''}
    </div>
    ${rows || '<div class="empty">Lần này chưa có váy</div>'}
    <div class="lan-actions"><button class="chip" data-act="add-dress-to-order" data-id="${o.id}">＋ Váy</button><button class="chip" data-act="add-pay" data-id="${o.id}">＋ Thu tiền</button><button class="chip" data-act="edit-lan" data-id="${o.id}">Sửa ngày, hạn, ghi chú</button></div>
  </div>`;
}
// Đơn nhiều lần: tổng cả đơn trên cùng, mỗi lần một khung
function viewGroup(g) {
  const c = customerOf(g);
  const pays = g.lans.flatMap(o => o.pays.map(p => ({ o, p }))).sort((a, b) => a.p.date - b.p.date)
    .map(({ o, p }) => `<button class="kv" data-act="edit-pay" data-id="${o.id}" data-pid="${p.id}"><span>${dm(p.date)} · ${esc(p.kind)} · lần ${o.lanNo}</span><b>${money(p.amount)}</b></button>`).join('');
  return topbar({ title: c.name, sub: `${g.lans.length} lần đặt · ${groupDresses(g).length} váy · ${esc(c.channel)}`, back: backLabel() }) +
    moneyCard('Còn lại cả đơn', groupTotal(g), groupPaid(g)) + `
    <section class="block">${dressTools(g)}${g.lans.map(lanCard).join('')}</section>
    ${apptSection(g)}
    ${payDisc('Các lần thu tiền', pays, groupPaid(g), groupTotal(g), '')}
    ${groupFooter(g)}${selBar(g)}`;
}
// Bảng sửa một lần: ngày đặt, hạn giao, ghi chú; tách ra đơn riêng; xoá lần
function sheetLan() {
  const t = state.tmp, o = orderById(t.oid), g = groupById(o.gid);
  openSheet(`<h3>${g.lans.length > 1 ? 'Lần ' + o.lanNo + ' · ' : ''}${esc(customerOf(o).name)}</h3>
    <label class="lab">Ngày đặt</label><input class="field" type="date" data-in="lan-date" value="${t.date}">
    <label class="lab">Hạn giao</label><input class="field" type="date" data-in="lan-due" value="${t.due}">
    <div class="chips wrap" style="margin-top:8px"><button class="chip" data-act="lan-clear-due">Bỏ hạn giao</button></div>
    ${g.lans.length > 1 ? `<label class="lab">Ghi chú lần này</label><textarea class="field" data-in="lan-note" placeholder="Ví dụ: cả 5 váy đuôi dài 1m">${esc(t.note)}</textarea>` : ''}
    <button class="btn" style="margin-top:16px" data-act="save-lan">Lưu</button>
    ${g.lans.length > 1 ? `<button class="btn ghost" style="margin-top:8px" data-act="split-lan">Tách lần này ra đơn riêng</button>
      <button class="btn ghost" style="margin-top:8px" data-act="del-lan">Xoá lần này</button>` : ''}`);
}
// Bảng chọn đơn để gộp vào (cùng khách)
function sheetMerge(g) {
  const others = groupsOf(customerOf(g)).filter(x => x.id !== g.id).sort((a, b) => cmpDate(a.last, b.last, -1));
  openSheet(`<h3>Gộp vào đơn nào?</h3><p class="sub" style="margin:0">Các lần của đơn này sẽ thành lần đặt tiếp theo của đơn bạn chọn. Tiền cọc, hạn giao, ghi chú từng lần giữ nguyên.</p>
    <div class="group" style="margin-top:12px">${others.map(x => `<button class="row" data-act="merge-into" data-id="${g.id}" data-val="${x.id}">
      <div class="main"><b>${groupDateLabel(x)}${multiTag(x)}</b><span>${groupDresses(x).length} váy · còn ${money(groupOwed(x))}</span></div></button>`).join('')}</div>`);
}
// Xoá hẳn một lần đặt: váy, thanh toán, lịch hẹn của lần đó; hàng sẵn quay về "Sẵn"
async function removeLan(o) {
  for (const x of o.dresses) { await remove('ChiTietDon', x.id); if (x.stockId) await upd('HangHoa', x.stockId, { trangThai: 'Sẵn', donHangId: '' }); }
  for (const p of o.pays) await remove('ThanhToan', p.id);
  for (const ap of o.appts) await remove('LichHen', ap.id);
  await remove('DonHang', o.id);
}
// Đưa một lần ra đơn riêng. Nếu nó là lần mang mã đơn chung, các lần còn lại chuyển sang mã của lần kế tiếp.
async function splitLan(o) {
  const g = groupById(o.gid);
  if (o.id === g.id) {
    const rest = g.lans.filter(x => x.id !== o.id);
    for (const x of rest) await upd('DonHang', x.id, { donChungId: rest[0].id });
  }
  await upd('DonHang', o.id, { donChungId: '' });
}

/* =====================================================================
   5. KHÁCH HÀNG
   ===================================================================== */
function viewCustomers() {
  return topbar({ title: 'Khách hàng', sub: state.customers.length + ' khách' }) + dupBanner() + `
    <div class="search"><input class="field" id="cust-search" type="search" placeholder="Gõ vài chữ, không cần dấu…" value="${esc(state.filter.cq || '')}" autocomplete="off"></div>
    <div class="names" id="cust-names"></div>
    <div class="fbar"><button class="fbtn ${(state.filter.ctype || 'all') !== 'all' ? 'on' : ''}" data-act="ctype-open"><span>Loại khách</span><b>${ctypeLabel(state.filter.ctype || 'all')}</b></button></div>
    <div class="block" style="margin-top:12px"><button class="btn ghost" style="margin-bottom:10px" data-act="add-customer">＋ Thêm khách</button><div class="group" id="cust-list"></div></div>`;
}
// Các lựa chọn lọc loại khách
const CTYPES = [['all', 'Tất cả'], ['Sỉ', 'Khách sỉ'], ['Lẻ', 'Khách lẻ'], ['none', 'Chưa chọn loại']];
const ctypeLabel = k => (CTYPES.find(x => x[0] === k) || CTYPES[0])[1];
const ctypeMatch = (c, k) => k === 'all' || (k === 'none' ? !c.type : c.type === k);
// Bảng chọn loại khách, kèm số khách mỗi loại
function sheetCtype() {
  const cur = state.filter.ctype || 'all';
  openSheet(`<h3>Loại khách</h3><div class="opt-grid">${CTYPES.map(([k, l]) => `<button class="opt ${cur === k ? 'on' : ''}" data-act="cust-type" data-val="${k}"><b>${l}</b><span>${state.customers.filter(c => ctypeMatch(c, k)).length} khách</span></button>`).join('')}</div>`);
}
function renderCustomerList() {
  const q = (state.filter.cq || '').trim();
  const type = state.filter.ctype || 'all';
  const list = state.customers.filter(c => ctypeMatch(c, type) && (!q || matchText(c.name + ' ' + c.channel + ' ' + c.phone + ' ' + c.address, q))).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  $('#cust-names').innerHTML = nameSuggest(q);
  $('#cust-list').innerHTML = list.map(c => {
    const gs = groupsOf(c), owe = gs.reduce((s, g) => s + groupOwed(g), 0);
    return `<button class="row" data-act="open-customer" data-id="${c.id}">
      <div class="main"><b>${esc(c.name)}${c.type ? ` <span class="tag">${esc(c.type)}</span>` : ''}</b><span>${esc(c.channel)}${c.phone ? ' · ' + esc(c.phone) : ''} · ${gs.length} đơn · ${gs.reduce((s, g) => s + groupDresses(g).length, 0)} váy</span></div>
      <div class="side">${owe > 0 ? `<b class="owe">${money(owe)}</b><span class="muted">còn nợ</span>` : ''}</div></button>`;
  }).join('') || '<div class="empty">Chưa có khách nào</div>';
}
function viewCustomer(v) {
  const c = state.customers.find(x => x.id === v.id);
  if (!c) { state.stack.pop(); return viewCustomers(); }
  const gs = groupsOf(c).sort((a, b) => cmpDate(a.last, b.last, -1));
  const total = gs.reduce((s, g) => s + groupTotal(g), 0), paid = gs.reduce((s, g) => s + groupPaid(g), 0);
  return topbar({ title: c.name, sub: `${c.type ? 'Khách ' + esc(c.type.toLowerCase()) + ' · ' : ''}${gs.length} đơn · ${gs.reduce((s, g) => s + groupDresses(g).length, 0)} váy · ${esc(c.channel)}${c.phone ? ' · ' + esc(c.phone) : ''}`, back: backLabel() }) +
    (gs.length ? moneyCard(gs.length > 1 ? 'Còn nợ tất cả các đơn' : 'Còn nợ', total, paid) : '') + `
    <section class="block"><h2>Các đơn ${addBtn('new-order-for', '＋ Đơn mới', `data-id="${c.id}"`)}</h2>
      <div class="group">${moreList(gs.map(g => orderRow(g, false)), 3, 'Xem thêm ' + (gs.length - 3) + ' đơn cũ hơn') || '<div class="empty">Chưa có đơn</div>'}</div></section>
    ${disc('cust-info', 'Thông tin khách', esc([c.type ? 'Khách ' + c.type.toLowerCase() : '', c.ship || c.phone].filter(Boolean).join(' · ') || 'Chưa có thông tin'), `<div class="group">
      ${[['Loại khách', c.type ? 'Khách ' + c.type.toLowerCase() : 'Chưa chọn'], ['Kênh liên hệ', c.channel], ['Số điện thoại', c.phone || 'Chưa có'], ['Địa chỉ', c.address || 'Chưa có']]
        .map(([k, v]) => `<button class="kv" data-act="edit-customer" data-id="${c.id}"><span>${k}</span><span class="val">${esc(v)}</span></button>`).join('')}
      ${c.link ? `<a class="kv" href="${esc(linkHref(c.link))}" target="_blank" rel="noopener"><span>Facebook / Zalo</span><span class="val">Mở trang của khách ↗</span></a>`
        : `<button class="kv" data-act="edit-customer" data-id="${c.id}"><span>Facebook / Zalo</span><span class="val">Chưa có</span></button>`}
      ${[['Gửi hàng qua', c.ship || 'Chưa có'], ['Ghi chú', c.note || '—']]
        .map(([k, v]) => `<button class="kv" data-act="edit-customer" data-id="${c.id}"><span>${k}</span><span class="val">${esc(v)}</span></button>`).join('')}
    </div>`, { add: addBtn('edit-customer', 'Sửa', `data-id="${c.id}"`) })}`;
}
// Link khách dán thiếu "https://" thì tự thêm để bấm mở được
const linkHref = s => /^https?:\/\//i.test(s) ? s : 'https://' + s.replace(/^\/+/, '');
// Khách trống cho bảng Thêm khách
function blankCustomer() {
  return { cid: null, name: '', channel: 'Fb', phone: '', note: '', type: '', address: '', link: '', ship: '' };
}
// Bảng thêm / sửa khách; khách chưa có đơn nào thì xoá được ở đây
function sheetCustomer() {
  const t = state.tmp, adding = !t.cid;
  openSheet(`<h3>${adding ? 'Thêm khách' : 'Sửa khách'}</h3>
    <label class="lab">Tên</label><input class="field" data-in="cu-name" value="${esc(t.name)}" autocomplete="off">
    <label class="lab">Loại khách</label><div class="chips wrap">${CUSTOMER_TYPES.map(k => `<button class="chip ${t.type === k ? 'on' : ''}" data-act="cu-type" data-val="${k}">Khách ${k.toLowerCase()}</button>`).join('')}</div>
    <label class="lab">Kênh liên hệ</label><div class="chips wrap">${CHANNELS.map(ch => `<button class="chip ${t.channel === ch ? 'on' : ''}" data-act="cu-channel" data-val="${ch}">${ch}</button>`).join('')}</div>
    <label class="lab">Số điện thoại</label><input class="field" data-in="cu-phone" inputmode="tel" value="${esc(t.phone)}" autocomplete="off">
    <label class="lab">Địa chỉ giao hàng</label><textarea class="field" data-in="cu-address" placeholder="Số nhà, đường, phường, tỉnh">${esc(t.address)}</textarea>
    <label class="lab">Link Facebook / Zalo</label><input class="field" data-in="cu-link" inputmode="url" placeholder="Dán link trang cá nhân của khách" value="${esc(t.link)}" autocomplete="off" spellcheck="false">
    <label class="lab">Gửi hàng qua</label><input class="field" data-in="cu-ship" placeholder="Ví dụ: Nhà xe Phương Trang" value="${esc(t.ship)}" autocomplete="off">
    <label class="lab">Ghi chú</label><textarea class="field" data-in="cu-note">${esc(t.note)}</textarea>
    <button class="btn" style="margin-top:16px" data-act="save-customer">${adding ? 'Thêm khách' : 'Lưu'}</button>
    ${adding ? '' : `<button class="linkbtn danger" style="margin-top:6px;justify-content:center;width:100%" data-act="del-customer">Xoá khách này</button>`}`);
}
// Bảng đổi khách của một đơn: gõ tên để lọc, chạm khách để chuyển cả đơn sang
function sheetChangeCustomer() {
  const g = groupById(state.tmp.gid);
  openSheet(`<h3>Đổi khách của đơn</h3><p class="sub" style="margin:0">Đang là ${esc(customerOf(g).name)} · ${g.lans.length} lần đặt · ${groupDresses(g).length} váy</p>
    <input class="field" style="margin-top:12px" data-in="cc-q" placeholder="Gõ tên khách mới…" value="${esc(state.tmp.q)}" autocomplete="off">
    <div class="group" id="cc-list" style="margin-top:10px">${changeCustomerRows()}</div>`);
}
function changeCustomerRows() {
  const g = groupById(state.tmp.gid), q = state.tmp.q.trim();
  const list = state.customers.filter(c => c.id !== g.cid && (!q || matchText(c.name + ' ' + c.phone, q))).sort((a, b) => a.name.localeCompare(b.name, 'vi')).slice(0, 30);
  return list.map(c => `<button class="row" data-act="change-cust-to" data-id="${c.id}"><div class="main"><b>${esc(c.name)}</b><span>${esc(c.channel)} · ${groupsOf(c).length} đơn</span></div></button>`).join('')
    || '<div class="empty">Không có khách nào khớp. Muốn khách mới thì thêm ở mục Khách hàng trước.</div>';
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
// Bảng thêm / sửa một lần thu tiền; khi sửa thì đổi được loại và xoá được
function sheetPay() {
  const t = state.tmp, o = orderById(t.oid);
  openSheet(`<h3>${t.pid ? 'Sửa thanh toán' : 'Thêm thanh toán'}</h3><p class="sub" style="margin-bottom:0">Còn lại ${money(orderOwed(o))}</p>
    <label class="lab">Số tiền</label>${moneyField('pay', t.pay)}
    ${t.pid ? `<label class="lab">Loại</label><div class="chips wrap">${PAY_KINDS.map(k => `<button class="chip ${t.kind === k ? 'on' : ''}" data-act="pay-kind" data-val="${k}">${k}</button>`).join('')}</div>`
      : '<div class="chips wrap" style="margin-top:8px"><button class="chip" data-act="pay-rest">Thu đủ phần còn lại</button></div>'}
    <label class="lab">Ngày</label><input class="field" type="date" data-in="pay-date" value="${t.payDate}">
    <button class="btn" style="margin-top:16px" data-act="save-pay">Lưu</button>
    ${t.pid ? `<button class="linkbtn danger" style="margin-top:6px;justify-content:center;width:100%" data-act="del-pay" data-pid="${t.pid}">Xoá khoản này</button>` : ''}`);
}
// Bảng thêm / sửa lịch hẹn
function sheetAppt() {
  const t = state.tmp, o = orderById(t.oid);
  openSheet(`<h3>${t.aid ? 'Sửa lịch hẹn' : 'Thêm lịch hẹn'}</h3>
    ${t.lock ? `<p class="sub" style="margin:0">${esc(customerOf(o).name)}</p>` : `<label class="lab">Đơn của khách</label><select class="field" data-in="ap-oid">${state.orders.slice().sort((a, b) => cmpDate(a.date, b.date, -1)).map(x => `<option value="${x.id}" ${x.id === t.oid ? 'selected' : ''}>${esc(customerOf(x).name + lanTag(x))} · đặt ${dateLabel(x.date)}</option>`).join('')}</select>`}
    <label class="lab">Loại</label><div class="chips wrap">${APPT_KINDS.map(k => `<button class="chip ${t.kind === k ? 'on' : ''}" data-act="ap-kind" data-val="${k}">${k}</button>`).join('')}</div>
    <label class="lab">Ngày</label><input class="field" type="date" data-in="ap-date" value="${t.date}">
    <label class="lab">Ghi chú</label><input class="field" data-in="ap-note" value="${esc(t.note)}" placeholder="Ví dụ: thử lần 2, mang giày, 15h" autocomplete="off">
    <button class="btn" style="margin-top:16px" data-act="save-appt">Lưu lịch hẹn</button>
    ${t.aid ? `<button class="linkbtn danger" style="margin-top:6px;justify-content:center;width:100%" data-act="del-appt" data-aid="${t.aid}">Xoá lịch hẹn này</button>` : ''}`);
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
      <button class="fbtn ${f.source !== 'all' ? 'on' : ''}" data-act="stock-filter" data-val="source"><span>Kho</span><b>${f.source === 'all' ? 'Tất cả' : esc(f.source)}</b></button>
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
  openSheet(`<h3>${isS ? 'Trạng thái hàng' : 'Kho'}</h3><div class="opt-grid">${opts.map(([v, l]) => `<button class="opt ${String(cur) === String(v) ? 'on' : ''}" data-act="set-s${kind}" data-val="${esc(v)}"><b>${esc(l)}</b><span>${count(v)} váy</span></button>`).join('')}</div>`);
}
// Bảng thêm/sửa 1 món hàng (ảnh gắn ngay khi chọn nếu đã có id; hàng mới thì gắn sau khi lưu)
function sheetStock() {
  const t = state.tmp;
  openSheet(`<h3>${t.id ? 'Sửa hàng' : 'Thêm hàng mới'}</h3>
    <div class="photo-row" style="margin-top:8px"><div class="tile xl ${t.img ? '' : 'nopic'}" style="${t.img ? `background-image:url(${t.img})` : '--tone:#F3E4E8'}">${t.img ? '' : NOPIC + 'Chưa có ảnh'}</div>
      <div class="col"><label class="lab" style="margin-top:0">Giá tiền</label>${moneyField('sp', t.sp)}</div></div>
    <div class="photo-btns"><label>Chụp ảnh<input type="file" accept="image/*" capture="environment" data-sphoto="1"></label><label>Chọn từ thư viện<input type="file" accept="image/*" data-sphoto="1"></label></div>
    <label class="lab">Size</label><div class="chips wrap">${SIZES.map(x => `<button class="chip ${t.size === x ? 'on' : ''}" data-act="ss-size" data-val="${x}">${x}</button>`).join('')}</div>
    <label class="lab">Kho</label><div class="chips wrap">${state.sources.map(x => `<button class="chip ${t.source === x ? 'on' : ''}" data-act="ss-source" data-val="${esc(x)}">${esc(x)}</button>`).join('')}</div>
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
  const conn = `<label class="lab" style="margin-top:0">URL Web App</label><input class="field" data-in="cfg-url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(t.url)}" autocomplete="off" spellcheck="false">
      <label class="lab">Mã bí mật</label><input class="field" type="password" data-in="cfg-key" placeholder="Lấy từ Execution log khi chạy setup()" value="${esc(t.key)}" autocomplete="off">
      <button class="btn" style="margin-top:14px" data-act="cfg-save">Lưu và kiểm tra kết nối</button>
      <p class="small-note">Cách lấy 2 thứ này: xem apps-script/README.md. Mã chỉ lưu trong máy này.</p>`;
  const sync = `<div class="group"><div class="kv" style="cursor:default"><span>Lần cuối</span><span class="val">${Sync.lastAt ? new Date(Sync.lastAt).toLocaleString('vi-VN') : 'Chưa'}</span></div>
      <div class="kv" style="cursor:default"><span>Thay đổi chờ gửi</span><span class="val ${Sync.pending ? 'owe' : 'ok'}">${Sync.pending}</span></div>
      ${Sync.error ? `<div class="kv" style="cursor:default"><span>Lỗi</span><span class="val owe">${esc(Sync.error)}</span></div>` : ''}</div>
      <button class="btn ghost" style="margin-top:10px" data-act="sync-now">Đồng bộ ngay</button>
      ${disc('set-adv', 'Nâng cao', 'Tải lại hết từ Sheets', `<button class="btn ghost" data-act="resync">Đồng bộ lại toàn bộ (tải lại hết từ Sheets)</button>
        <p class="small-note">"Đồng bộ lại toàn bộ" gửi hết thay đổi đang chờ trước, rồi xóa bản sao trong máy và tải lại. Dùng khi bạn sửa nhiều trên Sheets hoặc thấy số liệu lệch.</p>`, { sub: true })}`;
  const kho = `<div class="group">${state.sourceRecs.map(r => `<div class="kv" style="cursor:default"><button class="linkbtn" style="justify-content:flex-start;color:var(--ink);font-weight:400" data-act="rename-source" data-id="${r.id}">${esc(r.ten)} <small style="color:var(--ink2);margin-left:6px">Đổi tên</small></button><button class="linkbtn danger" data-act="del-source" data-id="${r.id}">Xoá</button></div>`).join('') || '<div class="empty">Chưa có kho nào</div>'}</div>`;
  return topbar({ title: 'Cài đặt' }) +
    disc('set-conn', 'Kết nối Google Sheets', Api.ready() ? 'Đã kết nối' : 'Chưa kết nối', conn, { tone: Api.ready() ? 'ok' : 'owe', force: !Api.ready() }) +
    disc('set-sync', 'Đồng bộ', Sync.pending ? Sync.pending + ' chờ gửi' : Sync.error ? 'Có lỗi' : 'Không có gì chờ gửi', sync, { open: true, tone: Sync.pending || Sync.error ? 'owe' : '' }) +
    disc('set-kho', 'Kho', state.sourceRecs.length + ' kho', kho, { add: addBtn('add-source-open', '＋ Kho') }) + `
    <section class="block"><p class="small-note">Moon House · app ${APP_VERSION} · Apps Script ${state.serverVersion || (Api.ready() ? 'đang hỏi…' : 'chưa kết nối')} · ${state.groups.length} đơn (${state.orders.length} lần đặt), ${state.customers.length} khách, ${state.stock.length} hàng trong máy</p></section>`;
}

/* =====================================================================
   4. THÊM ĐƠN NHANH (một trang cuộn, nút Lưu dính đáy)
   ===================================================================== */
const newDress = prev => ({ price: 0, size: prev ? prev.size : '', source: prev ? prev.source : '', cost: 0, note: '', img: null, blob: null, stockId: null, stockImgId: '' });
// Bắt đầu nhập đơn; mặc định tạo đơn mới riêng. Từ chi tiết đơn bấm "Thêm lần đặt mới" thì khách và đơn đích đã chọn sẵn
function startDraft(g, cust) {
  const c = cust || (g && customerOf(g));
  state.draft = { cid: c ? c.id : null, name: c ? c.name : '', channel: c ? c.channel : 'Fb', target: g ? g.id : null, dresses: [newDress()], deposit: 0, due: '', note: '', date: toIso(TODAY), openDress: 0 };
  navDir = 'push'; state.stack.push({ v: 'new' }); render();
}
// Các đơn còn váy chưa giao của khách đang chọn, mới nhất trước
const openGroupsOf = cid => state.groups.filter(g => g.cid === cid && groupOpen(g)).sort((a, b) => cmpDate(a.last, b.last, -1));
const draftTotal = () => state.draft.dresses.reduce((s, x) => s + x.price, 0);
// Dòng nhỏ dưới ô cọc: số đầy đủ + tỷ lệ so với giá trị lần này
function depositNote() {
  const d = state.draft, t = draftTotal();
  return d.deposit ? '= ' + money(d.deposit) + (t ? ' · ' + Math.round(d.deposit / t * 100) + '% giá trị' + (d.target ? ' lần này' : '') : '') : '';
}
function viewNew() {
  const d = state.draft;
  const g = d.target && groupById(d.target);
  return topbar({ title: g ? 'Lần đặt mới' : 'Đơn mới' }).replace('<header class="top">', '<header class="top"><button class="back" data-act="cancel-new"><b>‹</b> Huỷ</button>') + `
    <section class="block" style="margin-top:8px"><h2>Khách</h2>
      <input class="field" id="cust-q" placeholder="Gõ tên khách…" value="${esc(d.name)}" autocomplete="off">
      <div id="cust-sugg" class="sugg"></div>
      <label class="lab">${g ? 'Ngày đặt lần này' : 'Ngày đặt'}</label><input class="field" type="date" data-in="draft-date" value="${d.date}">
      <p class="small-note">Tự lấy ngày hôm nay, chạm vào để chọn ngày khác</p></section>
    <section class="block"><h2>Váy <small id="dress-count"></small></h2><div class="group" id="dress-forms"></div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost" data-act="add-dress">＋ Thêm váy nữa</button><button class="btn ghost" data-act="pick-stock-open">Chọn từ hàng sẵn</button></div></section>
    ${disc('draft-dep', g ? 'Cọc và hạn giao lần này' : 'Cọc và hạn giao', d.deposit ? 'Cọc ' + money(d.deposit) : 'Chưa cọc', `
      <label class="lab" style="margin-top:0">Cọc</label>${moneyField('dep', d.deposit)}
      <div class="chips wrap" style="margin-top:8px"><button class="chip" data-act="pay-60" id="chip-60">60%</button><button class="chip" data-act="pay-full">Đã thanh toán đủ</button></div>
      <label class="lab">${g ? 'Hạn giao lần này' : 'Hạn giao (không bắt buộc)'}</label><input class="field" type="date" data-in="draft-due" value="${d.due}">
      <label class="lab">${g ? 'Ghi chú lần này' : 'Note đơn'}</label><textarea class="field" data-in="draft-note" placeholder="${g ? 'Ví dụ: cả lần này đuôi dài 1m' : 'Ví dụ: Trước 5/8, khách báo qua Fb'}">${esc(d.note)}</textarea>`, { open: true, sumId: 'dep-sum' })}
    <div class="savebar"><div class="sumline"><span id="sum-left"></span><span id="sum-right"></span></div>
      <button class="btn" id="save-order" data-act="save-order">Lưu đơn</button></div>`;
}
// Gợi ý khách theo chữ đang gõ + tạo khách mới
function renderCustomerSuggest() {
  const d = state.draft, q = d.name.trim();
  let html = '';
  if (d.cid) {
    html = `<div class="group"><div class="row" style="cursor:default"><div class="main"><b>${esc(d.name)}</b><span>Khách cũ · ${esc(d.channel)}</span></div><span class="ok">✓ Đã chọn</span></div></div>`;
    // Chỉ đưa 3 đơn đang mở gần nhất (và đơn đang chọn nếu nằm ngoài 3 đơn đó) để lựa chọn gọn
    const all = openGroupsOf(d.cid), open = all.slice(0, 3);
    const chosen = d.target && groupById(d.target);
    if (chosen && !open.includes(chosen)) open.push(chosen);
    // Mặc định "Tạo đơn mới riêng"; các đơn đang mở nằm trong một dòng xổ xuống bên dưới
    if (open.length) html += `<div class="choose"><button class="pick ${d.target ? '' : 'on'}" data-act="draft-target" data-val=""><i></i><span><b>Tạo đơn mới riêng</b>Cho đợt đặt này, theo dõi tách biệt</span></button></div>`
      + disc('draft-join', 'Hoặc thêm vào đơn đang mở', open.length + ' đơn', `<div class="choose" style="margin-top:0">${open.map(g => `<button class="pick ${d.target === g.id ? 'on' : ''}" data-act="draft-target" data-val="${g.id}"><i></i><span><b>Thêm vào đơn ${groupDateLabel(g)}, thành lần ${g.lans.length + 1}</b>${g.lans.length} lần · ${groupDresses(g).length} váy · còn ${money(groupOwed(g))}</span></button>`).join('')}</div>`, { sub: true, force: !!d.target });
  }
  else if (q) {
    const found = state.customers.filter(c => matchText(c.name, q)).slice(0, 4);
    html = `<div class="group">${found.map(c => `<button class="row" data-act="pick-customer" data-id="${c.id}"><div class="main"><b>${esc(c.name)}</b><span>${esc(c.channel)} · ${groupsOf(c).length} đơn</span></div></button>`).join('')}
      ${sameNameCustomer(q) ? `<div class="banner" style="margin:8px 0 0"><b>Đã có khách “${esc(sameNameCustomer(q).name)}”</b>Chạm vào tên ở trên để thêm đơn cho khách này. Nếu là người khác cùng tên, gõ thêm chữ để phân biệt, ví dụ “${esc(q)} Q7”.</div>` : ''}
      ${found.some(c => norm(c.name) === norm(q)) ? '' : `<div class="row" style="cursor:default;align-items:flex-start;flex-direction:column;gap:8px"><b style="font-weight:600">＋ Khách mới “${esc(q)}” — kênh liên hệ:</b>
        <div class="chips wrap">${CHANNELS.map(ch => `<button class="chip ${d.channel === ch ? 'on' : ''}" data-act="draft-channel" data-val="${ch}">${ch}</button>`).join('')}</div></div>`}</div>`;
  }
  $('#cust-sugg').innerHTML = html;
}
// Váy trong đơn đang nhập: chỉ váy đang nhập mở đầy đủ, váy khác thu thành một dòng tóm tắt, chạm để sửa
function renderDressForms() {
  const d = state.draft, many = d.dresses.length > 1;
  $('#dress-forms').innerHTML = d.dresses.map((dr, i) => i !== d.openDress
    ? `<button class="dsum" data-act="dress-open" data-i="${i}">${tile({ img: dr.img, tone: '#F3E4E8' })}
        <div class="main"><b>Váy ${i + 1} · ${dr.price ? money(dr.price) : 'chưa có giá'}</b><span>${[dr.size, dr.source, (dr.note || '').trim(), dr.img ? 'có ảnh' : 'chưa có ảnh'].filter(Boolean).map(esc).join(' · ')}</span></div>
        <span class="ed">Sửa${CHEV}</span></button>`
    : `<div class="dform">
      <div class="head"><b>Váy ${i + 1}${dr.stockId ? ' <span class="tag">Hàng sẵn</span>' : ''}</b>${many ? `<span><button class="linkbtn danger" data-act="del-dress" data-i="${i}">Xoá</button><button class="linkbtn" data-act="dress-open" data-i="-1">Thu gọn</button></span>` : ''}</div>
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
  const d = state.draft, total = draftTotal(), g = d.target && groupById(d.target);
  const dup = !d.cid && d.name.trim() && sameNameCustomer(d.name);
  const ready = (d.cid || d.name.trim()) && !dup && d.dresses.some(x => x.price > 0);
  const rest = Math.max(0, total - d.deposit), lan = g ? g.lans.length + 1 : 0;
  $('#dress-count').textContent = d.dresses.length + ' váy';
  $('#sum-left').innerHTML = g ? `Lần ${lan} · <b>${money(total)}</b>` : `Tổng <b>${money(total)}</b>`;
  $('#sum-right').innerHTML = g ? `Cả đơn còn <b>${money(groupOwed(g) + rest)}</b>` : `Còn lại <b>${money(rest)}</b>`;
  const c60 = $('#chip-60'); if (c60) c60.textContent = '60%' + (total ? ' = ' + money(Math.round(total * 0.6 / 1000) * 1000) : '');
  const full = document.querySelector('[data-kfull="dep"]'); if (full) full.textContent = depositNote();
  const ds = $('#dep-sum'); if (ds) ds.textContent = d.deposit ? 'Cọc ' + money(d.deposit) : 'Chưa cọc';
  const btn = $('#save-order'); btn.disabled = !ready;
  btn.textContent = dup ? 'Tên khách đã có: chọn khách ở trên hoặc đổi tên' : !ready ? 'Nhập tên khách và giá ít nhất 1 váy' : g ? `Lưu lần ${lan} · ${d.dresses.length} váy` : `Lưu đơn · ${d.dresses.length} váy`;
}
// Lưu đơn mới: khách (nếu mới) + đơn + từng váy + cọc + ảnh + hàng sẵn đã bán; rồi mở chi tiết đơn ngay
async function saveDraft() {
  const d = state.draft, btn = $('#save-order');
  btn.disabled = true; btn.textContent = 'Đang lưu…';
  let cid = d.cid;
  if (!cid && sameNameCustomer(d.name)) { toast('Đã có khách tên này, chọn khách ở danh sách gợi ý'); btn.disabled = false; refreshDraftSummary(); return; }
  if (!cid) { cid = uid('kh'); await save('KhachHang', { id: cid, ten: d.name.trim(), kenh: d.channel, sdt: '', ghiChu: '' }); }
  const oid = uid('dh'), day = d.date || toIso(TODAY);                 // ô ngày bị xoá trống thì lấy hôm nay
  await save('DonHang', { id: oid, khachId: cid, ngayDat: day, hanGiao: d.due || '', note: d.note.trim(), sheetGoc: '', donChungId: d.target || '' });
  const dresses = d.dresses.filter(x => x.price > 0);
  let thuTu = 0, total = 0;
  for (const x of dresses) {
    const id = uid('ct'); thuTu++; total += x.price;
    await save('ChiTietDon', { id, donHangId: oid, thuTu, giaTien: x.price, giaNhap: x.cost || '', size: x.size, kho: x.source, anhId: x.stockImgId || '',
      ghiChuVay: x.note.trim(), trangThai: x.stockId ? 'Đã về' : 'Đặt', hangHoaId: x.stockId || '', noteGoc: '', ngayThem: day });
    if (x.blob) { await Store.imagePut(id, x.blob); state.imgUrls[id] = x.img; await Store.outboxAdd({ kind: 'image', tab: 'ChiTietDon', id }); }
    if (x.stockId) await upd('HangHoa', x.stockId, { trangThai: 'Đã bán', donHangId: oid });
  }
  if (d.deposit > 0) await save('ThanhToan', { id: uid('tt'), donHangId: oid, ngay: day, soTien: d.deposit, loai: d.deposit >= total ? 'Thanh toán đủ' : 'Cọc' });
  state.draft = null; state.stack.pop(); state.stack.push({ v: 'order', id: d.target || oid });
  navDir = 'push';
  await commit(false, (d.target ? 'Đã lưu lần đặt mới' : 'Đã lưu đơn') + (Api.ready() ? ' · đang gửi lên Sheets' : ''));
}

/* =====================================================================
   BẢNG TRƯỢT
   ===================================================================== */
function openSheet(html) { $('#sheet').innerHTML = `<div class="sheet-back" data-act="close-sheet"></div><div class="sheet-panel">${html}</div>`; $('#sheet').classList.add('open'); }
function closeSheet() { $('#sheet').classList.remove('open'); $('#sheet').innerHTML = ''; }
const sheetOpen = () => $('#sheet').classList.contains('open');
// Bảng sửa 1 váy trong đơn (ảnh chọn ở đây gắn ngay vào váy)
function sheetDress() {
  const t = state.tmp, o = orderById(t.oid), adding = !t.did;
  openSheet(`<h3>${adding ? 'Thêm váy vào đơn ' + dateLabel(o.date) : 'Sửa váy ' + (t.i + 1)}</h3>
    <p class="sub" style="margin:0">${esc(customerOf(o).name + lanTag(o))} · váy thứ ${t.i + 1}</p>
    <label class="lab">Ngày thêm</label><input class="field" type="date" data-in="ed-date" value="${t.date}">
    <p class="small-note">${adding ? 'Tự lấy ngày hôm nay, chạm vào để chọn ngày khác' : 'Chạm vào để đổi ngày'}</p>
    ${adding ? `<div class="photo-row" style="margin-top:10px"><div class="tile xl ${t.img ? '' : 'nopic'}" style="${t.img ? `background-image:url(${t.img})` : '--tone:#F3E4E8'}">${t.img ? '' : NOPIC + 'Chưa có ảnh'}</div>
      <div class="col"><label class="lab" style="margin-top:0">Giá tiền</label>${moneyField('ep', t.ep)}</div></div>` : ''}
    <div class="photo-btns" style="margin-top:8px"><label>${adding ? 'Chụp ảnh' : 'Chụp ảnh mới'}<input type="file" accept="image/*" capture="environment" data-dphoto="1"></label><label>Chọn từ thư viện<input type="file" accept="image/*" data-dphoto="1"></label></div>
    ${adding ? '' : `<label class="lab">Giá tiền</label>${moneyField('ep', t.ep)}`}
    <label class="lab">Size</label><div class="chips wrap">${SIZES.map(s => `<button class="chip ${t.size === s ? 'on' : ''}" data-act="ed-size" data-val="${s}">${s}</button>`).join('')}</div>
    <label class="lab">Kho</label><div class="chips wrap">${state.sources.map(s => `<button class="chip ${t.source === s ? 'on' : ''}" data-act="ed-source" data-val="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <label class="lab">Giá nhập</label>${moneyField('ec', t.ec)}
    <label class="lab">Ghi chú váy</label><textarea class="field" data-in="ed-note" placeholder="Những gì trước đây bạn ghi lên ảnh">${esc(t.note)}</textarea>
    <button class="btn" style="margin-top:16px" data-act="save-dress">${adding ? 'Lưu váy' : 'Lưu'}</button>
    ${adding ? '' : '<button class="btn ghost" style="margin-top:8px" data-act="del-dress-order">Xoá váy này khỏi đơn</button>'}`);
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
  v.innerHTML = `<div class="vw-top"><b>${esc(c.name + lanTag(o))} · váy ${i + 1}/${n}</b><button class="vw-close" data-act="viewer-close" aria-label="Đóng">×</button></div>
    <div class="vw-stage">
      ${n > 1 ? `<button class="vw-arrow l" data-act="viewer-nav" data-val="-1" aria-label="Váy trước">‹</button><button class="vw-arrow r" data-act="viewer-nav" data-val="1" aria-label="Váy sau">›</button>` : ''}
      ${big ? `<img class="vw-photo" src="${big}" alt="">` : `<div class="vw-img nopic" style="background:${d.tone}">Chưa có ảnh</div>`}
    </div>
    <div class="vw-cap"><b>${money(d.price)}</b><span>${esc(d.size || 'chưa có size')} · ${esc(d.source || 'chưa có kho')} · ${STATUS[d.status]}</span>${dressDay(d, o) ? `<span class="vw-day">Ngày ${dm(dressDay(d, o))}${addedLater(d, o) ? ' · thêm sau đơn đặt ' + dm(o.date) : ''}</span>` : ''}${d.note ? `<span class="dnote">${esc(d.note)}</span>` : ''}
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
  return { today: WEEKDAYS[TODAY.getDay()] + ', ' + dm(TODAY), calendar: in7 + ' việc trong 7 ngày', orders: state.groups.length + ' đơn · ' + state.groups.filter(g => groupOwed(g) > 0).length + ' chưa thu đủ',
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
  if (v.v !== 'order') state.dsnap = null;                          // rời đơn: lần sau mở lại xếp theo trạng thái mới
  $('#view').innerHTML = map[v.v](v);
  $('#fab').style.display = v.v === 'new' || (state.dsnap && state.dsnap.sel) ? 'none' : 'grid';
  if (topView().v === 'orders') renderOrderList();
  if (topView().v === 'customers') renderCustomerList();
  if (topView().v === 'stock') renderStockGrid();
  if (topView().v === 'new') { renderCustomerSuggest(); renderDressForms(); }
  // Mở Cài đặt lần đầu: hỏi máy chủ phiên bản Code.gs để hiện ở cuối trang
  if (topView().v === 'settings' && Api.ready() && !state.serverVersion)
    Api.get('ping').then(r => { state.serverVersion = r.version || '?'; if (topView().v === 'settings') render(true); }).catch(() => {});
  $('#app').scrollTop = keepScroll ? y : 0;
  if (!keepScroll) enterScreen(topView().v);
  navDir = 'tab';
}
const push = v => { navDir = 'push'; state.stack.push(v); render(); };

/* ---------- Hiệu ứng (tự chạy tắt nếu máy bật "giảm chuyển động") ---------- */
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
function enterScreen(viewName) {
  if (REDUCE) return;
  const shift = navDir === 'tab' ? 0 : navDir === 'back' ? -16 : 16;
  // Từng khối chạy cùng lúc; bỏ qua thanh đáy cố định (đặt hiệu ứng lên cha sẽ làm thanh đáy nhảy)
  [...$('#view').children].filter(el => !el.classList.contains('savebar')).forEach(el =>
    el.animate([{ opacity: 0, transform: `translateX(${shift}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }));
  if (viewName === 'today') countUp($('#owed-num'));
}
function countUp(el) {
  if (!el || REDUCE) return;
  const end = +el.dataset.val, t0 = performance.now();
  const step = t => { const p = Math.min(1, (t - t0) / 800), e = 1 - Math.pow(1 - p, 3); el.textContent = money(end * e); if (p < 1) requestAnimationFrame(step); else el.textContent = money(end); };
  requestAnimationFrame(step);
}
function popMoon(id, i) { if (REDUCE) return; const m = document.querySelector(`[data-act="cycle"][data-id="${id}"][data-i="${i}"] .moon`); if (m) m.classList.add('pop'); }
// Gợn sóng khi chạm
document.addEventListener('pointerdown', e => {
  const host = e.target.closest('.btn,.chip,.row,.due,.kv,.moonbtn,.linkbtn,.mi,.fbtn,.opt,.wd,.cd,.sc,.pick,.names button');
  if (!host) return;
  const r = host.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2, w = document.createElement('span');
  w.className = 'ripple'; w.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  host.appendChild(w); setTimeout(() => w.remove(), 650);
});
/* ---------- Giữ cửa sổ đứng yên trên điện thoại (nhất là khi cài app ra màn hình chính) ---------- */
// Bàn phím hiện lên: đặt bảng trượt ngay trên bàn phím, thay vì để iPhone đẩy cả màn đi
if (window.visualViewport) {
  const vv = window.visualViewport, fit = () => {
    document.documentElement.style.setProperty('--kb', Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + 'px');
    document.documentElement.style.setProperty('--vvh', vv.height + 'px');
  };
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
}
// Đang gõ chữ trong vùng sel?
const typingIn = sel => { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest(sel)); };
// Tắt bàn phím xong: kéo trang về đúng chỗ (iPhone hay để lệch), rồi vẽ lại màn nếu đã hoãn trong lúc gõ
document.addEventListener('focusout', () => setTimeout(() => {
  if (typingIn('body')) return;
  if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
  if (state.renderLater) { state.renderLater = false; if (!sheetOpen() && topView().v !== 'new') render(true); }
}, 80));

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
      case 'new-order': closeMenu(); startDraft(null); break;
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
        const latest = state.orders.slice().sort((a, b) => cmpDate(a.date, b.date, -1))[0];
        state.tmp = { oid: id || latest.id, lock: !!id, kind: 'Thử váy', date: el.dataset.iso || toIso(TODAY), note: '' }; sheetAppt(); break; }
      case 'ap-kind': state.tmp.kind = val; sheetAppt(); break;
      case 'edit-appt': { const o = state.orders.find(x => x.appts.some(a => a.id === el.dataset.aid)), a = o.appts.find(x => x.id === el.dataset.aid);
        state.tmp = { oid: o.id, aid: a.id, lock: true, kind: a.kind, date: toIso(a.date), note: a.note }; sheetAppt(); break; }
      case 'save-appt': { const t = state.tmp; if (!t.date) { toast('Chọn ngày'); break; }
        if (t.aid) await upd('LichHen', t.aid, { ngay: t.date, loai: t.kind, ghiChu: t.note.trim() });
        else await save('LichHen', { id: uid('lh'), donHangId: t.oid, ngay: t.date, loai: t.kind, ghiChu: t.note.trim() });
        closeSheet(); await commit(true, t.aid ? 'Đã lưu lịch hẹn' : 'Đã thêm lịch hẹn'); break; }
      case 'del-appt': if (confirm('Xoá lịch hẹn này?')) { await remove('LichHen', el.dataset.aid); closeSheet(); await commit(true, 'Đã xoá lịch hẹn'); } break;

      /* Chi tiết đơn */
      case 'cycle': { const o = order(), dr = o.dresses[i]; await upd('ChiTietDon', dr.id, { trangThai: STATUS[(dr.status + 1) % 3] }); await commit(true); popMoon(o.id, i); break; }
      case 'view-img': openViewer(order().id, i); break;
      case 'viewer-close': closeViewer(); break;
      case 'viewer-nav': viewerNav(+val); break;
      case 'edit-dress': { const o = order(), dr = o.dresses[i], day = dressDay(dr, o);
        state.tmp = { oid: o.id, did: dr.id, i, ep: dr.price, ec: dr.cost || 0, size: dr.size, source: dr.source, note: dr.note, date: day ? toIso(day) : '' }; sheetDress(); break; }
      case 'ed-size': state.tmp.size = val; sheetDress(); break;
      case 'ed-source': state.tmp.source = val; sheetDress(); break;
      case 'save-dress': { const t = state.tmp;
        if (!t.did) {                                               // thêm váy mới vào đơn có sẵn
          if (!t.ep) { toast('Nhập giá tiền'); break; }
          const o = orderById(t.oid), id = uid('ct');
          await save('ChiTietDon', { id, donHangId: o.id, thuTu: o.dresses.length + 1, giaTien: t.ep, giaNhap: t.ec || '', size: t.size, kho: t.source, anhId: '',
            ghiChuVay: (t.note || '').trim(), trangThai: 'Đặt', hangHoaId: '', noteGoc: '', ngayThem: t.date || toIso(TODAY) });
          if (t.file) await attachImage('ChiTietDon', id, t.file);
          closeSheet(); await commit(true, 'Đã thêm váy'); break;
        }
        await upd('ChiTietDon', t.did, { giaTien: t.ep, giaNhap: t.ec || '', size: t.size, kho: t.source, ghiChuVay: (t.note || '').trim(), ngayThem: t.date || '' });
        closeSheet(); await commit(true, 'Đã lưu váy'); break; }
      case 'del-dress-order': if (confirm('Xoá váy này khỏi đơn?')) { await remove('ChiTietDon', state.tmp.did); await Store.imageDel(state.tmp.did); closeSheet(); await commit(true, 'Đã xoá váy'); } break;
      case 'add-dress-to-order': { const o = order(), last = o.dresses[o.dresses.length - 1];   // mở bảng Thêm váy, ngày tự lấy hôm nay
        state.tmp = { oid: o.id, did: null, i: o.dresses.length, ep: 0, ec: 0, size: last ? last.size : '', source: last ? last.source : '', note: '', date: toIso(TODAY), file: null, img: null };
        sheetDress(); break; }
      case 'add-pay': state.tmp = { oid: order().id, pay: 0, payDate: toIso(TODAY) }; sheetPay(); break;
      case 'edit-pay': { const o = orderById(id), p = o.pays.find(x => x.id === el.dataset.pid);
        state.tmp = { oid: o.id, pid: p.id, pay: p.amount, payDate: toIso(p.date), kind: p.kind }; sheetPay(); break; }
      case 'pay-kind': state.tmp.kind = val; sheetPay(); break;
      case 'pay-rest': { const v = orderOwed(orderById(state.tmp.oid)); state.tmp.pay = v; document.querySelector('[data-k="pay"]').value = Math.round(v / 1000); setMoney('pay', v); break; }
      case 'save-pay': { const o = orderById(state.tmp.oid), amt = state.tmp.pay || 0;
        if (!amt) { toast('Nhập số tiền'); break; }
        if (state.tmp.pid) { await upd('ThanhToan', state.tmp.pid, { soTien: amt, ngay: state.tmp.payDate || toIso(TODAY), loai: state.tmp.kind }); closeSheet(); await commit(true, 'Đã lưu thanh toán'); break; }
        await save('ThanhToan', { id: uid('tt'), donHangId: o.id, ngay: state.tmp.payDate || toIso(TODAY), soTien: amt, loai: amt >= orderOwed(o) ? 'Thanh toán đủ' : (o.pays.length ? 'Thanh toán' : 'Cọc') });
        closeSheet(); await commit(true, 'Đã thêm thanh toán'); break; }
      case 'del-pay': if (confirm('Xoá khoản thanh toán này?')) { await remove('ThanhToan', el.dataset.pid); closeSheet(); await commit(true, 'Đã xoá'); } break;
      /* Lần đặt: sửa ngày / hạn / ghi chú, tách, xoá; đơn: thêm lần, gộp, xoá */
      case 'edit-lan': { const o = order(); state.tmp = { oid: o.id, date: o.date ? toIso(o.date) : '', due: o.due ? toIso(o.due) : '', note: o.note }; sheetLan(); break; }
      case 'lan-clear-due': state.tmp.due = ''; sheetLan(); break;
      case 'save-lan': { const t = state.tmp, o = orderById(t.oid), ch = { ngayDat: t.date || '', hanGiao: t.due || '' };
        if (groupById(o.gid).lans.length > 1) ch.note = (t.note || '').trim();
        await upd('DonHang', t.oid, ch); closeSheet(); await commit(true, 'Đã lưu'); break; }
      case 'split-lan': { const o = orderById(state.tmp.oid); if (!confirm(`Tách lần ${o.lanNo} ra thành đơn riêng?`)) break;
        await splitLan(o); closeSheet(); state.stack[state.stack.length - 1] = { v: 'order', id: o.id }; await commit(true, 'Đã tách thành đơn riêng'); break; }
      case 'del-lan': { const o = orderById(state.tmp.oid); if (!confirm(`Xoá lần ${o.lanNo} (${o.dresses.length} váy)? Dữ liệu vẫn còn trên Sheets với dấu đã xoá.`)) break;
        const g = groupById(o.gid);
        if (o.id === g.id) await splitLan(o);                  // lần mang mã đơn chung: chuyển mã cho các lần còn lại trước
        const keep = g.lans.find(x => x.id !== o.id);
        await removeLan(o); closeSheet(); state.stack[state.stack.length - 1] = { v: 'order', id: keep.id }; await commit(true, 'Đã xoá lần đặt'); break; }
      case 'merge-dups': { const d = duplicateCustomers();
        if (!confirm('Gộp ' + d.map(x => x[0].name + ' (' + x.length + ')').join(', ') + '? Đơn của các bản trùng sẽ chuyển về một khách.')) break;
        for (const set of d) {
          const keep = set.slice().sort((a, b) => groupsOf(b).length - groupsOf(a).length || (a.id < b.id ? -1 : 1))[0];
          for (const c of set.filter(x => x.id !== keep.id)) {
            for (const o of state.orders.filter(x => x.cid === c.id)) await upd('DonHang', o.id, { khachId: keep.id });
            const fill = {};
            if (!keep.phone && c.phone) fill.sdt = c.phone;
            if (!keep.note && c.note) fill.ghiChu = c.note;
            [['type', 'loaiKhach'], ['address', 'diaChi'], ['link', 'lienKet'], ['ship', 'guiQua']].forEach(([k, col]) => { if (!keep[k] && c[k]) { fill[col] = c[k]; keep[k] = c[k]; } });
            if (Object.keys(fill).length) { await upd('KhachHang', keep.id, fill); Object.assign(keep, { phone: fill.sdt || keep.phone, note: fill.ghiChu || keep.note }); }
            await remove('KhachHang', c.id);
          }
        }
        await commit(true, 'Đã gộp khách trùng tên'); break; }
      case 'add-lan': startDraft(groupById(id)); break;
      case 'new-order-for': startDraft(null, state.customers.find(x => x.id === id)); break;
      case 'merge-open': sheetMerge(groupById(id)); break;
      case 'dview-open': sheetDview(groupById(id)); break;
      case 'dview': closeSheet(); state.dsnap.mode = val === 'need' || val === 'input' ? val : +val; render(true); break;
      case 'disc': { const on = el.closest('.disc').classList.toggle('open'); el.setAttribute('aria-expanded', on); DISC[val] = on;
        try { localStorage.setItem('mh_disc', JSON.stringify(DISC)); } catch (err) {} break; }         // không lưu được thì lần sau về mặc định, không sao
      case 'more': { const box = el.previousElementSibling; box.hidden = !box.hidden; el.textContent = box.hidden ? val : 'Thu gọn'; break; }
      case 'done-toggle': { const s = state.dsnap.open; s.has(id) ? s.delete(id) : s.add(id); render(true); break; }
      case 'sel-start': state.dsnap.sel = new Set(); render(true); break;
      case 'sel-cancel': state.dsnap.sel = null; render(true); break;
      case 'sel-toggle': { const s = state.dsnap.sel, did = el.dataset.did; s.has(did) ? s.delete(did) : s.add(did); render(true); break; }
      case 'sel-all': document.querySelectorAll('[data-act="sel-toggle"][data-did]').forEach(b => state.dsnap.sel.add(b.dataset.did)); render(true); break;
      case 'sel-set': { const s = state.dsnap, k = +val, all = state.orders.flatMap(o => o.dresses); let n = 0;
        for (const did of s.sel) { const d = all.find(x => x.id === did); if (d && d.status !== k) { await upd('ChiTietDon', did, { trangThai: STATUS[k] }); n++; } s.st[did] = k; }   // đổi loạt thì xếp lại ngay
        s.sel = null; await commit(true, n ? `Đã chuyển ${n} váy sang ${STATUS[k]}` : 'Các váy đã chọn vốn ở trạng thái này'); break; }
      case 'change-cust': state.tmp = { gid: id, q: '' }; sheetChangeCustomer(); break;
      case 'change-cust-to': { const g = groupById(state.tmp.gid), c = state.customers.find(x => x.id === id);
        if (!confirm(`Chuyển đơn này (${g.lans.length > 1 ? g.lans.length + ' lần, ' : ''}${groupDresses(g).length} váy) từ ${customerOf(g).name} sang ${c.name}?`)) break;
        for (const o of g.lans) await upd('DonHang', o.id, { khachId: c.id });
        closeSheet(); await commit(true, 'Đã chuyển đơn sang ' + c.name); break; }
      case 'merge-into': { const g = groupById(id), target = groupById(val);
        for (const o of g.lans) await upd('DonHang', o.id, { donChungId: target.id });
        closeSheet(); state.stack[state.stack.length - 1] = { v: 'order', id: target.id }; await commit(true, 'Đã gộp đơn'); break; }
      case 'del-order': { const g = groupById(id || cur.id), n = groupDresses(g).length;
        if (!confirm(`Xoá đơn của ${customerOf(g).name} (${g.lans.length > 1 ? g.lans.length + ' lần, ' : ''}${n} váy)? Dữ liệu vẫn còn trên Sheets với dấu đã xoá.`)) break;
        for (const o of g.lans) await removeLan(o);
        navDir = 'back'; state.stack.pop(); await commit(false, 'Đã xoá đơn'); break; }

      /* Khách */
      case 'add-customer': state.tmp = blankCustomer(); sheetCustomer(); break;
      case 'edit-customer': { const c = state.customers.find(x => x.id === id);
        state.tmp = { cid: c.id, name: c.name, channel: c.channel, phone: c.phone, note: c.note, type: c.type, address: c.address, link: c.link, ship: c.ship }; sheetCustomer(); break; }
      case 'cu-channel': state.tmp.channel = val; sheetCustomer(); break;
      case 'cu-type': state.tmp.type = state.tmp.type === val ? '' : val; sheetCustomer(); break;       // chạm lần nữa để bỏ chọn
      case 'ctype-open': sheetCtype(); break;
      case 'cust-type': state.filter.ctype = val; closeSheet(); render(true); break;
      case 'save-customer': { const t = state.tmp; if (!t.name.trim()) { toast('Nhập tên'); break; }
        if (sameNameCustomer(t.name, t.cid)) { toast('Đã có khách khác tên “' + t.name.trim() + '”, thêm chữ để phân biệt'); break; }
        const rec = { ten: t.name.trim(), kenh: t.channel, sdt: t.phone.trim(), ghiChu: t.note.trim(), loaiKhach: t.type, diaChi: t.address.trim(), lienKet: t.link.trim(), guiQua: t.ship.trim() };
        closeSheet();
        if (t.cid) { await upd('KhachHang', t.cid, rec); await commit(true, 'Đã lưu khách'); break; }
        const cid = uid('kh'); await save('KhachHang', Object.assign({ id: cid }, rec));
        navDir = 'push'; state.stack.push({ v: 'customer', id: cid }); await commit(false, 'Đã thêm khách'); break; }
      case 'del-customer': { const c = state.customers.find(x => x.id === state.tmp.cid), n = groupsOf(c).length;
        if (n) { alert(`${c.name} còn ${n} đơn nên chưa xoá được. Xoá hết đơn của khách trước (hoặc dùng "Đổi khách" để chuyển đơn đi), rồi mới xoá khách.`); break; }
        if (!confirm(`Xoá khách ${c.name}? Dòng vẫn còn trên Sheets với dấu đã xoá.`)) break;
        await remove('KhachHang', c.id); closeSheet();
        if (topView().v === 'customer') { navDir = 'back'; state.stack.pop(); }
        await commit(false, 'Đã xoá khách'); break; }

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
        d.openDress = d.dresses.indexOf(dr);
        closeSheet(); renderDressForms(); toast('Đã đưa hàng sẵn vào đơn'); break; }

      /* Thêm đơn */
      case 'pick-customer': { const c = state.customers.find(x => x.id === id); d.cid = c.id; d.name = c.name; d.channel = c.channel;
        d.target = null;                                   // mặc định tạo đơn mới riêng; muốn gộp thì chọn trong "Hoặc thêm vào đơn đang mở"
        render(true); break; }
      case 'draft-target': d.target = val || null; render(true); break;
      case 'pay-60': { const v = Math.round(draftTotal() * 0.6 / 1000) * 1000; if (!v) { toast('Nhập giá váy trước'); break; }
        d.deposit = v; document.querySelector('[data-k="dep"]').value = v / 1000; setMoney('dep', v); break; }
      case 'draft-channel': d.channel = val; renderCustomerSuggest(); break;
      case 'draft-size': d.dresses[i].size = val; renderDressForms(); break;
      case 'draft-source': d.dresses[i].source = val; renderDressForms(); break;
      case 'dress-open': d.openDress = i; renderDressForms();
        if (i >= 0) setTimeout(() => { const f = $('.dform'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 0); break;
      case 'add-dress': d.dresses.push(newDress(d.dresses[d.dresses.length - 1])); d.openDress = d.dresses.length - 1; renderDressForms();
        setTimeout(() => { const f = $$('.dform'); f[f.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 0); break;
      case 'del-dress': d.dresses.splice(i, 1); d.openDress = Math.max(0, i - 1); renderDressForms(); break;
      case 'pay-full': { const total = d.dresses.reduce((s, x) => s + x.price, 0); d.deposit = total; document.querySelector('[data-k="dep"]').value = Math.round(total / 1000); setMoney('dep', total); break; }
      case 'save-order': await saveDraft(); break;

      /* Cài đặt */
      case 'cfg-save': { const t = state.tmp.cfg; if (!t.url || !t.key) { toast('Nhập cả URL và mã bí mật'); break; }
        Api.save(t.url, t.key); toast('Đang kiểm tra…');
        try { const r = await Api.get('ping'); state.serverVersion = r.version || ''; toast('Kết nối OK: ' + r.sheet + ' · Apps Script ' + r.version); Sync.error = ''; await Sync.run(!(await Store.metaGet('lastSync'))); await loadModel(); render(true); }
        catch (err) { toast('Không kết nối được: ' + err.message); render(true); } break; }
      case 'resync': { if (!Api.ready()) { toast('Chưa có URL và mã'); break; }
        if (!confirm('Tải lại toàn bộ từ Sheets? Thay đổi đang chờ sẽ được gửi trước.')) break;
        toast('Đang gửi thay đổi chờ…');
        try { await Sync.pushData(); } catch (err) { toast('Không gửi được: ' + err.message); break; }
        toast('Đang tải lại…');                                   // tải xong mới thay bản trong máy; lỗi thì giữ nguyên
        if (await Sync.run(true, true)) { await loadModel(); render(true); toast('Đã tải lại từ Sheets'); } else { render(true); toast('Không tải được, dữ liệu trong máy giữ nguyên. ' + Sync.error); } break; }
      case 'add-source-open': openSheet(`<h3>Thêm kho</h3><label class="lab">Tên kho</label><input class="field" id="new-source" placeholder="Ví dụ: Chị Hằng" autocomplete="off">
          <button class="btn" style="margin-top:16px" data-act="add-source">Thêm kho</button>`); break;
      case 'add-source': { const v = $('#new-source').value.trim(); if (!v) break; if (state.sources.some(s => norm(s) === norm(v))) { toast('Đã có kho này'); break; }
        await save('Nguon', { id: uid('ng'), ten: v, thuTu: state.sourceRecs.length + 1 }); closeSheet(); await commit(true, 'Đã thêm kho'); break; }
      case 'del-source': if (confirm('Xoá kho này khỏi danh sách? Váy đã ghi kho này vẫn giữ tên.')) { await remove('Nguon', id); await commit(true); } break;
      case 'rename-source': { const r = state.sourceRecs.find(x => x.id === id); state.tmp = { srcId: id };
        openSheet(`<h3>Đổi tên kho</h3><label class="lab">Tên mới</label><input class="field" id="src-name" value="${esc(r.ten)}" autocomplete="off">
          <p class="small-note">Váy trong đơn và hàng sẵn đang ghi tên cũ sẽ đổi theo.</p><button class="btn" style="margin-top:16px" data-act="save-source">Lưu</button>`); break; }
      case 'save-source': { const r = state.sourceRecs.find(x => x.id === state.tmp.srcId), old = r.ten, v = $('#src-name').value.trim();
        if (!v || v === old) { closeSheet(); break; }
        if (state.sources.some(s => s !== old && norm(s) === norm(v))) { toast('Đã có kho tên này'); break; }
        const drs = state.orders.flatMap(o => o.dresses).filter(d => d.source === old), sts = state.stock.filter(s => s.source === old);
        if (drs.length + sts.length && !confirm(`Đổi "${old}" thành "${v}"? ${drs.length} váy trong đơn và ${sts.length} hàng sẵn đang ghi kho này cũng đổi theo.`)) break;
        await upd('Nguon', r.id, { ten: v });
        for (const d of drs) await upd('ChiTietDon', d.id, { kho: v });
        for (const s of sts) await upd('HangHoa', s.id, { kho: v });
        if (state.filter.source === old) state.filter.source = v;
        if (state.sfilter.source === old) state.sfilter.source = v;
        closeSheet(); await commit(true, 'Đã đổi tên kho'); break; }
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
  else if (t.id === 'cust-q') { const d = state.draft; d.name = t.value; d.cid = null; d.target = null; renderCustomerSuggest(); refreshDraftSummary(); }
  else if (inn === 'order-note') { const id = t.dataset.id, v = t.value; debounced('note' + id, async () => { await upd('DonHang', id, { note: v.trim() }); const o = orderById(id); if (o) o.note = v; Sync.schedule(); }); }
  else if (inn === 'draft-note') state.draft.note = t.value;
  else if (inn === 'draft-dnote') state.draft.dresses[+t.dataset.i].note = t.value;
  else if (inn === 'draft-due') state.draft.due = t.value;
  else if (inn === 'draft-date') state.draft.date = t.value;
  else if (inn === 'ed-note') state.tmp.note = t.value;
  else if (inn === 'ss-note') state.tmp.note = t.value;
  else if (inn === 'ap-date') state.tmp.date = t.value;
  else if (inn === 'ap-note') state.tmp.note = t.value;
  else if (inn === 'ap-oid') state.tmp.oid = t.value;
  else if (inn === 'pay-date') state.tmp.payDate = t.value;
  else if (inn === 'cu-name') state.tmp.name = t.value;
  else if (inn === 'cu-phone') state.tmp.phone = t.value;
  else if (inn === 'cu-note') state.tmp.note = t.value;
  else if (inn === 'cu-address') state.tmp.address = t.value;
  else if (inn === 'cu-link') state.tmp.link = t.value;
  else if (inn === 'cu-ship') state.tmp.ship = t.value;
  else if (inn === 'cc-q') { state.tmp.q = t.value; $('#cc-list').innerHTML = changeCustomerRows(); }
  else if (inn === 'cfg-url') state.tmp.cfg.url = t.value;
  else if (inn === 'cfg-key') state.tmp.cfg.key = t.value;
  else if (inn === 'lan-date') state.tmp.date = t.value;
  else if (inn === 'ed-date') state.tmp.date = t.value;
  else if (inn === 'lan-due') state.tmp.due = t.value;
  else if (inn === 'lan-note') state.tmp.note = t.value;
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
    } else if (t.dataset.dphoto && !state.tmp.did) {       // đang thêm váy mới: giữ ảnh, gắn khi bấm Lưu
      state.tmp.file = file; state.tmp.img = URL.createObjectURL(file); sheetDress();
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
    if (s.changed && !s.busy && topView().v !== 'new' && !sheetOpen()) {
      s.changed = false;
      await loadModel();
      if (typingIn('#view')) state.renderLater = true; else render(true);    // đang gõ thì chưa vẽ lại, tránh mất chữ và bàn phím tự tắt
    }
  });
  Sync.start();
  if (Api.ready()) Sync.run(!Sync.lastAt);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
