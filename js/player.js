(function (VT) {
  const { $, toast, fmt } = VT, audio = $("audio");
  let cur = null, queue = [], qi = -1, shuffle = false, repeat = false, obj = null, tok = 0;

  function setUI(t) {
    $("playerTitle").textContent = t.title; $("playerArtist").textContent = t.artist;
    $("playerCover").innerHTML = t.cover ? `<img src="${VT.esc(t.cover)}" alt="">` : "♫";
    $("duration").textContent = fmt(t.dur); updateButtons();
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, artwork: t.cover ? [{ src: t.cover }] : [] });
  }
  function updateButtons() {
    const f = cur && VT.store.has(cur.id), o = cur && VT.offline.has(cur.id);
    $("playerFavorite").textContent = f ? "♥" : "♡"; $("playerFavorite").classList.toggle("saved", !!f);
    const d = $("downloadButton"); d.textContent = o ? "✓" : "↓"; d.classList.toggle("selected", !!o);
    d.style.display = cur && (cur.download || o) ? "" : "none";
  }
  async function play(track, list) {
    if (list) { queue = list.slice(); qi = queue.findIndex(t => t.id === track.id); }
    $("player").classList.add("active"); document.body.classList.add("has-player");
    cur = track; const my = ++tok; setUI(track); VT.lyrics.load(track);
    try {
      const blob = await VT.offline.getBlob(track.id);
      let src;
      if (blob) { if (obj) URL.revokeObjectURL(obj); obj = URL.createObjectURL(blob); src = obj; }
      else src = await VT.sources.resolve(track);
      if (my !== tok) return;
      audio.src = src; await audio.play();
    } catch (e) { if (my === tok) { audio.pause(); toast(track.url || track.source === "archive" ? "Could not play this track. Try another." : "No playable audio for this track."); } }
  }
  function move(d) {
    if (!queue.length) return;
    qi = shuffle && d > 0 ? Math.floor(Math.random() * queue.length) : (qi + d + queue.length) % queue.length;
    play(queue[qi]);
  }
  $("playButton").addEventListener("click", () => { if (!cur) return toast("Choose a song first."); audio.paused ? audio.play().catch(() => {}) : audio.pause(); });
  audio.addEventListener("play", () => { $("playButton").textContent = "Ⅱ"; document.body.classList.add("playing"); });
  audio.addEventListener("pause", () => { $("playButton").textContent = "▶"; document.body.classList.remove("playing"); });
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    $("progress").value = audio.currentTime / audio.duration * 100;
    $("currentTime").textContent = fmt(audio.currentTime); $("duration").textContent = fmt(audio.duration);
    VT.lyrics.onTime(audio.currentTime);
  });
  audio.addEventListener("ended", () => repeat ? (audio.currentTime = 0, audio.play()) : move(1));
  $("progress").addEventListener("input", e => { if (audio.duration) audio.currentTime = e.target.value / 100 * audio.duration; });
  $("volume").addEventListener("input", e => audio.volume = +e.target.value);
  $("nextButton").addEventListener("click", () => move(1));
  $("previousButton").addEventListener("click", () => audio.currentTime > 3 ? audio.currentTime = 0 : move(-1));
  $("shuffleButton").addEventListener("click", () => { shuffle = !shuffle; $("shuffleButton").classList.toggle("selected", shuffle); toast(shuffle ? "Shuffle on" : "Shuffle off"); });
  $("repeatButton").addEventListener("click", () => { repeat = !repeat; $("repeatButton").classList.toggle("selected", repeat); toast(repeat ? "Repeat song on" : "Repeat off"); });
  $("lyricsButton").addEventListener("click", () => { if (!cur) toast("Play a song, then turn on lyrics."); VT.lyrics.toggle(); });
  $("lyricsClose").addEventListener("click", () => VT.lyrics.toggle(false));
  $("lyricsBody").addEventListener("click", e => { const p = e.target.closest(".lyric-line"); if (p && audio.duration) audio.currentTime = VT.lyrics.lines()[+p.dataset.i].t; });
  if ("mediaSession" in navigator) { const m = navigator.mediaSession; m.setActionHandler("play", () => audio.play()); m.setActionHandler("pause", () => audio.pause()); m.setActionHandler("nexttrack", () => move(1)); m.setActionHandler("previoustrack", () => move(-1)); }
  VT.player = { play, current: () => cur, updateButtons };
})(window.VT);
