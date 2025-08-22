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
