/* Shlokha Dhaara: a shloka gurukul for children.
   Everything runs in the browser and is saved on this device (localStorage). */
(() => {
  "use strict";
  const SH = window.SHLOKAS, CATS = window.CATEGORIES, FEST = window.FESTIVALS, QUOTES = window.QUOTES;
  const byId = Object.fromEntries(SH.map(s => [s.id, s]));
  const catById = Object.fromEntries(CATS.map(c => [c.id, c]));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const main = $("#main");
  const icon = (name, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const LEVELS = { 1: ["Little learner", "Ages 4–6", "🌱"], 2: ["Growing learner", "Ages 7–10", "🌸"], 3: ["Advanced learner", "Ages 11–15", "🦚"] };
  const words = s => s.words.split("|").map(p => { const i = p.indexOf("="); return [p.slice(0, i).trim(), p.slice(i + 1).trim()]; });
  const tokens = line => line.split(/\s+/).filter(t => t && !/^[|।॥]+$/.test(t)).map(t => t.replace(/[|।॥]+$/, ""));

  /* ================= Dates ================= */
  const pad = n => String(n).padStart(2, "0");
  const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => keyOf(new Date());
  const dateOf = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
  const dayNum = k => Math.round(dateOf(k).getTime() / 864e5);
  const niceDate = k => dateOf(k).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const shortDay = k => dateOf(k).toLocaleDateString(undefined, { weekday: "short" });

  /* ================= Storage ================= */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("sd:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("sd:" + k, JSON.stringify(v)); } catch {} }
  };
  let db = LS.get("db", { learners: [], active: null });
  const save = () => LS.set("db", db);
  const newLearner = ({ name, age, minutes, chant }) => ({
    id: "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: name || "Learner", age: age || 1, minutes: minutes || 10, chant: chant || "18:00",
    created: today(), points: 0, learned: {}, current: null, days: {}, history: [], badges: [], notes: [], challenge: null, stats: { games: 0, records: 0, listens: 0 }
  });
  const me = () => db.learners.find(l => l.id === db.active) || db.learners[0] || null;
  if (!db.learners.length) { const g = newLearner({ name: "Guest" }); g.guest = true; db.learners.push(g); db.active = g.id; save(); }
  const dayRec = (l, k = today()) => (l.days[k] ||= { sec: 0, plan: null, done: false, listened: [] });

  /* ================= Learning path & daily plan ================= */
  const CAT_ORDER = ["morning", "ganesha", "saraswati", "peace", "guru", "bedtime", "everyday", "hanuman", "vishnu", "shiva", "devi", "wisdom", "gita"];
  const pathFor = l => [...SH].sort((a, b) => (a.level > l.age) - (b.level > l.age) || a.level - b.level || CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat));
  const STAGES = [
    { name: "Meet the shloka", how: "Listen to it and learn what it means.", act: "listen" },
    { name: "Repeat after Guru", how: "Say each line back after the guru.", act: "guru" },
    { name: "Word meanings", how: "Play Match the Meanings.", act: "game:match" },
    { name: "Fill the gaps", how: "Find the missing words.", act: "game:fill" },
    { name: "Word order", how: "Put the words back in order.", act: "game:arrange" },
    { name: "Record yourself", how: "Recite, record and listen back.", act: "record" },
    { name: "Say it by heart", how: "Recite without looking, then mark it learned.", act: "learned" }
  ];
  const REVIEW_GAPS = [1, 3, 7, 14, 30, 60];
  const GAMES = {
    match: { name: "Match the Meanings", emoji: "🔗", about: "Join each Sanskrit word to its meaning." },
    fill: { name: "Fill the Missing Word", emoji: "✏️", about: "Pick the word that completes the line." },
    memory: { name: "Memory Cards", emoji: "🃏", about: "Flip cards to find words and their meanings." },
    arrange: { name: "Word Arrange", emoji: "🧩", about: "Tap the words in the right order." },
    order: { name: "Shloka Puzzle", emoji: "🪷", about: "Put the lines of the shloka in order." }
  };
  function ensureCurrent(l) {
    if (l.current && byId[l.current.id] && !l.learned[l.current.id]) return l.current;
    const next = pathFor(l).find(s => !l.learned[s.id]);
    l.current = next ? { id: next.id, stage: 0, since: today() } : null;
    return l.current;
  }
  const sotd = () => SH[(dayNum(today()) * 7) % SH.length];
  function planFor(l, k = today()) {
    const rec = dayRec(l, k);
    const cur = ensureCurrent(l);
    if (!rec.plan) {
      const steps = [];
      if (l.minutes >= 10) steps.push({ k: "warm", id: sotd().id, done: false });
      if (cur) steps.push({ k: "learn", id: cur.id, stage: cur.stage, done: false });
      const due = Object.entries(l.learned).filter(([, v]) => v.next <= k).sort((a, b) => a[1].next.localeCompare(b[1].next)).map(([id]) => id);
      due.slice(0, l.minutes >= 15 ? 2 : 1).forEach(id => steps.push({ k: "review", id, done: false }));
      if (l.minutes >= 15 || (l.minutes >= 10 && !due.length)) steps.push({ k: "play", game: ["memory", "match", "fill", "arrange", "order"][dayNum(k) % 5], done: false });
      rec.plan = steps; save();
    }
    // Keep today's learning step in line with the current shloka until it is done
    const ls = rec.plan.find(s => s.k === "learn");
    if (ls && !ls.done && cur && (ls.id !== cur.id || ls.stage !== cur.stage)) { ls.id = cur.id; ls.stage = cur.stage; save(); }
    if (!ls && cur) { rec.plan.splice(rec.plan[0]?.k === "warm" ? 1 : 0, 0, { k: "learn", id: cur.id, stage: cur.stage, done: false }); save(); }
    return rec.plan;
  }
  const streakOf = l => { let n = 0, k = today(); if (!l.days[k]?.done) k = addDays(k, -1); while (l.days[k]?.done) { n++; k = addDays(k, -1); } return n; };
  const doneDays = l => Object.values(l.days).filter(d => d.done).length;
  const learnedCount = l => Object.keys(l.learned).length;
  const minutesOn = (l, k) => Math.round((l.days[k]?.sec || 0) / 60);

  function addPoints(l, pts, text) {
    l.points += pts;
    l.history.unshift({ t: Date.now(), text, pts });
    l.history.length = Math.min(l.history.length, 300);
  }
  function note(l, text) { l.notes.unshift({ t: Date.now(), text }); l.notes.length = Math.min(l.notes.length, 60); }

  /* Every learning action reports here; it awards points and ticks off today's plan. */
  function track(kind, data = {}) {
    const l = me(); if (!l) return;
    const k = today(), rec = dayRec(l, k), plan = planFor(l, k);
    const s = data.id ? byId[data.id] : null;
    let stepDone = null;
    const tick = st => { if (st && !st.done) { st.done = true; stepDone = st; } };
    const learn = plan.find(p => p.k === "learn");
    const stageAct = learn && !learn.done && learn.id === data.id ? STAGES[learn.stage].act : null;
    if (kind === "listen") {
      l.stats.listens++;
      if (!rec.listened.includes(data.id)) { rec.listened.push(data.id); addPoints(l, 2, `Listened to ${s.title}`); }
      tick(plan.find(p => p.k === "warm" && p.id === data.id));
      if (stageAct === "listen") tick(learn);
    } else if (kind === "guru") {
      addPoints(l, 5, `Repeated ${s.title} after the guru`);
      tick(plan.find(p => p.k === "warm" && p.id === data.id));
      if (stageAct === "listen" || stageAct === "guru") tick(learn);
    } else if (kind === "record") {
      l.stats.records++; addPoints(l, 5, `Recorded ${s.title}`);
      if (stageAct === "record") tick(learn);
    } else if (kind === "game") {
      l.stats.games++; addPoints(l, 10, `Played ${GAMES[data.type].name}${s ? " · " + s.title : ""}`);
      if (stageAct === "game:" + data.type) tick(learn);
      tick(plan.find(p => p.k === "play"));
    } else if (kind === "learned") {
      if (!l.learned[data.id]) {
        l.learned[data.id] = { date: k, n: 0, next: addDays(k, REVIEW_GAPS[0]) };
        addPoints(l, 30, `Learned ${s.title} by heart`); note(l, `Learned “${s.title}” by heart`);
        celebrate(); toastMsg(`Wonderful! ${s.title} is learned ✨`);
      }
      if (learn && learn.id === data.id) tick(learn);
      if (l.current?.id === data.id) { l.current = null; ensureCurrent(l); }
    } else if (kind === "review") {
      const r = l.learned[data.id];
      if (r) { r.n = Math.min(r.n + 1, REVIEW_GAPS.length - 1); r.next = addDays(k, REVIEW_GAPS[r.n]); }
      addPoints(l, 5, `Revised ${s.title}`);
      tick(plan.find(p => p.k === "review" && p.id === data.id));
    }
    if (stepDone?.k === "learn" && l.current && l.current.id === stepDone.id && STAGES[stepDone.stage].act !== "learned") {
      l.current.stage = Math.min(STAGES.length - 1, stepDone.stage + 1);
    }
    if (stepDone) toastMsg("Step done! " + pick(["Shabash! 🌟", "Well done! 🪔", "Great work! 🦚", "Wonderful! 🌸"]));
    if (!rec.done && plan.length && plan.every(p => p.done)) {
      rec.done = true; addPoints(l, 20, "Finished today's plan"); note(l, `Finished the daily plan on ${niceDate(k)}`);
      setTimeout(() => { celebrate(); toastMsg(`Today's plan is complete! ${streakOf(l)}-day streak 🔥`); }, 400);
    }
    checkBadges(l); save(); renderWho();
  }

  /* ================= Badges ================= */
  const BADGES = [
    ["first-step", "🌱", "First Step", "Finish a daily plan", l => doneDays(l) >= 1],
    ["first-shloka", "🪔", "First Shloka", "Learn a shloka by heart", l => learnedCount(l) >= 1],
    ["five", "🌸", "Blossoming", "Learn 5 shlokas", l => learnedCount(l) >= 5],
    ["ten", "🏵️", "Flower Garland", "Learn 10 shlokas", l => learnedCount(l) >= 10],
    ["twentyfive", "👑", "Shloka Star", "Learn 25 shlokas", l => learnedCount(l) >= 25],
    ["streak3", "🔥", "On Fire", "3-day streak", l => streakOf(l) >= 3],
    ["streak7", "🌟", "Week of Light", "7-day streak", l => streakOf(l) >= 7],
    ["challenge", "🏆", "21-Day Champion", "Finish the 21-day challenge", l => challengeDone(l) >= 21],
    ["gamer", "🎮", "Game Guru", "Play 10 games", l => l.stats.games >= 10],
    ["voice", "🎙️", "Little Guru", "Record yourself 5 times", l => l.stats.records >= 5],
    ["explorer", "🦚", "Explorer", "Learn from 5 categories", l => new Set(Object.keys(l.learned).map(id => byId[id]?.cat)).size >= 5],
    ["points", "💎", "Treasure", "Earn 500 points", l => l.points >= 500]
  ];
  function checkBadges(l) {
    for (const [id, em, name] of BADGES) {
      if (!l.badges.some(b => b.id === id) && BADGES.find(b => b[0] === id)[4](l)) {
        l.badges.push({ id, date: today() }); note(l, `Earned the ${name} badge ${em}`);
        setTimeout(() => toastMsg(`New badge: ${em} ${name}!`), 1200);
      }
    }
  }
  const challengeDone = l => { if (!l.challenge) return 0; let n = 0; for (let i = 0; i < 21; i++) if (l.days[addDays(l.challenge.start, i)]?.done) n++; return n; };

  /* ================= Audio: guru voice (device text-to-speech) ================= */
  const synth = window.speechSynthesis || null;
  let voices = [];
  const loadVoices = () => { voices = synth ? synth.getVoices() : []; };
  if (synth) { loadVoices(); synth.addEventListener?.("voiceschanged", loadVoices); }
  const guruVoice = () => voices.find(v => /^hi[-_]?/i.test(v.lang)) || voices.find(v => /^(mr|sa|ne)[-_]?/i.test(v.lang)) || null;
  let playToken = 0, timers = [];
  function stopAudio() {
    playToken++; timers.forEach(clearTimeout); timers = [];
    try { synth?.cancel(); } catch {}
    $$(".line.on, .line.turn, .w.on").forEach(e => e.classList.remove("on", "turn"));
  }
  const wait = ms => new Promise(r => timers.push(setTimeout(r, ms)));
  // Speak one line; light up each word as it is spoken (karaoke)
  function speakLine(lineEl, text, rate, token) {
    return new Promise(resolve => {
      const ws = text.split(/\s+/).filter(t => t && !/^[।॥|]+$/.test(t)).map(t => t.replace(/[।॥|]+$/, ""));
      const spans = lineEl ? $$(".w", lineEl) : [];
      const starts = []; let pos = 0; ws.forEach(w => { starts.push(pos); pos += w.length + 1; });
      const spoken = ws.join(" ");
      const light = i => spans.forEach((s, j) => s.classList.toggle("on", j === i));
      let gotBoundary = false, fallback = [];
      const finish = () => { fallback.forEach(clearTimeout); spans.forEach(s => s.classList.remove("on")); resolve(); };
      if (!synth) { finish(); return; }
      const u = new SpeechSynthesisUtterance(spoken);
      const v = guruVoice(); if (v) u.voice = v;
      u.lang = v?.lang || "hi-IN"; u.rate = rate; u.pitch = 1;
      u.onboundary = e => {
        if (token !== playToken) return;
        gotBoundary = true; fallback.forEach(clearTimeout);
        let i = 0; while (i + 1 < starts.length && starts[i + 1] <= e.charIndex) i++; light(i);
      };
      u.onstart = () => {
        // Some voices send no word events: step through the words on a timer instead
        let t = 250;
        ws.forEach((w, i) => { fallback.push(setTimeout(() => { if (!gotBoundary && token === playToken) light(i); }, t)); t += (w.length * 95 + 160) / rate; });
      };
      u.onend = finish; u.onerror = finish;
      timers.push(setTimeout(finish, (spoken.length * 160 + 4000) / rate));
      synth.speak(u);
    });
  }
  async function playShloka(s, { rate = 1, guru = false, root = document, onStatus = () => {} } = {}) {
    stopAudio(); const token = playToken;
    if (!synth) { onStatus("Sorry, this browser cannot speak. Try Chrome, Edge or Safari."); return false; }
    const lines = $$(".line", root);
    for (let i = 0; i < s.dev.length; i++) {
      if (token !== playToken) return false;
      const el = lines[i]; el?.classList.add("on");
      onStatus(guru ? `Guru: line ${i + 1} of ${s.dev.length}` : `Reciting line ${i + 1} of ${s.dev.length}`);
      await speakLine(el, s.dev[i], rate, token);
      el?.classList.remove("on");
      if (token !== playToken) return false;
      if (guru) {
        el?.classList.add("turn");
        onStatus(`<span class="turn-badge">Your turn!</span> Say line ${i + 1} out loud.`);
        await wait(Math.max(2600, tokens(s.dev[i]).length * 900) / Math.min(rate, 1));
        el?.classList.remove("turn");
      } else await wait(250);
    }
    if (token !== playToken) return false;
    onStatus(guru ? "Well done! You repeated every line. 🌟" : "Finished. Try Repeat after Guru next!");
    track(guru ? "guru" : "listen", { id: s.id });
    return true;
  }

  /* ================= Recorder ================= */
  let rec = null;
  async function startRecording(onUpdate) {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { onUpdate({ error: "Recording isn't supported in this browser." }); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream), chunks = [];
      rec = { mr, stream, started: Date.now() };
      mr.ondataavailable = e => e.data.size && chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        rec = null; onUpdate({ url: URL.createObjectURL(blob), secs: blob.size ? 1 : 0 });
      };
      mr.start(); onUpdate({ recording: true });
      timers.push(setTimeout(() => rec?.mr.state === "recording" && rec.mr.stop(), 90000));
    } catch { onUpdate({ error: "Microphone permission was not given. Allow it in the browser to record." }); }
  }
  const stopRecording = () => { if (rec?.mr.state === "recording") rec.mr.stop(); };

  /* ================= UI helpers ================= */
  function toastMsg(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastMsg.t); toastMsg.t = setTimeout(() => t.classList.remove("show"), 2600); }
  function celebrate() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = $("#confetti"), cols = ["#f59e0b", "#ea580c", "#fbbf24", "#9f1d20", "#f472b6", "#e0b44a"];   // marigold and rose petals
    for (let i = 0; i < 70; i++) {
      const p = document.createElement("i");
      p.style.left = Math.random() * 100 + "vw"; p.style.background = pick(cols);
      p.style.animationDuration = 1.6 + Math.random() * 1.6 + "s"; p.style.animationDelay = Math.random() * .4 + "s";
      box.append(p); setTimeout(() => p.remove(), 3800);
    }
  }
  function openModal(html, onReady) {
    const m = $("#modal"); $("#modal-card").innerHTML = html; m.hidden = false;
    const first = $("#modal-card").querySelector("input, button"); first?.focus();
    onReady?.($("#modal-card"));
  }
  const closeModal = () => { $("#modal").hidden = true; };
  $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
  addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
  const levelChip = s => `<span class="chip l${s.level}">${LEVELS[s.level][2]} ${LEVELS[s.level][0]}</span>`;
  function statusChip(l, s) {
    if (l.learned[s.id]) return `<span class="chip done">✓ Learned</span>`;
    if (l.current?.id === s.id) return `<span class="chip doing">Learning · day ${l.current.stage + 1} of 7</span>`;
    return "";
  }
  const skCard = (l, s) => `<a class="sk" href="#/shloka/${s.id}" style="--c:${catById[s.cat].color}">
      <h3>${esc(s.title)}</h3><p class="deva" lang="sa">${esc(s.dev.join(" "))}</p>
      <div class="meta">${levelChip(s)}${statusChip(l, s)}</div></a>`;
  const ring = (done, total) => {
    const r = 46, c = 2 * Math.PI * r, f = total ? done / total : 0;
    return `<svg class="ring" viewBox="0 0 110 110" role="img" aria-label="${done} of ${total} steps done"><circle class="bg" cx="55" cy="55" r="${r}"/><circle class="fg" cx="55" cy="55" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}"/><text x="55" y="63" text-anchor="middle">${done}/${total}</text></svg>`;
  };

  /* ================= Header: learner switcher & theme ================= */
  function renderWho() {
    const l = me();
    $("#who-avatar").textContent = (l?.name || "?").trim()[0]?.toUpperCase() || "?";
    $("#who-name").textContent = l?.name || "Learner";
    $("#who-menu").innerHTML = db.learners.map(x => `<button type="button" data-switch="${x.id}"><span class="avatar">${esc(x.name[0]?.toUpperCase() || "?")}</span>${esc(x.name)}${x.id === l?.id ? " ✓" : ""}</button>`).join("")
      + `<hr><button type="button" data-add>＋ Add a learner</button><button type="button" data-edit>✎ Edit ${esc(l?.name || "profile")}</button><button type="button" data-go="#/parents">${icon("users")} Parent dashboard</button>`;
  }
  $("#who-btn").addEventListener("click", e => { e.stopPropagation(); const m = $("#who-menu"); m.hidden = !m.hidden; $("#who-btn").setAttribute("aria-expanded", !m.hidden); });
  document.addEventListener("click", e => { if (!e.target.closest(".who")) { $("#who-menu").hidden = true; $("#who-btn").setAttribute("aria-expanded", "false"); } });
  $("#who-menu").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    $("#who-menu").hidden = true;
    if (b.dataset.switch) { db.active = b.dataset.switch; save(); renderWho(); route(); toastMsg(`Namaste, ${me().name}! 🙏`); }
    if (b.hasAttribute("data-add")) profileForm(null);
    if (b.hasAttribute("data-edit")) profileForm(me());
    if (b.dataset.go) location.hash = b.dataset.go;
  });
  function applyTheme() {
    const t = LS.get("theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = t;
    $("#theme-btn use").setAttribute("href", t === "dark" ? "#i-sun" : "#i-moon");
    $("meta[name=theme-color]").content = t === "dark" ? "#3a0c0c" : "#6e1414";
  }
  $("#theme-btn").addEventListener("click", () => { LS.set("theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark"); applyTheme(); });

  function profileForm(l) {
    const isNew = !l; const v = l || { name: "", age: 1, minutes: 10, chant: "18:00" };
    openModal(`<h2 id="modal-h">${isNew ? "Who is learning?" : "Edit " + esc(v.name)}</h2>
      <p class="muted">${isNew ? "Each child gets their own daily plan, streak and badges. Everything stays on this device." : "Changes apply from tomorrow's plan."}</p>
      <form class="form" id="pf">
        <label>Child's name<input name="name" required maxlength="30" value="${esc(v.guest ? "" : v.name)}" placeholder="e.g. Atharv" autocomplete="off"></label>
        <div><b>Age group</b><div class="choice" id="pf-age" style="margin-top:6px">${[1, 2, 3].map(a => `<button type="button" data-age="${a}" aria-pressed="${v.age === a}"><span class="em">${LEVELS[a][2]}</span>${LEVELS[a][0]}<span>${LEVELS[a][1]}</span></button>`).join("")}</div></div>
        <div><b>Practice time each day</b><div class="choice" id="pf-min" style="margin-top:6px">${[[5, "Quick", "1–2 steps"], [10, "Regular", "3 steps"], [15, "Keen", "4–5 steps"]].map(([m, n, d]) => `<button type="button" data-min="${m}" aria-pressed="${v.minutes === m}">${m} min<span>${n} · ${d}</span></button>`).join("")}</div></div>
        <label>Daily chant time<input type="time" name="chant" value="${esc(v.chant)}"></label>
        <div class="row" style="justify-content:flex-end">${isNew && db.learners.length && !me()?.guest ? `<button type="button" class="btn ghost" data-close>Cancel</button>` : `<button type="button" class="btn ghost" data-close>${isNew ? "Maybe later" : "Cancel"}</button>`}<button class="btn" type="submit">${isNew ? "Start learning" : "Save"}</button></div>
      </form>`, card => {
      let age = v.age, minutes = v.minutes;
      card.addEventListener("click", e => {
        const a = e.target.closest("[data-age]"), m = e.target.closest("[data-min]");
        if (a) { age = +a.dataset.age; $$("[data-age]", card).forEach(b => b.setAttribute("aria-pressed", b === a)); }
        if (m) { minutes = +m.dataset.min; $$("[data-min]", card).forEach(b => b.setAttribute("aria-pressed", b === m)); }
        if (e.target.closest("[data-close]")) closeModal();
      });
      $("#pf", card).addEventListener("submit", e => {
        e.preventDefault(); const f = new FormData(e.target);
        const data = { name: String(f.get("name")).trim(), age, minutes, chant: f.get("chant") || "18:00" };
        if (isNew) {
          const g = me();
          if (g?.guest && !g.points && !learnedCount(g)) Object.assign(g, data, { guest: false });   // turn the untouched guest into this child
          else { const n = newLearner(data); db.learners.push(n); db.active = n.id; }
        } else {
          const ageChanged = l.age !== age;
          Object.assign(l, data, { guest: false });
          if (ageChanged && l.current && l.current.stage === 0) l.current = null;
        }
        save(); closeModal(); renderWho(); route(); toastMsg(`Namaste, ${data.name}! 🙏`);
      });
    });
  }

  /* ================= Hero illustration ================= */
  // Dawn behind a temple gopuram, framed by a carved arch with a marigold toran and temple bells
  const garland = (x1, x2, y, sag, n) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, x = x1 + (x2 - x1) * t, yy = y + sag * 4 * t * (1 - t);
    return i % 2 ? `<path d="M${x} ${yy}c-5 6-4 13 0 19c4-6 5-13 0-19Z" fill="#3f7a2b"/>` : `<circle cx="${x}" cy="${yy + 5}" r="7" fill="#f59e0b"/><circle cx="${x}" cy="${yy + 5}" r="4" fill="#ea580c"/>`; }).join("");
  const bell = (x, y, len) => `<g><path d="M${x} ${y}v${len}" stroke="#9c6c0e" stroke-width="2"/><path d="M${x - 11} ${y + len + 22}c0-14 4-22 11-22s11 8 11 22Z" fill="#e0b44a" stroke="#9c6c0e" stroke-width="1.5"/><circle cx="${x}" cy="${y + len + 25}" r="3.5" fill="#9c6c0e"/></g>`;
  const heroArt = `<svg class="hero-art" viewBox="0 0 520 440" role="img" aria-label="The sun rising behind a temple gopuram, framed by a carved arch with a marigold garland, temple bells, lotuses and peacock feathers">
    <defs><linearGradient id="hg-t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2c14e"/><stop offset="1" stop-color="#c2410c"/></linearGradient>
    <linearGradient id="hg-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb6c4"/><stop offset="1" stop-color="#0f6b7e"/></linearGradient>
    <radialGradient id="hg-s"><stop offset="0" stop-color="#fff3c4"/><stop offset=".55" stop-color="#fbbf24"/><stop offset="1" stop-color="#f59e0b"/></radialGradient></defs>
    <g transform="translate(260 200)"><g stroke="#e0a100" stroke-width="5" stroke-linecap="round" opacity=".55">${Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return `<line x1="${Math.cos(a) * 98}" y1="${Math.sin(a) * 98}" x2="${Math.cos(a) * 124}" y2="${Math.sin(a) * 124}"/>`; }).join("")}</g>
      <circle r="88" fill="url(#hg-s)"/></g>
    <path d="M118 104q9-7 18 0q9-7 18 0M372 92q8-6 16 0q8-6 16 0" fill="none" stroke="#6e1414" stroke-width="2.5" stroke-linecap="round" opacity=".5"/>
    <g>
      <rect x="168" y="322" width="184" height="58" rx="3" fill="url(#hg-t)"/>
      <rect x="182" y="276" width="156" height="50" rx="3" fill="#e0a100"/>
      <rect x="196" y="236" width="128" height="44" rx="3" fill="#f2c14e"/>
      <rect x="210" y="200" width="100" height="40" rx="3" fill="#e0a100"/>
      <rect x="224" y="168" width="72" height="36" rx="3" fill="#f2c14e"/>
      <path d="M226 170c4-26 64-26 68 0Z" fill="#9f1d20"/>
      <path d="M260 124v22" stroke="#9c6c0e" stroke-width="4"/><circle cx="260" cy="122" r="6" fill="#9c6c0e"/>
      <g fill="#9f1d20" opacity=".55">${[[182, 290, 156], [196, 250, 128], [210, 212, 100], [224, 179, 72]].map(([x, y, w]) => Array.from({ length: Math.floor(w / 18) }, (_, i) => `<rect x="${x + 8 + i * 18}" y="${y}" width="8" height="14" rx="4"/>`).join("")).join("")}</g>
      <path d="M238 380v-34a22 22 0 0 1 44 0v34Z" fill="#5a1010"/>
      <path d="M150 380h220" stroke="#6e1414" stroke-width="6" stroke-linecap="round"/>
    </g>
    <ellipse cx="260" cy="408" rx="250" ry="24" fill="url(#hg-w)" opacity=".85"/>
    ${[[110, 402, 1], [410, 404, .85], [330, 414, .6]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0c-22 0-40-12-46-30 16-1 32 6 46 20 14-14 30-21 46-20C40-12 22 0 0 0Z" fill="#f9a8d4"/><path d="M0-8c-12-17-12-37 0-58 12 21 12 41 0 58Z" fill="#db2777"/><path d="M-16-12c-9-11-11-26-7-40 10 6 17 16 19 27M16-12c9-11 11-26 7-40-10 6-17 16-19 27" fill="#f472b6"/></g>`).join("")}
    <path d="M30 432V178C30 84 140 22 260 22s230 62 230 156v254" fill="none" stroke="#6e1414" stroke-width="10"/>
    <path d="M44 432V180C44 96 148 38 260 38s216 58 216 142v252" fill="none" stroke="#e0b44a" stroke-width="3"/>
    <path d="M30 178C30 84 140 22 260 22s230 62 230 156" fill="none" stroke="#e0b44a" stroke-width="2" stroke-dasharray="2 9" stroke-linecap="round"/>
    <path d="M70 92Q260 196 450 92" fill="none" stroke="#7a4a12" stroke-width="1.6"/>
    ${garland(70, 450, 92, 52, 22)}
    ${bell(70, 96, 40)}${bell(450, 96, 40)}
    <use href="#i-feather" x="0" y="200" width="56" height="180" transform="rotate(-12 28 290)"/>
    <use href="#i-feather" x="466" y="214" width="46" height="150" transform="rotate(12 489 289)"/>
  </svg>`;

  /* ================= Views ================= */
  const V = {};

  V.home = () => {
    const l = me(), s = sotd(), plan = planFor(l), done = plan.filter(p => p.done).length;
    const q = QUOTES[dayNum(today()) % QUOTES.length];
    const m = new Date().getMonth();
    const fest = FEST.find(f => f.months.includes(m)) || FEST.find(f => f.months.includes((m + 1) % 12)) || FEST[0];
    const next = plan.find(p => !p.done);
    main.innerHTML = `
    <section class="hero"><div class="wrap hero-in">
      <div>
        <p class="eyebrow">Shloka Gurukul for children aged 4–15</p>
        <h1>Learn shlokas the <em>joyful</em> way</h1>
        <p class="lead">${l.guest ? "Listen, repeat, play and remember the sacred verses of our tradition, a few minutes every day." : `Namaste, ${esc(l.name)}! Ready for today's ${l.minutes}-minute shloka time?`}</p>
        <div class="row"><a class="btn lg" href="#/today">${icon("play")} Start learning</a><a class="btn ghost lg" href="#/learn">Explore shlokas</a></div>
        <div class="stat-tiles">
          <div class="tile"><b>${icon("flame")}${streakOf(l)}</b><span>day streak</span></div>
          <div class="tile"><b>${learnedCount(l)}</b><span>shlokas learned</span></div>
          <div class="tile"><b>${l.points}</b><span>points</span></div>
        </div>
      </div>
      <div>${heroArt}</div>
    </div></section>

    <div class="wrap">
      <section class="section grid g3">
        <article class="card sotd">
          <svg class="feather" aria-hidden="true"><use href="#i-feather"/></svg>
          <p class="eyebrow">Shloka of the day</p>
          <h2 style="font-size:1.45rem">${esc(s.title)}</h2>
          <p class="deva-big" lang="sa">${s.dev.map(esc).join("<br>")}</p>
          <p class="muted small">${esc(s.mean)}</p>
          <div class="row"><button class="btn sky sm" data-listen="${s.id}">${icon("play")} Listen</button><a class="btn ghost sm" href="#/shloka/${s.id}">Open</a></div>
          <div class="lines" hidden>${s.dev.map(d => `<span class="line">${d}</span>`).join("")}</div>
        </article>
        <article class="card">
          <p class="eyebrow">Today's plan</p>
          <div class="plan-head"><div><h2 style="font-size:1.45rem">${done === plan.length ? "All done for today! 🎉" : `${plan.length - done} step${plan.length - done === 1 ? "" : "s"} to go`}</h2>
            <p class="muted small" style="margin:6px 0 12px">${next ? stepTitle(next) : "Come back tomorrow to keep your streak going."}</p></div>${ring(done, plan.length)}</div>
          <a class="btn green" href="#/today">${done === plan.length ? "See today's plan" : "Continue"}</a>
          ${l.current ? `<p class="muted small" style="margin:14px 0 0">Learning now: <b>${esc(byId[l.current.id].title)}</b> · day ${l.current.stage + 1} of 7</p><div class="stages">${STAGES.map((_, i) => `<div class="${i < l.current.stage ? "done" : i === l.current.stage ? "now" : ""}"></div>`).join("")}</div>` : ""}
        </article>
        <div class="grid">
          <article class="card quote"><p class="eyebrow" style="color:#fff">Thought for today</p><p class="deva" lang="sa">${esc(q[0])}</p><p>${esc(q[1])}</p><small>${esc(q[2])}</small></article>
          <a class="card" href="#/festivals" style="text-decoration:none;color:inherit"><p class="eyebrow">Festival time</p><h3 style="font-size:1.2rem">${esc(fest.name)}</h3><p class="muted small" style="margin:4px 0 0">${esc(fest.when)} · ${fest.shlokas.length} shlokas to learn</p></a>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><div><p class="eyebrow">Learn shlokas</p><h2>Choose a shelf</h2></div><a class="btn ghost sm" href="#/learn">See all ${SH.length} shlokas</a></div>
        ${catGrid(l)}
      </section>

      <section class="section grid g3">
        ${[["🎧", "Listen & repeat", "Hear each line from the guru voice, then say it back. Words light up as they're recited."], ["🎮", "Play to remember", "Five games turn every shloka into puzzles, matching and memory cards."], ["📅", "A plan for every day", "A short daily plan teaches one shloka in 7 days and brings back old ones to revise."]]
          .map(([e, h, p]) => `<article class="card"><div style="font-size:2rem">${e}</div><h3 style="font-size:1.25rem;margin-top:6px">${h}</h3><p class="muted small" style="margin:6px 0 0">${p}</p></article>`).join("")}
      </section>
      <section class="section"><article class="card row" style="justify-content:space-between">
        <div><p class="eyebrow">21-day shloka challenge</p><h3 style="font-size:1.3rem">${l.challenge ? `${challengeDone(l)} of 21 days complete` : "Finish your plan 21 days in a row"}</h3></div>
        <a class="btn sky" href="#/progress">${l.challenge ? "See the challenge" : "Take the challenge"}</a></article></section>
    </div>`;
  };
  const catGrid = l => `<div class="cat-grid">${CATS.map(c => {
      const list = c.id === "festival" ? [...new Set(FEST.flatMap(f => f.shlokas))] : SH.filter(s => s.cat === c.id).map(s => s.id);
      const got = list.filter(id => l.learned[id]).length;
      return `<a class="cat" href="#/learn/${c.id}" style="--c:${c.color}"><span class="ic">${icon(c.icon)}</span><b>${esc(c.name)}</b><span class="sa" lang="sa">${esc(c.sa)}</span>
        <span class="meter"><i style="width:${list.length ? got / list.length * 100 : 0}%"></i></span><small>${got} of ${list.length} learned</small></a>`;
    }).join("")}</div>`;

  function stepTitle(p) {
    const s = byId[p.id];
    if (p.k === "warm") return `Warm-up: listen to the Shloka of the Day, ${s.title}`;
    if (p.k === "learn") return `Learn ${s.title}: ${STAGES[p.stage].name}`;
    if (p.k === "review") return `Revise ${s.title}`;
    return `Play ${GAMES[p.game].name}`;
  }

  V.today = () => {
    const l = me(), k = today(), plan = planFor(l, k), done = plan.filter(p => p.done).length;
    const stepHTML = (p, i) => {
      const s = byId[p.id]; let h = "", d = "", acts = "";
      if (p.k === "warm") { h = "Warm-up · Shloka of the Day"; d = `Listen to ${s.title} once.`; acts = `<button class="btn sky sm" data-listen="${s.id}">${icon("play")} Listen</button>`; }
      if (p.k === "learn") {
        const st = STAGES[p.stage]; h = `Learn · ${st.name}`; d = `${s.title}: ${st.how} <span class="chip">Day ${p.stage + 1} of 7</span>`;
        const g = st.act.startsWith("game:") ? st.act.slice(5) : null;
        acts = g ? `<a class="btn sm" href="#/games/${g}/${s.id}">Play</a>` : st.act === "learned" ? `<a class="btn sm" href="#/shloka/${s.id}">Recite</a><button class="btn green sm" data-learned="${s.id}">I know it by heart</button>` : `<a class="btn sm" href="#/shloka/${s.id}${st.act === "guru" ? "?guru" : st.act === "record" ? "?record" : ""}">Start</a>`;
      }
      if (p.k === "review") { h = "Revise"; d = `Say ${s.title} from memory. Peek if you need to!`; acts = `<a class="btn ghost sm" href="#/shloka/${s.id}">Peek</a><button class="btn green sm" data-review="${s.id}">I remembered it</button>`; }
      if (p.k === "play") { h = "Play time"; d = `${GAMES[p.game].emoji} ${GAMES[p.game].name}: ${GAMES[p.game].about}`; acts = `<a class="btn sm" href="#/games/${p.game}">Play</a>`; }
      return `<div class="step ${p.done ? "done" : ""}"><div class="num"><span>${i + 1}</span>${icon("check")}</div><div><h3>${h}</h3><p>${d}</p>
        ${p.k === "warm" ? `<div class="lines" hidden>${s.dev.map(x => `<span class="line">${x}</span>`).join("")}</div>` : ""}</div><div class="acts">${p.done ? `<span class="chip done">Done</span>` : acts}</div></div>`;
    };
    // Look ahead: one learning stage per day, then the next shloka on the path
    // l.current has already moved on if today's learning step is done
    const week = []; let cur = l.current ? { ...l.current } : null; const path = pathFor(l).filter(s => !l.learned[s.id]);
    let pi = cur ? path.findIndex(s => s.id === cur.id) : 0;
    const adv = () => { if (!cur) return; cur.stage++; if (cur.stage >= STAGES.length) { pi++; cur = path[pi] ? { id: path[pi].id, stage: 0 } : null; } };
    const learnToday = plan.find(p => p.k === "learn");
    if (learnToday && !learnToday.done) adv();
    for (let i = 0; i < 7; i++) {
      const dk = addDays(k, i), first = i === 0 && learnToday;
      const item = first ? STAGES[learnToday.stage].name : cur ? STAGES[cur.stage].name : "Revise";
      const who = first ? byId[learnToday.id].title : cur ? byId[cur.id].title : "";
      week.push(`<div class="day ${i === 0 ? "today" : ""} ${l.days[dk]?.done ? "done" : ""}"><b>${i === 0 ? "Today" : shortDay(dk)}</b><span title="${esc(who)}">${esc(who.split(" ")[0])}</span><span>${esc(item)}</span></div>`);
      if (!first) adv();
    }
    const upcoming = path.filter(s => s.id !== l.current?.id).slice(0, 4);
    main.innerHTML = `<div class="wrap">
      <header class="page-head plan-head"><div><p class="eyebrow">${esc(niceDate(k))}</p><h1>${l.guest ? "Today's plan" : `${esc(l.name)}'s plan for today`}</h1>
        <p>${l.minutes} minutes of shloka time. Finish every step to grow your streak <b>${icon("flame", "inline")}</b> ${streakOf(l)} ${streakOf(l) === 1 ? "day" : "days"}.</p></div>${ring(done, plan.length)}</header>
      ${l.guest ? `<p class="notice">Tip: <a href="#" data-profile>add your child's name and age</a> so the plan fits them.</p>` : ""}
      <div class="steps">${plan.map(stepHTML).join("")}</div>
      ${done === plan.length ? `<div class="card result" style="margin-top:16px"><div class="big">🎉</div><h2>Today's plan is complete!</h2><p class="muted">Want more? Play a game or learn ahead.</p><div class="row" style="justify-content:center"><a class="btn sky" href="#/games">Play a game</a><a class="btn ghost" href="#/learn">Explore</a></div></div>` : ""}
      <section class="section"><div class="section-head"><div><p class="eyebrow">Planning ahead</p><h2>This week</h2></div><a class="btn ghost sm" href="#" data-profile>Change daily time</a></div>
        <div class="week">${week.join("")}</div></section>
      <section class="section grid g2" style="align-items:start">
        <article class="card"><p class="eyebrow">Learning now</p>${l.current ? `<h2 style="font-size:1.4rem">${esc(byId[l.current.id].title)}</h2><p class="muted small" style="margin:4px 0 0">Day ${l.current.stage + 1} of 7 · ${esc(STAGES[l.current.stage].name)}</p>
          <div class="stages">${STAGES.map((_, i) => `<div class="${i < l.current.stage ? "done" : i === l.current.stage ? "now" : ""}" title="${esc(STAGES[i].name)}"></div>`).join("")}</div>
          <ol class="small muted" style="margin:12px 0 0;padding-left:20px">${STAGES.map((st, i) => `<li${i === l.current.stage ? ' style="color:var(--ink);font-weight:800"' : ""}>${esc(st.name)}</li>`).join("")}</ol>` : `<h2>You've learned every shloka! 🏆</h2>`}</article>
        <article class="card"><p class="eyebrow">Coming up next</p><div class="grid">${upcoming.map(s => skCard(l, s)).join("") || `<p class="muted">Nothing left. Amazing!</p>`}</div>
          <p class="small muted" style="margin:12px 0 0">Want a different shloka? Open any shloka and choose <b>Learn this in 7 days</b>.</p></article>
      </section></div>`;
  };

  V.learn = () => {
    const l = me();
    main.innerHTML = `<div class="wrap"><header class="page-head"><p class="eyebrow">Learn shlokas</p><h1>The shloka library</h1><p>${SH.length} shlokas on ${CATS.length - 1} shelves, each with Sanskrit text, pronunciation, word-by-word meanings and a guru voice.</p></header>
      <div class="filters"><label class="search">🔍<input type="search" id="lq" placeholder="Search: Ganesha, karma, morning…" aria-label="Search shlokas" autocomplete="off"></label>
        <div class="seg" role="group" aria-label="Level"><button type="button" data-lv="0" aria-pressed="true">All</button>${[1, 2, 3].map(a => `<button type="button" data-lv="${a}" aria-pressed="false">${LEVELS[a][2]} ${LEVELS[a][1]}</button>`).join("")}</div></div>
      <div id="lres"></div></div>`;
    let lv = 0;
    const draw = () => {
      const q = fold($("#lq").value.trim());
      if (!q && !lv) { $("#lres").innerHTML = catGrid(l); return; }
      const hits = SH.filter(s => (!lv || s.level === lv) && (!q || [s.title, s.iast.join(" "), s.mean, s.src, catById[s.cat].name, s.use || ""].some(x => fold(x).includes(q)) || s.dev.join(" ").includes($("#lq").value.trim())));
      $("#lres").innerHTML = `<p class="muted small">${hits.length} shloka${hits.length === 1 ? "" : "s"}</p><div class="list">${hits.map(s => skCard(l, s)).join("") || `<p class="muted">No shlokas match. Try another word.</p>`}</div>`;
    };
    $("#lq").addEventListener("input", draw);
    $(".seg").addEventListener("click", e => { const b = e.target.closest("[data-lv]"); if (!b) return; lv = +b.dataset.lv; $$(".seg [data-lv]").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); });
    draw();
  };

  V.category = id => {
    const l = me(), c = catById[id]; if (!c) return V.notFound();
    let body;
    if (id === "festival") {
      body = `<div class="festivals">${festList(l)}</div>`;
    } else {
      const list = SH.filter(s => s.cat === id).sort((a, b) => a.level - b.level);
      body = `<div class="list">${list.map(s => skCard(l, s)).join("")}</div>`;
    }
    main.innerHTML = `<div class="wrap"><header class="page-head"><p class="crumbs"><a href="#/learn">Learn</a> › ${esc(c.name)}</p>
      <div class="row" style="gap:14px"><span class="cat" style="--c:${c.color};padding:0;border:0;box-shadow:none;background:transparent"><span class="ic">${icon(c.icon)}</span></span><div><h1>${esc(c.name)}</h1><p lang="sa" style="margin:0">${esc(c.sa)}</p></div></div>
      <p>${esc(c.about)}</p></header><div style="margin-top:18px">${body}</div></div>`;
  };
  function festList(l) {
    const m = new Date().getMonth();
    return FEST.slice().sort((a, b) => ((a.months[0] - m + 12) % 12) - ((b.months[0] - m + 12) % 12) || 0).map(f => {
      const soon = f.months.includes(m) || f.months.includes((m + 1) % 12);
      return `<article class="card fest ${soon ? "soon" : ""}"><div class="when">${esc(f.when)}${soon ? `<br><span class="chip doing">Coming up</span>` : ""}</div>
        <div><h3 style="font-size:1.3rem">${esc(f.name)}</h3><p class="muted small" style="margin:2px 0 0">${esc(f.about)}</p>
        <div class="links">${f.shlokas.map(id => `<a class="chip" href="#/shloka/${id}">${esc(byId[id].title)}${l.learned[id] ? " ✓" : ""}</a>`).join("")}</div></div></article>`;
    }).join("");
  }
  V.festivals = () => {
    main.innerHTML = `<div class="wrap"><header class="page-head"><p class="eyebrow">Festival calendar</p><h1>Shlokas for every festival</h1>
      <p>Hindu festivals follow the lunar calendar, so their dates move each year. The usual months are shown here. Check your local pañcāṅga for this year's exact dates.</p></header>
      <div class="festivals" style="margin-top:18px">${festList(me())}</div></div>`;
  };

  V.shloka = (id, opt) => {
    const l = me(), s = byId[id]; if (!s) return V.notFound();
    const c = catById[s.cat], fests = FEST.filter(f => f.shlokas.includes(id));
    const lineHTML = d => d.split(/\s+/).map((w, i) => /^[।॥|]+$/.test(w) ? w : `<span class="w">${esc(w)}</span>`).join(" ");
    const isCur = l.current?.id === id, learned = l.learned[id];
    const yt = "https://www.youtube.com/results?search_query=" + encodeURIComponent(s.title.normalize("NFD").replace(/[̀-ͯ]/g, "") + " shloka for kids");
    main.innerHTML = `<div class="wrap">
      <header class="page-head"><p class="crumbs"><a href="#/learn">Learn</a> › <a href="#/learn/${c.id}">${esc(c.name)}</a></p>
        <h1>${esc(s.title)}</h1><div class="row" style="margin-top:8px">${levelChip(s)}${statusChip(l, s)}${s.use ? `<span class="chip">🕰️ ${esc(s.use)}</span>` : ""}</div></header>
      <div class="detail" style="margin-top:18px">
        <div class="grid">
          <section class="sanskrit" aria-label="Shloka text">
            <div class="row" style="justify-content:space-between"><p class="eyebrow" style="margin:0">Sanskrit</p>
              <div class="seg" role="group" aria-label="Text size"><button type="button" data-size="-1" aria-label="Smaller text">A−</button><button type="button" data-size="1" aria-label="Larger text">A+</button></div></div>
            <div class="lines" lang="sa">${s.dev.map(d => `<span class="line">${lineHTML(d)}</span>`).join("")}</div>
            <div class="iast-lines"><p class="eyebrow">Say it like this</p>${s.iast.map(t => `<span>${esc(t)}</span>`).join("")}</div>
            <div class="player">
              <button class="btn sky" data-play="1">${icon("play")} Listen</button>
              <button class="btn ghost" data-play="0.6">${icon("slow")} Slow</button>
              <button class="btn" data-guru>${icon("repeat")} Repeat after Guru</button>
              <button class="btn ghost" data-stop hidden>${icon("stop")} Stop</button>
            </div>
            <div class="player-status" id="pstat" role="status"></div>
            ${!synth ? `<p class="notice">This browser can't play the guru voice. Try Chrome, Edge or Safari.</p>` : ""}
            <p class="notice" id="voice-note" hidden>No Hindi voice was found on this device, so the guru voice may not sound right. On a phone or tablet, add a Hindi voice in the device's speech settings.</p>
          </section>
          <section class="card"><h2 style="font-size:1.35rem;margin-bottom:8px">What it means</h2><p class="meaning">${esc(s.mean)}</p></section>
          <section class="card"><h2 style="font-size:1.35rem;margin-bottom:8px">Word by word</h2><table class="words"><tbody>${words(s).map(([w, m]) => `<tr><td>${esc(w)}</td><td>${esc(m)}</td></tr>`).join("")}</tbody></table></section>
        </div>
        <aside class="side">
          <section class="card"><h2>Learn it in 7 days</h2>
            ${learned ? `<p class="muted small">Learned on ${esc(niceDate(learned.date))}. Next revision: ${esc(niceDate(learned.next))}.</p><button class="btn green sm" data-review="${s.id}">I remembered it today</button>`
              : isCur ? `<p class="muted small" style="margin:0 0 8px">Day ${l.current.stage + 1} of 7 · ${esc(STAGES[l.current.stage].name)}</p><div class="stages">${STAGES.map((_, i) => `<div class="${i < l.current.stage ? "done" : i === l.current.stage ? "now" : ""}"></div>`).join("")}</div><div class="row" style="margin-top:12px"><a class="btn sm" href="#/today">Today's step</a><button class="btn green sm" data-learned="${s.id}">I know it by heart</button></div>`
              : `<p class="muted small">Learn a little each day: listen, repeat, play, record and recite.</p><div class="row"><button class="btn sm" data-start="${s.id}">Learn this in 7 days</button><button class="btn ghost sm" data-learned="${s.id}">I already know it</button></div>`}
          </section>
          <section class="card recorder"><h2>Record yourself</h2><p class="muted small" style="margin:-4px 0 10px">Recite the shloka, then listen to yourself and compare with the guru.</p>
            <div class="row"><button class="btn" data-rec>${icon("mic")} Record</button><button class="btn ghost" data-compare hidden>Compare with guru</button></div>
            <div id="rec-out" class="player-status"></div></section>
          <section class="card"><h2>More</h2><div class="grid" style="gap:8px">
            <a class="btn ghost sm" href="#/worksheet/${s.id}">${icon("print")} Printable worksheet &amp; PDF</a>
            <a class="btn ghost sm" href="${yt}" target="_blank" rel="noopener">${icon("video")} Watch a recitation on YouTube</a>
            <div class="row">${["match", "fill", "arrange"].map(g => `<a class="chip" href="#/games/${g}/${s.id}">${GAMES[g].emoji} ${GAMES[g].name}</a>`).join("")}${s.dev.length > 1 ? `<a class="chip" href="#/games/order/${s.id}">${GAMES.order.emoji} ${GAMES.order.name}</a>` : ""}</div></div></section>
          <section class="card"><h2>About this shloka</h2><dl class="facts-list">
            <div><dt>Source</dt><dd>${esc(s.src)}</dd></div><div><dt>Shelf</dt><dd><a href="#/learn/${c.id}">${esc(c.name)}</a></dd></div>
            ${s.use ? `<div><dt>When</dt><dd>${esc(s.use)}</dd></div>` : ""}${fests.length ? `<div><dt>Festivals</dt><dd>${fests.map(f => esc(f.name)).join(", ")}</dd></div>` : ""}
            <div><dt>Level</dt><dd>${LEVELS[s.level][0]} · ${LEVELS[s.level][1]}</dd></div></dl></section>
        </aside>
      </div></div>`;
    const root = $(".sanskrit"), stat = h => { $("#pstat").innerHTML = h; };
    if (synth && voices.length && !guruVoice()) $("#voice-note").hidden = false;
    const playing = on => { $("[data-stop]").hidden = !on; $$("[data-play],[data-guru]").forEach(b => b.disabled = on); };
    root.addEventListener("click", async e => {
      const p = e.target.closest("[data-play]"), g = e.target.closest("[data-guru]"), sz = e.target.closest("[data-size]");
      if (sz) { setScale(+sz.dataset.size); return; }
      if (e.target.closest("[data-stop]")) { stopAudio(); playing(false); stat("Stopped."); return; }
      if (p || g) { playing(true); await playShloka(s, { rate: p ? +p.dataset.play : 0.85, guru: !!g, root, onStatus: stat }); playing(false); }
    });
    let recUrl = null;
    const side = $(".side");
    side.addEventListener("click", async e => {
      const r = e.target.closest("[data-rec]");
      if (r) {
        if (rec) { stopRecording(); return; }
        stopAudio();
        await startRecording(st => {
          if (st.error) { $("#rec-out").textContent = st.error; return; }
          if (st.recording) { r.innerHTML = `${icon("stop")} Stop recording`; $("#rec-out").innerHTML = `<span class="rec-dot"></span> Recording… recite the shloka now.`; return; }
          r.innerHTML = `${icon("mic")} Record again`; recUrl = st.url;
          $("#rec-out").innerHTML = `<audio controls src="${st.url}"></audio>`; $("[data-compare]").hidden = false;
          track("record", { id: s.id });
        });
      }
      if (e.target.closest("[data-compare]") && recUrl) {
        $("#rec-out audio")?.pause(); stat("First the guru…");
        const ok = await playShloka(s, { rate: 0.85, root, onStatus: stat });
        if (ok) { stat("Now you!"); const a = $("#rec-out audio"); a.currentTime = 0; a.play(); }
      }
      if (e.target.closest("[data-start]")) {
        l.current = { id: s.id, stage: 0, since: today() };
        const dr = dayRec(l), ls = dr.plan?.find(p => p.k === "learn"); if (ls && !ls.done) { ls.id = s.id; ls.stage = 0; }
        save(); toastMsg(`${s.title} is now in your daily plan 📅`); route();
      }
    });
    if (opt === "guru") setTimeout(() => $("[data-guru]")?.click(), 400);
    if (opt === "record") $(".recorder").scrollIntoView({ behavior: "smooth", block: "center" });
  };
  function setScale(d) { const v = Math.min(1.5, Math.max(.8, +(LS.get("scale", 1) + d * .1).toFixed(2))); LS.set("scale", v); document.documentElement.style.setProperty("--scale", v); }

  V.worksheet = id => {
    const s = byId[id]; if (!s) return V.notFound();
    const w = words(s).slice(0, 6), mixed = shuffle(w.map(x => x[1]));
    main.innerHTML = `<div class="wrap" style="padding-top:20px">
      <div class="row no-print" style="margin-bottom:14px"><a class="btn ghost sm" href="#/shloka/${s.id}">← Back</a><button class="btn sm" data-print>${icon("print")} Print or save as PDF</button><span class="muted small">To save a PDF, choose “Save as PDF” in the print window.</span></div>
      <article class="worksheet">
        <div class="row" style="justify-content:space-between"><p class="eyebrow" style="margin:0">Shlokha Dhaara · Worksheet</p><p class="small" style="margin:0">Name: ____________________ &nbsp; Date: __________</p></div>
        <h1 style="margin-top:8px">${esc(s.title)}</h1><p class="small muted" style="margin:2px 0 0">${esc(s.src)}</p>
        <div class="ws-box"><p lang="sa" style="font:400 1.55rem/1.7 var(--deva);margin:0">${s.dev.map(esc).join("<br>")}</p><p style="font-style:italic;margin:10px 0 0">${s.iast.map(esc).join("<br>")}</p></div>
        <div class="ws-box"><b>What it means</b><p style="margin:4px 0 0">${esc(s.mean)}</p></div>
        <div class="ws-box"><b>Match each word to its meaning</b> (draw a line)<div class="ws-match" style="margin-top:8px"><div>${w.map((x, i) => `<span>${i + 1}. <i>${esc(x[0])}</i></span>`).join("")}</div><div>${mixed.map((m, i) => `<span>${"ABCDEF"[i]}. ${esc(m)}</span>`).join("")}</div></div></div>
        <div class="ws-box"><b>Write the shloka from memory</b><div class="ws-lines">${s.dev.map(() => "<div></div><div></div>").join("")}</div></div>
        <div class="ws-box" style="min-height:180px"><b>Draw a picture about this shloka</b></div>
        <p class="small">I practised this shloka ☐ Mon ☐ Tue ☐ Wed ☐ Thu ☐ Fri ☐ Sat ☐ Sun &nbsp; · &nbsp; Parent / teacher signature: ______________</p>
      </article></div>`;
    $("[data-print]").addEventListener("click", () => print());
  };

  /* ================= Games ================= */
  function poolFor(l, focus) {
    if (focus && byId[focus]) return [byId[focus]];
    const ids = Object.keys(l.learned); if (l.current) ids.push(l.current.id);
    const pool = ids.map(id => byId[id]).filter(Boolean);
    for (const s of pathFor(l)) { if (pool.length >= 5) break; if (!pool.includes(s)) pool.push(s); }
    return pool;
  }
  V.games = () => {
    const l = me();
    main.innerHTML = `<div class="wrap"><header class="page-head"><p class="eyebrow">Kids game zone</p><h1>Play &amp; remember</h1><p>Every game uses the shlokas you're learning. Win games to earn points and badges!</p></header>
      <div class="tile" style="display:inline-block;margin:10px 0 18px"><b>💎 ${l.points}</b><span>points · ${l.stats.games} games played</span></div>
      <div class="game-tiles">${Object.entries(GAMES).map(([k, g]) => `<a class="game-tile" href="#/games/${k}"><span class="emoji">${g.emoji}</span><b>${g.name}</b><span>${g.about}</span></a>`).join("")}</div>
      <p class="muted small" style="margin-top:18px">Games use ${l.current || learnedCount(l) ? "the shlokas you've learned and the one you're learning now" : "the first shlokas on your learning path"}. To practise one shloka, open it and pick a game.</p></div>`;
  };
  V.game = (type, focus) => {
    const l = me(), g = GAMES[type]; if (!g) return V.notFound();
    const pool = poolFor(l, focus);
    const shell = (inner, sub) => {
      main.innerHTML = `<div class="wrap"><div class="game"><header class="page-head"><p class="crumbs"><a href="#/games">Games</a>${focus ? ` › <a href="#/shloka/${focus}">${esc(byId[focus].title)}</a>` : ""}</p><h1>${g.emoji} ${g.name}</h1><p>${sub || g.about}</p></header>
        <div class="card" style="margin-top:14px" id="gbox">${inner}</div></div></div>`;
      return $("#gbox");
    };
    const finish = (score, total, focusId) => {
      const stars = total ? Math.max(1, Math.round(score / total * 3)) : 3;
      track("game", { type, id: focusId || (pool.length === 1 ? pool[0].id : null) });
      if (stars === 3) celebrate();
      $("#gbox").innerHTML = `<div class="result"><div class="big">${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}</div><h2 style="margin-top:10px">${["", "Good try!", "Well done!", "Perfect!"][stars]}</h2>
        <p class="muted">${total ? `${score} of ${total} right · ` : ""}+10 points</p>
        <div class="row" style="justify-content:center"><button class="btn" data-again>Play again</button><a class="btn ghost" href="#/today">Back to today's plan</a></div></div>`;
      $("[data-again]").addEventListener("click", () => V.game(type, focus));
    };
    const fid = focus || null;

    if (type === "fill") {
      const qs = [];
      for (const s of shuffle(pool)) s.iast.forEach(line => { const t = tokens(line); t.forEach((w, i) => { if (w.replace(/[^a-zāīūṛṝḷēōṃṁḥṅñṭḍṇśṣ']/gi, "").length >= 3) qs.push({ s, line, i, t }); }); });
      const rounds = shuffle(qs).slice(0, 5);
      if (!rounds.length) { shell(`<p>This shloka is too short for this game. Try Match the Meanings!</p>`); return; }
      const allWords = [...new Set(SH.flatMap(s => s.iast.flatMap(tokens)).filter(w => w.length >= 3))];
      let r = 0, score = 0;
      const box = shell("");
      const draw = () => {
        const q = rounds[r], ans = q.t[q.i];
        const opts = shuffle([ans, ...shuffle(allWords.filter(w => w !== ans)).slice(0, 3)]);
        box.innerHTML = `<div class="game-bar"><b>${esc(q.s.title)}</b><div class="dots">${rounds.map((_, i) => `<i class="${i < r ? (rounds[i].ok ? "ok" : "bad") : i === r ? "cur" : ""}"></i>`).join("")}</div></div>
          <p class="q-text">${q.t.map((w, i) => i === q.i ? `<span class="blank">?</span>` : esc(w)).join(" ")}</p>
          <p class="muted small">Hint: ${esc(q.s.mean.split(". ")[0])}.</p>
          <div class="opts">${opts.map(o => `<button class="opt" data-o="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
        box.querySelector(".opts").addEventListener("click", e => {
          const b = e.target.closest(".opt"); if (!b || box.dataset.lock) return;
          box.dataset.lock = 1; const ok = b.dataset.o === ans; q.ok = ok; if (ok) score++;
          b.classList.add(ok ? "ok" : "bad"); if (!ok) $$(".opt", box).find(x => x.dataset.o === ans)?.classList.add("ok");
          box.querySelector(".blank").textContent = ans;
          setTimeout(() => { delete box.dataset.lock; r++; r < rounds.length ? draw() : finish(score, rounds.length, fid); }, ok ? 800 : 1500);
        });
      };
      draw(); return;
    }

    if (type === "match") {
      const s = focus ? byId[focus] : pick(pool.filter(x => words(x).length >= 4)) || pool[0];
      const pairs = shuffle(words(s)).slice(0, 5);
      let sel = null, mistakes = 0, left = pairs.length;
      const box = shell(`<div class="game-bar"><b>${esc(s.title)}</b><span class="muted small">Tap a word, then its meaning</span></div>
        <div class="match"><div class="col">${shuffle(pairs).map(([w]) => `<button class="opt" data-w="${esc(w)}"><i>${esc(w)}</i></button>`).join("")}</div>
        <div class="col">${shuffle(pairs).map(([w, m]) => `<button class="opt" data-m="${esc(w)}">${esc(m)}</button>`).join("")}</div></div>`);
      box.addEventListener("click", e => {
        const b = e.target.closest(".opt"); if (!b || b.classList.contains("gone")) return;
        if (b.dataset.w) { $$("[data-w]", box).forEach(x => x.classList.remove("sel")); b.classList.add("sel"); sel = b; return; }
        if (!sel) { toastMsg("First tap a Sanskrit word"); return; }
        if (b.dataset.m === sel.dataset.w) { [b, sel].forEach(x => { x.classList.remove("sel"); x.classList.add("ok"); setTimeout(() => x.classList.add("gone"), 400); }); sel = null; if (--left === 0) setTimeout(() => finish(Math.max(0, pairs.length - mistakes), pairs.length, s.id === focus ? fid : null), 600); }
        else { mistakes++; b.classList.add("bad"); setTimeout(() => b.classList.remove("bad"), 600); }
      });
      return;
    }

    if (type === "memory") {
      let ws = focus ? words(byId[focus]) : shuffle(pool).flatMap(words);
      const seen = new Set(); ws = shuffle(ws).filter(([w]) => !seen.has(w) && seen.add(w)).slice(0, 6);
      const cards = shuffle(ws.flatMap(([w, m], i) => [{ p: i, t: w, sa: true }, { p: i, t: m }]));
      let up = [], got = 0, moves = 0;
      const box = shell(`<div class="game-bar"><b>Find the pairs</b><span class="muted small" id="moves">0 moves</span></div>
        <div class="memory">${cards.map((c, i) => `<button class="mc" data-i="${i}" aria-label="Card ${i + 1}"><span class="mc-in"><span class="mc-f">🪷</span><span class="mc-b ${c.sa ? "sa" : ""}">${esc(c.t)}</span></span></button>`).join("")}</div>`);
      box.addEventListener("click", e => {
        const b = e.target.closest(".mc"); if (!b || b.classList.contains("up") || b.classList.contains("got") || up.length === 2) return;
        b.classList.add("up"); up.push(b);
        if (up.length === 2) {
          moves++; $("#moves").textContent = moves + " moves";
          const [a, c] = up.map(x => cards[x.dataset.i]);
          if (a.p === c.p && a !== c) { setTimeout(() => { up.forEach(x => x.classList.add("got")); up = []; if (++got === ws.length) setTimeout(() => finish(Math.max(ws.length * 2 - (moves - ws.length), ws.length), ws.length * 2, fid), 500); }, 400); }
          else setTimeout(() => { up.forEach(x => x.classList.remove("up")); up = []; }, 900);
        }
      });
      return;
    }

    if (type === "arrange") {
      const lines = focus ? byId[focus].iast.map(line => ({ s: byId[focus], line })) : shuffle(pool.flatMap(s => s.iast.map(line => ({ s, line })))).slice(0, 3);
      const rounds = lines.filter(x => tokens(x.line).length >= 2).slice(0, 4);
      if (!rounds.length) { shell(`<p>This shloka is a single phrase. Try Match the Meanings!</p>`); return; }
      let r = 0, score = 0;
      const box = shell("");
      const draw = () => {
        const q = rounds[r], t = tokens(q.line); let mix = shuffle(t.map((w, i) => ({ w, i }))); if (mix.every((x, i) => x.i === i)) mix.reverse();
        let placed = [], first = true;
        box.innerHTML = `<div class="game-bar"><b>${esc(q.s.title)} · line ${q.s.iast.indexOf(q.line) + 1}</b><div class="dots">${rounds.map((_, i) => `<i class="${i < r ? "ok" : i === r ? "cur" : ""}"></i>`).join("")}</div></div>
          <p class="muted small">Tap the words in order. Tap a placed word to take it back.</p>
          <div class="tray" id="tray"></div><div class="pieces" id="pcs"></div>`;
        const paint = () => {
          $("#tray").innerHTML = placed.map((x, k) => `<button class="piece" data-back="${k}">${esc(x.w)}</button>`).join("");
          $("#pcs").innerHTML = mix.map((x, k) => placed.includes(x) ? "" : `<button class="piece" data-k="${k}">${esc(x.w)}</button>`).join("");
          if (placed.length === t.length) {
            const ok = placed.map(x => x.w).join(" ") === t.join(" ");
            $("#tray").classList.toggle("ok", ok); $("#tray").classList.toggle("bad", !ok);
            if (ok) { if (first) score++; setTimeout(() => { r++; r < rounds.length ? draw() : finish(score, rounds.length, fid); }, 900); }
            else { first = false; setTimeout(() => $("#tray")?.classList.remove("bad"), 500); }
          } else $("#tray").classList.remove("ok", "bad");
        };
        box.onclick = e => {
          const k = e.target.closest("[data-k]"), bk = e.target.closest("[data-back]");
          if (k) placed.push(mix[+k.dataset.k]); else if (bk) placed.splice(+bk.dataset.back, 1); else return;
          paint();
        };
        paint();
      };
      draw(); return;
    }

    if (type === "order") {
      const cand = focus && byId[focus].dev.length > 1 ? [byId[focus]] : shuffle(pool.filter(s => s.dev.length > 1)).slice(0, 2);
      const list = cand.length ? cand : shuffle(SH.filter(s => s.dev.length > 1 && s.level <= l.age)).slice(0, 2);
      let r = 0, score = 0;
      const box = shell("");
      const draw = () => {
        const s = list[r]; let mix = shuffle(s.dev.map((d, i) => ({ d, i }))); if (mix.every((x, i) => x.i === i)) mix.reverse();
        let placed = [], first = true;
        box.innerHTML = `<div class="game-bar"><b>${esc(s.title)}</b><div class="dots">${list.map((_, i) => `<i class="${i < r ? "ok" : i === r ? "cur" : ""}"></i>`).join("")}</div></div>
          <p class="muted small">Tap the lines from first to last.</p><div class="tray" id="tray" style="flex-direction:column"></div><div class="pieces" id="pcs" style="flex-direction:column"></div>`;
        const paint = () => {
          $("#tray").innerHTML = placed.map((x, k) => `<button class="piece deva-piece" data-back="${k}" lang="sa">${k + 1}. ${esc(x.d)}</button>`).join("");
          $("#pcs").innerHTML = mix.map((x, k) => placed.includes(x) ? "" : `<button class="piece deva-piece" data-k="${k}" lang="sa">${esc(x.d)}</button>`).join("");
          if (placed.length === s.dev.length) {
            const ok = placed.every((x, i) => x.i === i);
            $("#tray").classList.toggle("ok", ok); $("#tray").classList.toggle("bad", !ok);
            if (ok) { if (first) score++; setTimeout(() => { r++; r < list.length ? draw() : finish(score, list.length, fid); }, 900); }
            else { first = false; setTimeout(() => $("#tray")?.classList.remove("bad"), 500); }
          } else $("#tray").classList.remove("ok", "bad");
        };
        box.onclick = e => {
          const k = e.target.closest("[data-k]"), bk = e.target.closest("[data-back]");
          if (k) placed.push(mix[+k.dataset.k]); else if (bk) placed.splice(+bk.dataset.back, 1); else return;
          paint();
        };
        paint();
      };
      draw();
    }
  };

  /* ================= Progress ================= */
  const weekChart = l => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
    const max = Math.max(5, ...days.map(k => minutesOn(l, k)));
    return `<div class="chart">${days.map(k => { const m = minutesOn(l, k); return `<div class="bar"><b>${m}</b><i style="height:${m / max * 100}%"></i><span>${shortDay(k)}${l.days[k]?.done ? " ✓" : ""}</span></div>`; }).join("")}</div>`;
  };
  V.progress = () => {
    const l = me();
    const ch = l.challenge, chDone = challengeDone(l);
    const learnedList = Object.entries(l.learned).sort((a, b) => b[1].date.localeCompare(a[1].date));
    main.innerHTML = `<div class="wrap"><header class="page-head"><p class="eyebrow">My progress</p><h1>${l.guest ? "Your" : esc(l.name) + "'s"} journey</h1></header>
      <section class="section grid g4" style="padding-top:18px">
        ${[["🔥", streakOf(l), "day streak"], ["🪔", learnedCount(l), "shlokas learned"], ["💎", l.points, "points"], ["📅", doneDays(l), "plans finished"]].map(([e, v, t]) => `<div class="tile"><b>${e} ${v}</b><span>${t}</span></div>`).join("")}
      </section>
      <section class="section grid g2">
        <article class="card"><h2 style="font-size:1.35rem">Minutes practised this week</h2>${weekChart(l)}</article>
        <article class="card"><div class="row" style="justify-content:space-between"><h2 style="font-size:1.35rem">21-day shloka challenge</h2>${ch ? `<span class="chip">${chDone}/21</span>` : ""}</div>
          ${ch ? `<p class="muted small">Started ${esc(niceDate(ch.start))}. Finish your daily plan each day to fill a lamp.</p><div class="challenge">${Array.from({ length: 21 }, (_, i) => `<div class="${l.days[addDays(ch.start, i)]?.done ? "done" : ""}" title="${esc(niceDate(addDays(ch.start, i)))}">${l.days[addDays(ch.start, i)]?.done ? "🪔" : i + 1}</div>`).join("")}</div>
            ${dayNum(today()) - dayNum(ch.start) >= 21 ? `<button class="btn sm" style="margin-top:12px" data-challenge>Start a new challenge</button>` : ""}`
            : `<p class="muted">Finish your plan every day for 21 days. Every day lights a lamp, and all 21 earns the champion badge 🏆.</p><button class="btn" data-challenge>Start the challenge</button>`}</article>
      </section>
      <section class="section"><div class="section-head"><h2>Badges</h2><span class="muted small">${l.badges.length} of ${BADGES.length} earned</span></div>
        <div class="badges">${BADGES.map(([id, em, n, d]) => `<div class="badge ${l.badges.some(b => b.id === id) ? "" : "off"}"><span class="em">${em}</span><b>${n}</b><span>${d}</span></div>`).join("")}</div></section>
      <section class="section grid g2">
        <article class="card"><h2 style="font-size:1.35rem;margin-bottom:8px">Shlokas learned</h2>${learnedList.length ? `<ul class="history">${learnedList.map(([id, v]) => `<li><a href="#/shloka/${id}">${esc(byId[id].title)}</a><span class="muted small">revise ${v.next <= today() ? "today" : esc(niceDate(v.next).split(",")[0])}</span></li>`).join("")}</ul>` : `<p class="muted">None yet. Your first one is in today's plan!</p>`}</article>
        <article class="card"><h2 style="font-size:1.35rem;margin-bottom:8px">Practice history</h2>${l.history.length ? `<ul class="history">${l.history.slice(0, 12).map(h => `<li><span>${esc(h.text)}<br><span class="muted small">${new Date(h.t).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}</span></span><span class="pts">+${h.pts}</span></li>`).join("")}</ul>` : `<p class="muted">Your practice will appear here.</p>`}</article>
      </section>
      <section class="section"><article class="card row" style="justify-content:space-between"><div><h2 style="font-size:1.35rem">Certificate</h2><p class="muted small" style="margin:4px 0 0">${learnedCount(l) ? `Download a certificate for ${learnedCount(l)} shloka${learnedCount(l) === 1 ? "" : "s"} learned.` : "Learn your first shloka to unlock a certificate."}</p></div>
        <button class="btn" data-cert ${learnedCount(l) ? "" : "disabled"}>🏅 Download certificate</button></article></section></div>`;
    main.querySelector(".wrap").addEventListener("click", e => {
      if (e.target.closest("[data-challenge]")) { l.challenge = { start: today() }; save(); toastMsg("Challenge started! See you tomorrow too 🪔"); route(); }
      if (e.target.closest("[data-cert]")) certificate(l);
    });
  };
  function certificate(l) {
    const cv = document.createElement("canvas"); cv.width = 1600; cv.height = 1130; const g = cv.getContext("2d");
    g.fillStyle = "#fbf3e2"; g.fillRect(0, 0, 1600, 1130);
    g.strokeStyle = "#6e1414"; g.lineWidth = 18; g.strokeRect(40, 40, 1520, 1050);
    g.strokeStyle = "#d69e14"; g.lineWidth = 4; g.strokeRect(78, 78, 1444, 974);
    for (let x = 120; x < 1490; x += 46) { g.fillStyle = x % 92 ? "#e09a1a" : "#9f1d20"; g.beginPath(); g.arc(x, 112, 7, 0, 7); g.fill(); g.beginPath(); g.arc(x, 1018, 7, 0, 7); g.fill(); }
    g.textAlign = "center"; g.fillStyle = "#c2410c"; g.font = "92px 'Tiro Devanagari Sanskrit', serif"; g.fillText("ॐ", 800, 250);
    g.fillStyle = "#3b1f12"; g.font = "76px 'Tiro Devanagari Sanskrit', Georgia, serif"; g.fillText("Certificate of Learning", 800, 360);
    g.font = "600 34px Nunito, sans-serif"; g.fillStyle = "#55607a"; g.fillText("This is proudly presented to", 800, 440);
    g.font = "96px 'Tiro Devanagari Sanskrit', Georgia, serif"; g.fillStyle = "#9f1d20"; g.fillText(l.guest ? "A Shining Learner" : l.name, 800, 560);
    const n = learnedCount(l);
    g.font = "600 36px Nunito, sans-serif"; g.fillStyle = "#1f2a44"; g.fillText(`for learning ${n} shloka${n === 1 ? "" : "s"} by heart at Shlokha Dhaara`, 800, 640);
    const names = Object.keys(l.learned).map(id => byId[id].title.normalize("NFC"));
    g.font = "italic 600 28px Nunito, sans-serif"; g.fillStyle = "#0369a1";
    const lines = []; let cur = "";
    for (const t of names.slice(0, 18)) { const next = cur ? cur + "  ·  " + t : t; if (g.measureText(next).width > 1250) { lines.push(cur); cur = t; } else cur = next; }
    if (cur) lines.push(cur + (names.length > 18 ? `  ·  and ${names.length - 18} more` : ""));
    lines.slice(0, 3).forEach((t, i) => g.fillText(t, 800, 710 + i * 44));
    g.font = "600 28px Nunito, sans-serif"; g.fillStyle = "#55607a";
    g.fillText(new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }), 420, 930);
    g.fillText("Parent / Teacher", 1180, 930);
    g.strokeStyle = "#c9d2e3"; g.lineWidth = 3; g.beginPath(); g.moveTo(260, 890); g.lineTo(580, 890); g.moveTo(1020, 890); g.lineTo(1340, 890); g.stroke();
    g.font = "34px 'Tiro Devanagari Sanskrit', serif"; g.fillStyle = "#d69e14"; g.fillText("सर्वे भवन्तु सुखिनः", 800, 980);
    const a = document.createElement("a"); a.download = `Shlokha-Dhaara-certificate-${(l.name || "learner").replace(/\W+/g, "-")}.png`; a.href = cv.toDataURL("image/png"); a.click();
    celebrate(); toastMsg("Certificate downloaded 🏅");
  }

  /* ================= Parents & teachers ================= */
  V.parents = () => {
    const wk = l => Array.from({ length: 7 }, (_, i) => minutesOn(l, addDays(today(), -i))).reduce((a, b) => a + b, 0);
    main.innerHTML = `<div class="wrap"><header class="page-head"><p class="eyebrow">For parents &amp; teachers</p><h1>Parent dashboard</h1>
      <p>See how each child is doing, set daily chant reminders, and print worksheets. All progress is stored privately on this device.</p></header>
      <section class="section" style="padding-top:18px"><div class="section-head"><h2>Children</h2><button class="btn sm" data-add>＋ Add a child</button></div>
      <div class="grid g2">${db.learners.map(l => {
        const plan = planFor(l), done = plan.filter(p => p.done).length;
        return `<article class="card kid-card">
          <div class="kid-top"><span class="avatar">${esc(l.name[0]?.toUpperCase() || "?")}</span><div style="flex:1;min-width:0"><h3 style="font-size:1.35rem">${esc(l.name)}${l.id === me().id ? ` <span class="chip">active</span>` : ""}</h3>
            <p class="muted small" style="margin:0">${LEVELS[l.age][0]} · ${l.minutes} min a day · chant time ${esc(l.chant)}</p></div></div>
          <div class="kid-stats"><div><b>${learnedCount(l)}</b><span>learned</span></div><div><b>${streakOf(l)}</b><span>day streak</span></div><div><b>${wk(l)}</b><span>minutes this week</span></div><div><b>${minutesOn(l, today())}</b><span>screen time today (min)</span></div></div>
          <p class="small" style="margin:0"><b>Today:</b> ${done} of ${plan.length} steps done. ${l.current ? `<b>Learning:</b> ${esc(byId[l.current.id].title)} (day ${l.current.stage + 1} of 7).` : ""}</p>
          ${weekChart(l)}
          <div><b class="small">Recent achievements</b><ul class="history">${l.notes.slice(0, 4).map(n => `<li><span>${esc(n.text)}</span><span class="muted small">${new Date(n.t).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span></li>`).join("") || `<li class="muted">No achievements yet.</li>`}</ul></div>
          <div class="row">${l.id !== me().id ? `<button class="btn sky sm" data-use="${l.id}">Switch to ${esc(l.name)}</button>` : ""}<button class="btn ghost sm" data-editk="${l.id}">Edit</button><button class="btn ghost sm" data-report="${l.id}">Download report</button><button class="btn ghost sm" data-ics="${l.id}">📅 Add daily reminder</button><button class="btn ghost sm" data-del="${l.id}">Remove</button></div>
          <div class="notice" data-confirm="${l.id}" hidden>Remove ${esc(l.name)} and all their progress from this device? <button class="btn sm" style="margin-left:6px" data-delyes="${l.id}">Yes, remove</button> <button class="btn ghost sm" data-delno>Keep</button></div>
        </article>`; }).join("")}</div></section>
      <section class="section grid g2">
        <article class="card"><h2 style="font-size:1.35rem">Practice reminders</h2>
          <p class="muted small">Use <b>Add daily reminder</b> to put each child's chant time in your phone's calendar, so you're reminded even when this site is closed. While the site is open, it can also show a reminder at chant time if the plan isn't finished.</p>
          <button class="btn sky sm" data-notify>${"Notification" in window && Notification.permission === "granted" ? "Browser reminders are on ✓" : "Turn on browser reminders"}</button></article>
        <article class="card"><h2 style="font-size:1.35rem">Back up progress</h2><p class="muted small">Progress lives in this browser. Download a backup to keep it safe or move it to another device.</p>
          <div class="row"><button class="btn ghost sm" data-export>Download backup</button><label class="btn ghost sm" style="cursor:pointer">Restore backup<input type="file" accept="application/json" data-import hidden></label></div></article>
      </section>
      <section class="section grid g2">
        <article class="card"><h2 style="font-size:1.35rem">Teacher corner</h2><p class="muted small">Print a worksheet for any shloka to use in class or at home. Each one has the text, meaning, a word-matching exercise, writing lines and a weekly practice checklist.</p>
          <form class="form" data-ws><label>Shloka<select name="s">${CATS.filter(c => c.id !== "festival").map(c => `<optgroup label="${esc(c.name)}">${SH.filter(s => s.cat === c.id).map(s => `<option value="${s.id}">${esc(s.title)}</option>`).join("")}</optgroup>`).join("")}</select></label><button class="btn sm" type="submit">${icon("print")} Open worksheet</button></form></article>
        <article class="card"><h2 style="font-size:1.35rem">Coming next</h2><p class="muted small">These need online accounts and a secure server, so they're planned for a later version:</p>
          <ul class="roadmap small"><li>Teacher dashboard: classes, assigning shlokas, recitation assessments</li><li>Family accounts that sync across devices</li><li>Community: recitation uploads, monthly chanting competitions and leaderboards</li><li>AI pronunciation scoring and feedback</li><li>Hindi, Telugu, Tamil and Kannada meanings</li><li>Recorded audio and video by trained teachers</li></ul></article>
      </section></div>`;
    const w = main.querySelector(".wrap");
    w.addEventListener("click", e => {
      const t = e.target.closest("button"); if (!t) return;
      const L = id => db.learners.find(x => x.id === id);
      if (t.hasAttribute("data-add")) profileForm(null);
      if (t.dataset.use) { db.active = t.dataset.use; save(); renderWho(); route(); }
      if (t.dataset.editk) profileForm(L(t.dataset.editk));
      if (t.dataset.del) { if (db.learners.length === 1) { toastMsg("Add another child before removing the last one."); return; } $(`[data-confirm="${t.dataset.del}"]`).hidden = false; }
      if (t.hasAttribute("data-delno")) t.closest("[data-confirm]").hidden = true;
      if (t.dataset.delyes) { db.learners = db.learners.filter(x => x.id !== t.dataset.delyes); if (!L(db.active)) db.active = db.learners[0].id; save(); renderWho(); route(); }
      if (t.dataset.report) report(L(t.dataset.report));
      if (t.dataset.ics) ics(L(t.dataset.ics));
      if (t.hasAttribute("data-export")) download(`shlokha-dhaara-backup-${today()}.json`, JSON.stringify(db, null, 1), "application/json");
      if (t.hasAttribute("data-notify")) {
        if (!("Notification" in window)) { toastMsg("This browser doesn't support reminders. Use the calendar reminder instead."); return; }
        Notification.requestPermission().then(p => { toastMsg(p === "granted" ? "Reminders are on while the site is open 🔔" : "Reminders were not allowed."); route(); });
      }
    });
    $("[data-import]", w).addEventListener("change", async e => {
      const f = e.target.files[0]; if (!f) return;
      try { const d = JSON.parse(await f.text()); if (!Array.isArray(d.learners) || !d.learners.length) throw 0; db = d; save(); renderWho(); route(); toastMsg("Backup restored ✓"); }
      catch { toastMsg("That file isn't a Shlokha Dhaara backup."); }
    });
    $("[data-ws]", w).addEventListener("submit", e => { e.preventDefault(); location.hash = "#/worksheet/" + new FormData(e.target).get("s"); });
  };
  function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  function report(l) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
    const lines = [`Shlokha Dhaara: learning report for ${l.name}`, `Date: ${niceDate(today())}`, "",
      `Level: ${LEVELS[l.age][0]} (${LEVELS[l.age][1]}) · Daily time: ${l.minutes} minutes`, `Points: ${l.points} · Streak: ${streakOf(l)} days · Plans finished: ${doneDays(l)}`, "",
      `Shlokas learned (${learnedCount(l)}):`, ...Object.entries(l.learned).map(([id, v]) => `  - ${byId[id].title} (learned ${v.date}, next revision ${v.next})`),
      "", l.current ? `Learning now: ${byId[l.current.id].title}, day ${l.current.stage + 1} of 7 (${STAGES[l.current.stage].name})` : "", "",
      "Last 7 days (minutes · plan finished):", ...days.map(k => `  ${k}  ${String(minutesOn(l, k)).padStart(3)} min  ${l.days[k]?.done ? "yes" : "-"}`), "",
      `Badges: ${l.badges.map(b => BADGES.find(x => x[0] === b.id)?.[2]).filter(Boolean).join(", ") || "none yet"}`];
    download(`Shlokha-Dhaara-report-${l.name.replace(/\W+/g, "-")}-${today()}.txt`, lines.join("\n"), "text/plain");
  }
  function ics(l) {
    const [h, m] = (l.chant || "18:00").split(":"); const d = today().replace(/-/g, "");
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Shlokha Dhaara//EN", "BEGIN:VEVENT", `UID:${l.id}-${Date.now()}@shlokha-dhaara`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART:${d}T${h}${m}00`, `DURATION:PT${l.minutes}M`, "RRULE:FREQ=DAILY", `SUMMARY:Shloka time for ${l.name} 🪔`, "DESCRIPTION:Open Shlokha Dhaara and finish today's plan.",
      "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", `DESCRIPTION:Shloka time for ${l.name}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    download(`shloka-time-${l.name.replace(/\W+/g, "-")}.ics`, body, "text/calendar");
  }

  V.about = () => {
    main.innerHTML = `<div class="wrap"><header class="page-head"><p class="eyebrow">About</p><h1>Sacred learning, timeless traditions</h1>
      <p>Shlokha Dhaara (“a stream of shlokas”) is a gurukul for children to learn, practise and remember Sanskrit shlokas, a few joyful minutes at a time.</p></header>
      <section class="section grid g3">
        <article class="card"><h3 style="font-size:1.25rem">The verses</h3><p class="muted small">Each shloka is given in Devanagari with a transliteration (IAST) to guide pronunciation, word-by-word meanings and a simple English meaning. Its source is named; prayers handed down without one fixed source are marked “Traditional”. Readings can differ slightly between traditions.</p></article>
        <article class="card"><h3 style="font-size:1.25rem">The guru voice</h3><p class="muted small">Listening uses your device's own Hindi voice to read the Devanagari. It's a helpful guide but not a trained reciter, so learn the finer points of pronunciation and metre from a teacher or family elder.</p></article>
        <article class="card"><h3 style="font-size:1.25rem">Privacy</h3><p class="muted small">There are no accounts and nothing is sent anywhere. Names, progress and recordings stay in this browser. Recordings are never saved; they disappear when you leave the page.</p></article>
      </section></div>`;
  };
  V.notFound = () => { main.innerHTML = `<div class="wrap page-head"><h1>Page not found</h1><p><a href="#/home">Go home</a></p></div>`; };

  /* ================= Global clicks (listen, learned, review, profile) ================= */
  main.addEventListener("click", async e => {
    const L = e.target.closest("[data-listen]"), ld = e.target.closest("[data-learned]"), rv = e.target.closest("[data-review]");
    if (L) {
      const s = byId[L.dataset.listen], root = L.closest(".card, .step");
      L.disabled = true; L.innerHTML = `${icon("play")} Playing…`;
      const ok = await playShloka(s, { rate: .85, root: root || document, onStatus: () => {} });
      if (!synth) toastMsg("This browser can't speak. Open the shloka to read along.");
      if (document.body.contains(L)) { L.disabled = false; L.innerHTML = `${icon("play")} Listen`; }
      if (ok && location.hash.startsWith("#/today")) route();
    }
    if (ld) { track("learned", { id: ld.dataset.learned }); route(); }
    if (rv) { track("review", { id: rv.dataset.review }); route(); }
    if (e.target.closest("[data-profile]")) { e.preventDefault(); profileForm(me().guest ? null : me()); }
  });

  /* ================= Router ================= */
  function route() {
    stopAudio(); stopRecording();
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, opt] = raw.split("?"); const [a = "home", b, c] = path.split("/");
    $$("[data-nav]").forEach(n => n.classList.toggle("on", n.dataset.nav === (["shloka", "worksheet", "festivals"].includes(a) ? "learn" : a)));
    if (a === "home" || a === "") V.home();
    else if (a === "today") V.today();
    else if (a === "learn") b ? V.category(b) : V.learn();
    else if (a === "shloka") V.shloka(b, opt);
    else if (a === "worksheet") V.worksheet(b);
    else if (a === "games") b ? V.game(b, c) : V.games();
    else if (a === "progress") V.progress();
    else if (a === "parents") V.parents();
    else if (a === "festivals") V.festivals();
    else if (a === "about") V.about();
    else V.notFound();
    const title = { home: "Shloka Gurukul for Children", today: "Today's Plan", learn: "Learn Shlokas", shloka: byId[b]?.title, games: "Game Zone", progress: "My Progress", parents: "Parent Dashboard", festivals: "Festival Calendar", about: "About", worksheet: "Worksheet" }[a];
    document.title = `${title ? title + " · " : ""}Shlokha Dhaara`;
  }
  addEventListener("hashchange", () => { route(); scrollTo(0, 0); main.focus({ preventScroll: true }); });

  /* ================= Screen time & chant reminders ================= */
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const l = me(); if (!l) return; dayRec(l).sec += 15; save();
  }, 15000);
  setInterval(() => {
    const now = new Date(), hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    for (const l of db.learners) {
      const r = dayRec(l);
      if (r.done || r.reminded || !l.chant || hm < l.chant) continue;
      r.reminded = true; save();
      toastMsg(`🪔 It's shloka time for ${l.name}!`);
      if ("Notification" in window && Notification.permission === "granted") try { new Notification("Shloka time 🪔", { body: `Time for ${l.name}'s ${l.minutes}-minute shloka practice.`, icon: "assets/favicon.svg" }); } catch {}
    }
  }, 30000);

  /* ================= Start ================= */
  document.documentElement.style.setProperty("--scale", LS.get("scale", 1));
  applyTheme(); renderWho(); route();
  if (me()?.guest && !LS.get("welcomed", false)) { LS.set("welcomed", true); setTimeout(() => profileForm(null), 700); }
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
