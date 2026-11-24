(async function (VT) {
  const $ = VT.$;
  // --- intro: V draws itself, VALTUNEZ rises letter by letter, "by Okedinachi Valentine", then the app opens by itself
  const word = $("introWord");
  "VALTUNEZ".split("").forEach((ch, i) => { const s = document.createElement("span"); s.textContent = ch; s.style.animationDelay = (1.5 + i * 0.09) + "s"; word.appendChild(s); });
  let opened = false;
  function openApp() {
    if (opened) return; opened = true;
    try { sessionStorage.setItem("vt_seen", "1"); } catch {}
    $("app").classList.remove("hidden"); VT.ui.show("about");
    $("intro").classList.add("leave"); document.body.classList.remove("intro-on");
    setTimeout(() => $("intro").remove(), 1000);
  }
  let seen = false; try { seen = sessionStorage.getItem("vt_seen") === "1"; } catch {}
  $("skipIntro").addEventListener("click", openApp);
  if (seen) openApp(); else setTimeout(openApp, 5600);

  // --- the rest starts quietly in the background while the intro plays
  await VT.offline.init();
  VT.ui.buildArtists(); VT.ui.loadHome();
  if (VT.lyrics.wasOn()) VT.lyrics.toggle(true);
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});
  window.addEventListener("offline", () => VT.toast("You are offline. Your Offline library and its lyrics still work."));
})(window.VT);
