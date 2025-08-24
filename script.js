/* ===================== StudyPal — Full Script ===================== */

/* ---------- State & helpers ---------- */
const DB = { title: "StudyPal Deck", cards: [], notes: "" };
let quizIdx = 0, score = 0;

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));

// LocalStorage
const KEY = "study-buddy-v1";
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch {}
  const st = $("#status");
  if (st) { st.textContent = "Saved"; setTimeout(() => st.textContent = "", 800); }
}
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "null");
    if (data && Array.isArray(data.cards)) Object.assign(DB, data);
  } catch {}
}

/* ---------- Notes → Cards generator ---------- */
function notesToCards(text) {
  const sentences = text.replace(/\n+/g, " ")
    .split(".")
    .map(s => s.trim())
    .filter(Boolean);
  const cards = sentences.slice(0, 12).map((s, i) => ({
    q: `Card ${i + 1}: ${s.split(" ")[0]}...?`,
    a: s.slice(0, 220),
    tags: ["auto"]
  }));
  if (!cards.length) {
    cards.push({ q: "What is the main idea?", a: text.slice(0, 200) || "No notes yet.", tags: ["summary"] });
    cards.push({ q: "Name one key term.", a: "Example term", tags: ["recall"] });
  }
  return cards;
}

/* ---------- Text-to-Speech ---------- */
function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {}
}

/* ---------- Cards: render + edit/delete/reorder + TTS ---------- */
function renderCards() {
  const wrap = $("#cards");
  if (!wrap) return;

  const html = DB.cards.map((c, i) => `
    <div class="card" data-i="${i}">
      <div><b>Q${i + 1}:</b> ${esc(c.q)} <span class="tag">${(c.tags || []).map(esc).join(" • ")}</span></div>
      <div><b>A:</b> ${esc(c.a)}</div>
      <div class="actions">
        <button class="edit">Edit</button>
        <button class="del">Delete</button>
        <button class="speakQ">🔊 Q</button>
        <button class="speakA">🔊 A</button>
        <button class="up">↑</button>
        <button class="down">↓</button>
      </div>
    </div>
  `).join("");

  wrap.innerHTML = html || '<p class="muted">No cards yet.</p>';

  wrap.querySelectorAll(".card").forEach(card => {
    const i = +card.dataset.i;
    card.querySelector(".edit").onclick = () => editCard(i);
    card.querySelector(".del").onclick = () => { DB.cards.splice(i, 1); renderCards(); save(); };
    card.querySelector(".speakQ").onclick = () => speak(DB.cards[i].q);
    card.querySelector(".speakA").onclick = () => speak(DB.cards[i].a);
    card.querySelector(".up").onclick = () => { if (i > 0) { [DB.cards[i - 1], DB.cards[i]] = [DB.cards[i], DB.cards[i - 1]]; renderCards(); save(); } };
    card.querySelector(".down").onclick = () => { if (i < DB.cards.length - 1) { [DB.cards[i + 1], DB.cards[i]] = [DB.cards[i], DB.cards[i + 1]]; renderCards(); save(); } };
  });
}

function editCard(i) {
  const c = DB.cards[i];
  const q = prompt("Edit question:", c.q);
  if (q === null) return;
  const a = prompt("Edit answer:", c.a);
  if (a === null) return;
  DB.cards[i] = { ...c, q, a };
  renderCards(); save();
}

/* ---------- Quiz ---------- */
function updateProgress() {
  const bar = $("#quizProgress .bar");
  if (!bar) return;
  const total = Math.min(5, DB.cards.length) || 1;
  const pct = Math.min(100, Math.round((quizIdx / total) * 100));
  bar.style.width = pct + "%";
}

function startQuiz() {
  const qz = $("#quiz");
  if (!qz) return;
  if (!DB.cards.length) { qz.innerHTML = "<p class='muted'>Generate cards first.</p>"; return; }
  quizIdx = 0; score = 0;
  showQuestion();
  updateProgress();
}

function showQuestion() {
  const qz = $("#quiz");
  const total = Math.min(5, DB.cards.length);
  if (quizIdx >= total) {
    qz.innerHTML = `<p><b>Done!</b> Score ${score}/${total}</p>`;
    if (score === total) celebrate();
    updateProgress();
    return;
  }
  const c = DB.cards[quizIdx];
  const pool = DB.cards.map(x => x.a).filter(a => a !== c.a);
  const choices = [c.a, ...pool.slice(0, 2)].sort(() => Math.random() - 0.5);

  qz.innerHTML = `
    <div class="card">
      <b>${esc(c.q)}</b>
      ${choices.map(ch => `
        <div><label><input type="radio" name="opt" value="${esc(ch)}"> ${esc(ch)}</label></div>
      `).join("")}
      <div class="actions"><button id="submit">Submit</button></div>
    </div>
  `;

  $("#submit").onclick = () => {
    const pick = document.querySelector('input[name="opt"]:checked');
    if (!pick) { alert("Pick one!"); return; }
    if (pick.value === c.a) score++;
    quizIdx++;
    updateProgress();
    showQuestion();
  };
}

function celebrate() {
  const layer = document.createElement("div");
  layer.style.position = "fixed"; layer.style.inset = 0; layer.style.pointerEvents = "none";
  document.body.appendChild(layer);
  Array.from({ length: 40 }).forEach(() => {
    const e = document.createElement("div");
    e.textContent = "🎉";
    e.style.position = "absolute";
    e.style.left = Math.random() * 100 + "vw";
    e.style.top = "-10vh";
    e.style.fontSize = (16 + Math.random() * 20) + "px";
    e.style.transition = "transform 1.2s ease, opacity 1.2s ease";
    layer.appendChild(e);
    requestAnimationFrame(() => {
      e.style.transform = `translateY(${110 + Math.random() * 30}vh) rotate(${(Math.random() * 720 - 360) | 0}deg)`;
      e.style.opacity = "0";
    });
  });
  setTimeout(() => layer.remove(), 1400);
}

/* ---------- Import / Export ---------- */
function exportDeck() {
  const deck = { deck_title: DB.title, cards: DB.cards };
  const blob = new Blob([JSON.stringify(deck, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "deck.json";
  a.click();
}
function importDeck() {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "application/json";
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (Array.isArray(data.cards)) {
        DB.cards = data.cards; DB.title = data.deck_title || DB.title;
        renderCards(); save();
      } else alert("Invalid deck file");
    } catch { alert("Could not read deck"); }
  };
  inp.click();
}

/* ---------- Dark Mode ---------- */
function toggleDark() {
  document.documentElement.classList.toggle("dark");
  try { localStorage.setItem("sb-dark", document.documentElement.classList.contains("dark") ? "1" : "0"); } catch {}
}
function initDark() {
  try {
    if (localStorage.getItem("sb-dark") === "1") document.documentElement.classList.add("dark");
  } catch {}
}

/* ---------- Assistant helpers (math/CS/BA + notes/cards) ---------- */
const KNOWLEDGE = {
  photosynthesis: "Photosynthesis: plants use sunlight, water, and CO₂ to make glucose and release oxygen.",
  mitosis: "Mitosis: cell division producing two identical daughter cells (prophase → metaphase → anaphase → telophase).",
  "world war 2": "World War II (1939–1945): global conflict between Allies and Axis; major theaters in Europe and the Pacific.",
  pi: "Pi (π) ≈ 3.14159… ratio of a circle’s circumference to its diameter.",
  atom: "Atom: smallest unit of matter; nucleus (protons, neutrons) with electrons in orbitals."
};

const toFixed6 = (n) => Math.round(n * 1e6) / 1e6;
const extractNumbers = (q) => (q.match(/-?\d+(\.\d+)?/g) || []).map(Number);

function safeEvalMath(expr) {
  if (!expr) return null;
  const cleaned = expr.replace(/\s+/g, "");
  if (!/^[0-9().+\-*/^%]+$/.test(cleaned)) return null;
  const jsExpr = cleaned.replace(/\^/g, "**");
  try {
    // eslint-disable-next-line no-new-func
    const val = Function("'use strict'; return (" + jsExpr + ");")();
    return (typeof val === "number" && isFinite(val)) ? val : null;
  } catch { return null; }
}
function solveLinear(eq) {
  const s = eq.toLowerCase().replace(/\s+/g, "");
  const m = s.match(/(-?\d*\.?\d*)x([+\-]\d*\.?\d*)?=(-?\d*\.?\d*)/);
  if (!m) return null;
  let a = m[1];
  a = (a === "" || a === "+") ? 1 : (a === "-" ? -1 : parseFloat(a));
  const b = parseFloat(m[2] || "0");
  const c = parseFloat(m[3] || "0");
  const x = (c - b) / a;
  return `Solving ${m[0]} → x = ${toFixed6(x)}`;
}
function derivativePoly(q) {
  const m = q.toLowerCase().match(/derivative of ([^?]+)/);
  if (!m) return null;
  const expr = m[1].replace(/\s+/g, "");
  const terms = expr.replace(/-/g, "+-").split("+").filter(Boolean);
  const derivTerms = terms.map(t => {
    if (!/x/.test(t)) return "0";
    const m1 = t.match(/^(-?\d*\.?\d*)x(?:\^(-?\d+))?$/) || t.match(/^x(?:\^(-?\d+))?$/);
    if (!m1) return "0";
    let coef, pow;
    if (m1.length === 3) { coef = (m1[1] === "" || m1[1] === "+") ? 1 : (m1[1] === "-" ? -1 : parseFloat(m1[1])); pow = m1[2] ? parseFloat(m1[2]) : 1; }
    else { coef = 1; pow = 1; }
    const newCoef = coef * pow;
    const newPow = pow - 1;
    if (newPow === 0) return String(newCoef);
    if (newPow === 1) return `${newCoef}x`;
    return `${newCoef}x^${newPow}`;
  });
  const pretty = derivTerms.filter(t => t !== "0").map((t, i) => (t.startsWith("-") || i === 0) ? t : `+${t}`).join(" ");
  return `d/dx(${m[1].trim()}) = ${pretty || "0"}`;
}
function statsHelper(q) {
  const nums = extractNumbers(q);
  if (nums.length < 2) return null;
  const n = nums.length;
  const mean = nums.reduce((a,b)=>a+b,0)/n;
  const sorted = nums.slice().sort((a,b)=>a-b);
  const median = (n%2 ? sorted[(n-1)/2] : (sorted[n/2-1]+sorted[n/2])/2);
  const variance = nums.reduce((s,x)=>s + Math.pow(x-mean,2),0)/n;
  const std = Math.sqrt(variance);
  return `Numbers: [${nums.join(", ")}]
Mean = ${toFixed6(mean)}, Median = ${toFixed6(median)}, Std Dev = ${toFixed6(std)}`;
}
function csComplexity(q) {
  const s = q.toLowerCase();
  if (s.includes("binary search")) return "Binary search: O(log n) time, O(1) space (sorted array).";
  if (s.includes("hash map") || s.includes("hashtable")) return "Hash map: average O(1) insert/lookup, worst-case O(n).";
  if (s.includes("quicksort")) return "Quicksort: average O(n log n), worst-case O(n^2), ~O(log n) space (recursion).";
  if (s.includes("mergesort")) return "Mergesort: O(n log n) time, O(n) extra space.";
  if (s.includes("bfs") || s.includes("breadth")) return "BFS on graph: O(V+E) time, O(V) space.";
  if (s.includes("dfs") || s.includes("depth")) return "DFS on graph: O(V+E) time, O(V) space.";
  if (s.includes("two pointers")) return "Two pointers: typically O(n) time, O(1) space for linear scans on arrays/strings.";
  return null;
}
function sqlHelper(q) {
  const s = q.toLowerCase();
  if (s.includes("sql") || s.includes("query") || s.includes("select")) {
    return `SQL patterns:
• Count by group:
SELECT group_col, COUNT(*) AS cnt
FROM your_table
GROUP BY group_col;

• Conversion rate:
SELECT SUM(CASE WHEN converted=1 THEN 1 ELSE 0 END)*1.0/COUNT(*) AS conversion_rate
FROM events;

• Top N:
SELECT item, COUNT(*) AS uses
FROM logs
GROUP BY item
ORDER BY uses DESC
LIMIT 10;`;
  }
  return null;
}
function bizAnalytics(q) {
  const s = q.toLowerCase();
  if (s.includes("conversion rate")) return "Conversion Rate = Conversions / Total Visitors. ×100% for a percent.";
  if (s.includes("ltv") || s.includes("lifetime value")) return "LTV ≈ ARPU × Gross Margin × Avg Customer Lifespan. For subs: LTV ≈ ARPU × (Gross Margin) / Churn.";
  if (s.includes("cac")) return "CAC = Total marketing/sales spend / # of new customers.";
  if (s.includes("arpu")) return "ARPU = Total revenue / Active users in a period.";
  if (s.includes("a/b") || s.includes("ab test")) return "A/B test: pick metric, randomize split, run long enough, compute lift & CI/p-value; beware peeking.";
  if (s.includes("cohort")) return "Cohort analysis: group users by start time/event (e.g., signup month) and track retention/revenue over time.";
  return null;
}

/* ---------- Assistant UI & logic ---------- */
function chatAdd(text, who) {
  const box = $("#assistantOutput");
  if (!box) return;
  const div = document.createElement("div");
  div.className = "msg " + (who || "ai");
  div.textContent = (who === "me" ? "You: " : "AI: ") + text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function askAssistant() {
  const input = $("#assistantInput");
  if (!input) return;
  const q = input.value.trim();
  if (!q) return;
  input.value = "";
  chatAdd(q, "me");

  // 1) Direct math expression (e.g., 2*(3+4)^2)
  if (/[0-9][0-9().+\-*/^% ]+$/.test(q)) {
    const val = safeEvalMath(q);
    if (val !== null) { chatAdd(`Result: ${toFixed6(val)}`, "ai"); return; }
  }

  // 2) Solve simple linear equation with x
  if (/solve/i.test(q) && /x/i.test(q) && /=/.test(q)) {
    const ans = solveLinear(q);
    if (ans) { chatAdd(ans, "ai"); return; }
  }

  // 3) Derivative for simple polynomials
  if (/derivative of/i.test(q)) {
    const d = derivativePoly(q);
    if (d) { chatAdd(d, "ai"); return; }
  }

  // 4) Quick stats from numbers in question
  if (/mean|average|median|std|standard deviation/i.test(q)) {
    const s = statsHelper(q);
    if (s) { chatAdd(s, "ai"); return; }
  }

  // 5) CS complexity facts
  const cs = csComplexity(q);
  if (cs) { chatAdd(cs, "ai"); return; }

  // 6) SQL patterns
  const sql = sqlHelper(q);
  if (sql) { chatAdd(sql, "ai"); return; }

  // 7) Business analytics definitions
  const ba = bizAnalytics(q);
  if (ba) { chatAdd(ba, "ai"); return; }

  // 8) Prefer your notes/cards
  const words = q.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const found = DB.cards.find(c => words.some(w => c.a.toLowerCase().includes(w) || c.q.toLowerCase().includes(w)));
  if (found) { chatAdd("From your notes: " + found.a, "ai"); return; }

  // 9) Built-in knowledge base
  for (const key in KNOWLEDGE) {
    if (q.toLowerCase().includes(key)) { chatAdd(KNOWLEDGE[key], "ai"); return; }
  }

  // 10) Fallback
  chatAdd("I’m not sure yet — try adding notes or ask topics like derivatives, binary search, conversion rate, or SQL SELECT.", "ai");
}

/* ---------- Wire up UI ---------- */
function setup() {
  load();
  initDark();

  const notes = $("#notes");
  if (notes) notes.value = DB.notes || "";

  renderCards();

  const btnGen = $("#btnGen");
  if (btnGen) btnGen.onclick = () => {
    DB.notes = ($("#notes")?.value || "");
    DB.cards = notesToCards(DB.notes);
    renderCards(); save();
    const st = $("#status"); if (st) st.textContent = `Generated ${DB.cards.length} cards.`;
  };

  const btnQuiz = $("#btnQuiz");
  if (btnQuiz) btnQuiz.onclick = startQuiz;

  const btnExport = $("#btnExport");
  if (btnExport) btnExport.onclick = exportDeck;

  const btnImport = $("#btnImport");
  if (btnImport) btnImport.onclick = importDeck;

  const btnDark = $("#btnDark");
  if (btnDark) btnDark.onclick = toggleDark;

  const send = $("#assistantSend");
  if (send) send.onclick = askAssistant;

  const input = $("#assistantInput");
  if (input) input.addEventListener("keydown", (e) => { if (e.key === "Enter") askAssistant(); });

  // Auto-save notes as you type (lightweight)
  if (notes) notes.addEventListener("input", () => { DB.notes = notes.value; save(); });

  console.log("[StudyPal] Ready");
}

document.addEventListener("DOMContentLoaded", setup);

/* ===================== StudyPal Pro — Smart Cards + Pro Quiz + Spaced Repetition ===================== */

/** Utils **/
const SP_KEY = "studypal_spaced_rep_v1";

function spHash(str) {
  // simple stable hash for card identity (q+a)
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(36);
}
function cardId(c) { return spHash((c.q || "") + "::" + (c.a || "")); }
function shuffle(arr){ return arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }
function sample(arr, n){ return arr.slice(0, Math.max(0, Math.min(n, arr.length))); }

/** Spaced Repetition store: id -> box(1..5), streak, lastTs **/
let SR = {};
function loadSR(){ try { SR = JSON.parse(localStorage.getItem(SP_KEY) || "{}"); } catch { SR = {}; } }
function saveSR(){ try { localStorage.setItem(SP_KEY, JSON.stringify(SR)); } catch {} }
function getBox(id){ return (SR[id]?.box) || 1; }
function bump(id, correct){
  const now = Date.now();
  const cur = SR[id] || { box: 1, streak: 0, lastTs: 0 };
  if (correct) {
    cur.streak = (cur.streak || 0) + 1;
    cur.box = Math.min(5, cur.box + 1);
  } else {
    cur.streak = 0;
    cur.box = 1;
  }
  cur.lastTs = now;
  SR[id] = cur; saveSR();
}
function srSummaryText(cards){
  const counts = [0,0,0,0,0,0]; // index 1..5
  cards.forEach(c => counts[getBox(cardId(c))]++);
  return counts.slice(1).map((n,i)=>`<span class="sr-badge">Box ${i+1}: ${n}</span>`).join(" ");
}

/** Smart generator: better Q/A from notes **/
function smartNotesToCards(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const pairs = [];
  // 1) Q: / A: blocks
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (/^q[:\-]/i.test(L)) {
      const q = L.replace(/^q[:\-]\s*/i, "");
      const aLine = (lines[i+1] || "");
      if (/^a[:\-]/i.test(aLine)) {
        const a = aLine.replace(/^a[:\-]\s*/i, "");
        pairs.push({ q, a, tags: ["smart","Q/A"] });
        i++;
        continue;
      }
    }
  }

  // 2) term — definition   OR   term: definition   OR   term - definition
  lines.forEach(L => {
    const m = L.match(/^(.{2,80}?)[\s]*[:\-—–]+[\s]+(.{3,})$/); // term : def
    if (m && !/^q[:\-]/i.test(L) && !/^a[:\-]/i.test(L)) {
      const term = m[1].trim();
      const def = m[2].trim();
      if (term && def) pairs.push({ q: `What is ${term}?`, a: def, tags: ["smart","term"] });
    }
  });

  // 3) Headings create context → next sentence as answer
  const headingIdx = lines
    .map((L,i)=> [/^#{1,6}\s+(.+)/.exec(L) || /^\*\*?(.+?)\*\*?$/.exec(L) ? i : -1])
    .filter(i=>i>=0);
  headingIdx.forEach(i => {
    const head = lines[i].replace(/^#{1,6}\s+/, "").replace(/^\*+|\*+$/g,"").trim();
    const next = lines[i+1] || "";
    if (head && next) pairs.push({ q: `Explain: ${head}`, a: next.slice(0, 240), tags: ["smart","heading"] });
  });

  // 4) Fallback: sentences → cloze questions
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 16);
  sentences.slice(0, 30).forEach((s, i) => {
    const firstWord = (s.split(" ")[0] || "").replace(/[^A-Za-z0-9\-()]/g,"");
    if (firstWord) {
      pairs.push({ q: `Card ${i+1}: ${firstWord} …?`, a: s.slice(0, 220), tags: ["smart","auto"] });
    }
  });

  // Deduplicate by (q+a) hash, keep first
  const seen = new Set();
  const out = [];
  for (const p of pairs) {
    const id = cardId(p);
    if (!seen.has(id)) { out.push(p); seen.add(id); }
  }
  // Reasonable cap
  return out.slice(0, 60);
}

/** Pro Quiz **/
function buildChoices(correct, pool, k=3){
  const others = shuffle(pool.filter(a => a !== correct)).slice(0, k-1);
  return shuffle([correct, ...others]);
}

function startProQuiz() {
  const mode = (document.getElementById("modeSelect")?.value || "mc");
  const nReq = Math.max(1, Math.min(25, parseInt(document.getElementById("numQuestions")?.value || "5", 10)));
  const doShuffle = !!document.getElementById("shuffleToggle")?.checked;

  if (!DB.cards.length) {
    const qz = document.getElementById("quiz");
    if (qz) qz.innerHTML = "<p class='muted'>Generate cards first.</p>";
    return;
  }

  // Queue: prefer lower Leitner boxes
  const byBox = [1,2,3,4,5].flatMap(b => DB.cards.filter(c => getBox(cardId(c)) === b));
  let queue = byBox.length ? byBox : DB.cards.slice();
  if (doShuffle) queue = shuffle(queue);
  queue = sample(queue, nReq);

  // Render loop
  const qz = document.getElementById("quiz");
  const poolAnswers = DB.cards.map(c => c.a);
  let i = 0, correctCount = 0;

  function renderMC(card){
    const opts = buildChoices(card.a, poolAnswers, 4);
    qz.innerHTML = `
      <div class="card">
        <div class="pro-question">${esc(card.q)}</div>
        ${opts.map(o => `<div class="pro-opt" data-v="${esc(o)}">${esc(o)}</div>`).join("")}
        <div class="pro-actions">
          <button id="btnSkip" class="ghost">Skip</button>
        </div>
      </div>
    `;
    qz.querySelectorAll(".pro-opt").forEach(el => {
      el.onclick = () => {
        const pick = el.getAttribute("data-v");
        const id = cardId(card);
        if (pick === card.a) {
          el.classList.add("correct");
          bump(id, true); correctCount++;
        } else {
          el.classList.add("wrong");
          // highlight correct
          qz.querySelectorAll(".pro-opt").forEach(x => {
            if (x.getAttribute("data-v") === card.a) x.classList.add("correct");
          });
          bump(id, false);
        }
        setTimeout(nextCard, 450);
      };
    });
    document.getElementById("btnSkip").onclick = () => { bump(cardId(card), false); nextCard(); };
  }

  function renderType(card){
    qz.innerHTML = `
      <div class="card">
        <div class="pro-question">${esc(card.q)}</div>
        <input id="typeAns" class="ask" placeholder="Type your answer…" />
        <div class="pro-actions">
          <button id="btnCheck">Check</button>
          <button id="btnReveal" class="ghost">Reveal</button>
          <button id="btnSkip" class="ghost">Skip</button>
        </div>
      </div>
    `;
    const input = document.getElementById("typeAns");
    const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const id = cardId(card);
    const check = () => {
      const ok = norm(input.value) && norm(input.value) === norm(card.a);
      if (ok) { bump(id, true); correctCount++; }
      else { bump(id, false); }
      qz.querySelector(".pro-actions").insertAdjacentHTML("beforeend",
        `<span class="muted">Answer: <span class="kbd">${esc(card.a)}</span></span>`);
      setTimeout(nextCard, 500);
    };
    document.getElementById("btnCheck").onclick = check;
    document.getElementById("btnReveal").onclick = () => {
      qz.querySelector(".pro-actions").insertAdjacentHTML("beforeend",
        `<span class="muted">Answer: <span class="kbd">${esc(card.a)}</span></span>`);
      bump(id, false);
      setTimeout(nextCard, 500);
    };
    document.getElementById("btnSkip").onclick = () => { bump(id, false); nextCard(); };
    input.addEventListener("keydown", e => { if (e.key === "Enter") check(); });
    input.focus();
  }

  function nextCard(){
    i++;
    if (i >= queue.length) {
      qz.innerHTML = `<p><b>Pro Quiz done!</b> Score ${correctCount}/${queue.length}</p>`;
      // update top progress bar if present
      const bar = document.querySelector("#quizProgress .bar");
      if (bar) bar.style.width = "100%";
      // refresh SR summary
      const el = document.getElementById("srSummary");
      if (el) el.innerHTML = srSummaryText(DB.cards);
      return;
    }
    const c = queue[i];
    if (mode === "mc") renderMC(c); else renderType(c);
    // update progress bar
    const bar = document.querySelector("#quizProgress .bar");
    if (bar) bar.style.width = Math.round(((i)/queue.length) * 100) + "%";
  }

  // start
  if (!qz) return;
  const first = queue[0];
  if (mode === "mc") renderMC(first); else renderType(first);
  const el = document.getElementById("srSummary");
  if (el) el.innerHTML = srSummaryText(DB.cards);
}

/** Wire up new controls (second DOMContentLoaded is fine) **/
document.addEventListener("DOMContentLoaded", () => {
  loadSR();

  // Smart Generate
  const btnSmart = document.getElementById("btnSmartGen");
  if (btnSmart) btnSmart.onclick = () => {
    const notesVal = (document.getElementById("notes")?.value || "").trim();
    if (!notesVal) { alert("Paste notes first."); return; }
    const cards = smartNotesToCards(notesVal);
    if (!cards.length) { alert("Couldn't detect Q/A pairs. Try adding lines like 'Term — definition'."); return; }
    // Merge with existing without duplicates
    const existingIds = new Set(DB.cards.map(cardId));
    const merged = DB.cards.concat(cards.filter(c => !existingIds.has(cardId(c))));
    DB.cards = merged;
    // Save & render
    if (!DB.title) DB.title = "StudyPal Deck";
    (function render(){ if (typeof renderCards === "function") renderCards(); })();
    (function saveNow(){ if (typeof save === "function") save(); })();

    const st = document.getElementById("status");
    if (st) st.textContent = `Smart-generated ${cards.length} new cards (merged to ${DB.cards.length}).`;
    const el = document.getElementById("srSummary");
    if (el) el.innerHTML = srSummaryText(DB.cards);
  };

  // Pro Quiz start
  const btnStartPro = document.getElementById("btnStartPro");
  if (btnStartPro) btnStartPro.onclick = startProQuiz;

  // Reset spaced-rep progress
  const btnReset = document.getElementById("btnResetProgress");
  if (btnReset) btnReset.onclick = () => {
    if (confirm("Reset spaced-repetition progress?")) {
      SR = {}; saveSR();
      const el = document.getElementById("srSummary");
      if (el) el.innerHTML = srSummaryText(DB.cards);
      alert("Progress reset.");
    }
  };

  // Show initial SR summary
  const el = document.getElementById("srSummary");
  if (el) el.innerHTML = srSummaryText(DB.cards);
});
