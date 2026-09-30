/* =====================================================================
   Đồng bộ với Google Sheets:
   - pull(): 1 lần gọi lấy mọi thay đổi kể từ lần cuối (hoặc tất cả), ghi vào kho trong máy.
   - push(): gửi hàng đợi chờ (upsert gộp theo tab, ảnh gửi từng cái) — gửi hỏng thì giữ lại, báo lỗi.
   - run(): push rồi pull. Tự chạy khi có mạng trở lại và mỗi 30 giây.
   Giao diện đăng ký onChange() để vẽ lại trạng thái (đang gửi / đã đồng bộ / lỗi / n chờ gửi).
   ===================================================================== */
const Sync = {
  busy: false, error: '', lastAt: '', pending: 0, changed: false, listeners: [],
  onChange(fn) { this.listeners.push(fn); },
  async emit() {
    this.pending = await Store.outboxCount();
    this.listeners.forEach(fn => fn(this));
  },

  // Kéo thay đổi từ Sheets về máy. full = true: lấy lại tất cả từ đầu.
  // replace = true: xoá bản sao trong máy rồi ghi bản mới — chỉ làm SAU KHI đã tải thành công
  async pull(full, replace) {
    const since = full ? '' : (await Store.metaGet('lastSync')) || '';
    const res = await Api.get('getChanges', { since });
    if (replace) await Store.clearData();
    let n = 0;
    for (const tab of SYNC_TABS) {
      const recs = res.data[tab] || [];
      if (recs.length) { await Store.putMany(tab, recs); n += recs.length; }
    }
    await Store.metaSet('lastSync', res.now);
    this.lastAt = res.now;
    this.changed = n > 0;
    return n;
  },

  // Gửi hàng đợi theo đúng thứ tự: các upsert liền nhau cùng tab gộp thành 1 lần gọi; ảnh gửi riêng
  async push() {
    const items = await Store.outboxAll();
    let i = 0;
    while (i < items.length) {
      const it = items[i].item;
      if (it.kind === 'image') {
        await this._pushImage(it);
        await Store.outboxDel(items[i].key);
        i++;
      } else {
        const keys = [], recs = [];
        while (i < items.length && items[i].item.kind !== 'image' && items[i].item.tab === it.tab && recs.length < 50) {
          keys.push(items[i].key); recs.push(items[i].item.rec); i++;
        }
        await Api.post({ action: 'upsert', tab: it.tab, records: recs });
        for (const k of keys) await Store.outboxDel(k);
      }
      await this.emit();
    }
  },
  // Gửi 1 ảnh đang chờ: đọc blob → base64 → uploadImage; xong thì ghi anhId vào bản ghi trong máy và bỏ blob
  async _pushImage(it) {
    const blob = await Store.imageGet(it.id);
    if (!blob) return;                                   // ảnh đã bị dọn (ví dụ xóa váy) → bỏ qua
    const base64 = await blobToBase64(blob);
    const res = await Api.post({ action: 'uploadImage', tab: it.tab, id: it.id, name: it.id + '.jpg', mime: blob.type || 'image/jpeg', base64 });
    const rec = await Store.get(it.tab, it.id);
    if (rec) { rec.anhId = res.fileId; rec.updatedAt = res.now; await Store.put(it.tab, rec); }
    await Store.imageDel(it.id);
  },

  // Push rồi pull; lỗi ở đâu dừng ở đó, giữ hàng đợi, báo lên giao diện
  async run(full, replace) {
    if (!Api.ready()) { this.error = 'Chưa cài đặt kết nối'; await this.emit(); return false; }
    if (this.busy) return false;
    if (!navigator.onLine) { this.error = 'Mất mạng'; await this.emit(); return false; }
    this.busy = true; this.changed = false; await this.emit();
    try {
      await this.push();
      await this.pull(full, replace);
      this.error = '';
      return true;
    } catch (e) {
      this.error = e.message || String(e);
      return false;
    } finally {
      this.busy = false;
      await this.emit();
    }
  },
  // Gọi lại có trì hoãn ngắn (gom nhiều lần lưu liên tiếp thành 1 lần gửi)
  schedule() { clearTimeout(this._t); this._t = setTimeout(() => this.run(), 800); },
  start() {
    window.addEventListener('online', () => this.run());
    window.addEventListener('offline', () => { this.error = 'Mất mạng'; this.emit(); });
    setInterval(() => { if (navigator.onLine && !this.busy) this.run(); }, 30000);
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
