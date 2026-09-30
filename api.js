/* =====================================================================
   Gọi Apps Script Web App. URL và mã bí mật lấy từ màn Cài đặt (localStorage).
   GET cho ping/getChanges; POST cho upsert/uploadImage.
   POST gửi body là chuỗi JSON KHÔNG đặt Content-Type (trình duyệt coi là text/plain)
   — vì Apps Script không trả lời được câu hỏi "preflight" của trình duyệt nếu đặt application/json.
   ===================================================================== */
const Api = {
  cfg() { return { url: localStorage.getItem('mh_url') || '', key: localStorage.getItem('mh_key') || '' }; },
  save(url, key) { localStorage.setItem('mh_url', url.trim()); localStorage.setItem('mh_key', key.trim()); },
  ready() { const c = this.cfg(); return !!(c.url && c.key); },

  async get(action, params) {
    const c = this.cfg();
    const q = new URLSearchParams(Object.assign({ action, key: c.key }, params || {}));
    return this._call(c.url + '?' + q.toString(), { method: 'GET' });
  },
  async post(body) {
    const c = this.cfg();
    return this._call(c.url, { method: 'POST', body: JSON.stringify(Object.assign({ key: c.key }, body)) });
  },
  // Gửi và đọc JSON; quá 40 giây thì bỏ; báo lỗi rõ khi máy chủ trả về không phải JSON (thường do URL sai)
  async _call(url, opts) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 40000);
    let res;
    try { res = await fetch(url, Object.assign({ redirect: 'follow', signal: ctl.signal }, opts)); }
    catch (e) { throw new Error(e.name === 'AbortError' ? 'Máy chủ không trả lời (quá 40 giây)' : 'Không kết nối được (mất mạng?)'); }
    finally { clearTimeout(timer); }
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { throw new Error('Máy chủ trả về không phải JSON — kiểm tra lại URL Web App'); }
    if (!json.ok) throw new Error(json.error || 'Lỗi không rõ từ máy chủ');
    return json;
  }
};
