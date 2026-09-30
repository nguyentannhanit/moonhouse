/* =====================================================================
   Kho dữ liệu trong máy (IndexedDB): mỗi tab Sheets một bảng, cộng thêm
   hàng đợi chờ gửi (outbox), ảnh chờ gửi (images) và vài giá trị lẻ (meta).
   Mọi hàm trả Promise. Mở app đọc từ đây trước, đồng bộ sau.
   ===================================================================== */
const SYNC_TABS = ['KhachHang', 'DonHang', 'ChiTietDon', 'ThanhToan', 'LichHen', 'HangHoa', 'Nguon'];

const Store = {
  db: null,

  // Mở (hoặc tạo) cơ sở dữ liệu
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('moonhouse', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        SYNC_TABS.forEach(t => { if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' }); });
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { autoIncrement: true });
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onerror = () => reject(req.error);
    });
  },

  // Chạy 1 thao tác trên 1 bảng, bọc thành Promise
  _tx(store, mode, fn) {
    return this.open().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode), os = tx.objectStore(store);
      const req = fn(os);
      tx.oncomplete = () => resolve(req && req.result !== undefined ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  },
  // Lấy hết bản ghi của 1 bảng
  all(store) { return this._tx(store, 'readonly', os => os.getAll()); },
  get(store, id) { return this._tx(store, 'readonly', os => os.get(id)); },
  put(store, rec) { return this._tx(store, 'readwrite', os => os.put(rec)); },
  // Ghi nhiều bản ghi trong 1 giao dịch
  putMany(store, recs) { return this._tx(store, 'readwrite', os => { recs.forEach(r => os.put(r)); }); },
  del(store, id) { return this._tx(store, 'readwrite', os => os.delete(id)); },

  /* ---- Hàng đợi chờ gửi: {tab, rec} hoặc {kind:'image', tab, id} ---- */
  outboxAdd(item) { return this._tx('outbox', 'readwrite', os => os.add(Object.assign({ at: Date.now() }, item))); },
  // Trả [{key, item}] theo thứ tự thêm vào
  outboxAll() {
    return this.open().then(db => new Promise((resolve, reject) => {
      const out = [], req = db.transaction('outbox', 'readonly').objectStore('outbox').openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out.push({ key: c.key, item: c.value }); c.continue(); } else resolve(out); };
      req.onerror = () => reject(req.error);
    }));
  },
  outboxDel(key) { return this._tx('outbox', 'readwrite', os => os.delete(key)); },
  outboxCount() { return this._tx('outbox', 'readonly', os => os.count()); },

  /* ---- Ảnh chờ gửi: blob đã nén, khóa = id dòng váy/hàng ---- */
  imagePut(id, blob) { return this._tx('images', 'readwrite', os => os.put({ id, blob })); },
  imageGet(id) { return this._tx('images', 'readonly', os => os.get(id)).then(r => r && r.blob); },
  imageDel(id) { return this._tx('images', 'readwrite', os => os.delete(id)); },

  /* ---- Giá trị lẻ: lastSync... ---- */
  metaGet(k) { return this._tx('meta', 'readonly', os => os.get(k)).then(r => r && r.v); },
  metaSet(k, v) { return this._tx('meta', 'readwrite', os => os.put({ k, v })); },

  // Xóa sạch dữ liệu trong máy (dùng khi "Đồng bộ lại toàn bộ")
  clearData() {
    return this.open().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction([...SYNC_TABS, 'meta'], 'readwrite');
      SYNC_TABS.forEach(t => tx.objectStore(t).clear());
      tx.objectStore('meta').clear();
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    }));
  }
};
