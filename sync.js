/* =====================================================================
   Đồng bộ với Google Sheets:
   - Dữ liệu: gửi mọi thay đổi đang chờ và nhận thay đổi mới trong CÙNG MỘT lần gọi (action 'sync', Apps Script 1.5).
     Mỗi bản ghi chỉ gửi lần sửa cuối (lần sửa sau đã chứa đủ dữ liệu). Máy chủ cũ thì tự quay về cách gửi từng tab rồi tải về.
   - Ảnh: gửi ở nền sau khi dữ liệu đã lên, 2 ảnh một lượt, không bắt dữ liệu phải chờ.
   - Tự chạy khi có mạng trở lại, khi mở lại app, và mỗi 30 giây khi app đang mở.
   Giao diện đăng ký onChange() để vẽ lại trạng thái (đang gửi / đã đồng bộ / lỗi / n chờ gửi).
   ===================================================================== */
const BATCH = 300;                                    // số bản ghi tối đa mỗi lần gọi, để một lần gọi không quá nặng
const Sync = {
  busy: false, imgBusy: false, legacy: false, error: '', lastAt: '', pending: 0, changed: false, listeners: [], _ranAt: 0,
  onChange(fn) { this.listeners.push(fn); },
  async emit() {
    this.pending = await Store.outboxCount();
    this.listeners.forEach(fn => fn(this));
  },

  // Bản ghi (tab|id) còn thay đổi chờ gửi: bản trong máy mới hơn bản trên Sheets, không được ghi đè
  async _waiting() {
    return new Set((await Store.outboxAll()).filter(x => x.item.rec).map(x => x.item.tab + '|' + x.item.rec.id));
  },
  // Ghi kết quả từ Sheets vào máy; chỉ báo "có đổi" khi nội dung khác bản trong máy (bỏ qua giờ sửa)
  async apply(res, replace) {
    if (replace) await Store.clearData();
    const waiting = await this._waiting();
    let n = 0;
    for (const tab of SYNC_TABS) {
      const recs = (res.data[tab] || []).filter(r => !waiting.has(tab + '|' + r.id));
      if (!recs.length) continue;
      for (const r of recs) {
        const cur = !replace && await Store.get(tab, r.id);
        if (!cur || Object.keys(r).some(k => k !== 'updatedAt' && String(cur[k] ?? '') !== String(r[k] ?? ''))) n++;
      }
      await Store.putMany(tab, recs);
    }
    await Store.metaSet('lastSync', res.now);
    this.lastAt = res.now;
    if (n) this.changed = true;
    return n;
  },

  // Tải về (không gửi). full = lấy lại tất cả; replace = xoá bản sao trong máy rồi ghi bản mới, chỉ làm SAU KHI tải xong
  async pull(full, replace) {
    const since = full ? '' : (await Store.metaGet('lastSync')) || '';
    return this.apply(await Api.get('getChanges', { since }), replace);
  },

  // Lấy một lô thay đổi dữ liệu từ hàng đợi (bỏ ảnh): tối đa BATCH bản ghi, mỗi bản ghi giữ lần sửa cuối
  async _batch() {
    const map = {}, keys = [];
    let count = 0, more = false;
    for (const x of await Store.outboxAll()) {
      const it = x.item;
      if (it.kind === 'image') continue;
      const m = map[it.tab] = map[it.tab] || new Map();
      if (!m.has(it.rec.id)) { if (count >= BATCH) { more = true; continue; } count++; }
      m.set(it.rec.id, it.rec); keys.push(x.key);
    }
    const changes = {};
    Object.keys(map).forEach(t => { changes[t] = [...map[t].values()]; });
    return { changes, keys, count, more };
  },

  // Gửi + nhận trong một lần gọi; hàng đợi dài thì chia lô. Apps Script cũ chưa có 'sync' thì gửi từng tab rồi tải về
  async exchange(full) {
    let since = full ? '' : (await Store.metaGet('lastSync')) || '';
    for (;;) {
      if (this.legacy) { await this.pushData(); await this.pull(full); return; }
      const b = await this._batch();
      let res;
      try { res = await Api.post({ action: 'sync', changes: b.changes, since }); }
      catch (e) { if (/Không hiểu action/i.test(e.message)) { this.legacy = true; continue; } throw e; }
      for (const k of b.keys) await Store.outboxDel(k);
      await this.apply(res);
      since = res.now;
      if (!b.more) return;
    }
  },
  // Chỉ gửi dữ liệu, từng tab một (dùng cho máy chủ cũ và trước khi tải lại toàn bộ)
  async pushData() {
    for (;;) {
      const b = await this._batch();
      if (!b.count) return;
      for (const tab of Object.keys(b.changes)) await Api.post({ action: 'upsert', tab, records: b.changes[tab] });
      for (const k of b.keys) await Store.outboxDel(k);
      await this.emit();
    }
  },

  // Gửi ảnh chờ ở nền, 2 ảnh một lượt. Ảnh của dòng chưa lên Sheets thì đợi lượt sau (Apps Script cần dòng có sẵn để chèn ảnh)
  async pushImages() {
    if (this.imgBusy || !Api.ready() || !navigator.onLine) return;
    this.imgBusy = true; await this.emit();
    try {
      for (;;) {
        const waiting = await this._waiting();
        const imgs = (await Store.outboxAll()).filter(x => x.item.kind === 'image' && !waiting.has(x.item.tab + '|' + x.item.id)).slice(0, 2);
        if (!imgs.length) break;
        await Promise.all(imgs.map(async x => { await this._pushImage(x.item); await Store.outboxDel(x.key); }));
        await this.emit();
      }
    } catch (e) {
      this.error = e.message || String(e);
    } finally {
      this.imgBusy = false; await this.emit();
    }
  },
  // Gửi 1 ảnh: đọc blob → base64 → uploadImage; xong thì ghi anhId vào bản ghi trong máy và bỏ blob
  async _pushImage(it) {
    const blob = await Store.imageGet(it.id);
    if (!blob) return;                                   // ảnh đã bị dọn (ví dụ xóa váy) → bỏ qua
    const base64 = await blobToBase64(blob);
    const res = await Api.post({ action: 'uploadImage', tab: it.tab, id: it.id, name: it.id + '.jpg', mime: blob.type || 'image/jpeg', base64 });
    const rec = await Store.get(it.tab, it.id);
    if (rec) { rec.anhId = res.fileId; rec.updatedAt = res.now; await Store.put(it.tab, rec); }
    await Store.imageDel(it.id);
  },

  // Đồng bộ dữ liệu rồi đẩy ảnh ở nền; lỗi thì giữ hàng đợi, báo lên giao diện
  async run(full, replace) {
    if (!Api.ready()) { this.error = 'Chưa cài đặt kết nối'; await this.emit(); return false; }
    if (this.busy) return false;
    if (!navigator.onLine) { this.error = 'Mất mạng'; await this.emit(); return false; }
    this.busy = true; this.changed = false; this._ranAt = Date.now(); await this.emit();
    let ok = false;
    try {
      if (replace) { await this.pushData(); await this.pull(true, true); }
      else await this.exchange(full);
      this.error = ''; ok = true;
    } catch (e) {
      this.error = e.message || String(e);
    } finally {
      this.busy = false;
      await this.emit();
    }
    if (ok) this.pushImages();
    return ok;
  },
  // Gọi lại có trì hoãn ngắn (gom nhiều lần lưu liên tiếp thành 1 lần gửi)
  schedule() { clearTimeout(this._t); this._t = setTimeout(() => this.run(), 500); },
  start() {
    window.addEventListener('online', () => this.run());
    window.addEventListener('offline', () => { this.error = 'Mất mạng'; this.emit(); });
    // Mở lại app (từ nền hoặc từ màn hình chính) thì lấy ngay thay đổi mới, không đợi tới lượt 30 giây
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - this._ranAt > 5000) this.run(); });
    setInterval(() => { if (navigator.onLine && !this.busy && document.visibilityState === 'visible') this.run(); }, 30000);
  }
};

// Blob → chuỗi base64 (bỏ phần "data:...;base64,")
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
