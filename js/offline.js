// Offline library: full audio files are saved inside the browser (IndexedDB) and play with no internet.
(function (VT) {
  const ids = new Set();
  const db = () => new Promise((res, rej) => {
    const r = indexedDB.open("valtunez", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("songs", { keyPath: "id" });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction("songs", mode), rq = fn(t.objectStore("songs")); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); }); };

  async function init() { try { (await tx("readonly", s => s.getAllKeys())).forEach(k => ids.add(k)); } catch {} }
  async function save(track) {
    if (!track.download) throw new Error("The source does not allow downloads for this song.");
    const url = track.download === "resolve" ? await VT.sources.resolve(track) : track.download;
    const r = await fetch(url); if (!r.ok) throw new Error("Download failed (" + r.status + ")");
    const blob = await r.blob();
    const meta = { ...track, url: "", download: "resolve-offline" };
    let lyrics = null; try { lyrics = await VT.lyrics.fetch(track); } catch {}
    await tx("readwrite", s => s.put({ id: track.id, meta, blob, lyrics, saved: Date.now() }));
    ids.add(track.id);
    return !!lyrics;
  }
  const remove = async (id) => { await tx("readwrite", s => s.delete(id)); ids.delete(id); };
  const getBlob = async (id) => { if (!ids.has(id)) return null; try { const r = await tx("readonly", s => s.get(id)); return r ? r.blob : null; } catch { return null; } };
  const getLyrics = async (id) => { try { const r = await tx("readonly", s => s.get(id)); return r && r.lyrics || null; } catch { return null; } };
  const list = async () => { try { return (await tx("readonly", s => s.getAll())).sort((a, b) => b.saved - a.saved); } catch { return []; } };
  const exportFile = async (id) => {
    const r = await tx("readonly", s => s.get(id)); if (!r) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(r.blob);
    a.download = `${r.meta.artist} - ${r.meta.title}.mp3`.replace(/[\\/:*?"<>|]/g, ""); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  VT.offline = { getLyrics, init, save, remove, getBlob, list, exportFile, has: (id) => ids.has(id) };
})(window.VT);
