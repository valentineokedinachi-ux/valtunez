(function (VT) {
  const { $, esc, toast } = VT;
  const CFG = window.VT_CONFIG || {}, ARTISTS = CFG.ARTISTS || [];
  const LABEL = { itunes: "30-SEC PREVIEW", deezer: "30-SEC PREVIEW", audius: "FULL · AUDIUS", jamendo: "FULL · JAMENDO", archive: "FULL · ARCHIVE" };
  const enabled = new Set(["itunes", "deezer", "audius", "jamendo", "archive"]);
  const initials = (n) => n.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  let artistNow = "";

  /* ---------- cards ---------- */
  function cardHTML(t, i) {
    const fav = VT.store.has(t.id), off = VT.offline.has(t.id);
    const dl = (t.download || off) ? `<button class="save-track dl ${off ? "saved" : ""}" data-dl="${esc(t.id)}" title="${off ? "Remove from offline library" : "Save offline (with lyrics)"}">${off ? "✓" : "↓"}</button>` : "";
    return `<article class="track-card" style="--i:${Math.min(i, 14)}">
      <div class="cover-wrap">${t.cover ? `<img loading="lazy" src="${esc(t.cover)}" alt="${esc(t.title)} artwork" onerror="this.remove()">` : `<div class="cover-placeholder">♫</div>`}
        <button class="card-play" data-play="${esc(t.id)}" aria-label="Play ${esc(t.title)}">▶</button></div>
      <p class="track-title" title="${esc(t.title)}">${esc(t.title)}</p>
      <p class="track-artist" title="${esc(t.artist)}">${esc(t.artist)}</p>
      <div class="track-card-bottom"><span class="source-label">${off ? "SAVED OFFLINE" : LABEL[t.source] || ""}</span>
        <span>${dl}<button class="save-track ${fav ? "saved" : ""}" data-fav="${esc(t.id)}" title="Favourite">${fav ? "♥" : "♡"}</button></span></div>
    </article>`;
  }
  function render(el, tracks, empty = "Nothing here yet.") {
    tracks.forEach(t => VT.known.set(t.id, t));
    el.innerHTML = tracks.length ? tracks.map(cardHTML).join("") : `<div class="empty-state">${empty}</div>`;
    el._tracks = tracks;
  }
  function sync() { // update hearts/ticks in place so nothing flickers
    document.querySelectorAll("[data-fav]").forEach(b => { const s = VT.store.has(b.dataset.fav); b.classList.toggle("saved", s); b.textContent = s ? "♥" : "♡"; });
    document.querySelectorAll("[data-dl]").forEach(b => {
      const off = VT.offline.has(b.dataset.dl), t = VT.known.get(b.dataset.dl); b.classList.toggle("saved", off); b.textContent = off ? "✓" : "↓";
      const lab = b.closest(".track-card") && b.closest(".track-card").querySelector(".source-label"); if (lab && t) lab.textContent = off ? "SAVED OFFLINE" : LABEL[t.source] || "";
    });
    VT.player.updateButtons();
  }
  async function refreshLists() {
    render($("favoriteResults"), VT.store.all(), "Tap the ♡ on any song to keep it here.");
    const rows = await VT.offline.list();
    render($("downloadResults"), rows.map(r => r.meta), "Nothing saved yet. Tap ↓ on a song marked FULL to keep it (and its lyrics) for offline listening.");
  }
  async function toggleOffline(t) {
    try {
      if (VT.offline.has(t.id)) { await VT.offline.remove(t.id); toast("Removed from your offline library"); }
      else { toast("Saving “" + t.title + "”…"); const ly = await VT.offline.save(t); toast(ly ? "Saved offline, lyrics included ✓" : "Saved offline (no lyrics found for this one)"); }
    } catch (err) { toast(err.message || "Could not save this song."); }
    sync(); refreshLists();
  }

  /* ---------- navigation ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .1 });
  function reveal() { document.querySelectorAll(".view:not(.hidden) .rv:not(.in)").forEach((el, i) => { el.style.setProperty("--d", (i % 5) * .08 + "s"); io.observe(el); }); }
  function show(view) {
    document.querySelectorAll(".view").forEach(v => {
      const on = v.id === "view-" + view; v.classList.toggle("hidden", !on);
      if (on) { v.style.animation = "none"; void v.offsetHeight; v.style.animation = ""; }
    });
    const key = view === "artist" ? "home" : view;
    document.querySelectorAll("#navLinks button").forEach(b => b.classList.toggle("active", b.dataset.view === key));
    if (view === "favorites" || view === "downloads") refreshLists();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    reveal(); if (view === "search") $("searchInput").focus({ preventScroll: true });
  }
  window.addEventListener("scroll", () => $("nav").classList.toggle("scrolled", scrollY > 12), { passive: true });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-play],[data-fav],[data-dl],[data-view],[data-artist],[data-mood]"); if (!b) return;
    if (b.dataset.view) { e.preventDefault(); return show(b.dataset.view); }
    if (b.dataset.artist) return openArtist(b.dataset.artist);
    if (b.dataset.mood) return go(MOOD[b.dataset.mood] || b.dataset.mood);
    const id = b.dataset.play || b.dataset.fav || b.dataset.dl, t = VT.known.get(id); if (!t) return;
    if (b.dataset.play) { const g = b.closest(".track-grid"); return VT.player.play(t, (g && g._tracks) || [t]); }
    if (b.dataset.fav) { toast(VT.store.toggle(t) ? "Added to favourites" : "Removed from favourites"); sync(); if (!$("view-favorites").classList.contains("hidden")) refreshLists(); return; }
    if (b.dataset.dl) return toggleOffline(t);
  });
  $("downloadButton").addEventListener("click", () => { const c = VT.player.current(); if (c) toggleOffline(c); });
  $("playerFavorite").addEventListener("click", () => { const c = VT.player.current(); if (!c) return toast("Choose a song first."); VT.store.toggle(c); sync(); });

  /* ---------- artists ---------- */
  function buildArtists() {
    $("artistRow").innerHTML = ARTISTS.map((a, i) => `<button class="artist" data-artist="${esc(a)}" style="--i:${i}"><span class="artist-photo"><span>${initials(a)}</span><img alt="${esc(a)}"></span><b>${esc(a)}</b><small>View songs</small></button>`).join("");
    ARTISTS.forEach(async (a, i) => { try { const p = await VT.sources.artistPhoto(a); if (!p) return; const img = $("artistRow").children[i].querySelector("img"); img.onload = () => img.classList.add("ok"); img.src = p; } catch {} });
    const m = ARTISTS.map(a => `<span>${esc(a)}</span><b>✦</b>`).join(""); $("marquee").innerHTML = m + m;
  }
  async function openArtist(name) {
    artistNow = name; show("artist");
    $("artistName").textContent = name; $("artistInitials").textContent = initials(name);
    const pic = $("artistPic"); pic.style.backgroundImage = ""; $("artistBg").style.backgroundImage = "";
    VT.sources.artistPhoto(name).then(p => { if (p && artistNow === name) { pic.style.backgroundImage = `url("${p}")`; $("artistBg").style.backgroundImage = `url("${p}")`; $("artistInitials").textContent = ""; } }).catch(() => {});
    const box = $("artistTracks"); box._tracks = [];
    box.innerHTML = '<div class="loading-state"><span class="loader"></span> Gathering songs by ' + esc(name) + "…</div>";
    const { tracks } = await VT.sources.search(name, [...enabled], 24);
    if (artistNow !== name) return;
    const mine = tracks.filter(t => norm(t.artist).includes(norm(name)));
    render(box, mine.length >= 3 ? mine : tracks, "No songs found for this artist right now.");
  }
  $("playAll").addEventListener("click", () => { const g = $("artistTracks"); g._tracks && g._tracks.length ? VT.player.play(g._tracks[0], g._tracks) : toast("Songs are still loading."); });

  /* ---------- search & home ---------- */
  const MOOD = { emotional: "Omah Lay emotional", afrobeats: "Afrobeats", "late night": "chill r&b", "love songs": "love songs" };
  async function runSearch(term) {
    term = term.trim(); if (!term) return;
    const box = $("searchResults");
    box.innerHTML = '<div class="loading-state"><span class="loader"></span> Searching across music sources…</div>';
    $("resultsHeading").textContent = `Results for “${term}”`;
    const { tracks, failed } = await VT.sources.search(term, [...enabled]);
    render(box, tracks, `No results for “${esc(term)}”. Try another spelling or switch more sources on.`);
    if (failed) toast(failed + " source(s) did not respond. Showing the rest.");
  }
  function go(term) { show("search"); $("searchInput").value = term; runSearch(term); }
  function loadHome() {
    const picks = [...ARTISTS].sort(() => Math.random() - .5).slice(0, 6);
    Promise.allSettled(picks.map(a => VT.sources.itunes(a, 6))).then(r => {
      const m = r.flatMap(x => x.status === "fulfilled" ? x.value : []);
      render($("recommendations"), [...new Map(m.map(t => [t.id, t])).values()].sort(() => Math.random() - .5).slice(0, 12), "No recommendations. Check your connection and refresh.");
    });
    Promise.allSettled([VT.sources.audiusTrending(8), VT.sources.jamendoPopular(8)]).then(r => render($("freeTracks"), r.flatMap(x => x.status === "fulfilled" ? x.value : []), "Free music could not load right now."));
  }
  $("searchForm").addEventListener("submit", e => { e.preventDefault(); runSearch($("searchInput").value); });
  $("refreshRecommendations").addEventListener("click", loadHome);
  document.querySelectorAll("#sourceChips .chip").forEach(c => {
    if (c.dataset.src === "jamendo" && !VT.sources.hasJamendo) { c.classList.remove("on"); c.title = "Add your free Jamendo key in config.js to switch this on"; enabled.delete("jamendo"); }
    c.addEventListener("click", () => {
      if (c.dataset.src === "jamendo" && !VT.sources.hasJamendo) return toast("Add your Jamendo key in config.js first.");
      const on = c.classList.toggle("on"); on ? enabled.add(c.dataset.src) : enabled.delete(c.dataset.src);
    });
  });
  VT.ui = { show, loadHome, buildArtists, reveal, sync, refreshLists };
})(window.VT);
