/* ==========================================================================
   THE HEARTHBOUND CODEX — renderer (called by main.js; receives a small data API `dv`, `input`, `app`, `moment`)
   --------------------------------------------------------------------------
   Use in any note (plugin):
       ```codex
       status
       ```
   Sections: status, time, actions, daily, bad, log, feed, chart, charts,
             overview, rewards, areas, quests, battle, hall, prophecy,
             codex, goal, habit, reward, area
   All data lives in frontmatter + tasks of your notes. Nothing is hidden.
   ========================================================================== */

let SECTION = (input && input.section) || "status";
let OPTS = input || {};
const M = moment;
const TODAY = M().format("YYYY-MM-DD");

// The whole system lives in one folder (default "The Hearthbound Codex"); the engine finds it from its own location,
// so the folder can sit anywhere inside an existing vault.
const ROOT = input.__root || "";
const P = x => (ROOT ? ROOT + "/" : "") + x;
const FOLDERS = {
  good: P("01 Habits/Good"), bad: P("01 Habits/Bad"), quest: P("02 Quests"),
  reward: P("03 Rewards"), area: P("04 Life Areas"), prophecy: P("05 The Prophecy Chamber"),
  templates: P("_System/Templates"), sys: P("_System"),
};

// (styles come from the plugin's styles.css)
const RANK_XP = { E: 50, D: 100, C: 200, B: 400, A: 800, S: 1500 };
// Titles earned as you level (a title typed in the Player Profile overrides these)
const TITLES = [[1, "Hearthling"], [5, "Kindled Wanderer"], [10, "Lantern Bearer"], [20, "Trailwarden"],
  [35, "Keeper of the Hearth"], [50, "Hearthbound Knight"], [70, "Elder of the Glen"], [100, "Legend of the Hearth"]];

/* ---------------------------------------------------------------- helpers */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v, d = 0) => { const n = typeof v === "number" ? v : parseFloat(v); return isFinite(n) ? n : d; };
const fmt = n => (Math.abs(n % 1) > 0.001 ? (+n).toLocaleString(undefined, { maximumFractionDigits: 2 }) : Math.round(n).toLocaleString());
function toArr(v) {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) return v;
  if (typeof v !== "string" && typeof v[Symbol.iterator] === "function") return Array.from(v);
  return [v];
}
function nameOf(v) {
  if (v == null) return "";
  if (typeof v === "object" && v.path) return v.path.split("/").pop().replace(/\.md$/, "");
  let s = String(v).trim();
  const m = s.match(/^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/);
  if (m) s = m[1];
  return s.split("/").pop().replace(/\.md$/, "").trim();
}
function norm(v) {
  const n = nameOf(v);
  return n.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || n.toLowerCase();
}
function dstr(v) {
  if (!v) return null;
  if (typeof v.toISODate === "function") return v.toISODate();
  if (v instanceof Date) return M(v).format("YYYY-MM-DD");
  const m = String(v).match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}
const daysFrom = (a, b) => M(b, "YYYY-MM-DD").diff(M(a, "YYYY-MM-DD"), "days");
const pctOf = (a, b) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0);
function clean(text) {
  return String(text || "")
    .replace(/\[[^\[\]]+::[^\[\]]*\]/g, "")
    .replace(/\([^()]+::[^()]*\)/g, "")
    .replace(/(?:📅|✅|⏳|🛫|➕|❌|🗓️?)\s*\d{4}-\d{2}-\d{2}/gu, "")
    .replace(/🔁[^📅✅⏳🛫➕]*/gu, "")
    .replace(/[⏫🔼🔽🔺⏬]/gu, "")
    .replace(/\s+/g, " ").trim();
}
function imgSrc(v) {
  if (!v) return null;
  let s = (typeof v === "object" && v.path) ? v.path : String(v).trim();
  if (/^(https?:|data:|blob:)/.test(s)) return s;
  s = s.replace(/^!?\[\[/, "").replace(/(\|.*)?\]\]$/, "");
  const f = app.vault.getAbstractFileByPath(s) || app.metadataCache.getFirstLinkpathDest(s, "");
  return f ? app.vault.getResourcePath(f) : null;
}

/* ------------------------------------------------------------------ icons
   Any `icon:` property may be an emoji OR an image ("[[my-icon.png]]", a vault path or a URL).
   UI icons: drop an image named <key>.png/.svg/.webp… into System/Icons to replace it everywhere.
   Keys: star shield trophy lock gift sword skull fire scroll crystal check cross undo spark prophecy warn
         rank-e rank-d rank-c rank-b rank-a rank-s rank-n  (rank badges)  */
const IMG_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)(\|[^\]]*)?(\]\])?$/i;
function isImg(v) {
  if (!v) return false;
  if (typeof v === "object" && v.path) return IMG_RE.test(v.path);
  const s = String(v).trim();
  return /^(https?:|data:)/.test(s) || IMG_RE.test(s);
}
function ico(v, fb = "", cls = "") {
  if (isImg(v)) { const s = imgSrc(v); if (s) return `<img class="sl-ico ${cls}" src="${esc(s)}" alt="">`; }
  const t = v == null || v === "" ? fb : String(v);
  return t ? `<span class="sl-ico ${cls}">${esc(t)}</span>` : "";
}
const UI_DEFAULT = { star: "★", shield: "🛡", trophy: "🏆", lock: "🔒", gift: "🎁", sword: "⚔", skull: "☠", fire: "🔥", scroll: "📜",
  crystal: "🔮", check: "✔", cross: "✖", undo: "↺", spark: "✦", prophecy: "🜂", warn: "⚠" };
const UI_OVR = {};
for (const f of app.vault.getFiles())
  if (f.path.startsWith(P("_System/Icons/")) && /^(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(f.extension)) UI_OVR[f.basename.toLowerCase()] = app.vault.getResourcePath(f);
// Interface icons: chosen in the Icon Forge window (stored in the profile as ui_icons), then files in _System/Icons, then the default.
const uiOverride = k => { try { const o = profile && profile.ui_icons && profile.ui_icons[k]; return o ? String(o) : null; } catch (e) { return null; } };
const UI = k => {
  const o = uiOverride(k);
  if (o) return isImg(o) ? (imgSrc(o) ? `<img class="sl-ico ui" src="${esc(imgSrc(o))}" alt="">` : "") : esc(o);
  return UI_OVR[k] ? `<img class="sl-ico ui" src="${esc(UI_OVR[k])}" alt="">` : esc(UI_DEFAULT[k] || "");
};

/* ------------------------------------------------------------------- data */
const ALL = (ROOT ? dv.pages(`"${ROOT}"`) : dv.pages()).where(p => !p.file.path.startsWith(FOLDERS.sys + "/"));
const profile = ALL.where(p => p.type === "profile").first() || {};
const CFG = {
  base: num(profile.level_base_xp, 100), step: num(profile.level_step_xp, 50),
  dqBonus: num(profile.daily_quest_bonus, 25),
  name: profile.player_name || "Player", job: profile.job_class || null,
  title: profile.title || null, avatar: profile.character || profile.avatar || null,
  profilePath: profile.file ? profile.file.path : null,
};

const areas = ALL.where(p => p.type === "area").array().map(p => ({
  name: p.file.name, key: norm(p.file.name), path: p.file.path,
  stat: p.stat || "—", cls: p.class || "", icon: p.icon || "", cover: p.cover, desc: p.description || "", notes: p.notes || "",
}));
const habits = ALL.where(p => p.type === "habit").array().map(p => ({
  name: p.file.name, key: norm(p.file.name), path: p.file.path,
  polarity: String(p.polarity || "good").toLowerCase() === "bad" ? "bad" : "good",
  xp: num(p.xp, 10), area: p.area ? nameOf(p.area) : "", icon: p.icon || "",
  dq: p.daily_quest === true, active: p.active !== false, cover: p.cover, cue: p.cue || "", notes: p.notes || "",
  history: toArr(p.history).map(dstr).filter(Boolean),
})).sort((a, b) => (b.dq - a.dq) || (b.xp - a.xp) || a.name.localeCompare(b.name));
const H = Object.fromEntries(habits.map(h => [h.key, h]));
const FOCUS = new Set(toArr(profile.focus).map(norm));   // life areas the player most wants to improve
// Side quests. `repeat` makes one come back after it's completed:
//   1d, 3d, 7d, 14d … (every N days) · 1m (monthly) · mon … sun (every that weekday)
// A repeating side quest keeps every completion date in `completions` and hides until `next`.
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function normRepeat(r) {
  const s = String(r || "").trim().toLowerCase();
  if (!s || s === "none" || s === "no") return "";
  if (/^\d+\s*d(ays?)?$/.test(s)) return parseInt(s) + "d";
  if (/^\d+\s*w(eeks?)?$/.test(s)) return parseInt(s) * 7 + "d";
  if (/^(\d+\s*)?m(onths?)?$/.test(s) || s === "monthly") return (parseInt(s) || 1) + "m";
  if (s === "daily") return "1d";
  if (s === "weekly") return "7d";
  const wd = WEEKDAYS.findIndex(w => s.startsWith(w));
  return wd >= 0 ? WEEKDAYS[wd] : "";
}
function nextOccurrence(rep, from) {
  const r = normRepeat(rep);
  if (!r) return null;
  if (r.endsWith("d")) return M(from).add(parseInt(r), "days").format("YYYY-MM-DD");
  if (r.endsWith("m")) return M(from).add(parseInt(r), "months").format("YYYY-MM-DD");
  const target = WEEKDAYS.indexOf(r), d = M(from).add(1, "day");
  while (d.isoWeekday() % 7 !== target) d.add(1, "day");
  return d.format("YYYY-MM-DD");
}
function repeatLabel(rep) {
  const r = normRepeat(rep);
  if (!r) return "";
  if (r === "1d") return "every day";
  if (r === "7d") return "every week";
  if (r === "14d") return "every 2 weeks";
  if (r.endsWith("d")) return `every ${parseInt(r)} days`;
  if (r === "1m") return "every month";
  if (r.endsWith("m")) return `every ${parseInt(r)} months`;
  return "every " + WEEKDAY_NAMES[WEEKDAYS.indexOf(r)];
}
const sideQuests = ALL.where(p => p.type === "sidequest").array().map(p => {
  const repeat = normRepeat(p.repeat), completions = toArr(p.completions).map(dstr).filter(Boolean).sort();
  const done = dstr(p.done), next = dstr(p.next);
  const doneDates = repeat ? completions.concat(done && !completions.includes(done) ? [done] : []) : (done ? [done] : []);
  const doneToday = doneDates.includes(TODAY);
  return {
    name: p.file.name, path: p.file.path, xp: num(p.xp, 10), due: dstr(p.due), done, next, repeat, completions, doneDates, doneToday,
    created: dstr(p.created), notes: p.notes || "", area: p.area ? nameOf(p.area) : "",
    // open = shown in the list right now
    open: repeat ? !doneToday && (!next || next <= TODAY) : !done,
    resting: repeat && !doneToday && next && next > TODAY,
  };
});
const dqHabits = habits.filter(h => h.polarity === "good" && h.active && h.dq);

// Check-ins live inside each habit note: `history:` is the list of dates it was done (good) or slipped (bad).
// No daily notes are created. (Older notes with `type: daily` + habits_done/bad_done are still read, if any exist.)
const logByDate = {};
const dayOf = d => logByDate[d] || (logByDate[d] = { date: d, good: [], bad: [] });
for (const h of habits) for (const d of h.history) dayOf(d)[h.polarity === "good" ? "good" : "bad"].push(h.key);
ALL.where(p => p.type === "daily").array().forEach(p => {
  const d = dstr(p.date) || dstr(p.file.name);
  if (!d) return;
  dayOf(d).good.push(...toArr(p.habits_done).map(norm));
  dayOf(d).bad.push(...toArr(p.bad_done).map(norm));
});
const logDate = p => dstr(p.date) || dstr(p.file.name);

function milestoneInfo(t) {
  const target = num(t.target, NaN), cur = num(t.current, 0);
  const done = !!t.completed || /[xX]/.test(t.status || "");
  return {
    text: clean(t.text), line: t.line, path: t.path, done, cur,
    target: isFinite(target) ? target : null, unit: t.unit || "", step: num(t.step, 1),
    xp: num(t.xp, 0), due: dstr(t.due), doneOn: dstr(t.completion),
    pct: done ? 1 : (isFinite(target) && target > 0 ? Math.min(1, cur / target) : 0),
  };
}
const quests = ALL.where(p => p.type === "goal" || p.type === "quest").array().map(p => {
  const tasks = p.file.tasks ? toArr(p.file.tasks) : [];
  let ms = tasks.filter(t => { const s = t.section || t.header; return s && s.subpath && /milestone/i.test(s.subpath); });
  if (!ms.length) ms = tasks;
  ms = ms.map(milestoneInfo);
  const weighted = ms.length && ms.every(m => m.xp > 0);
  ms.forEach(m => (m.w = weighted ? m.xp : 1));
  const tw = ms.reduce((a, m) => a + m.w, 0);
  const status = String(p.status || "active").toLowerCase();
  const rank = String(p.rank || "E").toUpperCase();
  return {
    name: p.file.name, path: p.file.path, status, rank,
    area: p.area ? nameOf(p.area) : "", xp: num(p.xp_reward, RANK_XP[rank] || 0),
    started: dstr(p.started) || dstr(p.file.cday), deadline: dstr(p.deadline),
    completed: dstr(p.completed), cover: p.cover, example: !!p.example, victory: p.victory || "", notes: p.notes || "",
    ms, pct: status === "completed" ? 1 : (tw ? ms.reduce((a, m) => a + m.w * m.pct, 0) / tw : 0),
  };
});
// one order for quests everywhere: nearest deadline first, then name
const questOrder = (a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.name.localeCompare(b.name);
const isActive = q => ["active", "in progress", "in-progress"].includes(q.status);

const rewards = ALL.where(p => p.type === "reward").array().map(p => ({
  name: p.file.name, path: p.file.path, cost: num(p.cost, 50), icon: p.icon || "",
  repeatable: p.repeatable !== false, cover: p.cover, minLevel: num(p.min_level, 0), active: p.active !== false, notes: p.notes || "",
  claims: toArr(p.claims).map(dstr).filter(Boolean).sort(),
})).sort((a, b) => a.cost - b.cost);

/* ----------------------------------------------------------------- ledger */
const events = [];
for (const l of Object.values(logByDate)) {
  const g = new Set(l.good), b = new Set(l.bad);
  for (const k of g) { const h = H[k]; if (h && h.polarity === "good") events.push({ date: l.date, xp: h.xp, kind: "habit", area: h.area, label: h.name }); }
  for (const k of b) { const h = H[k]; if (h && h.polarity === "bad") events.push({ date: l.date, xp: -h.xp, kind: "bad", area: h.area, label: h.name }); }
  if (dqHabits.length && dqHabits.every(h => g.has(h.key))) events.push({ date: l.date, xp: CFG.dqBonus, kind: "bonus", label: "Daily Quest cleared" });
}
for (const sq of sideQuests) for (const d of sq.doneDates) events.push({ date: d, xp: sq.xp, kind: "side", area: sq.area, label: `Side quest: ${sq.name}` });
for (const q of quests) {
  if (q.example) continue;
  for (const m of q.ms) if (m.done && m.xp) events.push({ date: m.doneOn || q.completed, xp: m.xp, kind: "milestone", area: q.area, label: `${m.text} (${q.name})` });
  if (q.status === "completed") events.push({ date: q.completed, xp: q.xp, kind: "quest", area: q.area, label: `Quest cleared: ${q.name}` });
}
/* --------------------------------------------------------------- HP & death
   HP carries over day to day: bad habits deal damage (their XP), each good habit heals,
   and you regenerate every day. Hit 0 HP → you fall: lose one level, then revive at full HP. */
const HPC = { max: num(profile.hp_max, 100), regen: num(profile.hp_regen, 10), heal: num(profile.hp_heal_per_habit, 5) };
function cumForLevel(L) { let c = 0; for (let l = 1; l < L; l++) c += CFG.base + (l - 1) * CFG.step; return c; }
function lvlOf(xp) { let lvl = 1, need = CFG.base, rem = Math.max(0, xp); while (rem >= need) { rem -= need; lvl++; need = CFG.base + (lvl - 1) * CFG.step; } return lvl; }
let HP = HPC.max;
const hpByDate = {}, deaths = [];
{
  const dates = events.filter(e => e.date).map(e => e.date).concat(Object.keys(logByDate)).filter(d => d <= TODAY).sort();
  let cum = events.filter(e => !e.date).reduce((a, e) => a + e.xp, 0);
  if (dates.length) {
    for (let d = M(dates[0]), first = true; d.format("YYYY-MM-DD") <= TODAY; d.add(1, "day"), first = false) {
      const k = d.format("YYYY-MM-DD");
      if (!first) HP = Math.min(HPC.max, HP + HPC.regen);
      const dayEv = events.filter(e => e.date === k);
      cum += dayEv.reduce((a, e) => a + e.xp, 0);
      const heal = dayEv.filter(e => e.kind === "habit" || e.kind === "side").length * HPC.heal;
      const dmg = -dayEv.filter(e => e.kind === "bad").reduce((a, e) => a + e.xp, 0);
      HP = Math.min(HPC.max, HP + heal) - dmg;
      // overkill carries over: revive at full HP minus the excess damage (can fall more than once)
      for (let guard = 0; HP <= 0 && guard < 20; guard++) {
        const L = lvlOf(cum), to = Math.max(1, L - 1), loss = Math.max(0, cum - cumForLevel(to));
        if (loss > 0) { deaths.push({ date: k, xp: -loss, kind: "death", label: `You have fallen — Level ${L} → ${to}` }); cum -= loss; }
        HP += HPC.max;
      }
      hpByDate[k] = HP;
    }
  }
}
events.push(...deaths);

const spends = [];
for (const r of rewards) for (const d of r.claims) spends.push({ date: d, cost: r.cost, label: r.name });

const totalXP = Math.max(0, events.reduce((a, e) => a + e.xp, 0));
const spent = spends.reduce((a, s) => a + s.cost, 0);
const gold = totalXP - spent;
const xpOn = d => events.filter(e => e.date === d).reduce((a, e) => a + e.xp, 0);
const areaXP = {};
for (const e of events) if (e.area) areaXP[norm(e.area)] = (areaXP[norm(e.area)] || 0) + e.xp;

function levelInfo(xp) {
  let lvl = 1, need = CFG.base, rem = Math.max(0, xp);
  while (rem >= need) { rem -= need; lvl++; need = CFG.base + (lvl - 1) * CFG.step; }
  return { lvl, into: rem, need, pct: pctOf(rem, need) };
}
const hunterRank = l => l >= 100 ? "Legend" : l >= 70 ? "S" : l >= 50 ? "A" : l >= 35 ? "B" : l >= 20 ? "C" : l >= 10 ? "D" : "E";
const autoTitle = l => TITLES.filter(t => l >= t[0]).pop()[1];
// Job grows with you: class from your strongest stat (life area), rank word from your level.
// A job typed in the Player Profile overrides it; each life area's class can be renamed in its editor.
const STAT_CLASS = { STR: "Knight", VIT: "Herbalist", AGI: "Ranger", INT: "Scholar", WIS: "Druid" };
const jobRankWord = l => l >= 70 ? "Grand" : l >= 35 ? "Master" : l >= 10 ? "Journeyman" : "Apprentice";
function autoJob(l) {
  let best = null, bestXP = 0;
  for (const a of areas) { const x = areaXP[a.key] || 0; if (x > bestXP) { best = a; bestXP = x; } }
  const cls = best ? (best.cls || STAT_CLASS[String(best.stat).toUpperCase()] || "Adventurer") : "Adventurer";
  return `${jobRankWord(l)} ${cls}`;
}
const LV = levelInfo(totalXP);

/* ------------------------------------------------------------- rendering */
let root = dv.container;
dv.container.classList.add("sl-root");
function mount(html) {
  const div = document.createElement("div");
  div.className = "sl-section sl-s-" + SECTION;
  div.innerHTML = html;
  root.appendChild(div);
  bindRemove(div); bindAdd(div); bindPortraits(div); bindIconEdits(div); bindEditors(div);
  div.querySelectorAll("[data-open]").forEach(a => a.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    if (isRecord(a.dataset.open)) openEditor(a.dataset.open);
    else app.workspace.openLinkText(a.dataset.open, dv.currentFilePath || "", ev.ctrlKey || ev.metaKey);
  }));
  return div;
}
const isRecord = p => !!ALL.where(x => x.file.path === p).first();
function bind(el, sel, fn) {
  el.querySelectorAll(sel).forEach(b => b.addEventListener("click", async ev => {
    ev.preventDefault(); ev.stopPropagation();
    if (b.dataset.busy) return; b.dataset.busy = "1";
    try { await fn(b.dataset, b, ev); } catch (e) { console.error(e); toast("⚠ " + e.message, "bad"); }
    finally { delete b.dataset.busy; }
  }));
}
function toast(msg, kind = "") {
  const t = document.createElement("div");
  t.className = "sl-toast " + kind;
  t.innerHTML = `<div class="sl-toast-head">THE HEARTHBOUND CODEX</div><div>${esc(msg)}</div>`;
  t.style.bottom = 32 + document.querySelectorAll(".sl-toast:not(.out)").length * 84 + "px";
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3200);
}
const lnk = (path, text, cls = "") => `<span class="sl-name ${cls}">${esc(text)}</span>`;   // names are plain text; edit through ✎
const bar = (pct, cls = "") => `<div class="sl-bar ${cls}"><div class="sl-fill" style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%"></div></div>`;
const rankBadge = (r, big = "") => {
  const k = "rank-" + String(r).toLowerCase();
  const o = uiOverride(k);
  if (o && isImg(o) && imgSrc(o)) return `<span class="sl-rankimg ${big}"><img src="${esc(imgSrc(o))}" alt="${esc(r)}"></span>`;
  if (o && !isImg(o)) return `<span class="sl-rank sl-rank-${esc(String(r).toLowerCase())} ${big}"><b>${esc(o)}</b></span>`;
  if (UI_OVR[k]) return `<span class="sl-rankimg ${big}"><img src="${esc(UI_OVR[k])}" alt="${esc(r)}"></span>`;
  return `<span class="sl-rank sl-rank-${esc(String(r).toLowerCase())} ${big}" title="Rank ${esc(r)}"><b>${esc(r === "Legend" ? "★" : r)}</b></span>`;
};
// Window titles in the "Status-Window" style: Title-Case words joined by hyphens.
const KEEP_CAPS = new Set(["XP", "HP", "EXP"]);
const tcase = t => String(t).split(/(\s[—·]\s)/).map(seg => {
  if (/^\s[—·]\s$/.test(seg)) return seg;
  const words = seg.trim().split(/\s+/).map(w => KEEP_CAPS.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase());
  return words.every(w => /^[A-Za-z&']+$/.test(w)) ? words.join("-") : words.join(" ");
}).join("");
const win = (title, body, extra = "", right = "") =>
  `<div class="sl-window ${extra}"><div class="sl-wtitle"><span>${esc(tcase(title))}</span>${right ? `<span class="sl-wright">${right}</span>` : ""}</div>${body}</div>`;
const chip = (label, value, cls = "") => `<div class="sl-chip ${cls}"><div class="sl-chip-v">${value}</div><div class="sl-chip-l">${esc(label)}</div></div>`;
const empty = msg => `<div class="sl-empty">${msg}</div>`;
const cover = (v, fallback) => { const s = imgSrc(v); return s ? `<img class="sl-cover" src="${esc(s)}">` : `<div class="sl-cover sl-cover-icon">${fallback}</div>`; };
// card art: `cover:` wins, then an image `icon:`, then the emoji icon, then the default UI icon
const art = (e, defKey) => cover(e.cover, e.icon ? ico(e.icon) : UI(defKey));
const dayLabel = d => d === TODAY ? "Today" : M(d).format("ddd, MMM D");

/* ---------------------------------------------------------- file actions */
async function ensureFolder(path) {
  let acc = "";
  for (const part of path.split("/")) {
    acc = acc ? acc + "/" + part : part;
    if (!app.vault.getAbstractFileByPath(acc)) { try { await app.vault.createFolder(acc); } catch (e) { /* exists */ } }
  }
}
function fillTemplate(src, vars) {
  return src
    .replace(/\{\{date(?::([^}]+))?\}\}/g, (_, f) => M(vars.date).format(f || "YYYY-MM-DD"))
    .replace(/\{\{time(?::([^}]+))?\}\}/g, (_, f) => M().format(f || "HH:mm"))
    .replace(/\{\{title\}\}/g, vars.title || "");
}
async function readTemplate(name) {
  const f = app.vault.getAbstractFileByPath(`${FOLDERS.templates}/${name}`);
  return f ? await app.vault.read(f) : "";
}
async function toggleHabit(date, h) {
  let added = false;
  await setFM(h.path, fm => {
    const arr = toArr(fm.history).map(dstr).filter(Boolean);
    const i = arr.indexOf(date);
    if (i >= 0) arr.splice(i, 1); else { arr.push(date); added = true; }
    fm.history = [...new Set(arr)].sort();
  });
  return added;
}
async function updateMilestone(path, line, mode, val) {
  const f = app.vault.getAbstractFileByPath(path);
  if (!f) throw new Error("Quest file not found");
  let result = {};
  await app.vault.process(f, data => {
    const lines = data.split("\n");
    let L = lines[line];
    if (L == null || !/^\s*[-*+] \[.\]/.test(L)) throw new Error("Milestone moved — the view will refresh, try again");
    const tm = L.match(/\[target::\s*([-\d.]+)[^\]]*\]/);
    const target = tm ? parseFloat(tm[1]) : null;
    const cm = L.match(/\[current::\s*([-\d.]+)[^\]]*\]/);
    let cur = cm ? parseFloat(cm[1]) : 0;
    const wasDone = /^\s*[-*+] \[[xX]\]/.test(L);
    let done = wasDone;
    if (mode === "toggle") { done = !wasDone; if (done && target != null && cur < target) cur = target; }
    else {
      if (target == null) throw new Error("Add [target:: N] to track numbers");
      cur = Math.max(0, +(mode === "set" ? val : cur + val).toFixed(2));
      done = cur >= target;
    }
    if (target != null) L = cm ? L.replace(cm[0], `[current:: ${cur}]`) : L.replace(/\[target::/, `[current:: ${cur}] [target::`);
    L = L.replace(/^(\s*[-*+] \[)[^\]](\])/, `$1${done ? "x" : " "}$2`);
    if (done && !wasDone) L = L.replace(/\s+$/, "") + ` ✅ ${TODAY}`;
    if (!done && wasDone) L = L.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/u, "");
    lines[line] = L;
    result = { done, wasDone, cur, target };
    return lines.join("\n");
  });
  return result;
}
async function addMilestone(path, m) {
  const f = app.vault.getAbstractFileByPath(path);
  if (!f) throw new Error("Quest file not found");
  const text = String(m.text || "").replace(/[\[\]\n]/g, " ").trim();
  if (!text) throw new Error("Describe the milestone first");
  let line = `- [ ] ${text}`;
  if (isFinite(m.target) && m.target > 0) line += ` [current:: 0] [target:: ${m.target}]` + (m.unit ? ` [unit:: ${String(m.unit).replace(/[\[\]]/g, "")}]` : "");
  if (isFinite(m.xp) && m.xp > 0) line += ` [xp:: ${m.xp}]`;
  if (m.due) line += ` 📅 ${m.due}`;
  await app.vault.process(f, data => {
    const lines = data.split("\n");
    let h = lines.findIndex(l => /^#{1,6}\s+.*milestone/i.test(l));
    if (h < 0) { lines.push("", "## Milestones", line); return lines.join("\n"); }
    let ins = h + 1;
    for (let i = h + 1; i < lines.length; i++) {
      if (/^#{1,6}\s/.test(lines[i])) break;
      if (/^\s*[-*+] \[.\]/.test(lines[i])) ins = i + 1;
    }
    lines.splice(ins, 0, line);
    return lines.join("\n");
  });
}
async function setFM(path, fn) {
  const f = app.vault.getAbstractFileByPath(path);
  if (!f) throw new Error("File not found: " + path);
  await app.fileManager.processFrontMatter(f, fn);
}
async function openPath(path) {
  const f = app.vault.getAbstractFileByPath(path);
  if (f) await app.workspace.getLeaf(true).openFile(f);
}
async function createFromTemplate(kind, rawName) {
  const map = {
    good: ["Good Habit.md", FOLDERS.good], bad: ["Bad Habit.md", FOLDERS.bad],
    quest: ["Quest.md", FOLDERS.quest], reward: ["Reward.md", FOLDERS.reward],
    vision: ["Vision Board.md", FOLDERS.prophecy],
  };
  const [tpl, folder] = map[kind];
  const name = String(rawName || "").replace(/[\\/:*?"<>|#^\[\]]/g, "").trim();
  if (!name) throw new Error("Type a name in the box first");
  const ext = tpl.endsWith(".canvas") ? ".canvas" : ".md";
  const path = `${folder}/${name}${ext}`;
  if (!app.vault.getAbstractFileByPath(path)) {
    await ensureFolder(folder);
    await app.vault.create(path, fillTemplate(await readTemplate(tpl), { date: TODAY, title: name }));
  }
  setTimeout(() => openEditor(path), 60);
  return path;
}

// Removing: habits & rewards are *retired* (active: false) so their XP history stays intact;
// quests are *abandoned* (status: abandoned); vision boards and "delete forever" go to Obsidian's trash (.trash).
async function removeEntity(kind, path) {
  const f = app.vault.getAbstractFileByPath(path);
  if (!f) throw new Error("File not found");
  const name = f.basename;
  if (kind === "habit" || kind === "reward") { await setFM(path, fm => { fm.active = false; }); toast(`${name} retired. Its history is kept — restore it from its ✎ editor (${kind === "habit" ? "Arcanium → Quest Library → Retired" : "Rewards → Retired rewards"}).`); }
  else if (kind === "quest") { await setFM(path, fm => { fm.status = "abandoned"; }); toast(`Quest abandoned: ${name}. Restore or delete it from the Quest Log.`); }
  else { await app.vault.trash(f, false); toast(`${name} moved to the vault trash (.trash).`); }
}
async function restoreEntity(kind, path) {
  if (kind === "quest") await setFM(path, fm => { fm.status = "active"; });
  else await setFM(path, fm => { fm.active = true; });
  toast("Restored: " + path.split("/").pop().replace(/\.md$/, ""), "good");
}
// two-click confirm buttons: <button class="sl-x" data-rm="kind" data-p="path">
const edBtn = path => `<button class="sl-ed" data-edit="${esc(path)}" title="Edit">✎</button>`;
const areaTag = name => {
  if (!name) return "";
  const a = areas.find(x => x.key === norm(name));
  return a && a.stat && a.stat !== "—" ? `${esc(a.stat)}🔹${esc(a.name)}` : esc(name);
};
const noteLine = n => n ? `<div class="sl-note">${esc(n)}</div>` : "";
const rmBtn = (kind, path, label = "✕", title = "Remove") => `<button class="sl-x" data-rm="${kind}" data-p="${esc(path)}" title="${esc(title)}">${label}</button>`;
function bindRemove(el) {
  el.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", async ev => {
    ev.preventDefault(); ev.stopPropagation();
    if (!b.classList.contains("armed")) {
      b.dataset.orig = b.innerHTML; b.classList.add("armed");
      b.textContent = b.dataset.rm === "trash" || b.dataset.rm === "vision" ? "Delete?" : b.dataset.rm === "quest" ? "Abandon?" : "Retire?";
      setTimeout(() => { if (b.isConnected) { b.classList.remove("armed"); b.innerHTML = b.dataset.orig; } }, 3500);
      return;
    }
    try { await removeEntity(b.dataset.rm, b.dataset.p); const card = b.closest(".sl-card,.sl-quest,.sl-feedrow"); if (card) card.style.opacity = ".25"; }
    catch (e) { toast("⚠ " + e.message, "bad"); }
  }));
  el.querySelectorAll("[data-restore]").forEach(b => b.addEventListener("click", async ev => {
    ev.preventDefault(); ev.stopPropagation();
    try { await restoreEntity(b.dataset.restore, b.dataset.p); } catch (e) { toast("⚠ " + e.message, "bad"); }
  }));
}
// "+ Add" box for window title bars
const ADD_LABEL = { good: "good habit", bad: "bad habit", quest: "quest", reward: "reward", vision: "vision board" };
const addBox = kind => `<span class="sl-add"><input class="sl-addin" data-addin="${kind}" placeholder="New ${ADD_LABEL[kind]}…"><button class="sl-btn xs" data-add="${kind}">＋ Add</button></span>`;
function bindAdd(el) {
  const go = async kind => {
    const inp = el.querySelector(`[data-addin="${kind}"]`);
    try { await createFromTemplate(kind, inp.value); toast(`New ${ADD_LABEL[kind]} created: ${inp.value}.`, "good"); inp.value = ""; }
    catch (e) { toast("⚠ " + e.message, "bad"); }
  };
  el.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", ev => { ev.preventDefault(); go(b.dataset.add); }));
  el.querySelectorAll("[data-addin]").forEach(i => i.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); go(i.dataset.addin); } }));
}

// ---- character portrait: click to upload any image; it's saved into the vault and set as `character:`
const portrait = (cls, src, rank) => `<div class="${cls} sl-portrait" title="Click to change your character image">
  ${src ? `<img src="${esc(src)}" alt="Character">` : `<div class="sl-sigil">${esc(rank)}</div>`}
  <span class="sl-portrait-edit">✎ Change</span><input type="file" accept="image/*" class="sl-portrait-file" hidden></div>`;
async function savePortrait(file) {
  if (!CFG.profilePath) throw new Error("Player Profile note not found");
  const ext = ((file.name.match(/\.([a-z0-9]+)$/i) || [, "png"])[1]).toLowerCase();
  await ensureFolder(P("_System/Assets/Characters"));
  const path = P(`_System/Assets/Characters/character-${M().format("YYYYMMDD-HHmmss")}.${ext}`);
  await app.vault.createBinary(path, await file.arrayBuffer());
  await setFM(CFG.profilePath, fm => { fm.character = path; });
  toast("Your character portrait has been updated.", "gold");
}
function bindPortraits(el) {
  el.querySelectorAll(".sl-portrait").forEach(p => {
    const inp = p.querySelector(".sl-portrait-file");
    p.addEventListener("click", ev => { if (ev.target !== inp) inp.click(); });
    inp.addEventListener("change", async () => { if (inp.files && inp.files[0]) { try { await savePortrait(inp.files[0]); } catch (e) { toast("⚠ " + e.message, "bad"); } } });
  });
}

// ---- icon picker: emoji grid, type/paste any emoji, upload an image, or reset — like the portrait
const EMOJI = ["✦", "★", "🔥", "⚔", "🛡", "🏆", "🎁", "🔒", "📜", "🔮", "☠", "✔", "✖", "↺", "⚠", "🗝", "🪄", "🧪", "💎", "👑", "🐉", "🦉", "🌙", "☀", "🌿", "🍄", "🌸", "🍀",
  "🏰", "⛺", "🕯", "📖", "🖋", "🧭", "🗺", "🎯", "🏹", "🪓", "🧶", "🧩", "🎲", "🎨", "🎵", "🧘", "🏋", "🏃", "🚴", "🥗", "🍎", "💧", "🛌", "🧠", "💼", "💰", "📈", "📚",
  "✍", "📞", "🧹", "🧺", "🍳", "🛒", "🐾", "🌱", "❤", "💪", "🍔", "🍺", "🚬", "📱", "😵", "🍩", "🎮", "💤", "🚶", "🎬", "🍜", "🏖", "✈", "🎧"];
function openIconPicker(title, current, onPick) {
  document.querySelectorAll(".sl-picker-back").forEach(x => x.remove());
  const back = document.createElement("div");
  back.className = "sl-picker-back sl-root";
  const curHtml = current ? (isImg(current) ? (imgSrc(current) ? `<img src="${esc(imgSrc(current))}">` : "") : `<span>${esc(current)}</span>`) : `<span class="sl-defico" title="Default">—</span>`;
  back.innerHTML = `<div class="sl-picker"><div class="sl-picker-head"><b>${esc(title)}</b><span class="sl-picker-cur">${curHtml}</span></div>
    <div class="sl-emojigrid">${EMOJI.map(e => `<button class="sl-emo" data-emo="${esc(e)}">${esc(e)}</button>`).join("")}</div>
    <div class="sl-actions"><input class="sl-addin sl-emoin" placeholder="…or type / paste any emoji or symbol" maxlength="8"><button class="sl-btn xs" data-use="1">Use</button></div>
    <div class="sl-actions"><button class="sl-btn sm" data-up="1">⬆ Upload image…</button><button class="sl-btn sm ghost" data-reset="1">Reset to default</button><span style="flex:1"></span><button class="sl-btn sm ghost" data-cancel="1">Cancel</button></div>
    <input type="file" accept="image/*" hidden></div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  const pick = async v => { close(); try { await onPick(v); } catch (e) { toast("⚠ " + e.message, "bad"); } };
  back.addEventListener("click", ev => { if (ev.target === back) close(); });
  back.querySelectorAll("[data-emo]").forEach(b => b.addEventListener("click", () => pick(b.dataset.emo)));
  const inp = back.querySelector(".sl-emoin");
  back.querySelector("[data-use]").addEventListener("click", () => inp.value.trim() && pick(inp.value.trim()));
  inp.addEventListener("keydown", ev => { if (ev.key === "Enter" && inp.value.trim()) pick(inp.value.trim()); });
  back.querySelector("[data-reset]").addEventListener("click", () => pick(null));
  back.querySelector("[data-cancel]").addEventListener("click", close);
  const file = back.querySelector('input[type="file"]');
  back.querySelector("[data-up]").addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    const ext = ((f.name.match(/\.([a-z0-9]+)$/i) || [, "png"])[1]).toLowerCase();
    const path = P(`_System/Assets/Icons/icon-${M().format("YYYYMMDD-HHmmss")}.${ext}`);
    await ensureFolder(P("_System/Assets/Icons"));
    await app.vault.createBinary(path, await f.arrayBuffer());
    pick(path);
  });
}
function bindIconEdits(el) {
  el.querySelectorAll("[data-iconedit]").forEach(w => w.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    const path = w.dataset.iconedit;
    const pg = ALL.where(p => p.file.path === path).first() || {};
    openIconPicker("Change icon — " + path.split("/").pop().replace(/\.md$/, ""), pg.icon || null, async v => {
      await setFM(path, fm => { fm.icon = v; if (fm.cover) fm.cover = null; });
      toast(v ? "Icon updated." : "Icon reset to default.", "good");
    });
  }));
  el.querySelectorAll("[data-uiicon]").forEach(w => w.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    const k = w.dataset.uiicon;
    openIconPicker("Interface icon — " + k, uiOverride(k), async v => {
      if (!CFG.profilePath) throw new Error("Player Profile not found");
      await setFM(CFG.profilePath, fm => { const m = Object.assign({}, fm.ui_icons || {}); if (v) m[k] = v; else delete m[k]; fm.ui_icons = m; });
      toast(v ? `“${k}” icon updated everywhere.` : `“${k}” icon reset.`, "good");
    });
  }));
}

// ---- Card editor pop-ups: XP, notes, cover image, icon, name and the settings of each kind of card
const EDIT_FIELDS = {
  habit: [["xp", "number", "XP"], ["area", "area", "Life area"], ["daily_quest", "bool", "Part of the Daily Quest ★"], ["cue", "text", "Definition of done"]],
  reward: [["cost", "number", "Cost (XP)"], ["repeatable", "bool", "Can be claimed again"], ["min_level", "number", "Unlocks at level"]],
  area: [["stat", "text", "Stat (e.g. STR, WIS)"], ["class", "text", "Class when this is your strongest stat (e.g. Ranger)"], ["description", "text", "Description"]],
  goal: [["rank", "select:E,D,C,B,A,S", "Rank"], ["xp_reward", "number", "XP for clearing the quest"], ["area", "area", "Life area"], ["deadline", "date", "Deadline"], ["victory", "text", "Victory condition"]],
  sidequest: [["xp", "number", "XP reward"], ["due", "date", "Due date"], ["repeat", "repeat", "Repeats"], ["area", "area", "Life area"]],
  "vision-board": [["horizon", "text", "Horizon (e.g. 2027)"], ["__body", "body", "Content (vision text — images are added on the Prophecy tab)"]],
  "future-self": [["horizon", "text", "Horizon (e.g. 5 years)"], ["__body", "body", "Write-up"]],
  profile: [["player_name", "text", "Player name"], ["job_class", "text", "Job (empty = earned automatically)"], ["title", "text", "Title (empty = earned automatically)"],
    ["banner", "image", "Banner image"], ["banner_title", "text", "Banner title"], ["banner_subtitle", "text", "Banner subtitle"],
    ["level_base_xp", "number", "XP for level 2"], ["level_step_xp", "number", "Extra XP per further level"], ["daily_quest_bonus", "number", "Daily Quest bonus XP"],
    ["focus", "focus", "Stats you most want to improve (up to 3)"], ["hp_max", "number", "Max HP"], ["hp_regen", "number", "HP regenerated per day"], ["hp_heal_per_habit", "number", "HP healed per good habit"]],
};
EDIT_FIELDS.quest = EDIT_FIELDS.goal; EDIT_FIELDS.vision = EDIT_FIELDS["vision-board"];
function popup(title, bodyHtml) {
  document.querySelectorAll(".sl-picker-back").forEach(x => x.remove());
  const back = document.createElement("div");
  back.className = "sl-picker-back sl-root";
  back.innerHTML = `<div class="sl-picker sl-editpop"><div class="sl-picker-head"><b>${esc(title)}</b><button class="sl-btn xs ghost" data-x="1">✕</button></div>${bodyHtml}</div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.addEventListener("mousedown", ev => { if (ev.target === back) close(); });
  back.querySelector("[data-x]").addEventListener("click", close);
  return { el: back, close };
}
async function uploadTo(folder, file, prefix) {
  const ext = ((file.name.match(/\.([a-z0-9]+)$/i) || [, "png"])[1]).toLowerCase();
  const path = P(`${folder}/${prefix}-${M().format("YYYYMMDD-HHmmss")}.${ext}`);
  await ensureFolder(P(folder));
  await app.vault.createBinary(path, await file.arrayBuffer());
  return path;
}
// ---- focus-stat picker (used by character creation and the profile editor)
function focusPicker(selected) {
  return `<div class="sl-focus" data-k="focus">${areas.map(a => `<label class="sl-focusopt ${selected.includes(a.key) ? "on" : ""}"><input type="checkbox" value="${esc(a.name)}" ${selected.includes(a.key) ? "checked" : ""}>
    <span class="sl-focusico">${a.icon ? ico(a.icon) : UI("spark")}</span><b>${esc(a.stat)}</b><span>${esc(a.name)}</span></label>`).join("")}</div>`;
}
function readFocus(box) { return Array.from(box.querySelectorAll("input:checked")).map(i => `[[${i.value}]]`); }
function bindFocus(scope) {
  scope.querySelectorAll(".sl-focus").forEach(box => box.addEventListener("change", ev => {
    const boxes = Array.from(box.querySelectorAll("input")), on = boxes.filter(b => b.checked);
    if (on.length > 3) { ev.target.checked = false; toast("Pick up to 3 focus stats", "bad"); }
    boxes.forEach(b => b.closest(".sl-focusopt").classList.toggle("on", b.checked));
  }));
}
// ---- character creation: shown once, the first time the Codex opens
function renderCreator() {
  if (!CFG.profilePath || profile.setup_done === true || window.__slCreatorShown) return;
  window.__slCreatorShown = true;
  const p = popup("Create your character", `
    <div class="sl-meta" style="margin-bottom:10px">Welcome to the Hearthbound Codex. Tell the Codex who you are — you can change all of this later in Profile → ✎ Edit profile &amp; settings.</div>
    <label class="sl-edrow"><span>Name</span><input class="sl-addin" data-c="name" value="${esc(profile.player_name && profile.player_name !== "Player" ? profile.player_name : "")}" placeholder="Your adventurer's name"></label>
    <label class="sl-edrow"><span>Job</span><input class="sl-addin" data-c="job" value="${esc(profile.job_class || "")}" placeholder="Leave empty to earn one as you level"></label>
    <div class="sl-edrow"><span>Portrait</span><div class="sl-edinline"><span class="sl-edcover" data-c="prev">${imgSrc(CFG.avatar) ? `<img src="${esc(imgSrc(CFG.avatar))}">` : `<span class="sl-defico">—</span>`}</span><button class="sl-btn xs" data-c="up">Upload…</button><input type="file" accept="image/*" hidden data-c="file"></div></div>
    <div class="sl-chtitle">Which stats do you most want to improve? (pick up to 3)</div>
    ${focusPicker(toArr(profile.focus).map(norm))}
    <div class="sl-actions"><button class="sl-btn" data-c="go">Begin the adventure</button><span style="flex:1"></span><button class="sl-btn xs ghost" data-c="skip">Skip for now</button></div>`);
  const el = p.el, q = k => el.querySelector(`[data-c="${k}"]`);
  bindFocus(el);
  let portraitFile = null;
  q("up").addEventListener("click", () => q("file").click());
  q("file").addEventListener("change", () => {
    portraitFile = q("file").files && q("file").files[0];
    if (portraitFile) q("prev").innerHTML = `<img src="${URL.createObjectURL(portraitFile)}">`;
  });
  q("skip").addEventListener("click", p.close);
  q("go").addEventListener("click", async () => {
    try {
      const name = q("name").value.trim(), job = q("job").value.trim(), focus = readFocus(el.querySelector(".sl-focus"));
      if (portraitFile) await savePortrait(portraitFile);
      await setFM(CFG.profilePath, fm => { if (name) fm.player_name = name; fm.job_class = job || null; fm.focus = focus; fm.setup_done = true; });
      p.close();
      toast(`Welcome, ${name || "adventurer"}! Your adventure begins.`, "gold");
    } catch (e) { toast("⚠ " + e.message, "bad"); }
  });
}
const defaultIconFor = pg => UI(pg.type === "habit" ? (String(pg.polarity) === "bad" ? "skull" : "spark") : pg.type === "reward" ? "gift" : pg.type === "goal" || pg.type === "quest" ? "sword" : pg.type === "sidequest" ? "check" : "spark");
async function openEditor(path) {
  let pg = ALL.where(p => p.file.path === path).first();
  const file = app.vault.getAbstractFileByPath(path);
  if (!pg && file) { const c = app.metadataCache.getFileCache && app.metadataCache.getFileCache(file); pg = Object.assign({}, (c && c.frontmatter) || {}, { file: { name: file.basename, path } }); }
  if (!pg) return toast("Couldn't find that card", "bad");
  const bodyText = file ? String(await app.vault.read(file)).replace(/^---\n[\s\S]*?\n---\n?/, "") : "";
  const type = pg.type, fields = (EDIT_FIELDS[type] || []).filter(([k]) => !(k === "daily_quest" && String(pg.polarity) === "bad"));
  const name = pg.file.name;
  const state = { images: {}, icon: pg.icon || null, cover: pg.cover ? (typeof pg.cover === "object" && pg.cover.path ? pg.cover.path : String(pg.cover)) : null };
  const val = v => (v == null ? "" : typeof v === "object" && v.path ? v.path : String(v));
  const input = ([k, kind, label]) => {
    const v = pg[k];
    let ctl;
    if (kind === "bool") ctl = `<input type="checkbox" data-k="${k}" ${v === true ? "checked" : ""}>`;
    else if (kind === "number") ctl = `<input class="sl-addin" type="number" step="any" data-k="${k}" value="${esc(val(v))}">`;
    else if (kind === "date") ctl = `<input class="sl-addin date" type="date" data-k="${k}" value="${esc(dstr(v) || "")}">`;
    else if (kind === "area") ctl = `<select class="sl-addin" data-k="${k}"><option value="">—</option>${areas.map(a => `<option ${norm(v) === a.key ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>`;
    else if (kind === "focus") ctl = focusPicker(toArr(v).map(norm));
    else if (kind === "repeat") ctl = `<div class="sl-edinline">${repeatSelect(v, `data-k="${k}"`)}</div>`;
    else if (kind === "body") ctl = `<textarea class="sl-addin sl-edbody" rows="10" data-k="${k}">${esc(bodyText)}</textarea>`;
    else if (kind === "image") { state.images[k] = v ? val(v) : null; ctl = `<div class="sl-edinline"><span class="sl-edcover" data-imgprev="${k}">${v && imgSrc(v) ? `<img src="${esc(imgSrc(v))}">` : `<span class="sl-defico">—</span>`}</span><button class="sl-btn xs" data-imgup="${k}">Upload…</button><button class="sl-btn xs ghost" data-imgrm="${k}">Remove</button><input type="file" accept="image/*" hidden data-imgfile="${k}"></div>`; }
    else if (kind.startsWith("select:")) ctl = `<select class="sl-addin" data-k="${k}">${kind.slice(7).split(",").map(o => `<option ${String(v || "").toUpperCase() === o ? "selected" : ""}>${o}</option>`).join("")}</select>`;
    else ctl = `<input class="sl-addin" data-k="${k}" value="${esc(val(v))}">`;
    return kind === "image" ? `<div class="sl-edrow"><span>${esc(label)}</span>${ctl}</div>` : `<label class="sl-edrow ${kind === "body" ? "top" : ""}"><span>${esc(label)}</span>${ctl}</label>`;
  };
  const xpLabel = type === "habit" && String(pg.polarity) === "bad" ? "XP lost when you slip" : null;
  const showIcon = ["habit", "reward", "area", "vision-board", "future-self", "goal", "quest", "sidequest"].includes(type);
  const isProfile = type === "profile";
  // Retire (habits, rewards) / Abandon (quests) live here, next to Delete
  const isQuest = type === "goal" || type === "quest", qStatus = String(pg.status || "active").toLowerCase();
  const retireCtl = (type === "habit" || type === "reward")
    ? (pg.active === false ? `<button class="sl-btn xs" data-restorecard="${type}">Restore</button>` : `<button class="sl-btn xs ghost" data-retirecard="${type}" title="Hide it but keep its history">Retire</button>`)
    : isQuest && qStatus !== "completed"
      ? (qStatus === "abandoned" ? `<button class="sl-btn xs" data-restorecard="quest">Restore quest</button>` : `<button class="sl-btn xs ghost" data-retirecard="quest" title="Move it to Dormant / Abandoned">Abandon</button>`)
      : "";
  const p = popup(`Edit — ${name}`, `
    <label class="sl-edrow"><span>Name</span><input class="sl-addin" data-name="1" value="${esc(name)}"></label>
    ${fields.map(f => input(xpLabel && f[0] === "xp" ? [f[0], f[1], xpLabel] : f)).join("")}
    ${showIcon ? `<div class="sl-edrow"><span>Icon</span><div class="sl-edinline"><span class="sl-edicon">${state.icon ? ico(state.icon) : `<span class="sl-defico" title="Default icon">${defaultIconFor(pg)}</span>`}</span><button class="sl-btn xs" data-icon="1">Change icon…</button></div></div>` : ""}
    ${isProfile ? "" : `<div class="sl-edrow"><span>Cover image</span><div class="sl-edinline"><span class="sl-edcover">${state.cover && imgSrc(state.cover) ? `<img src="${esc(imgSrc(state.cover))}">` : `<span class="sl-defico">—</span>`}</span>
      <button class="sl-btn xs" data-cover="1">Upload…</button><button class="sl-btn xs ghost" data-nocover="1">Remove</button><input type="file" accept="image/*" hidden data-coverfile="1"></div></div>
    <label class="sl-edrow top"><span>Notes</span><textarea class="sl-addin" rows="4" data-notes="1" placeholder="Anything you want to remember…">${esc(pg.notes || "")}</textarea></label>`}
    <div class="sl-actions"><button class="sl-btn" data-save="1">Save</button><button class="sl-btn ghost" data-cancel="1">Cancel</button>${isProfile ? "" : `<span style="flex:1"></span>${retireCtl}<button class="sl-btn xs red" data-delcard="1">Delete…</button>`}</div>`);
  const el = p.el;
  bindRepeat(el); bindFocus(el);
  const retBtn = el.querySelector("[data-retirecard]");
  if (retBtn) retBtn.addEventListener("click", async () => {
    if (!retBtn.classList.contains("armed")) { retBtn.classList.add("armed"); retBtn.textContent = retBtn.dataset.retirecard === "quest" ? "Click again to abandon" : "Click again to retire"; return; }
    try { await removeEntity(retBtn.dataset.retirecard, path); p.close(); } catch (e) { toast("⚠ " + e.message, "bad"); }
  });
  const resBtn = el.querySelector("[data-restorecard]");
  if (resBtn) resBtn.addEventListener("click", async () => { try { await restoreEntity(resBtn.dataset.restorecard, path); p.close(); } catch (e) { toast("⚠ " + e.message, "bad"); } });
  const delBtn = el.querySelector("[data-delcard]");
  if (delBtn) delBtn.addEventListener("click", async () => {
    if (!delBtn.classList.contains("armed")) {
      delBtn.classList.add("armed");
      delBtn.textContent = type === "habit" ? "Click again — deletes its whole history" : (type === "goal" || type === "quest" || type === "sidequest") ? "Click again — its XP is removed" : "Click again to delete";
      return;
    }
    try { await app.vault.trash(app.vault.getAbstractFileByPath(path), false); p.close(); toast(`Deleted: ${name}`); } catch (e) { toast("⚠ " + e.message, "bad"); }
  });
  const iconBtn = el.querySelector("[data-icon]");
  if (iconBtn) iconBtn.addEventListener("click", () => {
    // reuse the icon picker, then come back to this editor's state
    const keepEl = el; keepEl.style.display = "none";
    openIconPickerInline(state.icon, v => { state.icon = v; keepEl.querySelector(".sl-edicon").innerHTML = v ? ico(v) : `<span class="sl-defico" title="Default icon">${defaultIconFor(pg)}</span>`; document.body.appendChild(keepEl); keepEl.style.display = ""; },
      () => { document.body.appendChild(keepEl); keepEl.style.display = ""; });
  });
  const cf = el.querySelector("[data-coverfile]");
  if (cf) {
    el.querySelector("[data-cover]").addEventListener("click", () => cf.click());
    cf.addEventListener("change", async () => {
      const f = cf.files && cf.files[0]; if (!f) return;
      state.cover = await uploadTo("_System/Assets/Covers", f, "cover");
      el.querySelector(".sl-edcover").innerHTML = `<img src="${esc(imgSrc(state.cover) || "")}">`;
    });
    el.querySelector("[data-nocover]").addEventListener("click", () => { state.cover = null; el.querySelector(".sl-edcover").innerHTML = `<span class="sl-defico">—</span>`; });
  }
  el.querySelectorAll("[data-imgup]").forEach(b => {
    const k = b.dataset.imgup, fi = el.querySelector(`[data-imgfile="${k}"]`), prev = el.querySelector(`[data-imgprev="${k}"]`);
    b.addEventListener("click", () => fi.click());
    fi.addEventListener("change", async () => { const f = fi.files && fi.files[0]; if (!f) return; state.images[k] = await uploadTo("_System/Assets", f, k); prev.innerHTML = `<img src="${esc(imgSrc(state.images[k]) || "")}">`; });
    el.querySelector(`[data-imgrm="${k}"]`).addEventListener("click", () => { state.images[k] = null; prev.innerHTML = `<span class="sl-defico">—</span>`; });
  });
  el.querySelector("[data-cancel]").addEventListener("click", p.close);
  el.querySelector("[data-save]").addEventListener("click", async () => {
    try {
      const values = {};
      el.querySelectorAll("[data-k]").forEach(i => {
        const k = i.dataset.k, kind = (fields.find(f => f[0] === k) || [])[1];
        if (kind === "body" || kind === "image" || i.tagName === "INPUT" && i.type === "file") return;
        if (kind === "repeat") { values[k] = readRepeat(i.parentNode) || null; return; }
        if (kind === "focus") { values[k] = readFocus(i); return; }
        if (kind === "bool") values[k] = i.checked;
        else if (kind === "number") values[k] = i.value === "" ? null : +i.value;
        else if (kind === "area") values[k] = i.value ? `[[${i.value}]]` : null;
        else values[k] = i.value === "" ? null : i.value;
      });
      const notesEl = el.querySelector("[data-notes]"), notes = notesEl ? notesEl.value.trim() : null;
      await setFM(path, fm => {
        Object.assign(fm, values, state.images);
        if (showIcon) fm.icon = state.icon;
        if (!isProfile) { fm.cover = state.cover; fm.notes = notes || null; }
      });
      const bodyEl = el.querySelector(".sl-edbody");
      if (bodyEl) await app.vault.process(app.vault.getAbstractFileByPath(path), data => { const m = data.match(/^---\n[\s\S]*?\n---\n?/); return (m ? m[0] : "") + bodyEl.value; });
      const newName = el.querySelector("[data-name]").value.replace(/[\\/:*?"<>|#^\[\]]/g, "").trim();
      if (newName && newName !== name) {
        const newPath = path.split("/").slice(0, -1).concat(newName + "." + path.split(".").pop()).join("/");
        if (app.vault.getAbstractFileByPath(newPath)) throw new Error("Something with that name already exists");
        await app.fileManager.renameFile(app.vault.getAbstractFileByPath(path), newPath);
        if (type === "area") {  // keep habits & quests pointing at the renamed area
          for (const q of ALL.array()) if (q.area && norm(q.area) === norm(name)) await setFM(q.file.path, fm => { fm.area = `[[${newName}]]`; });
        }
      }
      p.close();
      toast("Saved.", "good");
    } catch (e) { toast("⚠ " + e.message, "bad"); }
  });
}
// icon picker used from inside the editor: returns the choice instead of saving it
function openIconPickerInline(current, onDone, onCancel) {
  openIconPicker("Choose an icon", current, async v => onDone(v));
  const back = document.querySelector(".sl-picker-back:last-of-type");
  if (back) {
    const cancel = back.querySelector("[data-cancel]");
    if (cancel) cancel.addEventListener("click", onCancel);
    back.addEventListener("mousedown", ev => { if (ev.target === back) onCancel(); });
  }
}
// milestone editor: text, numbers, XP and due date of one milestone line
function openMilestoneEditor(path, line) {
  const q = quests.find(x => x.path === path), m = q && q.ms.find(x => x.line === line);
  if (!m) return toast("Milestone moved — try again", "bad");
  const num_ = v => (v == null ? "" : v);
  const p = popup("Edit milestone", `
    <label class="sl-edrow"><span>Milestone</span><input class="sl-addin" data-f="text" value="${esc(m.text)}"></label>
    <label class="sl-edrow"><span>Progress so far</span><input class="sl-addin" type="number" step="any" data-f="current" value="${num_(m.target != null ? m.cur : "")}"></label>
    <label class="sl-edrow"><span>Target</span><input class="sl-addin" type="number" step="any" data-f="target" value="${num_(m.target)}"></label>
    <label class="sl-edrow"><span>Unit</span><input class="sl-addin" data-f="unit" value="${esc(m.unit)}"></label>
    <label class="sl-edrow"><span>+ button adds</span><input class="sl-addin" type="number" step="any" data-f="step" value="${num_(m.step !== 1 ? m.step : "")}" placeholder="1"></label>
    <label class="sl-edrow"><span>XP</span><input class="sl-addin" type="number" step="any" data-f="xp" value="${num_(m.xp || "")}"></label>
    <label class="sl-edrow"><span>Due date</span><input class="sl-addin date" type="date" data-f="due" value="${esc(m.due || "")}"></label>
    <div class="sl-actions"><button class="sl-btn" data-save="1">Save</button><button class="sl-btn ghost" data-cancel="1">Cancel</button><span style="flex:1"></span><button class="sl-btn xs red" data-del="1">Delete milestone</button></div>`);
  const el = p.el, f = k => el.querySelector(`[data-f="${k}"]`).value.trim();
  el.querySelector("[data-cancel]").addEventListener("click", p.close);
  const write = async build => {
    const file = app.vault.getAbstractFileByPath(path);
    await app.vault.process(file, data => {
      const lines = data.split("\n");
      if (!/^\s*[-*+] \[.\]/.test(lines[line] || "")) throw new Error("Milestone moved — try again");
      const out = build(lines[line]);
      if (out == null) lines.splice(line, 1); else lines[line] = out;
      return lines.join("\n");
    });
  };
  el.querySelector("[data-save]").addEventListener("click", async () => {
    try {
      const text = f("text").replace(/[\[\]]/g, "");
      if (!text) throw new Error("The milestone needs a description");
      await write(old => {
        const indent = old.match(/^\s*/)[0], box = (old.match(/^\s*[-*+] \[(.)\]/) || [, " "])[1];
        const doneDate = (old.match(/✅\s*(\d{4}-\d{2}-\d{2})/u) || [])[1];
        let L = `${indent}- [${box}] ${text}`;
        if (f("target") !== "") L += ` [current:: ${f("current") === "" ? 0 : +f("current")}] [target:: ${+f("target")}]`;
        if (f("unit")) L += ` [unit:: ${f("unit").replace(/[\[\]]/g, "")}]`;
        if (f("step") !== "" && +f("step") !== 1) L += ` [step:: ${+f("step")}]`;
        if (f("xp") !== "" && +f("xp") > 0) L += ` [xp:: ${+f("xp")}]`;
        if (f("due")) L += ` 📅 ${f("due")}`;
        if (doneDate) L += ` ✅ ${doneDate}`;
        return L;
      });
      p.close(); toast("Milestone saved.", "good");
    } catch (e) { toast("⚠ " + e.message, "bad"); }
  });
  const del = el.querySelector("[data-del]");
  del.addEventListener("click", async () => {
    if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "Click again to delete"; return; }
    try { await write(() => null); p.close(); toast("Milestone deleted."); } catch (e) { toast("⚠ " + e.message, "bad"); }
  });
}
function bindEditors(el) {
  el.querySelectorAll("[data-claimq]").forEach(b => b.addEventListener("click", async ev => {
    ev.preventDefault(); ev.stopPropagation();
    const q = quests.find(x => x.path === b.dataset.claimq);
    await setFM(q.path, fm => { fm.status = "completed"; fm.completed = TODAY; });
    toast(`QUEST CLEARED: ${q.name}! +${q.xp} XP. Your triumph is enshrined in the Hall of Triumph.`, "gold");
  }));
  el.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); openEditor(b.dataset.edit); }));
  el.querySelectorAll("[data-msedit]").forEach(b => b.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); openMilestoneEditor(b.dataset.p, +b.dataset.msedit); }));
}

// ---- Side quests: one-off tasks with an XP reward and optional due date
const REPEAT_OPTIONS = [["", "Doesn't repeat"], ["1d", "Every day"], ["3d", "Every 3 days"], ["7d", "Every week"], ["14d", "Every 2 weeks"], ["1m", "Every month"],
  ...WEEKDAYS.map((w, i) => [w, "Every " + WEEKDAY_NAMES[i]]), ["custom", "Every … days"]];
const repeatSelect = (cur, attr) => {
  const r = normRepeat(cur), known = REPEAT_OPTIONS.some(o => o[0] === r);
  return `<select class="sl-addin rep" ${attr}>${REPEAT_OPTIONS.map(([v, l]) => `<option value="${v}" ${(known ? r === v : v === "custom") ? "selected" : ""}>${l}</option>`).join("")}</select>
    <input class="sl-addin num repdays" type="number" min="1" placeholder="days" value="${!known && r.endsWith("d") ? parseInt(r) : ""}" style="${known ? "display:none" : ""}">`;
};
function readRepeat(scope) {
  const sel = scope.querySelector("select.rep"), days = scope.querySelector(".repdays");
  if (!sel) return "";
  if (sel.value === "custom") { const n = parseInt(days.value); return n > 0 ? n + "d" : ""; }
  return sel.value;
}
function bindRepeat(scope) {
  scope.querySelectorAll("select.rep").forEach(sel => sel.addEventListener("change", () => {
    const d = sel.parentNode.querySelector(".repdays"); if (d) d.style.display = sel.value === "custom" ? "" : "none";
  }));
}
function renderSideQuests() {
  const open = sideQuests.filter(q => q.open).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.name.localeCompare(b.name));
  const recent = sideQuests.filter(q => q.doneToday);   // finished ones leave the list the next day (kept for XP & Quest Library stats)
  const resting = sideQuests.filter(q => q.resting).sort((a, b) => a.next.localeCompare(b.next));
  const row = (q, state) => {
    const overdue = state === "open" && q.due && q.due < TODAY;
    const due = state === "done" ? (q.repeat ? `done · back ${M(nextOccurrence(q.repeat, TODAY)).format("ddd MMM D")}` : "done today")
      : state === "rest" ? `back ${M(q.next).format("ddd MMM D")}`
      : q.due ? (q.due === TODAY ? "due today" : overdue ? `overdue ${-daysFrom(TODAY, q.due)}d` : `due ${M(q.due).format("MMM D")}`) : "";
    return `<div class="sl-ms sl-sq ${state === "done" ? "done" : ""} ${state === "rest" ? "resting" : ""} ${overdue ? "overdue" : ""}">
      <button class="sl-check" data-sq="${esc(q.path)}" title="${state === "done" ? "Mark not done" : "Complete"}" ${state === "rest" ? "disabled" : ""}>${state === "done" ? UI("check") : ""}</button>
      <div class="sl-mstext"><div>${lnk(q.path, q.name)}${q.repeat ? ` <span class="sl-rep" title="Repeats">↻ ${esc(repeatLabel(q.repeat))}</span>` : ""}</div>${noteLine(q.notes)}</div>
      <span class="sl-due">${esc(due)}</span><span class="sl-msxp">+${q.xp}</span><span class="sl-ctrls">${rmBtn("trash", q.path, "✕", "Delete side quest")}${edBtn(q.path)}</span></div>`;
  };
  const avail = open.reduce((a, q) => a + q.xp, 0);
  const el = mount(win("SIDE QUESTS", `
    ${open.length ? open.map(q => row(q, "open")).join("") : empty("No open side quests. Add errands and one-off tasks below.")}
    ${recent.length ? `<div class="sl-chtitle">Done today — clears tomorrow</div>` + recent.map(q => row(q, "done")).join("") : ""}
    ${!OPTS.compact && resting.length ? `<div class="sl-chtitle">Repeating — coming back</div>` + resting.map(q => row(q, "rest")).join("") : ""}
    <div class="sl-msadd sl-sqadd">
      <input class="sl-addin" data-f="name" placeholder="New side quest, e.g. Clean house, Call doctor">
      <input class="sl-addin num" data-f="xp" type="number" min="0" value="10" title="XP reward">
      <input class="sl-addin date" data-f="due" type="date" title="Due date (optional)">
      <span class="sl-repwrap" title="Repeat">${repeatSelect("", "")}</span>
      <button class="sl-btn xs" data-addsq="1">＋ Add</button>
    </div>`, "", `${open.length} open · +${avail} XP available`));
  bindRepeat(el);
  bind(el, "[data-sq]", async d => {
    const q = sideQuests.find(x => x.path === d.sq);
    if (q.repeat) {
      if (q.doneToday) {   // undo today's completion
        await setFM(d.sq, fm => { fm.completions = toArr(fm.completions).map(dstr).filter(x => x && x !== TODAY); if (dstr(fm.done) === TODAY) fm.done = null; fm.next = null; });
      } else {
        const next = nextOccurrence(q.repeat, TODAY);
        await setFM(d.sq, fm => { fm.completions = [...new Set(toArr(fm.completions).map(dstr).filter(Boolean).concat([TODAY]))].sort(); fm.done = null; fm.next = next; fm.due = next; });
        toast(`Side quest complete: ${q.name}. +${q.xp} XP — it comes back ${M(next).format("dddd, MMM D")}.`, "good");
      }
      return;
    }
    await setFM(d.sq, fm => { fm.done = q.done ? null : TODAY; });
    if (!q.done) toast(`Side quest complete: ${q.name}. +${q.xp} XP`, "good");
  });
  const box = el.querySelector(".sl-sqadd");
  const val = k => box.querySelector(`[data-f="${k}"]`).value;
  const add = async () => {
    const name = val("name").replace(/[\\/:*?"<>|#^\[\]]/g, "").trim();
    if (!name) return toast("Name the side quest first", "bad");
    let path = P(`07 Side Quests/${name}.md`), n = 2;
    while (app.vault.getAbstractFileByPath(path)) path = P(`07 Side Quests/${name} (${n++}).md`);
    const xp = parseFloat(val("xp")), due = val("due"), rep = readRepeat(box);
    await ensureFolder(P("07 Side Quests"));
    await app.vault.create(path, `---\ntype: sidequest\nxp: ${isFinite(xp) ? xp : 10}\ndue: ${due || ""}\nrepeat: ${rep}\ndone:\ncreated: ${TODAY}\n---\n`);
    toast(`Side quest added: ${name}${rep ? " (" + repeatLabel(rep) + ")" : ""}`, "good");
  };
  box.querySelector("[data-addsq]").addEventListener("click", ev => { ev.preventDefault(); add(); });
  box.querySelector('[data-f="name"]').addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); add(); } });
}

// ---- Icon Forge: every interface icon, click to swap (emoji or image)
function renderIcons() {
  const keys = Object.keys(UI_DEFAULT).filter(k => !["crystal", "prophecy", "scroll"].includes(k)).concat(["rank-e", "rank-d", "rank-c", "rank-b", "rank-a", "rank-s"]);
  const label = { star: "Daily-quest star", shield: "Clean streak", trophy: "Trophy", lock: "Locked", gift: "Reward", sword: "Claim victory", skull: "Bad habit", fire: "Streak", scroll: "Scroll",
    crystal: "Vision board", check: "Complete", cross: "Slip", undo: "Undo", spark: "Good habit", prophecy: "Future self", warn: "Warning" };
  mount(win("ICON FORGE", `<div class="sl-meta" style="margin-bottom:10px">Click any icon to swap it for another emoji or your own image. Card icons (habits, rewards, life areas) change by clicking the icon on the card itself.</div>
    <div class="sl-iconforge">${keys.map(k => {
      const isRank = k.startsWith("rank-");
      const shown = isRank ? rankBadge(k.slice(5).toUpperCase()) : `<span class="sl-forgeico">${UI(k)}</span>`;
      return `<button class="sl-forgecell ${uiOverride(k) ? "custom" : ""}" data-uiicon="${esc(k)}" title="Click to change">${shown}<span>${esc(isRank ? "Rank " + k.slice(5).toUpperCase() : label[k] || k)}</span></button>`;
    }).join("")}</div>`));
}

/* ============================================================== SECTIONS */

function renderStatus() {
  const hr = new Date().getHours();
  const greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const rank = hunterRank(LV.lvl);
  const todayNet = xpOn(TODAY);
  const todayPen = -events.filter(e => e.date === TODAY && e.kind === "bad").reduce((a, e) => a + e.xp, 0);
  const hp = Math.max(0, Math.round(HP));
  const fellToday = deaths.filter(d => d.date === TODAY).pop();
  const log = logByDate[TODAY];
  const dqDone = dqHabits.filter(h => log && log.good.includes(h.key)).length;
  const goodToday = habits.filter(h => h.polarity === "good" && h.active);
  const doneToday = goodToday.filter(h => log && log.good.includes(h.key)).length;
  const keep = Math.round(pctOf(doneToday, goodToday.length));
  const cleared = quests.filter(q => q.status === "completed" && !q.example).length;
  const av = imgSrc(CFG.avatar);
  const stats = areas.map(a => {
    const x = areaXP[a.key] || 0;
    return `<div class="sl-stat ${FOCUS.has(a.key) ? "focus" : ""}" ${FOCUS.has(a.key) ? 'title="Focus stat"' : ""}><span class="sl-stat-k">${ico(a.icon, "", "sm")} ${esc(a.stat)}</span><span class="sl-stat-v">${10 + Math.floor(Math.max(0, x) / 100)}</span><span class="sl-stat-n">${esc(a.name)}</span></div>`;
  }).join("");
  const body = `
  <div class="sl-status">
    ${portrait("sl-avatar", av, rank)}
    <div class="sl-ident">
      <div class="sl-greet">${greet}, <b>${esc(CFG.name)}</b></div>
      <div class="sl-lvlrow"><div class="sl-lvl"><span class="sl-lvlnum">${LV.lvl}</span><span class="sl-lvllab">LEVEL</span></div>
        <div class="sl-idgrid">
          <div><span>JOB</span><b>${esc(CFG.job || autoJob(LV.lvl))}</b></div>
          <div><span>TITLE</span><b>${esc(CFG.title || autoTitle(LV.lvl))}</b></div>
          <div><span>RANK</span>${rankBadge(rank)}</div>
          <div><span>DATE</span><b>${M().format("MMM D, YYYY")}</b></div>
        </div></div>
    </div>
  </div>
  <div class="sl-meter"><span>HP</span>${bar(pctOf(hp, HPC.max), "hp" + (hp <= HPC.max * 0.3 ? " crit" : ""))}<em>${hp} / ${HPC.max}</em></div>
  <div class="sl-meter"><span>EXP</span>${bar(LV.pct, "xp")}<em>${fmt(LV.into)} / ${fmt(LV.need)}</em></div>
  <div class="sl-chips">
    ${chip("Total XP", fmt(totalXP))}
    ${chip("Gold (XP left)", fmt(gold), gold < 0 ? "neg" : "gold")}
    ${chip("Today", (todayNet >= 0 ? "+" : "") + fmt(todayNet), todayNet < 0 ? "neg" : "pos")}
    ${chip("Quests cleared", cleared)}
  </div>
  ${stats ? `<div class="sl-stats">${stats}</div>` : ""}
  <div class="sl-statusline">
    ${dqHabits.length ? `<span>Daily Quest <b>${dqDone}/${dqHabits.length}</b></span>` : ""}
    <span class="sl-keep">Keep going — ${keep}% of today's habits done</span>
    ${todayPen ? `<span class="sl-warn">${UI("warn")} Penalty today: −${todayPen} XP</span>` : ""}
    ${fellToday ? `<span class="sl-warn">${UI("skull")} ${esc(fellToday.label)}</span>` : hp <= HPC.max * 0.3 ? `<span class="sl-warn">${UI("warn")} HP CRITICAL — at 0 HP you lose a level. Complete good habits to heal (+${HPC.heal} each).</span>` : ""}
  </div>`;
  mount(win("STATUS", body, "sl-statuswin"));
}

// Navigation bar: centred links to every hub page + a Back button (Obsidian's "Navigate back").
const NAV_ITEMS = [["⚔", "Dashboard", "Codex Dashboard"], ["🏆", "Hall of Triumph", "Hall of Triumph"], ["🔮", "Prophecy Chamber", "The Prophecy Chamber"],
  ["📜", "Quests", "Quest Log"], ["📊", "Progress", "Progress Overview"], ["🧬", "Habit Codex", "Habit Codex"], ["🎁", "Rewards", "Reward Shop"],
  ["🜚", "Icon Forge", "Icon Forge"], ["👤", "Profile", "Player Profile"]];
function renderNav() {
  const here = (dv.currentFilePath || "").split("/").pop().replace(/\.md$/, "");
  const el = mount(`<nav class="sl-navbar"><button class="sl-btn xs ghost sl-back" title="Go back to the previous page">← Back</button>
    <span class="sl-navlinks">${NAV_ITEMS.map(([i, label, note]) => `<a class="sl-navlink ${note === here ? "on" : ""}" data-open="${esc(P("00 Command Center/" + note + ".md"))}" href="#">${i} ${esc(label)}</a>`).join("")}</span></nav>`);
  el.querySelector(".sl-back").addEventListener("click", ev => {
    ev.preventDefault();
    if (app.commands && app.commands.executeCommandById("app:go-back")) return;
    app.workspace.openLinkText(P("00 Command Center/Codex Dashboard.md"), dv.currentFilePath || "", false);
  });
}

// Banner: image + title text from the Player Profile (banner, banner_title, banner_subtitle)
function renderBanner() {
  const src = imgSrc(profile.banner || P("_System/Assets/banner.jpg"));
  const title = profile.banner_title != null ? profile.banner_title : "The Hearthbound Codex";
  const sub = profile.banner_subtitle != null ? profile.banner_subtitle : "Level Up In Life";
  mount(`<div class="sl-banner">${src ? `<img src="${esc(src)}" alt="">` : ""}<div class="sl-banner-text">
    ${title ? `<div class="sl-banner-title">${esc(title)}</div>` : ""}${sub ? `<div class="sl-banner-sub">${esc(sub)}</div>` : ""}</div></div>`);
}

function renderCharacter() {
  const rank = hunterRank(LV.lvl);
  const stats = areas.map(a => { const x = Math.max(0, areaXP[a.key] || 0); return `<div class="sl-csrow ${FOCUS.has(a.key) ? "focus" : ""}"><span>${ico(a.icon, "", "sm")} ${esc(a.stat)}</span><em>${esc(a.name)}${FOCUS.has(a.key) ? " ★ focus" : ""}</em><b>${10 + Math.floor(x / 100)}</b></div>`; }).join("");
  mount(win("CHARACTER", `<div class="sl-charsheet">
    ${portrait("sl-bigportrait", imgSrc(CFG.avatar), rank)}
    <div class="sl-charinfo">
      <div class="sl-charname">${esc(CFG.name)}</div>
      <div class="sl-chartitle">${esc(CFG.title || autoTitle(LV.lvl))}</div>
      <div class="sl-charline">Level <b>${LV.lvl}</b> ${esc(CFG.job || autoJob(LV.lvl))} ${rankBadge(rank)}</div>
      <div class="sl-meter"><span>HP</span>${bar(pctOf(HP, HPC.max), "hp")}<em>${Math.round(HP)} / ${HPC.max}</em></div>
      <div class="sl-meter"><span>EXP</span>${bar(LV.pct, "xp")}<em>${fmt(LV.into)} / ${fmt(LV.need)}</em></div>
      <div class="sl-cstats">${stats}</div>
      <div class="sl-meta">Click the portrait to upload your own character art.</div>
      ${CFG.profilePath ? `<button class="sl-btn sm" data-edit="${esc(CFG.profilePath)}">✎ Edit profile &amp; settings</button>` : ""}
    </div></div>`, "sl-charwin"));
}

// Profile: find the weakest stat and suggest how to raise it
const STAT_TIPS = {
  STR: ["Add a short daily strength habit — even 10 push-ups or a 15-minute walk counts.", "Book three workouts into this week as side quests.", "Start a quest with measurable milestones, e.g. “Run 5 km” or “20 push-ups in a row”."],
  VIT: ["Make sleep a habit: a fixed bedtime and 7+ hours.", "Add an easy health habit: a glass of water with every meal, or one home-cooked meal a day.", "Take a 10-minute walk outside after lunch."],
  AGI: ["Protect one deep-work block a day (phone in another room).", "Plan tomorrow's top three tasks before you stop working.", "Turn a lingering work task into a side quest with a due date."],
  INT: ["Read 10–20 pages a day as a habit.", "Pick one course or skill and make a quest with weekly lessons as milestones.", "Journal three lines each evening: a win, a lesson, a plan."],
  WIS: ["Schedule hobby time like an appointment — a weekly repeating side quest works well.", "Start a small creative quest, e.g. “Finish a 1,000-piece puzzle” or “Knit a scarf”.", "Try something new each week: a game night, a craft or a puzzle."],
};
function renderAdvice() {
  if (!areas.length) return;
  const since = M().subtract(30, "days").format("YYYY-MM-DD");
  const recentXP = {};
  for (const e of events) if (e.area && e.date && e.date > since) recentXP[norm(e.area)] = (recentXP[norm(e.area)] || 0) + e.xp;
  const ranked = areas.map(a => ({ a, x: Math.max(0, areaXP[a.key] || 0), r: recentXP[a.key] || 0 }))
    .map(o => Object.assign(o, { v: 10 + Math.floor(o.x / 100) }))
    .sort((p, q) => p.v - q.v || p.r - q.r || p.x - q.x);
  const focusRanked = ranked.filter(o => FOCUS.has(o.a.key));
  const weak = focusRanked[0] || ranked[0], a = weak.a, overall = ranked[0];
  const hs = habits.filter(h => h.active && norm(h.area) === a.key);
  const good = hs.filter(h => h.polarity === "good").map(h => ({ h, st: habitStats(h) })).sort((p, q) => p.st.last30 - q.st.last30);
  const bad = hs.filter(h => h.polarity === "bad").map(h => ({ h, st: habitStats(h) })).filter(o => o.st.last30 > 0).sort((p, q) => q.st.last30 - p.st.last30);
  const qs = quests.filter(q => isActive(q) && norm(q.area) === a.key);
  const sqs = sideQuests.filter(q => q.open && norm(q.area) === a.key);
  const tips = [];
  for (const { h, st } of good.slice(0, 2)) tips.push(`Do <b>${esc(h.name)}</b> more often — ${Math.round(pctOf(st.last30, 30))}% of days in the last 30 (+${h.xp} XP each).`);
  for (const { h, st } of bad.slice(0, 1)) tips.push(`Cut back on <b>${esc(h.name)}</b> — ${st.last30} slip${st.last30 === 1 ? "" : "s"} in the last 30 days, each costing ${h.xp} XP.`);
  for (const q of qs.slice(0, 2)) { const n = q.ms.find(m => !m.done); if (n) tips.push(`Push quest <b>${esc(q.name)}</b>: next milestone “${esc(n.text)}”${n.target != null ? ` (${fmt(n.cur)}/${fmt(n.target)} ${esc(n.unit)})` : ""}${n.xp ? ` for +${n.xp} XP` : ""}.`); }
  for (const q of sqs.slice(0, 2)) tips.push(`Clear side quest <b>${esc(q.name)}</b> for +${q.xp} XP.`);
  if (!good.length) tips.push(`You have no good habits in ${esc(a.name)} yet — add one below and set its life area to ${esc(a.name)}.`);
  if (!qs.length) tips.push(`Start a quest in ${esc(a.name)} so milestones feed this stat.`);
  const general = STAT_TIPS[String(a.stat).toUpperCase()] || ["Add a small daily habit in this area.", "Set a quest with measurable milestones for it.", "Add a repeating side quest so it shows up every week."];
  const bars = ranked.map(o => `<div class="sl-hrow"><span class="hn">${FOCUS.has(o.a.key) ? "★ " : ""}${esc(o.a.stat)}🔹${esc(o.a.name)}</span>${bar(Math.min(100, (o.x % 100)), o === weak ? "hp" : "xp")}<em>${o.v} · ${o.r >= 0 ? "+" : ""}${o.r} XP/30d</em></div>`).join("");
  const focusNote = focusRanked.length
    ? `<div class="sl-meta" style="margin-bottom:10px">Your focus: ${focusRanked.map(o => `${esc(o.a.stat)}🔹${esc(o.a.name)}`).join(", ")}. Showing the weakest of them.${overall !== weak ? ` Your weakest stat overall is ${esc(overall.a.stat)}🔹${esc(overall.a.name)} (${overall.v}).` : ""}</div>`
    : `<div class="sl-meta" style="margin-bottom:10px">Tip: choose focus stats in ✎ Edit profile &amp; settings and this window will help with those first.</div>`;
  mount(win(focusRanked.length ? "FOCUS STAT TO TRAIN" : "WEAKEST STAT", focusNote + `
    <div class="sl-weak"><div class="sl-weakstat">${esc(a.stat)}<small>${weak.v}</small></div>
      <div><div class="sl-card-name">${a.icon ? ico(a.icon) + " " : ""}${esc(a.name)}</div><div class="sl-meta">${fmt(weak.x)} XP all-time · ${weak.r >= 0 ? "+" : ""}${weak.r} XP in the last 30 days</div></div></div>
    ${tips.length ? `<div class="sl-chtitle">From your Codex</div><ul class="sl-tips">${tips.map(t => `<li>${t}</li>`).join("")}</ul>` : ""}
    <div class="sl-chtitle">Ideas to raise ${esc(a.stat)}</div><ul class="sl-tips">${general.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
    <div class="sl-chtitle">All stats, weakest first</div>${bars.replace(/(<span class="hn">)/g, "$1")}
    <div class="sl-addrow">${addBox("good")}</div>`));
}

// ---- Random quest generator: rolls a side or main quest, leaning toward focus & weak stats
const QUEST_IDEAS = {
  STR: { side: [["Do 50 push-ups today, in any sets", 15], ["Take the stairs all day", 10], ["Stretch for 15 minutes", 10], ["Go for a 30-minute bike ride", 20], ["Try a new workout video", 15], ["Carry the groceries home on foot", 10]],
    main: [["Run a 5K", "C", [["Run 1 km without stopping", 1, "km"], ["Run 3 km without stopping", 3, "km"], ["Run 5 km", 5, "km"]]], ["20 Push-ups in a Row", "D", [["10 push-ups in a row", 10, "reps"], ["15 push-ups in a row", 15, "reps"], ["20 push-ups in a row", 20, "reps"]]], ["Train 12 Times This Month", "C", [["4 sessions", 4, "sessions"], ["8 sessions", 8, "sessions"], ["12 sessions", 12, "sessions"]]]] },
  VIT: { side: [["Drink 8 glasses of water today", 10], ["Cook a healthy meal from scratch", 15], ["Be in bed by 22:30 tonight", 15], ["Take a 20-minute walk outside", 10], ["Book a check-up you've been putting off", 20], ["Have a no-sugar day", 15]],
    main: [["Sleep Reset", "C", [["7 nights of 7+ hours", 7, "nights"], ["14 nights of 7+ hours", 14, "nights"], ["30 nights of 7+ hours", 30, "nights"]]], ["Cook 10 New Healthy Recipes", "D", [["3 recipes", 3, "recipes"], ["6 recipes", 6, "recipes"], ["10 recipes", 10, "recipes"]]]] },
  AGI: { side: [["Clear your inbox to zero", 15], ["Do one 90-minute deep-work block", 20], ["Plan tomorrow's top three tasks", 10], ["Finish the task you've been avoiding", 25], ["Tidy your desk and files", 10], ["Update your CV or portfolio", 20]],
    main: [["Ship a Side Project", "B", [["Write the plan", 1, "plan"], ["Build the first version", 50, "%"], ["Finish and share it", 100, "%"]]], ["40 Hours of Deep Work", "C", [["10 hours", 10, "hours"], ["25 hours", 25, "hours"], ["40 hours", 40, "hours"]]]] },
  INT: { side: [["Read 30 pages", 15], ["Watch a documentary and note 3 things you learned", 15], ["Learn 10 words in a new language", 10], ["Write a one-page summary of a book", 20], ["Do a free online lesson", 15], ["Journal for 15 minutes", 10]],
    main: [["Read 3 Books", "C", [["Finish book 1", 1, "books"], ["Finish book 2", 2, "books"], ["Finish book 3", 3, "books"]]], ["Learn the Basics of a Language", "B", [["Learn 100 words", 100, "words"], ["Learn 300 words", 300, "words"], ["Hold a 5-minute conversation", 1, "conversation"]]]] },
  WIS: { side: [["Spend an hour on a hobby, phone away", 15], ["Start a puzzle", 10], ["Host or join a game night", 20], ["Make something with your hands", 15], ["Visit a museum, gallery or library", 15], ["Try a craft you've never done", 20]],
    main: [["Finish a Creative Project", "C", [["Gather materials", 1, "step"], ["Halfway done", 50, "%"], ["Finished", 100, "%"]]], ["Master a New Board Game", "D", [["Learn the rules", 1, "game"], ["Play 5 games", 5, "games"], ["Win a game", 1, "win"]]]] },
};
const GENERIC_IDEAS = { side: [["Do one thing you've been putting off", 20], ["Spend 30 minutes on this life area", 15], ["Help someone today", 15]],
  main: [["30-Day Challenge", "C", [["10 days", 10, "days"], ["20 days", 20, "days"], ["30 days", 30, "days"]]]] };
function pickArea() {
  if (!areas.length) return null;
  const weakest = areas.map(a => ({ a, x: areaXP[a.key] || 0 })).sort((p, q) => p.x - q.x)[0].a;
  const pool = [];
  for (const a of areas) { const w = 1 + (FOCUS.has(a.key) ? 3 : 0) + (a === weakest ? 2 : 0); for (let i = 0; i < w; i++) pool.push(a); }
  return pool[Math.floor(Math.random() * pool.length)];
}
function rollQuest(kind) {
  const a = pickArea(), ideas = (a && QUEST_IDEAS[String(a.stat).toUpperCase()]) || GENERIC_IDEAS;
  const list = ideas[kind] || GENERIC_IDEAS[kind];
  return { area: a, kind, idea: list[Math.floor(Math.random() * list.length)] };
}
function renderGenerator() {
  const st = window.__slRoll || (window.__slRoll = rollQuest("side"));
  const el = mount(win("QUEST GENERATOR", ""));
  const body = el.querySelector(".sl-window");
  const draw = () => {
    const r = window.__slRoll, a = r.area;
    const tag = a ? `${esc(a.stat)}🔹${esc(a.name)}${FOCUS.has(a.key) ? " ★" : ""}` : "";
    const detail = r.kind === "side"
      ? `<div class="sl-rollname">${esc(r.idea[0])}</div><div class="sl-meta">${tag} · side quest · +${r.idea[1]} XP · due in 2 days</div>`
      : `<div class="sl-rollname">${rankBadge(r.idea[1])} ${esc(r.idea[0])}</div><div class="sl-meta">${tag} · main quest · +${RANK_XP[r.idea[1]] || 200} XP when cleared</div>
         <ul class="sl-tips">${r.idea[2].map(m => `<li>${esc(m[0])} <span class="sl-meta">(${m[1]} ${esc(m[2])})</span></li>`).join("")}</ul>`;
    body.innerHTML = `<div class="sl-wtitle"><span>${esc(tcase("QUEST GENERATOR"))}</span></div>
      <div class="sl-tabs"><button class="sl-tab ${r.kind === "side" ? "on" : ""}" data-gk="side">Side quest</button><button class="sl-tab ${r.kind === "main" ? "on" : ""}" data-gk="main">Main quest</button></div>
      <div class="sl-roll"><div class="sl-dice">🎲</div><div>${detail}</div></div>
      <div class="sl-actions"><button class="sl-btn" data-g="accept">✔ Accept quest</button><button class="sl-btn ghost" data-g="reroll">🎲 Roll again</button></div>`;
    body.querySelectorAll("[data-gk]").forEach(b => b.addEventListener("click", () => { window.__slRoll = rollQuest(b.dataset.gk); draw(); }));
    body.querySelector('[data-g="reroll"]').addEventListener("click", () => { window.__slRoll = rollQuest(window.__slRoll.kind); draw(); });
    body.querySelector('[data-g="accept"]').addEventListener("click", async () => {
      try {
        const r2 = window.__slRoll, areaLink = r2.area ? `"[[${r2.area.name}]]"` : "";
        const safe = r2.idea[0].replace(/[\\/:*?"<>|#^\[\]]/g, "").trim();
        if (r2.kind === "side") {
          let path = P(`07 Side Quests/${safe}.md`), n = 2;
          while (app.vault.getAbstractFileByPath(path)) path = P(`07 Side Quests/${safe} (${n++}).md`);
          await ensureFolder(P("07 Side Quests"));
          await app.vault.create(path, `---\ntype: sidequest\nxp: ${r2.idea[1]}\ndue: ${M().add(2, "days").format("YYYY-MM-DD")}\nrepeat:\ndone:\narea: ${areaLink}\ncreated: ${TODAY}\n---\n`);
        } else {
          let path = P(`02 Quests/${safe}.md`), n = 2;
          while (app.vault.getAbstractFileByPath(path)) path = P(`02 Quests/${safe} (${n++}).md`);
          const ms = r2.idea[2].map((m, i) => `- [ ] ${m[0]} [current:: 0] [target:: ${m[1]}] [unit:: ${m[2]}] [xp:: ${[25, 40, 60][i] || 40}] 📅 ${M().add((i + 1) * 14, "days").format("YYYY-MM-DD")}`).join("\n");
          await ensureFolder(P("02 Quests"));
          await app.vault.create(path, `---\ntype: goal\nstatus: active\nrank: ${r2.idea[1]}\narea: ${areaLink}\nxp_reward: ${RANK_XP[r2.idea[1]] || 200}\nstarted: ${TODAY}\ndeadline: ${M().add(r2.idea[2].length * 14, "days").format("YYYY-MM-DD")}\ncompleted:\nvictory: ""\n---\n# ${r2.idea[0]}\n\n## Milestones\n${ms}\n`);
        }
        toast(`Quest accepted: ${r2.idea[0]}`, "gold");
        window.__slRoll = rollQuest(r2.kind);
      } catch (e) { toast("⚠ " + e.message, "bad"); }
    });
  };
  // the window's inner markup is drawn by draw(); `el` is the section wrapper
  draw();
}

// Embeddable badge: just level, rank and title.   ```codex  level  ```   (add `style: line` for a single line)
function renderLevelBadge() {
  const rank = hunterRank(LV.lvl), title = CFG.title || autoTitle(LV.lvl);
  if (OPTS.style === "line") {
    mount(`<div class="sl-lvline"><b>Level ${LV.lvl}</b>${rankBadge(rank)}<span>${esc(title)}</span></div>`);
    return;
  }
  mount(`<div class="sl-lvbadge"><div class="sl-lvbig"><span>${LV.lvl}</span><small>LEVEL</small></div>
    <div class="sl-lvinfo"><div class="sl-lvrank">${rankBadge(rank)}<span>Rank ${esc(rank)}</span></div><div class="sl-lvtitle">${esc(title)}</div></div></div>`);
}

function renderTime() {
  const now = M();
  const span = (u, iso) => { const s = M().startOf(iso || u), e = M().endOf(iso || u); return pctOf(now - s, e - s); };
  const rows = [["Year", span("year")], ["Month", span("month")], ["Week", span("week", "isoWeek")], ["Day", span("day")]];
  mount(win("TIME REMAINING", `<div class="sl-time">${rows.map(([l, p]) =>
    `<div class="sl-trow"><span>${l}</span>${bar(p, "time")}<em>${Math.floor(p)}%</em></div>`).join("")}</div>`));
}

function renderActions() {
  if (OPTS.compact) {
    const el = mount(`<div class="sl-toolbar"><span class="sl-tbl">${UI("spark")} QUICK ADD</span><input class="sl-input sl-tbin" type="text" placeholder="Name…">
      <button class="sl-btn xs" data-kind="good">＋ Good habit</button><button class="sl-btn xs red" data-kind="bad">＋ Bad habit</button>
      <button class="sl-btn xs" data-kind="quest">＋ Quest</button><button class="sl-btn xs gold" data-kind="reward">＋ Reward</button></div>`);
    const input = el.querySelector(".sl-tbin");
    bind(el, "[data-kind]", async d => { await createFromTemplate(d.kind, input.value); input.value = ""; });
    return;
  }
  const body = `
    <input class="sl-input" type="text" placeholder="Name it… e.g. Cold Shower, Learn Spanish">
    <div class="sl-actions">
      <button class="sl-btn" data-kind="good">＋ Good Habit</button>
      <button class="sl-btn red" data-kind="bad">＋ Bad Habit</button>
      <button class="sl-btn" data-kind="quest">＋ Quest / Goal</button>
      <button class="sl-btn gold" data-kind="reward">＋ Reward</button>
    </div>
    <div class="sl-meta" style="margin-top:8px">Edit, retire or delete anything from the ✎ on its card.</div>
`;
  const el = mount(win("QUICK ACTIONS", body));
  const input = el.querySelector(".sl-input");
  bind(el, "[data-kind]", async d => { await createFromTemplate(d.kind, input.value); input.value = ""; });
}

function habitCards(date, pol) {
  const log = logByDate[date];
  const doneSet = new Set(log ? (pol === "good" ? log.good : log.bad) : []);
  const list = habits.filter(h => h.polarity === pol && h.active);
  if (!list.length) return { html: empty(pol === "good" ? "No good habits yet — add one in Quick Actions." : "No bad habits tracked. Nice."), list, doneSet };
  const html = `<div class="sl-cards">` + list.map(h => {
    const done = doneSet.has(h.key);
    const area = h.area ? `<div class="sl-meta sl-areatag">${areaTag(h.area)}</div>` : "";
    if (pol === "good") return `
      <div class="sl-card ${done ? "is-done" : ""}">${edBtn(h.path)}
        ${art(h, "spark")}
        <div class="sl-card-body">
          <div class="sl-card-name">${lnk(h.path, h.name)}${h.dq ? `<span class="sl-star" title="Daily Quest">${UI("star")}</span>` : ""}</div>
          ${area}
          ${noteLine(h.notes)}
          <div class="sl-xpline ${done ? "ok" : ""}">${done ? `${UI("check")} Cleared · +${h.xp} XP` : `● Complete it to earn: <b>${h.xp} XP</b>`}</div>
          <button class="sl-btn sm ${done ? "ghost" : ""}" data-h="${esc(h.key)}">${done ? UI("undo") + " Undo" : UI("check") + " Complete"}</button>
        </div></div>`;
    const s = cleanStreak(h.key);
    return `
      <div class="sl-card bad ${done ? "is-hit" : ""}">${edBtn(h.path)}
        ${art(h, "skull")}
        <div class="sl-card-body">
          <div class="sl-card-name">${lnk(h.path, h.name)}</div>
          ${area}
          ${noteLine(h.notes)}
          <div class="sl-xpline ${done ? "neg" : ""}">${done ? `${UI("cross")} Slipped · −${h.xp} XP` : `● Don't do it — you'll lose <b>${h.xp} XP</b>`}</div>
          <div class="sl-meta">${UI("shield")} ${s == null ? "Never slipped" : s + " day" + (s === 1 ? "" : "s") + " clean"}</div>
          <button class="sl-btn sm ${done ? "ghost" : "red"}" data-h="${esc(h.key)}">${done ? UI("undo") + " Undo" : UI("cross") + " I did it"}</button>
        </div></div>`;
  }).join("") + `</div>`;
  return { html, list, doneSet };
}
function bindHabitCards(el, date) {
  bind(el, "[data-h]", async (d, b) => {
    const h = H[d.h];
    const added = await toggleHabit(date, h);
    const card = b.closest(".sl-card");
    if (h.polarity === "good") {
      card.classList.toggle("is-done", added);
      b.innerHTML = added ? UI("undo") + " Undo" : UI("check") + " Complete";
      toast(added ? `Quest complete: ${h.name}. You gained +${h.xp} XP.` : `Undone: ${h.name} (−${h.xp} XP)`, added ? "good" : "");
    } else {
      card.classList.toggle("is-hit", added);
      b.innerHTML = added ? UI("undo") + " Undo" : UI("cross") + " I did it";
      toast(added ? `Penalty: ${h.name}. You lost −${h.xp} XP.` : `Penalty removed: ${h.name}`, added ? "bad" : "good");
    }
  });
}
function renderHabits(date, pol) {
  const { html, list, doneSet } = habitCards(date, pol);
  let right = "";
  if (pol === "good") {
    const dqd = dqHabits.filter(h => doneSet.has(h.key)).length;
    const earned = list.filter(h => doneSet.has(h.key)).reduce((a, h) => a + h.xp, 0);
    right = `${dayLabel(date)} · ${doneSet.size ? list.filter(h => doneSet.has(h.key)).length : 0}/${list.length} · +${earned} XP`;
    const dqLine = dqHabits.length ? `<div class="sl-dq">${dqd === dqHabits.length ? UI("star") + " DAILY QUEST CLEARED" : `${UI("star")} Daily Quest: clear all starred habits for <b>+${CFG.dqBonus} XP</b> bonus`} ${bar(pctOf(dqd, dqHabits.length), "dq")}</div>` : "";
    bindHabitCards(mount(win("DAILY QUEST — GOOD HABITS", dqLine + html + `<div class="sl-addrow">${addBox("good")}</div>`, "", right)), date);
  } else {
    const lost = list.filter(h => doneSet.has(h.key)).reduce((a, h) => a + h.xp, 0);
    right = `${dayLabel(date)} · ${lost ? `<span class="neg">−${lost} XP</span>` : "no penalties"}`;
    bindHabitCards(mount(win("PENALTY ZONE — BAD HABITS", html + `<div class="sl-addrow">${addBox("bad")}</div>`, "sl-redwin", right)), date);
  }
}
function cleanStreak(key) {
  const dates = Object.values(logByDate).filter(l => l.bad.includes(key)).map(l => l.date).sort();
  if (!dates.length) return null;
  return Math.max(0, daysFrom(dates[dates.length - 1], TODAY));
}

function renderLog() {
  const cur = dv.current();
  const date = logDate(cur) || TODAY;
  const dayEv = events.filter(e => e.date === date);
  const net = dayEv.reduce((a, e) => a + e.xp, 0);
  const plus = dayEv.filter(e => e.xp > 0).reduce((a, e) => a + e.xp, 0);
  mount(win(`HEARTH LOG — ${M(date).format("dddd, MMMM D, YYYY").toUpperCase()}`, `<div class="sl-chips">
    ${chip("Net XP", (net >= 0 ? "+" : "") + net, net < 0 ? "neg" : "pos")}
    ${chip("Earned", "+" + plus, "pos")}
    ${chip("Penalties", "−" + (plus - net), plus - net ? "neg" : "")}
</div>`));
  renderHabits(date, "good");
  renderHabits(date, "bad");
}

function renderFeed() {
  const ev = events.filter(e => e.date).map(e => ({ ...e })).concat(spends.map(s => ({ date: s.date, xp: -s.cost, kind: "spend", label: s.label })));
  ev.sort((a, b) => b.date.localeCompare(a.date));
  const rows = ev.slice(0, OPTS.limit || 12).map(e => {
    const msg = e.kind === "death" ? `<b>${UI("skull")} ${esc(e.label)}</b>` : e.kind === "bad" ? `Penalty applied — ${esc(e.label)}` : e.kind === "spend" ? `Reward claimed — ${esc(e.label)}` :
      e.kind === "quest" ? `<b>${esc(e.label)}</b>` : e.kind === "bonus" ? `${UI("star")} ${esc(e.label)}` : e.kind === "side" ? `${UI("check")} ${esc(e.label)}` : `You have gained XP — ${esc(e.label)}`;
    const v = e.kind === "spend" ? `−${-e.xp} G` : (e.xp >= 0 ? "+" : "−") + Math.abs(e.xp) + " XP";
    return `<div class="sl-feedrow k-${e.kind}"><span class="sl-fd">${M(e.date).format("MMM D")}</span><span class="sl-fm">${msg}</span><span class="sl-fv">${v}</span></div>`;
  }).join("");
  mount(win("CHRONICLE", rows || empty("No activity yet. Complete a habit to receive your first message.")));
}

/* -------- charts (pure SVG) */
function barChart(days) {
  const W = 760, Hh = 220, P = 26;
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = M().subtract(i, "days").format("YYYY-MM-DD");
    const de = events.filter(e => e.date === d);
    data.push({ d, plus: de.filter(e => e.xp > 0).reduce((a, e) => a + e.xp, 0), minus: -de.filter(e => e.xp < 0).reduce((a, e) => a + e.xp, 0) });
  }
  const maxP = Math.max(20, ...data.map(x => x.plus)), maxN = Math.max(0, ...data.map(x => x.minus));
  const span = maxP + maxN, zero = P + (Hh - 2 * P) * (maxP / span), sc = (Hh - 2 * P) / span;
  const bw = (W - 2 * P) / days;
  let s = `<svg class="sl-svg" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none">`;
  s += `<line x1="${P}" x2="${W - P}" y1="${zero}" y2="${zero}" class="sl-axis"/>`;
  data.forEach((x, i) => {
    const X = P + i * bw + bw * 0.18, w = bw * 0.64;
    if (x.plus) s += `<rect class="sl-bp" x="${X}" y="${zero - x.plus * sc}" width="${w}" height="${x.plus * sc}" rx="2"><title>${x.d}: +${x.plus} XP</title></rect>`;
    if (x.minus) s += `<rect class="sl-bn" x="${X}" y="${zero}" width="${w}" height="${x.minus * sc}" rx="2"><title>${x.d}: −${x.minus} XP</title></rect>`;
    if (days <= 31 && (days <= 14 || i % 3 === 0 || i === days - 1))
      s += `<text class="sl-tx" x="${X + w / 2}" y="${Hh - 6}" text-anchor="middle">${days <= 14 ? M(x.d).format("dd D") : M(x.d).format("D")}</text>`;
  });
  s += `<text class="sl-tx" x="${P}" y="14">+${maxP}</text></svg>`;
  const tp = data.reduce((a, x) => a + x.plus, 0), tn = data.reduce((a, x) => a + x.minus, 0);
  return { svg: s, tp, tn };
}
function lineChart(points, opts = {}) {
  const W = 760, Hh = opts.h || 200, P = 30;
  if (points.length < 2) return empty("Not enough history yet — check back after a few days of logging.");
  const ys = points.map(p => p.y), max = Math.max(1, ...ys), min = Math.min(0, ...ys);
  const X = i => P + (i / (points.length - 1)) * (W - 2 * P), Y = v => Hh - P - ((v - min) / (max - min || 1)) * (Hh - 2 * P);
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  const area = `${d} L${X(points.length - 1)},${Y(min)} L${X(0)},${Y(min)} Z`;
  let s = `<svg class="sl-svg" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none"><path class="sl-area" d="${area}"/><path class="sl-line" d="${d}"/>`;
  const every = Math.ceil(points.length / 8);
  points.forEach((p, i) => {
    if ((i % every === 0 && points.length - 1 - i >= every * 0.6) || i === points.length - 1) s += `<text class="sl-tx" x="${X(i)}" y="${Hh - 8}" text-anchor="middle">${esc(p.label)}</text>`;
  });
  const last = points[points.length - 1];
  s += `<circle class="sl-dot" cx="${X(points.length - 1)}" cy="${Y(last.y)}" r="4"/><text class="sl-tx hi" x="${X(points.length - 1) - 6}" y="${Y(last.y) - 9}" text-anchor="end">${esc(opts.fmt ? opts.fmt(last.y) : fmt(last.y))}</text>`;
  s += `<text class="sl-tx" x="4" y="${Y(max) + 4}">${fmt(max)}</text></svg>`;
  return s;
}
function renderChart() {
  const days = OPTS.days || 14;
  const { svg, tp, tn } = barChart(days);
  mount(win(`XP — LAST ${days} DAYS`, `${svg}<div class="sl-legend"><span class="lp">■ earned +${tp}</span><span class="ln">■ penalties −${tn}</span><span>avg ${(Math.round((tp - tn) / days * 10) / 10)} XP/day</span></div>`));
}
function renderCharts() {
  const el = mount(win("PROGRESS GRAPHS", `
    <div class="sl-tabs"><button class="sl-tab on" data-r="30">30 days</button><button class="sl-tab" data-r="90">90 days</button><button class="sl-tab" data-r="365">1 year</button></div>
    <div class="sl-ch"></div>`));
  const box = el.querySelector(".sl-ch");
  const draw = range => {
    const start = M().subtract(range - 1, "days");
    const firstDate = events.filter(e => e.date).map(e => e.date).sort()[0];
    let cum = events.filter(e => e.date && e.date < start.format("YYYY-MM-DD")).reduce((a, e) => a + e.xp, 0);
    const growth = [], lvl = [], weekly = {};
    for (let i = 0; i < range; i++) {
      const d = M(start).add(i, "days").format("YYYY-MM-DD");
      cum += xpOn(d);
      const lab = range <= 31 ? M(d).format("MMM D") : M(d).format("MMM D");
      growth.push({ y: Math.max(0, cum), label: lab });
      lvl.push({ y: levelInfo(cum).lvl + levelInfo(cum).pct / 100, label: lab });
      const wk = M(d).startOf("isoWeek").format("YYYY-MM-DD");
      const w = weekly[wk] || (weekly[wk] = { good: 0, bad: 0, days: 0 });
      const l = logByDate[d]; w.days++;
      if (l) { w.good += new Set(l.good.filter(k => H[k] && H[k].polarity === "good")).size; w.bad += new Set(l.bad.filter(k => H[k] && H[k].polarity === "bad")).size; }
    }
    const goodCount = habits.filter(h => h.polarity === "good" && h.active).length || 1;
    const wk = Object.entries(weekly).map(([k, v]) => ({ k, rate: pctOf(v.good, goodCount * v.days), bad: v.bad }));
    const W = 760, Hh = 170, P = 26, bw = (W - 2 * P) / Math.max(1, wk.length), maxBad = Math.max(1, ...wk.map(x => x.bad));
    let ws = `<svg class="sl-svg" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none">`;
    wk.forEach((x, i) => {
      const X = P + i * bw, h1 = (x.rate / 100) * (Hh - 2 * P), h2 = (x.bad / maxBad) * (Hh - 2 * P) * 0.5;
      ws += `<rect class="sl-bp" x="${X + bw * 0.12}" y="${Hh - P - h1}" width="${bw * 0.4}" height="${h1}" rx="2"><title>Week of ${x.k}: ${Math.round(x.rate)}% habits done</title></rect>`;
      ws += `<rect class="sl-bn" x="${X + bw * 0.52}" y="${Hh - P - h2}" width="${bw * 0.36}" height="${h2}" rx="2"><title>Week of ${x.k}: ${x.bad} slips</title></rect>`;
      if (wk.length <= 14 || i % Math.ceil(wk.length / 12) === 0) ws += `<text class="sl-tx" x="${X + bw / 2}" y="${Hh - 8}" text-anchor="middle">${M(x.k).format("MMM D")}</text>`;
    });
    ws += `</svg>`;
    box.innerHTML = `
      <div class="sl-chtitle">Total XP growth</div>${lineChart(growth)}
      <div class="sl-chtitle">Level progression</div>${lineChart(lvl, { h: 150, fmt: v => "Lv " + Math.floor(v) })}
      <div class="sl-chtitle">Weekly consistency</div>${ws}
      <div class="sl-legend"><span class="lp">■ % of good habits completed</span><span class="ln">■ bad-habit slips (relative)</span>${firstDate ? `<span>tracking since ${M(firstDate).format("MMM D, YYYY")}</span>` : ""}</div>`;
  };
  el.querySelectorAll(".sl-tab").forEach(t => t.addEventListener("click", () => {
    el.querySelectorAll(".sl-tab").forEach(x => x.classList.toggle("on", x === t)); draw(+t.dataset.r);
  }));
  draw(30);
}

/* -------- weekly & monthly overviews */
function renderOverview() {
  const state = { mode: OPTS.mode || "week", anchor: M() };
  const el = mount(win("ADVENTURE SO FAR", `
    <div class="sl-ovbar">
      <div class="sl-tabs"><button class="sl-tab" data-m="week">Week</button><button class="sl-tab" data-m="month">Month</button></div>
      <div class="sl-nav"><button class="sl-btn sm ghost" data-n="-1">◀</button><b class="sl-ovlabel"></b><button class="sl-btn sm ghost" data-n="1">▶</button><button class="sl-btn sm ghost" data-n="0">Today</button></div>
    </div><div class="sl-ovbody"></div>`));
  const body = el.querySelector(".sl-ovbody"), label = el.querySelector(".sl-ovlabel");
  const goods = habits.filter(h => h.polarity === "good" && h.active), bads = habits.filter(h => h.polarity === "bad" && h.active);
  const draw = () => {
    el.querySelectorAll("[data-m]").forEach(t => t.classList.toggle("on", t.dataset.m === state.mode));
    const unit = state.mode === "week" ? "isoWeek" : "month";
    const s = M(state.anchor).startOf(unit), e = M(state.anchor).endOf(unit);
    const days = []; for (let d = M(s); d.isSameOrBefore(e, "day"); d.add(1, "day")) days.push(d.format("YYYY-MM-DD"));
    const pastDays = days.filter(d => d <= TODAY);
    label.textContent = state.mode === "week" ? `${s.format("MMM D")} – ${e.format("MMM D, YYYY")}` : s.format("MMMM YYYY");
    const xp = days.map(xpOn), net = xp.reduce((a, b) => a + b, 0);
    const doneCount = d => (logByDate[d] ? new Set(logByDate[d].good.filter(k => H[k] && H[k].polarity === "good")).size : 0);
    const totalDone = pastDays.reduce((a, d) => a + doneCount(d), 0);
    const rate = pctOf(totalDone, goods.length * pastDays.length);
    const slips = pastDays.reduce((a, d) => a + (logByDate[d] ? new Set(logByDate[d].bad).size : 0), 0);
    const perfect = pastDays.filter(d => goods.length && doneCount(d) === goods.length).length;
    const best = days.reduce((b, d, i) => (xp[i] > b.v ? { d, v: xp[i] } : b), { d: null, v: 0 });
    const chips = `<div class="sl-chips">${chip("Net XP", (net >= 0 ? "+" : "") + net, net < 0 ? "neg" : "pos")}${chip("Completion", Math.round(rate) + "%")}${chip("Perfect days", perfect)}${chip("Slips", slips, slips ? "neg" : "")}${chip("Best day", best.d ? M(best.d).format("ddd D") + ` (+${best.v})` : "—")}</div>`;
    const cell = (d, h) => {
      if (d > TODAY) return `<td class="fut"></td>`;
      const l = logByDate[d], hit = l && (h.polarity === "good" ? l.good : l.bad).includes(h.key);
      return `<td class="${hit ? (h.polarity === "good" ? "on" : "hit") : ""}" title="${d}">${hit ? (h.polarity === "good" ? "✔" : "✖") : ""}</td>`;
    };
    const rate1 = h => { const n = pastDays.filter(d => logByDate[d] && (h.polarity === "good" ? logByDate[d].good : logByDate[d].bad).includes(h.key)).length; return h.polarity === "good" ? `${n}/${pastDays.length}` : `${n}×`; };
    if (state.mode === "week") {
      const head = `<tr><th></th>${days.map(d => `<th class="${d === TODAY ? "today" : ""}">${M(d).format("dd")}<br><small>${M(d).format("D")}</small></th>`).join("")}<th>Total</th></tr>`;
      const rowsG = goods.map(h => `<tr><td class="hn">${ico(h.icon)} ${lnk(h.path, h.name)}</td>${days.map(d => cell(d, h)).join("")}<td class="tot">${rate1(h)}</td></tr>`).join("");
      const rowsB = bads.map(h => `<tr class="badrow"><td class="hn">${ico(h.icon)} ${lnk(h.path, h.name)}</td>${days.map(d => cell(d, h)).join("")}<td class="tot">${rate1(h)}</td></tr>`).join("");
      const xpRow = `<tr class="xprow"><td class="hn">XP</td>${xp.map((v, i) => `<td class="${v < 0 ? "neg" : v ? "pos" : ""}">${days[i] > TODAY ? "" : (v > 0 ? "+" : "") + v}</td>`).join("")}<td class="tot">${net}</td></tr>`;
      body.innerHTML = chips + `<div class="sl-tablewrap"><table class="sl-week">${head}${rowsG}${bads.length ? `<tr class="sep"><td colspan="9">Bad habits</td></tr>` + rowsB : ""}${xpRow}</table></div>`;
    } else {
      const maxXP = Math.max(20, ...xp);
      const lead = (s.isoWeekday() + 6) % 7;
      let cal = `<div class="sl-cal">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(x => `<div class="sl-calh">${x}</div>`).join("")}`;
      for (let i = 0; i < lead; i++) cal += `<div class="sl-calc blank"></div>`;
      days.forEach((d, i) => {
        const v = xp[i], a = v > 0 ? 0.15 + 0.85 * (v / maxXP) : 0;
        cal += `<div class="sl-calc ${d === TODAY ? "today" : ""} ${d > TODAY ? "fut" : ""} ${v < 0 ? "negday" : ""}" style="--a:${a.toFixed(2)}" title="${d}: ${v} XP">
          <span class="sl-cald">${M(d).format("D")}</span>${d <= TODAY && (v || doneCount(d)) ? `<span class="sl-calv">${v > 0 ? "+" : ""}${v}</span><span class="sl-calm">${doneCount(d)}/${goods.length}</span>` : ""}</div>`;
      });
      cal += `</div>`;
      const hrows = goods.concat(bads).map(h => {
        const n = pastDays.filter(d => logByDate[d] && (h.polarity === "good" ? logByDate[d].good : logByDate[d].bad).includes(h.key)).length;
        const p = pctOf(n, pastDays.length);
        return `<div class="sl-hrow ${h.polarity}"><span class="hn">${ico(h.icon)} ${lnk(h.path, h.name)}</span>${bar(p, h.polarity === "good" ? "xp" : "hp")}<em>${h.polarity === "good" ? Math.round(p) + "%" : n + " slips"}</em></div>`;
      }).join("");
      body.innerHTML = chips + `<div class="sl-ovgrid"><div>${cal}</div><div><div class="sl-chtitle">Habit consistency this month</div>${hrows || empty("No habits")}</div></div>`;
    }
    body.querySelectorAll("[data-open]").forEach(a => a.addEventListener("click", ev => { ev.preventDefault(); app.workspace.openLinkText(a.dataset.open, dv.currentFilePath || "", ev.ctrlKey || ev.metaKey); }));
  };
  el.querySelectorAll("[data-m]").forEach(t => t.addEventListener("click", () => { state.mode = t.dataset.m; draw(); }));
  el.querySelectorAll("[data-n]").forEach(t => t.addEventListener("click", () => {
    const n = +t.dataset.n; state.anchor = n === 0 ? M() : M(state.anchor).add(n, state.mode === "week" ? "week" : "month"); draw();
  }));
  draw();
}

/* -------- rewards */
function rewardCard(r) {
  const claimedOnce = r.claims.length > 0, locked = LV.lvl < r.minLevel;
  const soldOut = !r.repeatable && claimedOnce, afford = gold >= r.cost;
  let status;
  if (soldOut) status = `<div class="sl-xpline ok">${UI("trophy")} Claimed ${M(r.claims[r.claims.length - 1]).format("MMM D")}</div>`;
  else if (locked) status = `<div class="sl-xpline neg">${UI("lock")} Unlocks at Level ${r.minLevel}</div>`;
  else if (afford) status = `<div class="sl-xpline ok">● Available now</div>`;
  else status = `<div class="sl-xpline neg">● Need ${fmt(r.cost - gold)} more XP</div>`;
  return `<div class="sl-card reward ${soldOut ? "is-done" : ""}">${edBtn(r.path)}
    ${art(r, "gift")}
    <div class="sl-card-body">
      <div class="sl-card-name">${lnk(r.path, r.name)}</div>
      <div class="sl-cost">${fmt(r.cost)} XP${r.repeatable ? " · repeatable" : " · one-time"}</div>${noteLine(r.notes)}
      ${status}
      ${r.claims.length ? `<div class="sl-meta">Claimed ${r.claims.length}×</div>` : ""}
      ${soldOut ? "" : `<button class="sl-btn sm gold" data-claim="${esc(r.path)}" ${afford && !locked ? "" : "disabled"}>${UI("gift")} Claim Reward</button>`}
    </div></div>`;
}
function bindRewards(el) {
  bind(el, "[data-claim]", async (d, b) => {
    const r = rewards.find(x => x.path === d.claim);
    if (gold < r.cost) throw new Error("Not enough XP yet");
    await setFM(r.path, fm => { fm.claims = toArr(fm.claims).concat([TODAY]); });
    b.disabled = true; b.innerHTML = UI("check") + " Claimed";
    toast(`Reward unlocked: ${r.name}. −${r.cost} XP spent. Enjoy it, adventurer.`, "gold");
  });
}
function renderRewards() {
  const live = rewards.filter(r => r.active);
  const list = OPTS.limit ? live.slice(0, OPTS.limit) : live;
  const retired = rewards.filter(r => !r.active);
  const recent = spends.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const hist = recent.length ? `<div class="sl-chtitle">Recently claimed</div>` + recent.map(s => `<div class="sl-feedrow k-spend"><span class="sl-fd">${M(s.date).format("MMM D")}</span><span class="sl-fm">${esc(s.label)}</span><span class="sl-fv">−${s.cost}</span></div>`).join("") : "";
  const el = mount(win("REWARD SHOP", `<div class="sl-shophead">Available to spend: <b class="gold">${fmt(gold)} XP</b></div>
    ${list.length ? `<div class="sl-cards">${list.map(rewardCard).join("")}</div>` : empty("No rewards yet — add one below.")}
    <div class="sl-addrow">${addBox("reward")}</div>${OPTS.limit ? "" : hist}
    ${!OPTS.limit && retired.length ? `<div class="sl-chtitle">Retired rewards</div>` + retired.map(r => `<div class="sl-feedrow"><span class="sl-fd">${fmt(r.cost)}</span><span class="sl-fm">${ico(r.icon)} ${lnk(r.path, r.name)}</span><button class="sl-btn xs ghost" data-restore="reward" data-p="${esc(r.path)}">Restore</button>${rmBtn("trash", r.path, "Delete", "Delete forever (moves to .trash)")}</div>`).join("") : ""}`));
  bindRewards(el);
}

function renderAreas() {
  if (!areas.length) return mount(win("LIFE AREAS", empty("Create notes in 04 Life Areas with <code>type: area</code>.")));
  mount(win("LIFE AREAS", `<div class="sl-cards">${areas.map(a => {
    const x = Math.max(0, areaXP[a.key] || 0);
    const nq = quests.filter(q => norm(q.area) === a.key && isActive(q)).length;
    return `<div class="sl-card area">${edBtn(a.path)}${art(a, "spark")}<div class="sl-card-body">
      <div class="sl-card-name">${lnk(a.path, a.name)}</div>
      <div class="sl-meta"><b>${esc(a.stat)} ${10 + Math.floor(x / 100)}</b> · ${nq} active quest${nq === 1 ? "" : "s"}</div>
      <div class="sl-mono">All-time XP earned: ${fmt(x)}</div>${bar(x % 100, "xp")}</div></div>`;
  }).join("")}</div>`));
}

/* -------- quests */
function msRow(m, q, compact) {
  const overdue = !m.done && m.due && m.due < TODAY;
  const dueTxt = m.due ? (m.done ? M(m.due).format("MMM D") : overdue ? `overdue ${-daysFrom(TODAY, m.due)}d` : daysFrom(TODAY, m.due) === 0 ? "due today" : `${daysFrom(TODAY, m.due)}d left`) : "no date";
  const prog = m.target != null ? `<span class="sl-msnum">${fmt(m.cur)}<small>/${fmt(m.target)} ${esc(m.unit)}</small></span>` : "";
  const ctrls = m.target != null && !m.done
    ? `<button class="sl-btn xs ghost" data-ms="${m.line}" data-p="${esc(m.path)}" data-op="add" data-v="${-m.step}">−</button><button class="sl-btn xs" data-ms="${m.line}" data-p="${esc(m.path)}" data-op="add" data-v="${m.step}">+${m.step}</button><input class="sl-msin" type="number" step="any" placeholder="log…" title="Type an amount and press Enter to log it" data-msin="${m.line}" data-p="${esc(m.path)}">`
    : "";
  return `<div class="sl-ms ${m.done ? "done" : ""} ${overdue ? "overdue" : ""}">
    <button class="sl-check" data-ms="${m.line}" data-p="${esc(m.path)}" data-op="toggle" title="Toggle complete">${m.done ? UI("check") : ""}</button>
    <div class="sl-mstext"><div>${esc(m.text)}${compact && q ? ` <span class="sl-meta">· ${lnk(q.path, q.name)}</span>` : ""}</div>${m.target != null ? bar(m.pct * 100, "ms") : ""}</div>
    ${prog}<span class="sl-due">${esc(dueTxt)}</span>${m.xp ? `<span class="sl-msxp">+${m.xp}</span>` : ""}<span class="sl-ctrls">${ctrls}<button class="sl-ed" data-msedit="${m.line}" data-p="${esc(m.path)}" title="Edit milestone">✎</button></span></div>`;
}
function bindMilestones(el) {
  bind(el, "[data-ms]", async d => {
    const r = await updateMilestone(d.p, +d.ms, d.op, +d.v || 0);
    if (r.done && !r.wasDone) toast("Milestone conquered! Quest progress increased.", "good");
  });
  el.querySelectorAll("[data-msin]").forEach(i => i.addEventListener("keydown", async ev => {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    const v = parseFloat(i.value);
    if (!isFinite(v)) return toast("Type a number first", "bad");
    try {
      const r = await updateMilestone(i.dataset.p, +i.dataset.msin, "add", v);
      toast(r.done && !r.wasDone ? "Milestone conquered! Quest progress increased." : `Progress logged: ${v > 0 ? "+" : ""}${v} → ${fmt(r.cur)}/${fmt(r.target)}`, "good");
    } catch (e) { toast("⚠ " + e.message, "bad"); }
  }));
}
const claimBtn = q => q.ms.length && q.ms.every(m => m.done) && isActive(q) ? `<button class="sl-btn wide gold" data-claimq="${esc(q.path)}">${UI("sword")} Claim victory — +${fmt(q.xp)} XP</button>` : "";
function questCard(q, removable) {
  const next = q.ms.filter(m => !m.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"))[0];
  const dl = q.deadline ? daysFrom(TODAY, q.deadline) : null;
  return `<div class="sl-quest">
    <div class="sl-qhead">${rankBadge(q.rank)}<div class="sl-qname">${lnk(q.path, q.name)}${q.example ? ` <span class="sl-tag">example</span>` : ""}<div class="sl-meta">${q.area ? areaTag(q.area) : "—"} · reward ${fmt(q.xp)} XP${q.deadline ? ` · deadline ${M(q.deadline).format("MMM D, YYYY")} (${dl >= 0 ? dl + "d left" : "overdue"})` : ""}</div></div>
    <div class="sl-qpct">${Math.round(q.pct * 100)}%</div>${edBtn(q.path)}</div>
    ${bar(q.pct * 100, "quest")}
    ${claimBtn(q)}${noteLine(q.notes)}<div class="sl-meta">${q.ms.filter(m => m.done).length}/${q.ms.length} milestones${next ? ` · next: <b>${esc(next.text)}</b>${next.due ? " (" + M(next.due).format("MMM D") + ")" : ""}` : ""}</div>
  </div>`;
}
function renderQuests() {
  const act = quests.filter(isActive).sort(questOrder);
  const other = quests.filter(q => !isActive(q) && q.status !== "completed");
  mount(win("ACTIVE QUESTS", (act.length ? act.map(q => questCard(q, true)).join("") : empty("No active quests yet — every quest needs measurable milestones.")) + `<div class="sl-addrow">${addBox("quest")}</div>`, "", `${act.length} active`));
  if (other.length) mount(win("DORMANT / ABANDONED", other.map(q => `<div class="sl-feedrow"><span class="sl-fd">${esc(q.status)}</span><span class="sl-fm">${lnk(q.path, q.name)} <span class="sl-meta">${Math.round(q.pct * 100)}%</span></span><button class="sl-btn xs ghost" data-restore="quest" data-p="${esc(q.path)}">Restore</button>${rmBtn("trash", q.path, "Delete", "Delete forever (moves to .trash)")}</div>`).join("")));
}

function renderGoal() {
  const cur = dv.current();
  const q = quests.find(x => x.path === cur.file.path);
  if (!q) return mount(win("QUEST", empty("This note is not a quest (needs <code>type: goal</code>).")));
  const allDone = q.ms.length && q.ms.every(m => m.done);
  const dl = q.deadline ? daysFrom(TODAY, q.deadline) : null;
  const msXP = q.ms.filter(m => m.done).reduce((a, m) => a + m.xp, 0);
  let footer = "";
  if (q.status === "completed") footer = `<div class="sl-victory">${UI("trophy")} Enshrined in the Hall of Triumph on ${M(q.completed).format("MMMM D, YYYY")} <button class="sl-btn xs ghost" data-reopen="1">reopen</button></div>`;
  else if (allDone) footer = `<button class="sl-btn wide gold big" data-claim-q="1">${UI("sword")} CLAIM VICTORY — +${fmt(q.xp)} XP</button>`;
  const el = mount(win(`QUEST · ${q.status.toUpperCase()}`, `
    <div class="sl-qhead">${rankBadge(q.rank, "big")}<div class="sl-qname"><b>${esc(q.name)}</b><div class="sl-meta">${q.area ? areaTag(q.area) : "No area"} · started ${q.started ? M(q.started).format("MMM D, YYYY") : "—"}${q.deadline ? ` · deadline ${M(q.deadline).format("MMM D, YYYY")} (${dl >= 0 ? dl + " days left" : "overdue"})` : ""}</div>
    ${q.victory ? `<div class="sl-victorycond">Victory condition: ${esc(q.victory)}</div>` : ""}</div><div class="sl-qpct">${Math.round(q.pct * 100)}%</div></div>
    ${bar(q.pct * 100, "quest big")}
    <div class="sl-chips">${chip("Milestones", `${q.ms.filter(m => m.done).length}/${q.ms.length}`)}${chip("Milestone XP", "+" + msXP, "pos")}${chip("Clear reward", fmt(q.xp) + " XP", "gold")}</div>
    <div class="sl-mslist">${q.ms.length ? q.ms.map(m => msRow(m, q)).join("") : empty("Add milestones under the <b>## Milestones</b> heading, e.g.<br><code>- [ ] Run 5 km [current:: 0] [target:: 5] [unit:: km] [xp:: 50] 📅 2026-12-01</code>")}</div>
    ${footer}
    <div class="sl-notectl">${q.status === "abandoned" ? `<button class="sl-btn xs ghost" data-restore="quest" data-p="${esc(q.path)}">Restore quest</button>` : q.status !== "completed" ? rmBtn("quest", q.path, "Abandon quest") : ""}${rmBtn("trash", q.path, "Delete forever", "Moves to .trash")}</div>`, "sl-questwin"));
  bindMilestones(el);
  bind(el, "[data-claim-q]", async () => {
    await setFM(q.path, fm => { fm.status = "completed"; fm.completed = TODAY; });
    toast(`QUEST CLEARED: ${q.name}! +${q.xp} XP. Your triumph has been recorded.`, "gold");
  });
  bind(el, "[data-reopen]", async () => { await setFM(q.path, fm => { fm.status = "active"; fm.completed = null; }); });
}

// Dashboard window: every active quest's milestones — log progress, tick them off, add new ones.
function renderMilestones() {
  const RANKS = ["S", "A", "B", "C", "D", "E"];
  const act = quests.filter(isActive).sort(questOrder);   // same order as the Quests list; milestones keep the order they have in the quest
  const showDone = !!OPTS.showDone;
  const blocks = act.map((q, i) => {
    const open = q.ms.filter(m => !m.done), done = q.ms.length - open.length;
    return `<details class="sl-qblock" ${i < (OPTS.open ?? 3) ? "open" : ""}>
      <summary><div class="sl-qhead small">${rankBadge(q.rank)}<div class="sl-qname">${lnk(q.path, q.name)}<div class="sl-meta">${done}/${q.ms.length} milestones${q.deadline ? " · deadline " + M(q.deadline).format("MMM D, YYYY") : ""}</div></div><div class="sl-qpct">${Math.round(q.pct * 100)}%</div>${edBtn(q.path)}</div>${bar(q.pct * 100, "quest")}</summary>
      <div class="sl-mslist">${(showDone ? q.ms : open).map(m => msRow(m, q)).join("") || (claimBtn(q) || empty("No milestones yet — add one below."))}</div>${showDone ? claimBtn(q) : ""}
      <div class="sl-msadd" data-q="${esc(q.path)}">
        <input class="sl-addin" data-f="text" placeholder="New milestone, e.g. Run 10 km">
        <input class="sl-addin num" data-f="target" type="number" step="any" min="0" placeholder="Target">
        <input class="sl-addin unit" data-f="unit" placeholder="Unit">
        <input class="sl-addin date" data-f="due" type="date" title="Due date">
        <input class="sl-addin num" data-f="xp" type="number" min="0" placeholder="XP" value="25" title="XP when completed">
        <button class="sl-btn xs" data-addms="1">＋ Add milestone</button>
      </div></details>`;
  }).join("");
  const el = mount(win("QUEST MILESTONES", blocks || empty("No active quests yet — create one with ＋ Quest, then add milestones here."), "", `${act.length} active quest${act.length === 1 ? "" : "s"}`));
  bindMilestones(el);
  el.querySelectorAll(".sl-msadd").forEach(box => {
    const val = k => box.querySelector(`[data-f="${k}"]`).value;
    const go = async () => {
      try {
        await addMilestone(box.dataset.q, { text: val("text"), target: parseFloat(val("target")), unit: val("unit"), due: val("due"), xp: parseFloat(val("xp")) });
        toast(`Milestone added: ${val("text")}`, "good");
        box.querySelectorAll("input").forEach(i => { if (i.dataset.f !== "xp") i.value = ""; });
      } catch (e) { toast("⚠ " + e.message, "bad"); }
    };
    box.querySelector("[data-addms]").addEventListener("click", ev => { ev.preventDefault(); go(); });
    box.querySelector('[data-f="text"]').addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); go(); } });
  });
}

function renderBattle() {
  const ms = M().startOf("month").format("YYYY-MM-DD"), me = M().endOf("month").format("YYYY-MM-DD");
  const act = quests.filter(isActive);
  const all = act.flatMap(q => q.ms.map(m => ({ m, q })));
  const due = all.filter(x => !x.m.done && x.m.due && x.m.due >= ms && x.m.due <= me).sort((a, b) => a.m.due.localeCompare(b.m.due));
  const overdue = all.filter(x => !x.m.done && x.m.due && x.m.due < ms);
  const cleared = quests.flatMap(q => q.ms.map(m => ({ m, q }))).filter(x => x.m.done && x.m.doneOn && x.m.doneOn >= ms && x.m.doneOn <= me);
  const qDue = act.filter(q => q.deadline && q.deadline <= me);
  const unsched = all.filter(x => !x.m.done && !x.m.due);
  const late = due.filter(x => x.m.due < TODAY).length;
  const daysLeft = daysFrom(TODAY, me);
  const pctMonth = pctOf(cleared.length, cleared.length + due.length);

  // calendar
  const s = M().startOf("month"), lead = (s.isoWeekday() + 6) % 7;
  let cal = `<div class="sl-cal small">${["M", "T", "W", "T", "F", "S", "S"].map(x => `<div class="sl-calh">${x}</div>`).join("")}`;
  for (let i = 0; i < lead; i++) cal += `<div class="sl-calc blank"></div>`;
  for (let d = M(s); d.isSameOrBefore(M().endOf("month"), "day"); d.add(1, "day")) {
    const k = d.format("YYYY-MM-DD");
    const n = due.filter(x => x.m.due === k).length + overdue.filter(x => x.m.due === k).length;
    const c = cleared.filter(x => x.m.doneOn === k).length;
    cal += `<div class="sl-calc ${k === TODAY ? "today" : ""} ${k < TODAY ? "past" : ""}"><span class="sl-cald">${d.date()}</span>${n ? `<span class="sl-pip due">${n}</span>` : ""}${c ? `<span class="sl-pip done">✔${c}</span>` : ""}</div>`;
  }
  cal += `</div>`;

  const byQuest = {};
  due.forEach(x => (byQuest[x.q.path] = byQuest[x.q.path] || { q: x.q, list: [] }).list.push(x.m));
  const groups = Object.values(byQuest).map(g => `<div class="sl-bgroup"><div class="sl-qhead small">${rankBadge(g.q.rank)}<div class="sl-qname">${lnk(g.q.path, g.q.name)}<div class="sl-meta">quest progress ${Math.round(g.q.pct * 100)}%</div></div></div>${bar(g.q.pct * 100, "quest")}
     ${g.list.map(m => msRow(m, g.q)).join("")}</div>`).join("");

  const el = mount(`
    ${win(`${M().format("MMMM YYYY").toUpperCase()} CAMPAIGN`, `
      <div class="sl-battletop"><div>
        <div class="sl-chips">${chip("Due this month", due.length)}${chip("Cleared this month", cleared.length, "pos")}${chip("Overdue", late + overdue.length, late + overdue.length ? "neg" : "")}${chip("Days left", daysLeft)}</div>
        <div class="sl-meter"><span>CAMPAIGN</span>${bar(pctMonth, "quest")}<em>${Math.round(pctMonth)}%</em></div>
        ${qDue.length ? `<div class="sl-chtitle">Quest deadlines this month</div>` + qDue.map(q => `<div class="sl-feedrow"><span class="sl-fd">${M(q.deadline).format("MMM D")}</span><span class="sl-fm">${rankBadge(q.rank)} ${lnk(q.path, q.name)}</span><span class="sl-fv">${Math.round(q.pct * 100)}%</span></div>`).join("") : ""}
      </div>${cal}</div>`)}
    ${win("BATTLE ORDERS — MILESTONES DUE THIS MONTH", groups || empty("No milestones due this month. Give your active quests dated milestones (📅 YYYY-MM-DD)."))}
    ${overdue.length ? win("OVERDUE FROM PREVIOUS MONTHS", overdue.map(x => msRow(x.m, x.q, true)).join(""), "sl-redwin") : ""}
    ${unsched.length ? win("UNSCHEDULED MILESTONES", unsched.map(x => msRow(x.m, x.q, true)).join("")) : ""}
    ${win("CONQUERED THIS MONTH", cleared.length ? cleared.map(x => `<div class="sl-feedrow k-milestone"><span class="sl-fd">${M(x.m.doneOn).format("MMM D")}</span><span class="sl-fm">${esc(x.m.text)} · ${lnk(x.q.path, x.q.name)}</span><span class="sl-fv">+${x.m.xp}</span></div>`).join("") : empty("Nothing conquered yet this month. The month is young."))}`);
  bindMilestones(el);
}

function renderHall() {
  const done = quests.filter(q => q.status === "completed").sort((a, b) => (b.completed || "").localeCompare(a.completed || ""));
  const real = done.filter(q => !q.example);
  const msTotal = quests.reduce((a, q) => a + q.ms.filter(m => m.done).length, 0);
  const xpFromQuests = real.reduce((a, q) => a + q.xp + q.ms.reduce((b, m) => b + (m.done ? m.xp : 0), 0), 0);
  const order = ["S", "A", "B", "C", "D", "E"];
  const best = order.find(r => done.some(q => q.rank === r));
  const byYear = {};
  done.forEach(q => (byYear[(q.completed || "????").slice(0, 4)] ||= []).push(q));
  const cards = Object.keys(byYear).sort().reverse().map(y => `<div class="sl-year">${y}</div><div class="sl-trophies">${byYear[y].map(q => {
    const days = q.started && q.completed ? daysFrom(q.started, q.completed) : null;
    const src = imgSrc(q.cover);
    return `<div class="sl-trophy r-${q.rank.toLowerCase()}">${edBtn(q.path)}
      <div class="sl-trophy-art">${src ? `<img src="${esc(src)}">` : `<div class="sl-trophy-emblem">${rankBadge(q.rank, "huge")}</div>`}</div>
      <div class="sl-trophy-body"><div class="sl-card-name">${UI("trophy")} ${lnk(q.path, q.name)}${q.example ? ` <span class="sl-tag">example</span>` : ""}</div>
      <div class="sl-meta">${q.area ? areaTag(q.area) : "—"} · Rank ${esc(q.rank)}</div>
      <div class="sl-mono">Cleared ${q.completed ? M(q.completed).format("MMM D, YYYY") : "—"}${days != null ? ` · ${days} days` : ""}</div>
      <div class="sl-mono">${q.ms.length} milestones · +${fmt(q.xp + q.ms.reduce((b, m) => b + (m.done ? m.xp : 0), 0))} XP</div>
      ${q.victory ? `<div class="sl-victorycond">“${esc(q.victory)}”</div>` : ""}${noteLine(q.notes)}</div></div>`;
  }).join("")}</div>`).join("");
  mount(win("HALL OF TRIUMPH", `<div class="sl-chips">${chip("Quests cleared", done.length, "gold")}${chip("Milestones conquered", msTotal)}${chip("XP from conquests", fmt(xpFromQuests), "pos")}${chip("Highest rank cleared", best || "—")}</div>
    ${cards || empty("Your hall stands empty… for now. Clear your first quest and it will be enshrined here forever.")}`, "sl-hall"));
}

async function renderProphecy() {
  const folder = FOLDERS.prophecy;
  const files = app.vault.getFiles().filter(f => f.path.startsWith(folder + "/"));
  const boards = files.filter(f => f.extension === "canvas");
  const notes = ALL.where(p => p.file.path.startsWith(folder + "/") && ["vision", "vision-board", "future-self", "prophecy"].includes(p.type)).array();
  const thumbs = await Promise.all(boards.map(async f => {
    try {
      const j = JSON.parse(await app.vault.cachedRead(f));
      const img = (j.nodes || []).find(n => n.type === "file" && /\.(png|jpe?g|gif|webp|svg)$/i.test(n.file || ""));
      return { f, src: img ? imgSrc(img.file) : null, n: (j.nodes || []).length };
    } catch (e) { return { f, src: null, n: 0 }; }
  }));
  const bcards = thumbs.map(t => `<div class="sl-card vision" data-open="${esc(t.f.path)}">${rmBtn("vision", t.f.path, "✕", "Delete board")}${t.src ? `<img class="sl-cover" src="${esc(t.src)}">` : `<div class="sl-cover sl-cover-icon">${UI("crystal")}</div>`}
    <div class="sl-card-body"><div class="sl-card-name">${lnk(t.f.path, t.f.basename)}</div><div class="sl-meta">Canvas vision board · ${t.n} items</div></div></div>`).join("");
  const ncards = notes.map(p => `<div class="sl-card vision" data-open="${esc(p.file.path)}">${edBtn(p.file.path)}${rmBtn("vision", p.file.path, "✕", "Delete")}${cover(p.cover || (isImg(p.icon) ? p.icon : null), p.icon && !isImg(p.icon) ? esc(p.icon) : UI(p.type === "future-self" ? "prophecy" : "crystal"))}
    <div class="sl-card-body"><div class="sl-card-name">${lnk(p.file.path, p.file.name)}</div><div class="sl-meta">${p.type === "future-self" ? "Future-self prophecy" : "Vision note"}${p.horizon ? " · " + esc(p.horizon) : ""}</div>${noteLine(p.notes)}</div></div>`).join("");
  mount(win("VISIONS & PROPHECIES", `<div class="sl-cards">${ncards}${bcards}</div>` + (ncards || bcards ? "" : empty("No vision boards yet.")) + `<div class="sl-addrow">${addBox("vision")}</div>`));
  // each board / write-up shown in full right here (no separate pages)
  for (const p of notes) {
    const file = app.vault.getAbstractFileByPath(p.file.path);
    const body = file ? String(await app.vault.read(file)).replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/^#\s[^\n]*\n/, "") : "";
    const el = mount(win(p.file.name, `<div class="sl-boardbody ${p.type !== "future-self" ? "sl-vision" : ""}"></div>
      <div class="sl-addrow">${p.type !== "future-self" ? `<button class="sl-btn sm" data-addimg="1">＋ Add image</button><input type="file" accept="image/*" multiple hidden>` : ""}<button class="sl-btn sm ghost" data-edit="${esc(p.file.path)}">✎ Edit text</button></div>`, "sl-board",
      p.horizon ? esc(p.horizon) : ""));
    el.id = "board-" + norm(p.file.name);
    const target = el.querySelector(".sl-boardbody");
    if (dv.renderMarkdown) await dv.renderMarkdown(body, target, p.file.path);
    else target.textContent = body;
    // links inside a board open the linked card's editor instead of creating notes
    target.addEventListener("click", ev => {
      const a = ev.target.closest && ev.target.closest("a.internal-link");
      if (!a) return;
      const hit = ALL.where(x => x.file.name === (a.getAttribute("data-href") || "").replace(/\.md$/, "")).first();
      ev.preventDefault(); ev.stopPropagation();
      if (hit) openEditor(hit.file.path);
    }, true);
    const addBtn = el.querySelector("[data-addimg]");
    if (addBtn) {
      const fi = addBtn.nextElementSibling;
      addBtn.addEventListener("click", () => fi.click());
      fi.addEventListener("change", async () => {
        for (const f of Array.from(fi.files || [])) {
          const dest = await uploadTo("05 The Prophecy Chamber/Images", f, "vision");
          await app.vault.process(app.vault.getAbstractFileByPath(p.file.path), d => d.replace(/\s*$/, "") + `\n\n![[${dest}]]\n`);
          if (!p.cover) await setFM(p.file.path, fm => { if (!fm.cover) fm.cover = dest; });
        }
        toast("Image added to " + p.file.name, "good");
      });
    }
  }
}

// weekly count chart (last n weeks) for any list of dates
function weeklyBars(dates, n = 12, cls = "sl-bp") {
  const W = 260, Hh = 64, bw = W / n, set = dates.filter(Boolean), rows = [];
  for (let i = n - 1; i >= 0; i--) {
    const s0 = M().startOf("isoWeek").subtract(i, "weeks"), e0 = M(s0).add(6, "days").format("YYYY-MM-DD"), s1 = s0.format("YYYY-MM-DD");
    rows.push({ c: set.filter(d => d >= s1 && d <= e0).length, lab: s0.format("MMM D") });
  }
  const mx = Math.max(1, ...rows.map(r => r.c));
  return `<svg class="sl-svg sl-mini" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none">${rows.map((r, i) => `<rect class="${r.c ? cls : "sl-axis"}" x="${i * bw + 2}" y="${Hh - 4 - (r.c / mx) * (Hh - 8)}" width="${bw - 4}" height="${Math.max(1.5, (r.c / mx) * (Hh - 8))}" rx="2"><title>Week of ${r.lab}: ${r.c}</title></rect>`).join("")}</svg>`;
}
// ---- Quest Library: main-quest stats
function renderQuestStats() {
  const order = q => (isActive(q) ? 0 : q.status === "completed" ? 1 : 2);
  const list = quests.slice().sort((a, b) => order(a) - order(b) || (a.deadline || "9999").localeCompare(b.deadline || "9999"));
  const allMs = quests.flatMap(q => q.ms);
  const msDates = allMs.filter(m => m.done && m.doneOn).map(m => m.doneOn);
  const xpOf = q => q.ms.reduce((a, m) => a + (m.done ? m.xp : 0), 0) + (q.status === "completed" ? q.xp : 0);
  const panels = list.map(q => {
    const done = q.ms.filter(m => m.done).length;
    const dl = q.deadline ? daysFrom(TODAY, q.deadline) : null;
    const age = q.started ? daysFrom(q.started, q.completed || TODAY) : null;
    const status = q.status === "completed" ? `Cleared ${q.completed ? M(q.completed).format("MMM D, YYYY") : ""}` : isActive(q) ? (dl == null ? "No deadline" : dl >= 0 ? `${dl} days left` : `${-dl} days overdue`) : q.status;
    return `<div class="sl-libcard quest ${q.status}">${edBtn(q.path)}
      <div class="sl-libhead">${rankBadge(q.rank, "big")}<div><div class="sl-card-name">${lnk(q.path, q.name)}${q.example ? ` <span class="sl-tag">example</span>` : ""}${!isActive(q) && q.status !== "completed" ? ` <span class="sl-tag">${esc(q.status)}</span>` : ""}</div>
        <div class="sl-meta">${q.area ? areaTag(q.area) : "No area"} · ${esc(status)}</div></div></div>
      ${noteLine(q.notes)}
      <div class="sl-chips">${chip("Progress", Math.round(q.pct * 100) + "%")}${chip("Milestones", `${done}/${q.ms.length}`)}${chip("XP earned", "+" + fmt(xpOf(q)), "pos")}${chip(q.status === "completed" ? "Days taken" : "Days active", age ?? "—")}</div>
      ${bar(q.pct * 100, "quest")}
      <div class="sl-qmslist">${q.ms.map(m => `<div class="sl-qmsrow ${m.done ? "done" : ""}"><span>${m.done ? UI("check") : "○"} ${esc(m.text)}</span>${m.target != null ? bar(m.pct * 100, "ms") : "<i></i>"}<em>${m.target != null ? `${fmt(m.cur)}/${fmt(m.target)}` : m.done ? "done" : ""}</em></div>`).join("") || empty("No milestones yet.")}</div>
    </div>`;
  }).join("");
  const real = quests.filter(q => !q.example);
  mount(win("MAIN QUESTS", `<div class="sl-chips">${chip("Active", quests.filter(isActive).length)}${chip("Cleared", quests.filter(q => q.status === "completed").length, "gold")}${chip("Milestones done", `${allMs.filter(m => m.done).length}/${allMs.length}`)}${chip("XP from quests", "+" + fmt(real.reduce((a, q) => a + xpOf(q), 0)), "pos")}</div>
    <div class="sl-chtitle">Milestones completed per week</div>${weeklyBars(msDates)}
    <div class="sl-library" style="margin-top:12px">${panels || empty("No quests yet.")}</div>`));
}
// ---- Quest Library: side-quest stats (including finished ones that left the list)
function renderSideStats() {
  const done = sideQuests.flatMap(q => q.doneDates.map(d => ({ q, d }))).sort((a, b) => b.d.localeCompare(a.d));
  const open = sideQuests.filter(q => q.open);
  const xp = done.reduce((a, x) => a + x.q.xp, 0);
  const last30 = done.filter(x => x.d > M().subtract(30, "days").format("YYYY-MM-DD")).length;
  const overdue = open.filter(q => q.due && q.due < TODAY).length;
  const dated = done.filter(x => !x.q.repeat && x.q.due);
  const onTime = dated.length ? Math.round(pctOf(dated.filter(x => x.d <= x.q.due).length, dated.length)) + "%" : "—";
  const rows = done.slice(0, 25).map(({ q, d }) => `<div class="sl-feedrow k-side"><span class="sl-fd">${M(d).format("MMM D")}</span><span class="sl-fm">${lnk(q.path, q.name)}${q.repeat ? ` <span class="sl-rep">↻ ${esc(repeatLabel(q.repeat))}</span>` : q.due ? ` <span class="sl-meta">· due ${M(q.due).format("MMM D")}${d > q.due ? " (late)" : ""}</span>` : ""}</span><span class="sl-fv">+${q.xp}</span>${edBtn(q.path)}</div>`).join("");
  const reps = sideQuests.filter(q => q.repeat);
  mount(win("SIDE QUESTS", `<div class="sl-chips">${chip("Completed", done.length, "gold")}${chip("Last 30 days", last30)}${chip("XP earned", "+" + fmt(xp), "pos")}${chip("Open", open.length)}${chip("Overdue", overdue, overdue ? "neg" : "")}${chip("On time", onTime)}</div>
    <div class="sl-chtitle">Side quests completed per week</div>${weeklyBars(done.map(x => x.d))}
    ${reps.length ? `<div class="sl-chtitle">Repeating side quests</div>` + reps.map(q => `<div class="sl-feedrow k-side"><span class="sl-fd">${q.completions.length}×</span><span class="sl-fm">${lnk(q.path, q.name)} <span class="sl-rep">↻ ${esc(repeatLabel(q.repeat))}</span></span><span class="sl-meta">${q.resting ? "back " + M(q.next).format("MMM D") : q.open ? "open now" : "done today"}</span>${edBtn(q.path)}</div>`).join("") : ""}
    <div class="sl-chtitle">Completed side quests</div>${rows || empty("Nothing completed yet. Finished side quests are kept here after they leave the list.")}`));
}

// ---- Habit Library: the stats and charts of every habit, side by side
function renderLibrary() {
  const filter = window.__slLibFilter || "all";
  const list = habits.filter(h => filter === "all" ? h.active : filter === "retired" ? !h.active : h.active && h.polarity === filter);
  const weekly = (set, pol) => {
    const W = 240, Hh = 64, n = 12, bw = W / n, rows = [];
    for (let i = n - 1; i >= 0; i--) {
      const s0 = M().startOf("isoWeek").subtract(i, "weeks");
      let c = 0; for (let d = 0; d < 7; d++) if (set.has(M(s0).add(d, "days").format("YYYY-MM-DD"))) c++;
      rows.push({ c, lab: s0.format("MMM D") });
    }
    return `<svg class="sl-svg sl-mini" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none">${rows.map((r, i) => `<rect class="${r.c ? (pol === "bad" ? "sl-bn" : "sl-bp") : "sl-axis"}" x="${i * bw + 2}" y="${Hh - 4 - (r.c / 7) * (Hh - 8)}" width="${bw - 4}" height="${Math.max(1.5, (r.c / 7) * (Hh - 8))}" rx="2"><title>Week of ${r.lab}: ${r.c}/7</title></rect>`).join("")}</svg>`;
  };
  const panels = list.map(h => {
    const st = habitStats(h), good = h.polarity === "good";
    const clean = cleanStreak(h.key);
    return `<div class="sl-libcard ${h.polarity}">${edBtn(h.path)}
      <div class="sl-libhead"><span class="sl-libico">${h.icon ? ico(h.icon) : UI(good ? "spark" : "skull")}</span>
        <div><div class="sl-card-name">${lnk(h.path, h.name)}${h.dq ? ` <span class="sl-star">${UI("star")}</span>` : ""}${h.active ? "" : ` <span class="sl-tag">retired</span>`}</div>
        <div class="sl-meta">${h.area ? areaTag(h.area) : "No area"} · ${good ? "+" : "−"}${h.xp} XP${h.cue ? " · " + esc(h.cue) : ""}</div></div></div>
      ${noteLine(h.notes)}
      <div class="sl-chips">${chip(good ? "Current streak" : "Days clean", good ? UI("fire") + " " + st.streak : UI("shield") + " " + (clean ?? "∞"))}${chip("Best streak", st.best)}${chip("Last 30 days", good ? Math.round(pctOf(st.last30, 30)) + "%" : st.last30 + "×", !good && st.last30 ? "neg" : "")}${chip("All time", st.total)}</div>
      <div class="sl-libcharts"><div><div class="sl-chtitle">Last 20 weeks</div>${heat(st.set, 20, h.polarity)}</div><div><div class="sl-chtitle">Days per week</div>${weekly(st.set, h.polarity)}</div></div>
      ${h.active ? "" : `<button class="sl-btn xs ghost" data-restore="habit" data-p="${esc(h.path)}">Restore habit</button> ${rmBtn("trash", h.path, "Delete forever", "Deletes the habit and its history")}`}
    </div>`;
  }).join("");
  const counts = { all: habits.filter(h => h.active).length, good: habits.filter(h => h.active && h.polarity === "good").length, bad: habits.filter(h => h.active && h.polarity === "bad").length, retired: habits.filter(h => !h.active).length };
  const el = mount(win("QUEST LIBRARY", `<div class="sl-tabs">${[["all", "All"], ["good", "Good"], ["bad", "Bad"], ["retired", "Retired"]].map(([k, l]) => `<button class="sl-tab ${filter === k ? "on" : ""}" data-libf="${k}">${l} (${counts[k]})</button>`).join("")}</div>
    <div class="sl-library">${panels || empty("Nothing here yet.")}</div>
    <div class="sl-addrow">${addBox("good")}${addBox("bad")}</div>`));
  el.querySelectorAll("[data-libf]").forEach(b => b.addEventListener("click", () => {
    window.__slLibFilter = b.dataset.libf;
    const parent = el.parentNode, before = el.nextSibling, saved = root;
    root = parent; el.remove(); renderLibrary(); root = saved;
    if (before) parent.insertBefore(parent.lastChild, before);
  }));
}

/* -------- codex / single-note views */
function habitStats(h) {
  const field = h.polarity === "good" ? "good" : "bad";
  const set = new Set(Object.values(logByDate).filter(l => l[field].includes(h.key)).map(l => l.date));
  let streak = 0, d = M();
  if (h.polarity === "good") {
    if (!set.has(d.format("YYYY-MM-DD"))) d.subtract(1, "day");
    while (set.has(d.format("YYYY-MM-DD"))) { streak++; d.subtract(1, "day"); }
  }
  let best = 0, run = 0, prev = null;
  [...set].sort().forEach(x => { run = prev && daysFrom(prev, x) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = x; });
  const last30 = [...set].filter(x => x > M().subtract(30, "days").format("YYYY-MM-DD") && x <= TODAY).length;
  return { set, total: set.size, streak, best, last30 };
}
function heat(set, weeks, pol) {
  const end = M().endOf("isoWeek"), start = M(end).subtract(weeks * 7 - 1, "days");
  let s = `<div class="sl-heat" style="--w:${weeks}">`;
  for (let d = M(start); d.isSameOrBefore(end, "day"); d.add(1, "day")) {
    const k = d.format("YYYY-MM-DD");
    s += `<i class="${k > TODAY ? "fut" : set.has(k) ? (pol === "good" ? "on" : "hit") : ""}" title="${k}"></i>`;
  }
  return s + `</div>`;
}
function renderCodex() {
  const rows = habits.map(h => {
    const st = habitStats(h);
    const ctl = h.active ? edBtn(h.path) : `<button class="sl-btn xs ghost" data-restore="habit" data-p="${esc(h.path)}">Restore</button>`;
    return `<tr class="${h.polarity} ${h.active ? "" : "retired"}"><td class="hn">${ico(h.icon)} ${lnk(h.path, h.name)}${h.dq ? " " + UI("star") : ""}${h.active ? "" : ` <span class="sl-tag">retired</span>`}</td><td>${h.polarity === "good" ? "+" : "−"}${h.xp}</td>
      <td>${esc(h.area)}</td><td>${h.polarity === "good" ? `${UI("fire")} ${st.streak}` : `${UI("shield")} ${cleanStreak(h.key) ?? "∞"}`}</td><td>${h.polarity === "good" ? st.best : "—"}</td>
      <td>${h.polarity === "good" ? Math.round(pctOf(st.last30, 30)) + "%" : st.last30 + "×"}</td><td>${st.total}</td><td>${heat(st.set, 8, h.polarity)}</td><td>${ctl}</td></tr>`;
  }).join("");
  mount(win("HABIT CODEX", `<div class="sl-tablewrap"><table class="sl-codex"><tr><th>Habit</th><th>XP</th><th>Area</th><th>Streak</th><th>Best</th><th>30 days</th><th>Total</th><th>Last 8 weeks</th><th></th></tr>${rows}</table></div>
    <div class="sl-addrow">${addBox("good")}${addBox("bad")}</div>`));
}
function renderHabitNote() {
  const h = habits.find(x => x.path === dv.current().file.path);
  if (!h) return mount(win("HABIT", empty("This note needs <code>type: habit</code>.")));
  const st = habitStats(h);
  const doneToday = st.set.has(TODAY);
  const ctl = h.active ? rmBtn("habit", h.path, "Retire habit", "Retire (keeps history)") : `<button class="sl-btn xs ghost" data-restore="habit" data-p="${esc(h.path)}">Restore habit</button>`;
  const el = mount(win(h.polarity === "good" ? "HABIT · BUFF" : "HABIT · DEBUFF" + "", `
    <div class="sl-chips">${chip(h.polarity === "good" ? "Current streak" : "Days clean", h.polarity === "good" ? UI("fire") + " " + st.streak : UI("shield") + " " + (cleanStreak(h.key) ?? "∞"))}${chip("Best streak", st.best)}${chip("Last 30 days", h.polarity === "good" ? Math.round(pctOf(st.last30, 30)) + "%" : st.last30 + "×", h.polarity === "bad" && st.last30 ? "neg" : "")}${chip("All time", st.total)}${chip(h.polarity === "good" ? "XP per clear" : "XP penalty", (h.polarity === "good" ? "+" : "−") + h.xp, h.polarity === "good" ? "pos" : "neg")}</div>
    ${heat(st.set, 20, h.polarity)}
    <div class="sl-notectl">${ctl}${rmBtn("trash", h.path, "Delete forever", "Moves to .trash — its past XP disappears")}</div>
    <button class="sl-btn ${h.polarity === "bad" && !doneToday ? "red" : doneToday ? "ghost" : ""}" data-h="${esc(h.key)}">${doneToday ? UI("undo") + " Undo today" : h.polarity === "good" ? UI("check") + " Complete today" : UI("cross") + " I did it today"}</button>`));
  bindHabitCards(el, TODAY);
}
function renderRewardNote() {
  const r = rewards.find(x => x.path === dv.current().file.path);
  if (!r) return mount(win("REWARD", empty("This note needs <code>type: reward</code>.")));
  const ctl = r.active ? rmBtn("reward", r.path, "Retire reward", "Retire (keeps claim history)") : `<button class="sl-btn xs ghost" data-restore="reward" data-p="${esc(r.path)}">Restore reward</button>`;
  const el = mount(win("REWARD", `<div class="sl-notectl">${ctl}${rmBtn("trash", r.path, "Delete forever", "Moves to .trash")}</div><div class="sl-shophead">Available to spend: <b class="gold">${fmt(gold)} XP</b></div><div class="sl-cards">${rewardCard(r)}</div>
    ${r.claims.length ? `<div class="sl-chtitle">Claim history</div>` + r.claims.slice().reverse().map(d => `<div class="sl-feedrow k-spend"><span class="sl-fd">${M(d).format("MMM D, YYYY")}</span><span class="sl-fm">Claimed</span><span class="sl-fv">−${r.cost}</span></div>`).join("") : ""}`));
  bindRewards(el);
}
function renderAreaNote() {
  const a = areas.find(x => x.path === dv.current().file.path);
  if (!a) return mount(win("LIFE AREA", empty("This note needs <code>type: area</code>.")));
  const x = Math.max(0, areaXP[a.key] || 0);
  const hs = habits.filter(h => norm(h.area) === a.key), qs = quests.filter(q => norm(q.area) === a.key);
  mount(win(`LIFE AREA · ${a.stat}`, `<div class="sl-chips">${chip(a.stat, 10 + Math.floor(x / 100), "gold")}${chip("All-time XP", fmt(x), "pos")}${chip("Habits", hs.length)}${chip("Quests", qs.length)}</div>
    <div class="sl-meter"><span>NEXT ${esc(a.stat)}</span>${bar(x % 100, "xp")}<em>${x % 100}/100</em></div>
    <div class="sl-chtitle">Habits</div>${hs.map(h => `<div class="sl-feedrow k-${h.polarity === "good" ? "habit" : "bad"}"><span class="sl-fd">${h.polarity}</span><span class="sl-fm">${ico(h.icon)} ${lnk(h.path, h.name)}</span><span class="sl-fv">${h.polarity === "good" ? "+" : "−"}${h.xp}</span></div>`).join("") || empty("No habits linked (set <code>area:</code> on a habit).")}
    <div class="sl-chtitle">Quests</div>${qs.map(questCard).join("") || empty("No quests in this area yet.")}`));
}

/* ================================================================ router */
const ROUTES = {
  status: renderStatus, character: renderCharacter, banner: renderBanner, nav: renderNav, time: renderTime, actions: renderActions,
  daily: () => renderHabits(OPTS.date || TODAY, "good"), bad: () => renderHabits(OPTS.date || TODAY, "bad"),
  log: renderLog, feed: renderFeed, chart: renderChart, charts: renderCharts, overview: renderOverview,
  rewards: renderRewards, areas: renderAreas, quests: renderQuests, goal: renderGoal, battle: renderBattle,
  hall: renderHall, milestones: renderMilestones, advice: renderAdvice, creator: renderCreator, generator: renderGenerator, level: renderLevelBadge, sidequests: renderSideQuests, icons: renderIcons, prophecy: renderProphecy, codex: renderCodex, library: renderLibrary, queststats: renderQuestStats, sidestats: renderSideStats,
  habit: renderHabitNote, reward: renderRewardNote, area: renderAreaNote,
};
async function runSection(spec) {
  const o = typeof spec === "string" ? { section: spec } : spec;
  SECTION = o.section || "status"; OPTS = o;
  try {
    await (ROUTES[SECTION] || (() => mount(win("SYSTEM", empty(`Unknown section “${esc(SECTION)}”.`)))))();
  } catch (e) {
    console.error(e);
    mount(win("SYSTEM ERROR", `<pre class="sl-err">${esc(e.stack || e.message)}</pre>`, "sl-redwin"));
  }
}
// Layout: {section: "grid", cols: [[...sections], [...sections]], widths: "1fr 2fr"}
if (SECTION === "grid") {
  const spec = OPTS, base = dv.container;
  const grid = document.createElement("div");
  grid.className = "sl-layout";
  grid.style.gridTemplateColumns = spec.widths || spec.cols.map(() => "1fr").join(" ");
  base.appendChild(grid);
  for (const col of spec.cols) {
    const c = document.createElement("div"); c.className = "sl-col"; grid.appendChild(c);
    root = c;
    for (const s of col) await runSection(s);
  }
  root = base;
} else {
  await runSection(input || {});
}
