/* Verenas Countdown – Logik und Darstellung
   Zeitzone: Europe/Berlin. Start: 13.11.2026, Ziel: 30.04.2027 (letzter Arbeitstag). */
(function () {
  "use strict";

  // ---------- Konfiguration ----------
  // Bundesland von Verenas Arbeitsort (Kürzel: BW BY BE BB HB HH HE MV NI NW RP SL SN ST SH TH).
  var BUNDESLAND = "NI"; // leer = nur bundesweite Feiertage
  // Zusätzliche freie Tage (ISO "YYYY-MM-DD"), z. B. 24.12., 31.12., Urlaub, Brückentage.
  var EXTRA_FREI = [];
  // Halbe Arbeitstage (ISO "YYYY-MM-DD"): zählen als 0,5 Arbeitstag, wenn sie auf Mo–Fr fallen.
  var HALBE_TAGE = ["2026-12-24", "2026-12-31"];

  var TZ = "Europe/Berlin";
  var DAY = 86400000;
  var START = Date.UTC(2026, 10, 13); // 13.11.2026
  var END = Date.UTC(2027, 3, 30);    // 30.04.2027
  var RAW = (typeof module !== "undefined" && module.exports) ? require("./sprueche.js") : SPRUECHE_RAW;

  // ---------- Daten ----------
  var MAP = {};
  Object.keys(RAW).forEach(function (month) {
    RAW[month].forEach(function (e) {
      MAP[month + "-" + (e[0] < 10 ? "0" + e[0] : e[0])] = { text: e[1], src: e[2] || "" };
    });
  });

  function isoOf(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
  function dayIndex(ms) { return Math.round((clamp(ms, START, END) - START) / DAY); }
  function isBallDay(ms) { return dayIndex(ms) % 2 === 0; } // jeder zweite Tag, beginnend mit dem 13.11.

  function berlinToday(now) {
    var s = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
      .format(now || new Date());
    var p = s.split("-").map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  }

  function parseIso(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  }

  // Gesetzliche Feiertage je Bundesland (ohne regional begrenzte Feiertage wie Fronleichnam in Teilen SN/TH,
  // Mariä Himmelfahrt in Teilen BY, Augsburger Friedensfest).
  function easterUtc(y) { // Gauß/Meeus, gregorianisch
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mon = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(y, mon - 1, day);
  }

  function holidays(y, land) {
    var E = easterUtc(y), all = null, list = [];
    function add(ms, name, laender) { if (laender === all || laender.indexOf(land) >= 0) list.push([isoOf(ms), name]); }
    var nov22 = Date.UTC(y, 10, 22), bussTag = nov22 - ((new Date(nov22).getUTCDay() + 4) % 7) * DAY; // Mittwoch vor dem 23.11.
    add(Date.UTC(y, 0, 1), "Neujahr", all);
    add(Date.UTC(y, 0, 6), "Heilige Drei Könige", ["BW", "BY", "ST"]);
    add(Date.UTC(y, 2, 8), "Internationaler Frauentag", ["BE", "MV"]);
    add(E - 2 * DAY, "Karfreitag", all);
    add(E, "Ostersonntag", ["BB"]);
    add(E + DAY, "Ostermontag", all);
    add(Date.UTC(y, 4, 1), "Tag der Arbeit", all);
    add(E + 39 * DAY, "Christi Himmelfahrt", all);
    add(E + 49 * DAY, "Pfingstsonntag", ["BB"]);
    add(E + 50 * DAY, "Pfingstmontag", all);
    add(E + 60 * DAY, "Fronleichnam", ["BW", "BY", "HE", "NW", "RP", "SL"]);
    add(Date.UTC(y, 7, 15), "Mariä Himmelfahrt", ["SL"]);
    add(Date.UTC(y, 8, 20), "Weltkindertag", ["TH"]);
    add(Date.UTC(y, 9, 3), "Tag der Deutschen Einheit", all);
    add(Date.UTC(y, 9, 31), "Reformationstag", ["BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH"]);
    add(Date.UTC(y, 10, 1), "Allerheiligen", ["BW", "BY", "NW", "RP", "SL"]);
    add(bussTag, "Buß- und Bettag", ["SN"]);
    add(Date.UTC(y, 11, 25), "1. Weihnachtstag", all);
    add(Date.UTC(y, 11, 26), "2. Weihnachtstag", all);
    return list;
  }

  var FREI = {};
  [2026, 2027].forEach(function (y) { holidays(y, BUNDESLAND).forEach(function (h) { FREI[h[0]] = h[1]; }); });
  EXTRA_FREI.forEach(function (iso) { FREI[iso] = FREI[iso] || "frei"; });

  // Arbeitstage ab morgen bis einschließlich Ziel: Mo–Fr ohne Feiertage und ohne EXTRA_FREI; HALBE_TAGE zählen 0,5.
  function workdaysBetween(fromExclusive, toInclusive) {
    var n = 0;
    for (var t = fromExclusive + DAY; t <= toInclusive; t += DAY) {
      var d = new Date(t).getUTCDay(), iso = isoOf(t);
      if (d >= 1 && d <= 5 && !FREI[iso]) n += HALBE_TAGE.indexOf(iso) >= 0 ? 0.5 : 1;
    }
    return n;
  }

  function getState(todayMs) {
    var daysLeft = Math.round((END - todayMs) / DAY);
    var phase = todayMs < START ? "before" : daysLeft > 0 ? "during" : daysLeft === 0 ? "last" : "after";
    var progress = clamp((todayMs - START) / (END - START), 0, 1);
    return {
      phase: phase,
      daysLeft: daysLeft,
      daysToStart: Math.round((START - todayMs) / DAY),
      progress: progress,
      weeks: daysLeft > 0 ? Math.floor(daysLeft / 7) : 0,
      restDays: daysLeft > 0 ? daysLeft % 7 : 0,
      workdays: daysLeft > 0 ? workdaysBetween(todayMs, END) : 0
    };
  }

  function getSaying(ms) { return MAP[isoOf(clamp(ms, START, END))]; }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { START: START, END: END, MAP: MAP, getState: getState, getSaying: getSaying, berlinToday: berlinToday,
      isoOf: isoOf, workdaysBetween: workdaysBetween, holidays: holidays, easterUtc: easterUtc, FREI: FREI, BUNDESLAND: BUNDESLAND, isBallDay: isBallDay, dayIndex: dayIndex };
  }
  if (typeof document === "undefined") { return; }

  // ---------- Hilfen ----------
  var $ = function (id) { return document.getElementById(id); };
  var fmtLong = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  var fmtShort = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  var params = new URLSearchParams(location.search);
  var previewMs = parseIso(params.get("datum"));
  var forceFlummi = params.get("flummi") === "1";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var today, view, firstRender = true;

  var mem = {};
  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); }
    catch (e) { if (val === undefined) return mem[key] || null; mem[key] = val; }
  }
  function currentToday() { return previewMs !== null ? previewMs : berlinToday(); }

  var toastTimer;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("on"); }, 2200);
  }

  // ---------- Favoriten ----------
  var FAV_KEY = "verena.favs.v1";
  function getFavs() {
    try { return JSON.parse(store(FAV_KEY) || "[]").filter(function (k) { return MAP[k]; }); } catch (e) { return []; }
  }
  function setFavs(a) { store(FAV_KEY, JSON.stringify(a)); }
  function toggleFav(iso) {
    var f = getFavs(), i = f.indexOf(iso);
    if (i >= 0) { f.splice(i, 1); toast("Entfernt"); } else { f.push(iso); f.sort(); toast("Gemerkt ♥"); }
    setFavs(f); render(); renderFavList();
  }

  function renderFavList() {
    var box = $("favsList"), f = getFavs().slice().reverse();
    box.textContent = "";
    if (!f.length) {
      var e = document.createElement("p"); e.className = "empty";
      e.textContent = "Noch nichts gemerkt. Tippe bei einem Spruch auf „♡ Merken“.";
      box.appendChild(e); return;
    }
    f.forEach(function (iso) {
      var s = MAP[iso], ms = parseIso(iso);
      var d = document.createElement("div"); d.className = "fav";
      var h = document.createElement("p"); h.className = "d"; h.textContent = fmtShort.format(ms);
      var t = document.createElement("p"); t.className = "t"; t.textContent = s.text;
      d.appendChild(h); d.appendChild(t);
      if (s.src) { var q = document.createElement("p"); q.className = "s"; q.textContent = s.src; d.appendChild(q); }
      var row = document.createElement("div"); row.className = "row";
      var b1 = document.createElement("button"); b1.type = "button"; b1.className = "alt"; b1.textContent = "Als Bild";
      b1.addEventListener("click", function () { shareImage(ms); });
      var b2 = document.createElement("button"); b2.type = "button"; b2.textContent = "Entfernen";
      b2.addEventListener("click", function () { toggleFav(iso); });
      row.appendChild(b1); row.appendChild(b2); d.appendChild(row); box.appendChild(d);
    });
  }

  // ---------- Spruch als Bild ----------
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function wrap(g, text, maxW) {
    var words = text.split(" "), lines = [], line = "";
    words.forEach(function (w) {
      var test = line ? line + " " + w : w;
      if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else { line = test; }
    });
    if (line) lines.push(line);
    return lines;
  }
  function makeImage(ms) {
    var s = getSaying(ms), c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
    var g = c.getContext("2d"), INK = "#1b1464", FONT = '"Trebuchet MS","Arial Rounded MT Bold",Verdana,sans-serif';
    var bg = g.createLinearGradient(0, 0, 1080, 1350);
    bg.addColorStop(0, "#ff8ae2"); bg.addColorStop(0.5, "#a98bff"); bg.addColorStop(1, "#6ee7ff");
    g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = "rgba(255,255,255,.35)";
    for (var x = 0; x < 1080; x += 30) for (var y = 0; y < 1350; y += 30) { g.beginPath(); g.arc(x, y, 2.5, 0, 6.3); g.fill(); }

    var X = 70, Y = 130, W = 940, H = 900;
    g.fillStyle = INK; rrect(g, X + 16, Y + 16, W, H, 30); g.fill();
    g.fillStyle = "#fff"; rrect(g, X, Y, W, H, 30); g.fill();
    g.save(); rrect(g, X, Y, W, H, 30); g.clip();
    var tb = g.createLinearGradient(X, 0, X + W, 0); tb.addColorStop(0, "#3a2bff"); tb.addColorStop(1, "#ff3fd0");
    g.fillStyle = tb; g.fillRect(X, Y, W, 96); g.fillStyle = INK; g.fillRect(X, Y + 92, W, 8); g.restore();
    g.lineWidth = 8; g.strokeStyle = INK; rrect(g, X, Y, W, H, 30); g.stroke();
    g.fillStyle = "#fff"; g.font = "800 40px " + FONT; g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText("spruch_des_tages.txt", X + 40, Y + 48);

    g.textAlign = "center"; g.fillStyle = "#7a3cff"; g.font = "800 34px " + FONT; g.textBaseline = "alphabetic";
    g.fillText(fmtLong.format(ms).toUpperCase(), 540, Y + 180);

    g.fillStyle = INK;
    var size = 62, lines, lh, maxH = 560;
    do {
      g.font = "700 " + size + "px " + FONT; lines = wrap(g, s.text, W - 120); lh = Math.round(size * 1.36); size -= 2;
    } while (lines.length * lh > maxH && size > 30);
    var top = Y + 250 + Math.max(0, (maxH - lines.length * lh) / 2);
    lines.forEach(function (l, i) { g.fillText(l, 540, top + i * lh + size); });
    if (s.src) { g.fillStyle = "#5b52a8"; g.font = "italic 30px " + FONT; g.fillText(s.src, 540, Y + H - 50, W - 100); }

    var n = Math.round((END - ms) / DAY), label = n > 1 ? "Noch " + n + " Tage" : n === 1 ? "Noch 1 Tag" : "Heute ist es so weit!";
    g.font = "900 96px " + FONT; g.lineJoin = "round"; g.lineWidth = 16; g.strokeStyle = INK;
    g.strokeText(label, 540, 1190); g.fillStyle = "#fff"; g.fillText(label, 540, 1190);
    g.font = "800 34px " + FONT; g.fillStyle = INK; g.fillText("✦ Verenas Countdown ✦", 540, 1270);
    return c;
  }
  function shareImage(ms) {
    var c = makeImage(ms), name = "verena-spruch-" + isoOf(ms) + ".png";
    c.toBlob(function (b) {
      if (!b) { toast("Bild konnte nicht erstellt werden"); return; }
      var file; try { file = new File([b], name, { type: "image/png" }); } catch (e) { file = null; }
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(function () {});
      } else {
        var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        toast("Bild gespeichert");
      }
    }, "image/png");
  }

  // ---------- Darstellung ----------
  function setCount(text, animateTo) {
    var el = $("count");
    el.classList.toggle("word", animateTo === undefined);
    if (animateTo === undefined || reduceMotion || !firstRender) { el.textContent = text; return; }
    var t0 = performance.now(), dur = 900;
    (function step(now) {
      var k = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(animateTo * e));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  function render() {
    var s = getState(today), shownToday = clamp(today, START, END);
    if (view === undefined || view > shownToday) view = shownToday;

    if (s.phase === "before") {
      $("eyebrow").textContent = "Der Countdown startet in";
      setCount(String(s.daysToStart), s.daysToStart);
      $("unit").textContent = s.daysToStart === 1 ? "Tag" : "Tagen";
      $("meta").textContent = "Start: 13. November 2026";
    } else if (s.phase === "during") {
      $("eyebrow").textContent = "Noch";
      setCount(String(s.daysLeft), s.daysLeft);
      $("unit").textContent = (s.daysLeft === 1 ? "Tag" : "Tage") + " bis zu deinem letzten Arbeitstag";
      var restTxt = s.restDays + (s.restDays === 1 ? " Tag" : " Tage");
      var weeksTxt = s.weeks === 0 ? restTxt
        : s.weeks + (s.weeks === 1 ? " Woche" : " Wochen") + (s.restDays ? " und " + restTxt : "");
      $("meta").textContent = weeksTxt + " · " + String(s.workdays).replace(".", ",") + (s.workdays === 1 ? " Arbeitstag" : " Arbeitstage") +
        " · " + Math.round(s.progress * 100) + " % geschafft";
    } else if (s.phase === "last") {
      $("eyebrow").textContent = "Es ist so weit";
      setCount("Heute!");
      $("unit").textContent = "Dein letzter Arbeitstag";
      $("meta").textContent = "100 % geschafft";
    } else {
      $("eyebrow").textContent = "Du hast es";
      setCount("Geschafft!");
      $("unit").textContent = "Der letzte Arbeitstag ist Geschichte";
      $("meta").textContent = "100 % geschafft";
    }
    $("barfill").style.width = Math.round(s.progress * 100) + "%";
    $("bar").setAttribute("aria-valuenow", String(Math.round(s.progress * 100)));

    var ball = isBallDay(today) || forceFlummi;
    $("badge").textContent = s.phase === "after" ? "★ Du hast es geschafft! ★"
      : ball ? "★ Flummi-Tag: heute wird gehüpft! ★" : "✦ Morgen hüpfen die Flummis ✦";

    var sa = getSaying(view), iso = isoOf(clamp(view, START, END));
    $("quote").textContent = sa.text;
    $("src").textContent = sa.src;
    $("src").hidden = !sa.src;
    $("dateLabel").textContent = view === shownToday ? "Dein Spruch für heute" : "Spruch vom " + fmtLong.format(view);

    var isFav = getFavs().indexOf(iso) >= 0;
    $("fav").textContent = isFav ? "♥ Gemerkt" : "♡ Merken";
    $("fav").setAttribute("aria-pressed", String(isFav));
    $("favsOpen").textContent = "Favoriten (" + getFavs().length + ")";

    $("prev").disabled = view <= START;
    $("next").disabled = view >= shownToday;
    $("now").hidden = view === shownToday;
    firstRender = false;
  }

  function step(delta) { view = clamp(view + delta * DAY, START, clamp(today, START, END)); render(); }

  // ---------- Effekte: Flummis und Konfetti ----------
  var fx = $("fx"), ctx = fx.getContext("2d"), dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0, balls = [], parts = [], raf = null, last = 0;
  var G = 2600; // px/s²
  var COLORS = [["#ff3fd0", "#ffb3f0"], ["#35f0ff", "#c4fcff"], ["#b6ff3b", "#eaffb0"], ["#7a3cff", "#c9aeff"], ["#ffe600", "#fff9b0"], ["#ff7a1a", "#ffc99a"]];

  function sizeCanvas() {
    W = window.innerWidth; H = window.innerHeight;
    fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr);
    fx.style.width = W + "px"; fx.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Sprunghöhe wächst mit dem Fortschritt: anfangs flach (ca. 14 px), am Ende fast bildschirmhoch.
  function jumpHeight(p) {
    var maxH = Math.max(180, H * 0.8), minH = 14;
    return minH + (maxH - minH) * Math.pow(p, 1.4);
  }

  function launchBalls(p, n) {
    sizeCanvas();
    var h = jumpHeight(p), T = 2 * Math.sqrt(2 * h / G), D = Math.max(2.4, 2.6 * T);
    for (var i = 0; i < n; i++) {
      var dir = i % 2 ? -1 : 1, r = 14 + Math.random() * 10 + p * 6, hi = h * (0.85 + Math.random() * 0.3);
      balls.push({
        dir: dir, r: r, x: dir > 0 ? -r : W + r, y: 0, h: hi,
        vx: dir * (W + 2 * r) / D * (0.85 + Math.random() * 0.3),
        vy: Math.sqrt(2 * G * hi), delay: i * 0.28 + Math.random() * 0.2, squash: 0,
        col: COLORS[(i + Math.floor(Math.random() * COLORS.length)) % COLORS.length]
      });
    }
    loop();
  }

  function confetti(n) {
    sizeCanvas();
    var cols = ["#ffe600", "#ff3fd0", "#35f0ff", "#b6ff3b", "#ffffff", "#7a3cff"];
    for (var i = 0; i < n; i++) {
      parts.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.4, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
        c: cols[i % cols.length], vx: -90 + Math.random() * 180, vy: 120 + Math.random() * 220, r: Math.random() * 6.28, vr: -8 + Math.random() * 16 });
    }
    loop();
  }

  function updateBall(b, dt) {
    if (b.delay > 0) { b.delay -= dt; return; }
    b.vy -= G * dt; b.y += b.vy * dt; b.x += b.vx * dt;
    if (b.squash > 0) b.squash -= dt;
    if (b.y <= 0 && b.vy < 0) { b.y = 0; b.vy = Math.sqrt(2 * G * b.h * (0.9 + Math.random() * 0.2)); b.squash = 0.09; }
  }

  function drawBall(b) {
    if (b.delay > 0) return;
    var floor = H - 14, k = b.squash > 0 ? b.squash / 0.09 : 0;
    var stretch = Math.min(Math.abs(b.vy) / 4000, 0.18);
    var sx = 1 + 0.35 * k - stretch * 0.4, sy = 1 - 0.3 * k + stretch * 0.8;
    // Schatten
    ctx.save(); ctx.globalAlpha = 0.22 / (1 + b.y / 150); ctx.fillStyle = "#1b1464";
    ctx.beginPath(); ctx.ellipse(b.x, floor, b.r * 1.1 / (1 + b.y / 300), b.r * 0.25, 0, 0, 6.3); ctx.fill(); ctx.restore();
    // Kugel
    ctx.save(); ctx.translate(b.x, floor - b.y - b.r * sy); ctx.scale(sx, sy);
    var gr = ctx.createRadialGradient(-b.r * 0.35, -b.r * 0.4, b.r * 0.1, 0, 0, b.r);
    gr.addColorStop(0, b.col[1]); gr.addColorStop(0.55, b.col[0]); gr.addColorStop(1, "#1b1464");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 6.3); ctx.fill();
    ctx.lineWidth = 2.5 / Math.max(sx, sy); ctx.strokeStyle = "#1b1464"; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.ellipse(-b.r * 0.38, -b.r * 0.42, b.r * 0.22, b.r * 0.13, -0.6, 0, 6.3); ctx.fill();
    ctx.restore();
  }

  function loop() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    var dt = Math.min((now - last) / 1000, 0.033); last = now;
    ctx.clearRect(0, 0, W, H);
    balls.forEach(function (b) { updateBall(b, dt); drawBall(b); });
    balls = balls.filter(function (b) { return b.delay > 0 || (b.dir > 0 ? b.x < W + b.r + 12 : b.x > -b.r - 12); });
    parts.forEach(function (p) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    });
    parts = parts.filter(function (p) { return p.y < H + 30; });
    if (balls.length || parts.length) { raf = requestAnimationFrame(tick); }
    else { raf = null; ctx.clearRect(0, 0, W, H); }
  }

  function runFlummis() {
    var s = getState(today);
    launchBalls(s.progress, 3 + Math.round(s.progress * 5));
    if (s.phase === "last" || s.phase === "after") confetti(160);
  }

  // Automatisch: einmal pro Flummi-Tag beim ersten Öffnen
  function maybeAutoFlummi() {
    if (reduceMotion) return;
    var ball = isBallDay(today) || forceFlummi, s = getState(today);
    var key = isoOf(today);
    if (!ball && s.phase !== "last") return;
    if (!forceFlummi && store("verena.flummi.day") === key) return;
    store("verena.flummi.day", key);
    setTimeout(runFlummis, 700);
  }

  // ---------- Start ----------
  (function sparkles() {
    var box = $("sparkles"), ch = ["✦", "★", "✧", "♥", "✦"], cols = ["#ffffff", "#fff7a0", "#b4fbff", "#ffd0f4"];
    for (var i = 0; i < 18; i++) {
      var s = document.createElement("span");
      s.textContent = ch[i % ch.length]; s.style.left = (Math.random() * 100) + "%"; s.style.top = (Math.random() * 100) + "%";
      s.style.fontSize = (10 + Math.random() * 22) + "px"; s.style.animationDelay = (Math.random() * 4) + "s"; s.style.color = cols[i % cols.length];
      box.appendChild(s);
    }
  })();

  $("prev").addEventListener("click", function () { step(-1); });
  $("next").addEventListener("click", function () { step(1); });
  $("now").addEventListener("click", function () { view = clamp(today, START, END); render(); });
  $("count").addEventListener("click", runFlummis);
  $("flummiBtn").addEventListener("click", runFlummis);
  $("fav").addEventListener("click", function () { toggleFav(isoOf(clamp(view, START, END))); });
  $("share").addEventListener("click", function () { shareImage(clamp(view, START, END)); });
  $("favsOpen").addEventListener("click", function () {
    renderFavList();
    var d = $("favsDialog"); if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  });
  $("favsClose").addEventListener("click", function () { var d = $("favsDialog"); if (d.close) d.close(); else d.removeAttribute("open"); });
  $("favsDialog").addEventListener("click", function (e) { if (e.target === this && this.close) this.close(); });
  window.addEventListener("resize", sizeCanvas);

  function refresh() {
    var t = currentToday();
    if (t !== today) { today = t; view = undefined; render(); maybeAutoFlummi(); }
  }
  setInterval(refresh, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });

  sizeCanvas();
  today = currentToday();
  render();
  renderFavList();
  maybeAutoFlummi();

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
