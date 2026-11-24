// Lyrics come from LRCLIB (free, no key, community-made, many songs are time-synced). Fallback: lyrics.ovh.
(function (VT) {
  const { $, esc } = VT;
  const q = encodeURIComponent, cache = new Map();
  let lines = [], active = -1, open = false, token = 0, shownId = null;

  function parseLRC(text) {
    const out = [];
    (text || "").split("\n").forEach(l => {
      const m = l.match(/^((?:\[\d+:\d+(?:\.\d+)?\])+)(.*)$/); if (!m) return;
      const txt = m[2].trim();
      [...m[1].matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)].forEach(t => out.push({ t: +t[1] * 60 + parseFloat(t[2]), text: txt }));
    });
    return out.sort((a, b) => a.t - b.t);
  }
  const cleanTitle = (s) => (s || "").replace(/[\(\[].*?[\)\]]/g, "").replace(/\s+-\s+.*$/, "").trim();
  const cleanArtist = (s) => (s || "").split(/\s+(?:feat\.?|ft\.?|featuring|x|&)\s+|,/i)[0].trim();
  async function J(u) { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.json(); }

  async function fetchLyrics(t) {
    if (cache.has(t.id)) return cache.get(t.id);
    if (VT.offline && VT.offline.has(t.id)) { const o = await VT.offline.getLyrics(t.id); if (o) { cache.set(t.id, o); return o; } }
    const title = cleanTitle(t.title), artist = cleanArtist(t.artist);
    let res = null;
    try {
      const d = t.fullDur ? await J(`https://lrclib.net/api/get?track_name=${q(title)}&artist_name=${q(artist)}&duration=${Math.round(t.fullDur)}`).catch(() => null) : null;
      let hit = d;
      if (!hit) { const s = await J(`https://lrclib.net/api/search?track_name=${q(title)}&artist_name=${q(artist)}`); hit = s.find(x => x.syncedLyrics) || s[0]; }
      if (hit && (hit.syncedLyrics || hit.plainLyrics)) res = { synced: parseLRC(hit.syncedLyrics), plain: hit.plainLyrics || "" };
    } catch {}
    if (!res) try { const d = await J(`https://api.lyrics.ovh/v1/${q(artist)}/${q(title)}`); if (d.lyrics) res = { synced: [], plain: d.lyrics }; } catch {}
    if (res) cache.set(t.id, res); return res;
  }

  async function load(t) {
    if (!t) return;
    $("lyricsTitle").textContent = t.title; $("lyricsArtist").textContent = t.artist;
    $("lyricsCover").innerHTML = t.cover ? `<img src="${esc(t.cover)}" alt="">` : "♫";
    if (!open || shownId === t.id) return;
    shownId = t.id; const my = ++token; lines = []; active = -1;
    $("lyricsNote").textContent = ""; $("lyricsBody").innerHTML = '<div class="lyrics-msg"><span class="loader"></span> Finding lyrics…</div>';
    const r = await fetchLyrics(t);
    if (my !== token) return;
    if (!r) { $("lyricsBody").innerHTML = '<div class="lyrics-msg">' + (navigator.onLine ? 'No lyrics found for this song yet.' : 'You are offline. Lyrics are kept offline only for songs saved while online.') + '</div>'; return; }
    const sync = r.synced.length && !t.preview; // a 30s preview is a clip from the middle, so timing would not match
    if (sync) {
      lines = r.synced;
      $("lyricsNote").textContent = "Synced lyrics · tap a line to jump to it";
      $("lyricsBody").innerHTML = lines.map((l, i) => `<p class="lyric-line" data-i="${i}">${esc(l.text) || "♪"}</p>`).join("");
    } else {
      $("lyricsNote").textContent = t.preview ? "Preview clip: full lyrics shown, not synced" : "Lyrics (not time-synced for this song)";
      const txt = r.plain || r.synced.map(l => l.text).join("\n");
      $("lyricsBody").innerHTML = txt.split("\n").map(l => `<p class="lyric-plain">${esc(l) || "&nbsp;"}</p>`).join("");
    }
  }
  function onTime(time) {
    if (!open || !lines.length) return;
    let i = -1; for (let k = 0; k < lines.length; k++) { if (lines[k].t <= time + 0.25) i = k; else break; }
    if (i === active) return; active = i;
    document.querySelectorAll(".lyric-line.on").forEach(e => e.classList.remove("on"));
    const el = document.querySelector(`.lyric-line[data-i="${i}"]`);
    if (el) { el.classList.add("on"); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
  }
  function toggle(force) {
    open = typeof force === "boolean" ? force : !open;
    $("lyricsPanel").classList.toggle("open", open); $("lyricsPanel").setAttribute("aria-hidden", String(!open));
    $("lyricsButton").classList.toggle("selected", open);
    try { localStorage.setItem("valtunez_lyrics_on", open ? "1" : "0"); } catch {}
    if (open) { shownId = null; load(VT.player && VT.player.current()); }
  }
  VT.lyrics = { fetch: fetchLyrics, lines: () => lines, load, onTime, toggle, parseLRC, wasOn: () => { try { return localStorage.getItem("valtunez_lyrics_on") === "1"; } catch { return false; } } };
})(window.VT);
