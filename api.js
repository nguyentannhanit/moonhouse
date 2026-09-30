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
    try { json = JSON.parse(text); }
    catch (e) {
      // Google trả trang HTML: thường do Apps Script cần cấp quyền lại sau khi dán code mới, hoặc URL sai
      throw new Error(/authoriz|quyền|permission/i.test(text)
        ? 'Google chặn vì Apps Script cần cấp quyền lại: mở Sheets → menu Moon House, bấm một mục và cho phép'
        : 'Google trả về trang web thay vì dữ liệu: kiểm tra URL Web App (phải kết thúc bằng /exec) hoặc cấp quyền lại cho Apps Script');
    }
    if (!json.ok) throw new Error(json.error || 'Lỗi không rõ từ máy chủ');
    return json;
  }
};
