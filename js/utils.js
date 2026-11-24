window.VT = window.VT || {};
(function (VT) {
  VT.$ = (id) => document.getElementById(id);
  VT.esc = (v = "") => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  VT.fmt = (s) => Number.isFinite(s) ? Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0") : "0:00";
  VT.toast = (msg) => { const el = VT.$("toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(VT.toast.t); VT.toast.t = setTimeout(() => el.classList.remove("show"), 2600); };
  VT.known = new Map(); // id -> track, for every track shown on screen

  // Favourites (migrates the old v1 format automatically)
  const KEY = "valtunez_favorites_v2", OLD = "valtunez_favorites_v1";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null") || migrate(); } catch { return []; } };
  function migrate() {
    try {
      const old = JSON.parse(localStorage.getItem(OLD) || "[]").map(t => ({
        id: "itunes:" + t.trackId, source: "itunes", title: t.trackName, artist: t.artistName, album: t.collectionName,
        cover: (t.artworkUrl100 || "").replace("100x100bb", "400x400bb"), url: t.previewUrl, preview: true, dur: 30, page: t.trackViewUrl
      }));
      localStorage.setItem(KEY, JSON.stringify(old)); return old;
    } catch { return []; }
  }
  VT.store = {
    all: read,
    has: (id) => read().some(t => t.id === id),
    toggle(track) {
      const list = read(), ex = list.some(t => t.id === track.id);
      localStorage.setItem(KEY, JSON.stringify(ex ? list.filter(t => t.id !== track.id) : [track, ...list]));
      return !ex;
    }
  };
})(window.VT);
