// Every source returns tracks in ONE shape:
// { id, source, title, artist, album, cover, url, preview, dur, download, page, license }
(function (VT) {
  const CFG = window.VT_CONFIG || {};
  const J = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); };
  const q = encodeURIComponent;
  const APP = "VALTUNEZ";

  const itunes = async (term, n = 20) => {
    const d = await J(`https://itunes.apple.com/search?term=${q(term)}&media=music&entity=song&limit=${n}&country=${CFG.COUNTRY || "us"}`);
    return (d.results || []).filter(x => x.trackId && x.trackName).map(x => ({
      id: "itunes:" + x.trackId, source: "itunes", title: x.trackName, artist: x.artistName, album: x.collectionName,
      cover: (x.artworkUrl100 || "").replace("100x100bb", "400x400bb"), url: x.previewUrl || "", preview: true,
      dur: 30, fullDur: (x.trackTimeMillis || 0) / 1000, download: null, page: x.trackViewUrl, license: "30-second preview"
    }));
  };

  const audiusMap = (x) => ({
    id: "audius:" + x.id, source: "audius", title: x.title, artist: x.user && x.user.name, album: "",
    cover: x.artwork && (x.artwork["480x480"] || x.artwork["150x150"]) || "",
    url: `https://api.audius.co/v1/tracks/${x.id}/stream?app_name=${APP}`, preview: false, dur: x.duration, fullDur: x.duration,
    download: x.is_downloadable ? `https://api.audius.co/v1/tracks/${x.id}/download?app_name=${APP}` : null,
    page: x.permalink ? "https://audius.co" + x.permalink : "", license: "Streamed from Audius"
  });
  const audius = async (term, n = 20) => ((await J(`https://api.audius.co/v1/tracks/search?query=${q(term)}&limit=${n}&app_name=${APP}`)).data || []).filter(x => x.is_streamable !== false).map(audiusMap);
  const audiusTrending = async (n = 12) => ((await J(`https://api.audius.co/v1/tracks/trending?limit=${n}&app_name=${APP}`)).data || []).map(audiusMap);

  const jamMap = (x) => ({
    id: "jamendo:" + x.id, source: "jamendo", title: x.name, artist: x.artist_name, album: x.album_name, cover: x.image || "",
    url: x.audio, preview: false, dur: x.duration, fullDur: x.duration,
    download: x.audiodownload_allowed ? x.audiodownload : null, page: x.shareurl, license: "Creative Commons (Jamendo)"
  });
  const jamendo = async (term, n = 20) => {
    if (!CFG.JAMENDO_CLIENT_ID) return [];
    const d = await J(`https://api.jamendo.com/v3.0/tracks/?client_id=${CFG.JAMENDO_CLIENT_ID}&format=json&limit=${n}&search=${q(term)}&audiodlformat=mp32&imagesize=300`);
    return (d.results || []).map(jamMap);
  };
  const jamendoPopular = async (n = 12) => {
    if (!CFG.JAMENDO_CLIENT_ID) return [];
    const d = await J(`https://api.jamendo.com/v3.0/tracks/?client_id=${CFG.JAMENDO_CLIENT_ID}&format=json&limit=${n}&order=popularity_week&audiodlformat=mp32&imagesize=300`);
    return (d.results || []).map(jamMap);
  };

  // Only open-licensed collections from the Internet Archive; the mp3 link is found when you press play.
  const archive = async (term, n = 12) => {
    const query = `(${term}) AND mediatype:audio AND (collection:opensource_audio OR collection:netlabels OR licenseurl:*creativecommons*)`;
    const d = await J(`https://archive.org/advancedsearch.php?q=${q(query)}&fl[]=identifier&fl[]=title&fl[]=creator&rows=${n}&output=json`);
    return ((d.response || {}).docs || []).map(x => ({
      id: "archive:" + x.identifier, source: "archive", title: x.title || x.identifier, artist: [].concat(x.creator || "Unknown artist")[0],
      album: "", cover: `https://archive.org/services/img/${x.identifier}`, url: "", preview: false, dur: 0, fullDur: 0,
      download: "resolve", page: `https://archive.org/details/${x.identifier}`, license: "Open licence (Internet Archive)"
    }));
  };

  async function resolve(track) { // returns a playable/downloadable URL
    if (track.url) return track.url;
    if (track.source === "archive") {
      const id = track.id.slice(8), d = await J(`https://archive.org/metadata/${id}`);
      const f = (d.files || []).find(f => /mp3/i.test(f.format || "") || /\.mp3$/i.test(f.name));
      if (!f) throw new Error("No audio file");
      track.url = `https://archive.org/download/${id}/${encodeURIComponent(f.name)}`;
      return track.url;
    }
    throw new Error("No audio");
  }

  // Deezer needs JSONP (no CORS). Gives 30-sec previews and artist photos, no key needed.
  const jsonp = (url) => new Promise((res, rej) => {
    const cb = "vt_" + Math.random().toString(36).slice(2), s = document.createElement("script");
    const done = () => { clearTimeout(t); delete window[cb]; s.remove(); };
    const t = setTimeout(() => { done(); rej(new Error("timeout")); }, 9000);
    window[cb] = (d) => { done(); res(d); }; s.onerror = () => { done(); rej(new Error("blocked")); };
    s.src = url + (url.includes("?") ? "&" : "?") + "output=jsonp&callback=" + cb; document.head.appendChild(s);
  });
  const deezer = async (term, n = 20) => ((await jsonp(`https://api.deezer.com/search?q=${q(term)}&limit=${n}`)).data || []).filter(x => x.preview).map(x => ({
    id: "deezer:" + x.id, source: "deezer", title: x.title, artist: x.artist && x.artist.name, album: x.album && x.album.title,
    cover: x.album && (x.album.cover_xl || x.album.cover_big) || "", url: x.preview, preview: true, dur: 30, fullDur: x.duration,
    download: null, page: x.link, license: "30-second preview"
  }));
  async function artistPhoto(name) {
    const k = "valtunez_pic_" + name;
    try { const c = localStorage.getItem(k); if (c) return c; } catch {}
    const d = await jsonp(`https://api.deezer.com/search/artist?q=${q(name)}&limit=1`);
    const pic = d.data && d.data[0] && (d.data[0].picture_xl || d.data[0].picture_big) || "";
    if (pic) try { localStorage.setItem(k, pic); } catch {}
    return pic;
  }

  const ALL = { itunes, deezer, audius, jamendo, archive };
  async function search(term, enabled, n = 14) {
    const names = (enabled && enabled.length ? enabled : Object.keys(ALL));
    const settled = await Promise.allSettled(names.map(k => ALL[k](term, n)));
    const lists = settled.map(s => s.status === "fulfilled" ? s.value : []);
    const out = []; // interleave so no single source floods the page
    for (let i = 0; out.length < lists.flat().length; i++) lists.forEach(l => l[i] && out.push(l[i]));
    const seen = new Set(), uniq = out.filter(t => { const k = (t.title + "|" + (t.artist || "")).toLowerCase().replace(/[^a-z0-9|]/g, ""); if (seen.has(k)) return false; seen.add(k); return true; });
    return { tracks: uniq, failed: settled.filter(s => s.status === "rejected").length };
  }
  VT.sources = { itunes, audius, jamendo, archive, audiusTrending, jamendoPopular, search, resolve, deezer, artistPhoto, hasJamendo: !!CFG.JAMENDO_CLIENT_ID };
})(window.VT);
