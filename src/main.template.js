/*
 * The Hearthbound Codex — a cozy, gamified habit / quest / reward dashboard for Obsidian.
 * Opens as its own tab with sub-tabs (Overview, Habits, Quests, Rewards, Hall of Triumph,
 * Prophecy, Progress, Profile, Guide). All data lives in this plugin's data.json — no notes
 * or daily notes are created. Only images you upload are saved to a folder in your vault.
 */
"use strict";
const obsidian = require("obsidian");
const { Plugin, ItemView, Notice, MarkdownRenderer, MarkdownRenderChild, Component, PluginSettingTab, Setting,
  normalizePath, parseYaml, stringifyYaml, moment } = obsidian;

const VIEW_TYPE = "hearthbound-codex-view";
const SEED_ROOT = "The Hearthbound Codex";
const DEFAULT_SETTINGS = { folder: "The Hearthbound Codex" };
const SEED_FILES = /*__SEED_FILES__*/{};   // starter data: { "relative/path.md": "markdown" }
const SEED_ASSETS = /*__SEED_ASSETS__*/{}; // starter images: { "relative/path": "text" | { b64 } }
const GUIDE = /*__GUIDE__*/"";

/* ===================================================================== engine */
async function ENGINE(dv, input, app, moment) {
/*__ENGINE__*/
}

/* ============================================================ helpers */
function splitFM(text) {
  const m = String(text).match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: {}, body: String(text) };
  let fm = {};
  try { fm = parseYaml(m[1]) || {}; } catch (e) { console.warn("Hearthbound Codex: bad YAML", e); }
  return { fm, body: String(text).slice(m[0].length) };
}
function joinFM(fm, body) {
  const clean = {};
  for (const [k, v] of Object.entries(fm)) if (v !== undefined) clean[k] = v;
  return "---\n" + stringifyYaml(clean) + "---\n" + body;
}
function parseTasks(path, text) {
  const lines = String(text).split("\n"), tasks = [];
  let heading = null, inFront = lines[0] === "---";
  lines.forEach((L, i) => {
    if (inFront) { if (i > 0 && L === "---") inFront = false; return; }
    const h = L.match(/^#{1,6}\s+(.*)$/);
    if (h) { heading = h[1].trim(); return; }
    const t = L.match(/^\s*[-*+] \[(.)\] (.*)$/);
    if (!t) return;
    const task = { line: i, path, status: t[1], completed: /[xX]/.test(t[1]), text: t[2], section: heading ? { subpath: heading } : null };
    for (const f of t[2].matchAll(/\[([^\[\]:]+)::\s*([^\[\]]*)\]/g)) { const k = f[1].trim(), v = f[2].trim(); task[k] = v !== "" && isFinite(+v) ? +v : v; }
    const due = t[2].match(/📅\s*(\d{4}-\d{2}-\d{2})/u); if (due) task.due = due[1];
    const done = t[2].match(/✅\s*(\d{4}-\d{2}-\d{2})/u); if (done) task.completion = done[1];
    tasks.push(task);
  });
  return tasks;
}
class DataArray {
  constructor(a) { this.a = a; }
  where(fn) { return new DataArray(this.a.filter(fn)); }
  first() { return this.a[0]; }
  array() { return this.a.slice(); }
  [Symbol.iterator]() { return this.a[Symbol.iterator](); }
}
const baseName = p => p.split("/").pop().replace(/\.[^.]+$/, "");
const extOf = p => (p.match(/\.([^./]+)$/) || [, ""])[1].toLowerCase();
const IMG_EXT = /^(png|jpe?g|gif|webp|svg|avif|bmp)$/i;

/* ======================================================== the data store
   Codex records are kept as small markdown documents (frontmatter + body) inside data.json,
   so the renderer can treat them like notes. They never appear as files in your vault. */
class CodexStore {
  constructor(plugin) { this.plugin = plugin; }
  get files() { return this.plugin.data.files; }
  get root() { return this.plugin.settings.folder; }
  full(rel) { return normalizePath(this.root + "/" + rel); }
  rel(full) { const r = this.root + "/"; return full.startsWith(r) ? full.slice(r.length) : null; }
  has(full) { const r = this.rel(full); return r != null && this.files[r] != null; }
  get(full) { return this.files[this.rel(full)]; }
  set(full, text) { this.files[this.rel(full)] = text; this.plugin.changed(); }
  del(full) { delete this.files[this.rel(full)]; this.plugin.changed(); }
  isFolder(full) { const r = this.rel(full); return r != null && Object.keys(this.files).some(k => k.startsWith(r + "/")); }
  list() { return Object.keys(this.files).map(k => this.full(k)); }
  fileObj(full) { return { path: full, name: full.split("/").pop(), basename: baseName(full), extension: extOf(full), virtual: true, parent: { path: full.split("/").slice(0, -1).join("/") } }; }
  page(full) {
    const text = this.get(full) || "";
    const { fm } = splitFM(text);
    const p = Object.assign({}, fm);
    p.file = { name: baseName(full), path: full, folder: full.split("/").slice(0, -1).join("/"), tasks: (fm.type === "goal" || fm.type === "quest") ? parseTasks(full, text) : [] };
    return p;
  }
  resolve(link) {
    let s = String(link || "").replace(/^!?\[\[|\]\]$/g, "").replace(/[|#].*$/, "").trim();
    if (this.has(s)) return s;
    if (this.has(s + ".md")) return s + ".md";
    if (this.has(this.full(s))) return this.full(s);
    if (this.has(this.full(s + ".md"))) return this.full(s + ".md");
    const name = baseName(s);
    return this.list().find(p => baseName(p) === name) || null;
  }
}

/* The renderer talks to this object exactly as it would to Obsidian's `app`. Records come from
   the store; images and other real files come from your vault. */
function makeCodexApp(plugin) {
  const real = plugin.app, store = plugin.store;
  const realFile = p => real.vault.getAbstractFileByPath(p);
  const ensureRealFolder = async path => {
    let acc = "";
    for (const part of path.split("/").filter(Boolean)) { acc = acc ? acc + "/" + part : part; if (!realFile(acc)) { try { await real.vault.createFolder(acc); } catch (e) { } } }
  };
  return {
    vault: {
      getAbstractFileByPath: p => store.has(p) ? store.fileObj(p) : store.isFolder(p) ? { path: p, children: [] } : realFile(p),
      read: async f => f.virtual ? store.get(f.path) : real.vault.read(f),
      cachedRead: async f => f.virtual ? store.get(f.path) : real.vault.cachedRead(f),
      create: async (p, text) => { store.set(p, text); return store.fileObj(p); },
      createFolder: async () => { },
      createBinary: async (p, buf) => { await ensureRealFolder(p.split("/").slice(0, -1).join("/")); return real.vault.createBinary(p, buf); },
      process: async (f, fn) => { const out = fn(store.get(f.path)); store.set(f.path, out); return out; },
      trash: async f => { if (f.virtual) store.del(f.path); else await real.vault.trash(f, false); },
      getFiles: () => store.list().map(p => store.fileObj(p)).concat(real.vault.getFiles().filter(f => f.path.startsWith(store.root + "/"))),
      getResourcePath: f => f.virtual ? "" : real.vault.getResourcePath(f),
      adapter: { read: async p => store.has(p) ? store.get(p) : real.vault.adapter.read(p) },
    },
    metadataCache: {
      getFileCache: f => f && f.virtual ? { frontmatter: splitFM(store.get(f.path) || "").fm } : real.metadataCache.getFileCache(f),
      getFirstLinkpathDest: (link, src) => {
        const r = real.metadataCache.getFirstLinkpathDest(String(link).replace(/[|#].*$/, ""), "");
        if (r) return r;
        const v = store.resolve(link);
        return v ? store.fileObj(v) : null;
      },
    },
    fileManager: {
      renameFile: async (f, newPath) => {
        if (!f.virtual) return real.fileManager.renameFile(f, newPath);
        const text = store.get(f.path); store.del(f.path); store.set(newPath, text);
        for (const v of plugin.views) if (v.record === f.path) v.record = newPath;
      },
      processFrontMatter: async (f, fn) => {
        if (!f.virtual) return real.fileManager.processFrontMatter(f, fn);
        const { fm, body } = splitFM(store.get(f.path));
        fn(fm);
        store.set(f.path, joinFM(fm, body));
      },
    },
    workspace: {
      openLinkText: link => { const p = store.resolve(link); if (p) plugin.openRecord(p); },
      getLeaf: () => ({ openFile: async f => { if (f.virtual) plugin.openRecord(f.path, true); else await real.workspace.getLeaf(true).openFile(f); } }),
    },
    commands: { executeCommandById: id => (id === "app:go-back" ? plugin.goBack() : false) },
  };
}
function makeDV(plugin, el, sourcePath) {
  const store = plugin.store;
  const pages = store.list().filter(p => p.endsWith(".md")).map(p => store.page(p));
  const current = store.has(sourcePath) ? store.page(sourcePath) : { file: { name: baseName(sourcePath || ""), path: sourcePath, tasks: [] } };
  return {
    container: el, currentFilePath: sourcePath,
    pages: src => {
      if (!src) return new DataArray(pages);
      const ex = src.startsWith("-"), folder = src.replace(/^-?"|"$/g, "");
      return new DataArray(pages.filter(p => ex ? !p.file.path.startsWith(folder + "/") : p.file.path.startsWith(folder + "/")));
    },
    current: () => current,
    renderMarkdown: (md, target, src) => MarkdownRenderer.render(plugin.app, md, target, src || "", plugin),
  };
}
// Render one Codex window (section) into `target`.
async function renderSection(plugin, target, input, sourcePath) {
  const fresh = document.createElement("div");
  try {
    await ENGINE(makeDV(plugin, fresh, sourcePath || ""), Object.assign({}, input, { __root: plugin.settings.folder }), plugin.codexApp, moment);
  } catch (e) {
    console.error("Hearthbound Codex:", e);
    fresh.textContent = "Hearthbound Codex error: " + e.message;
  }
  target.replaceChildren(...fresh.childNodes);
  target.classList.add("sl-root");
}

/* ============================================ ```codex blocks in your own notes */
function parseInput(source) {
  const s = source.trim();
  if (!s) return { section: "status" };
  if (s.startsWith("{")) { try { return JSON.parse(s); } catch (e) { return { section: "status" }; } }
  const [first, ...rest] = s.split("\n");
  if (first.includes(":")) { try { return Object.assign({}, parseYaml(s)); } catch (e) { } }
  let opts = {};
  if (rest.length) { try { opts = parseYaml(rest.join("\n")) || {}; } catch (e) { } }
  return Object.assign({ section: first.trim() }, opts);
}
class CodexBlock extends MarkdownRenderChild {
  constructor(plugin, el, input, sourcePath) { super(el); this.plugin = plugin; this.input = input; this.sourcePath = sourcePath; }
  onload() { this.plugin.blocks.add(this); this.render(); }
  onunload() { this.plugin.blocks.delete(this); }
  render() { return renderSection(this.plugin, this.containerEl, this.input, this.sourcePath); }
}

/* ================================================================ the dashboard tab */
const TABS = [
  ["overview", "Overview", [{ section: "grid", widths: "minmax(360px,1.15fr) 2fr", cols: [["status", "time", "actions", { section: "chart", days: 14 }, { section: "rewards", limit: 4 }, "areas"], ["daily", "bad", { section: "sidequests", compact: true }, "milestones", { section: "feed", limit: 10 }]] }]],
  ["habits", "Habits", ["daily", "bad"]],
  ["quests", "Quests", ["sidequests", "quests", { section: "milestones", open: 99, showDone: true }]],
  ["rewards", "Rewards", ["rewards"]],
  ["arcanium", "Arcanium", null, [
    ["library", "Quest Library", ["library", "codex", "queststats", "sidestats"]],
    ["adventure", "Adventure So Far", ["overview", "charts", { section: "chart", days: 30 }]],
    ["hall", "Hall of Triumph", ["hall"]],
  ]],
  ["profile", "Profile", ["character", "areas"]],
  ["guide", "Guide", []],
];
const RECORD_SECTION = { habit: "habit", goal: "goal", quest: "goal", reward: "reward", area: "area" };
const HIDDEN_KEYS = new Set(["type", "cssclasses", "history", "claims", "position", "ui_icons"]);

class CodexView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.tab = "overview"; this.sub = {}; this.record = null; this.editing = false; this.stack = []; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Hearthbound Codex"; }
  getIcon() { return "castle"; }
  async onOpen() { this.plugin.views.add(this); await this.render(); }
  async onClose() { this.plugin.views.delete(this); if (this.comp) this.comp.unload(); }

  showTab(id, sub) { this.stack.push({ tab: this.tab, record: this.record }); this.tab = id; if (sub) this.sub[id] = sub; this.record = null; this.editing = false; this.render(); }
  showRecord(path, edit) { this.stack.push({ tab: this.tab, record: this.record }); this.record = path; this.editing = !!edit; this.render(); }
  back() {
    const prev = this.stack.pop();
    if (!prev) { if (this.record) { this.record = null; this.render(); return true; } return false; }
    this.tab = prev.tab; this.record = prev.record; this.editing = false; this.render(); return true;
  }

  async render() {
    const el = this.contentEl;
    const scroll = el.scrollTop;
    if (this.comp) this.comp.unload();
    this.comp = new Component(); this.comp.load();
    const page = document.createElement("div");
    page.className = "sl-app";
    const banner = document.createElement("div");
    await renderSection(this.plugin, banner, { section: "banner" }, "");
    page.appendChild(banner);
    const bar = page.appendChild(document.createElement("nav"));
    bar.className = "sl-tabbar";
    for (const [id, label] of TABS) {
      const b = bar.appendChild(document.createElement("button"));
      b.className = "sl-tabbtn" + (id === this.tab && !this.record ? " on" : "");
      b.textContent = label;
      b.addEventListener("click", () => this.showTab(id));
    }
    const tabDef = TABS.find(t => t[0] === this.tab) || TABS[0];
    let sections = tabDef[2];
    if (tabDef[3]) {   // sub-tabs (Arcanium)
      const subs = tabDef[3], cur = subs.find(s => s[0] === this.sub[tabDef[0]]) || subs[0];
      const sbar = page.appendChild(document.createElement("nav"));
      sbar.className = "sl-subtabbar";
      for (const [sid, slabel] of subs) {
        const b = sbar.appendChild(document.createElement("button"));
        b.className = "sl-subtab" + (sid === cur[0] ? " on" : "");
        b.textContent = slabel;
        b.addEventListener("click", () => { this.sub[tabDef[0]] = sid; this.render(); });
      }
      sections = cur[2];
    }
    const body = page.appendChild(document.createElement("div"));
    body.className = "sl-tabbody";
    if (this.record && this.plugin.store.has(this.record)) await this.renderRecord(body);
    else if (this.tab === "guide") await this.renderMarkdown(body, GUIDE.split(SEED_ROOT + "/").join(this.plugin.settings.folder + "/"), "");
    else {
      for (const spec of sections || []) {
        const box = body.appendChild(document.createElement("div"));
        await renderSection(this.plugin, box, typeof spec === "string" ? { section: spec } : spec, "");
      }
    }
    el.replaceChildren(page);
    el.classList.add("sl-view");
    el.scrollTop = scroll;
  }

  async renderMarkdown(target, md, sourcePath) {
    const wrap = target.appendChild(document.createElement("div"));
    wrap.className = "sl-md markdown-rendered";
    await MarkdownRenderer.render(this.app, md, wrap, sourcePath, this.comp);
    // keep links inside the Codex: [[Record]] opens the record here instead of creating a note
    wrap.addEventListener("click", ev => {
      const a = ev.target.closest && ev.target.closest("a.internal-link");
      if (!a) return;
      const p = this.plugin.store.resolve(a.getAttribute("data-href") || a.getAttribute("href"));
      if (p) { ev.preventDefault(); ev.stopPropagation(); this.showRecord(p); }
    }, true);
    return wrap;
  }

  async renderRecord(body) {
    const store = this.plugin.store, path = this.record;
    const { fm, body: content } = splitFM(store.get(path));
    const head = body.appendChild(document.createElement("div"));
    head.className = "sl-rechead";
    head.innerHTML = `<button class="sl-btn xs ghost" data-a="back">← Back</button><span class="sl-rectitle"></span><span class="sl-recbtns"><button class="sl-btn xs" data-a="edit">${this.editing ? "Close editor" : "✎ Edit"}</button></span>`;
    head.querySelector(".sl-rectitle").textContent = baseName(path);
    head.querySelector('[data-a="back"]').addEventListener("click", () => this.back());
    head.querySelector('[data-a="edit"]').addEventListener("click", () => { this.editing = !this.editing; this.render(); });
    if (this.editing) this.renderEditor(body, path, fm, content);
    const section = RECORD_SECTION[fm.type];
    if (section && !/```codex/.test(content)) {
      const box = body.appendChild(document.createElement("div"));
      await renderSection(this.plugin, box, { section }, path);
    }
    if (content.trim()) await this.renderMarkdown(body, content, path);
    if (fm.type === "vision-board" || fm.type === "future-self") this.renderImageAdder(body, path, fm);
  }

  // Friendly editor: one field per property, plus the name and the free-text content.
  renderEditor(body, path, fm, content) {
    const store = this.plugin.store;
    const form = body.appendChild(document.createElement("div"));
    form.className = "sl-editor sl-window";
    const row = (label, input) => { const r = form.appendChild(document.createElement("label")); r.className = "sl-edrow"; r.appendChild(document.createElement("span")).textContent = label; r.appendChild(input); return input; };
    const nameIn = row("Name", Object.assign(document.createElement("input"), { value: baseName(path), className: "sl-addin" }));
    const inputs = {};
    for (const [k, v] of Object.entries(fm)) {
      if (HIDDEN_KEYS.has(k) || (v && typeof v === "object" && !Array.isArray(v))) continue;
      let inp;
      if (typeof v === "boolean") { inp = Object.assign(document.createElement("input"), { type: "checkbox", checked: v }); }
      else if (Array.isArray(v)) { inp = Object.assign(document.createElement("input"), { value: v.join(", "), className: "sl-addin" }); inp.dataset.kind = "list"; }
      else if (typeof v === "number") { inp = Object.assign(document.createElement("input"), { type: "number", value: v, className: "sl-addin" }); }
      else { inp = Object.assign(document.createElement("input"), { value: v == null ? "" : String(v), className: "sl-addin" }); }
      inputs[k] = row(k.replace(/_/g, " "), inp);
    }
    const ta = row("Content", Object.assign(document.createElement("textarea"), { value: content, className: "sl-addin sl-edtext", rows: 12 }));
    const btns = form.appendChild(document.createElement("div"));
    btns.className = "sl-actions";
    btns.innerHTML = `<button class="sl-btn" data-a="save">Save</button><button class="sl-btn ghost" data-a="cancel">Cancel</button><span style="flex:1"></span><button class="sl-btn red" data-a="del">Delete…</button>`;
    btns.querySelector('[data-a="cancel"]').addEventListener("click", () => { this.editing = false; this.render(); });
    btns.querySelector('[data-a="save"]').addEventListener("click", () => {
      const next = Object.assign({}, fm);
      for (const [k, inp] of Object.entries(inputs)) {
        const old = fm[k];
        if (inp.type === "checkbox") next[k] = inp.checked;
        else if (inp.dataset.kind === "list") next[k] = inp.value.split(",").map(s => s.trim()).filter(Boolean);
        else if (inp.type === "number") next[k] = inp.value === "" ? null : +inp.value;
        else next[k] = inp.value === "" ? null : (typeof old === "number" && isFinite(+inp.value) ? +inp.value : inp.value);
      }
      const name = nameIn.value.replace(/[\\/:*?"<>|#^\[\]]/g, "").trim() || baseName(path);
      const newPath = path.split("/").slice(0, -1).concat(name + "." + extOf(path)).join("/");
      if (newPath !== path && store.has(newPath)) { new Notice("Something with that name already exists."); return; }
      if (newPath !== path) { store.del(path); this.record = newPath; }
      store.set(newPath, joinFM(next, ta.value));
      this.editing = false;
      new Notice("Saved.");
      this.render();
    });
    const del = btns.querySelector('[data-a="del"]');
    del.addEventListener("click", () => {
      if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "Click again to delete"; return; }
      store.del(path); this.record = null; this.editing = false; new Notice("Deleted."); this.back() || this.render();
    });
  }

  // Vision boards: upload pictures straight into the board.
  renderImageAdder(body, path, fm) {
    const box = body.appendChild(document.createElement("div"));
    box.className = "sl-addrow";
    box.innerHTML = `<button class="sl-btn sm">＋ Add image to this board</button><input type="file" accept="image/*" multiple hidden>`;
    const inp = box.querySelector("input");
    box.querySelector("button").addEventListener("click", () => inp.click());
    inp.addEventListener("change", async () => {
      const store = this.plugin.store, app = this.plugin.codexApp;
      for (const file of Array.from(inp.files || [])) {
        const safe = file.name.replace(/[^\w.\-]+/g, "-");
        const dest = normalizePath(`${this.plugin.settings.folder}/05 The Prophecy Chamber/Images/${moment().format("YYYYMMDD-HHmmss")}-${safe}`);
        await app.vault.createBinary(dest, await file.arrayBuffer());
        const { fm: f2, body: b2 } = splitFM(store.get(path));
        if (!f2.cover) f2.cover = dest;
        store.set(path, joinFM(f2, b2.replace(/\s*$/, "") + `\n\n![[${dest}]]\n`));
      }
      new Notice("Image added to the board.");
    });
  }
}

/* ================================================================= settings */
class CodexSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "The Hearthbound Codex" });
    new Setting(containerEl).setName("Image folder")
      .setDesc("Vault folder for the banner, your character portrait, cover images and custom icons. Your habits, quests and rewards are stored in the plugin itself.")
      .addText(t => t.setValue(this.plugin.settings.folder).onChange(async v => { this.plugin.settings.folder = normalizePath(v.trim() || DEFAULT_SETTINGS.folder); await this.plugin.save(); }));
    new Setting(containerEl).setName("Open dashboard").addButton(b => b.setButtonText("Open").setCta().onClick(() => this.plugin.activateView()));
    new Setting(containerEl).setName("Restore starter images").setDesc("Re-creates the banner and default portrait if they were deleted.")
      .addButton(b => b.setButtonText("Restore").onClick(async () => { const n = await this.plugin.writeAssets(); new Notice(`${n} image(s) restored.`); }));
    new Setting(containerEl).setName("Export backup").setDesc("Saves all Codex data as a JSON file in the image folder.")
      .addButton(b => b.setButtonText("Export").onClick(async () => {
        const p = normalizePath(`${this.plugin.settings.folder}/codex-backup-${moment().format("YYYY-MM-DD-HHmm")}.json`);
        await this.plugin.codexApp.vault.createBinary(p, new TextEncoder().encode(JSON.stringify(this.plugin.data, null, 1)).buffer);
        new Notice("Backup saved: " + p);
      }));
    new Setting(containerEl).setName("Reset to starter data").setDesc("Erases all habits, quests, rewards and history, and loads the starter examples. Cannot be undone.")
      .addButton(b => b.setButtonText("Reset…").setWarning().onClick(async () => {
        if (!b.buttonEl.dataset.armed) { b.buttonEl.dataset.armed = "1"; b.setButtonText("Click again to erase everything"); return; }
        this.plugin.data.files = JSON.parse(JSON.stringify(SEED_FILES)); await this.plugin.save(); this.plugin.refresh(); new Notice("Codex reset."); this.display();
      }));
  }
}

/* =================================================================== plugin */
module.exports = class HearthboundCodexPlugin extends Plugin {
  async onload() {
    const saved = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved.settings || {});
    this.data = { files: saved.files || JSON.parse(JSON.stringify(SEED_FILES)) };
    // 1.1.0: the starter "Adventurer" job becomes automatic (strongest stat + level)
    const prof = "00 Command Center/Player Profile.md";
    if (!this.settings.migratedJob && this.data.files[prof]) {
      this.data.files[prof] = this.data.files[prof].replace(/^job_class: Adventurer$/m, "job_class:");
      this.settings.migratedJob = true;
      if (saved.files) this.saveData({ settings: this.settings, files: this.data.files });
    }
    this.store = new CodexStore(this);
    this.codexApp = makeCodexApp(this);
    this.views = new Set(); this.blocks = new Set();

    this.registerView(VIEW_TYPE, leaf => new CodexView(leaf, this));
    this.registerMarkdownCodeBlockProcessor("codex", (source, el, ctx) => ctx.addChild(new CodexBlock(this, el, parseInput(source), ctx.sourcePath)));
    // images in the Codex folder changed (portrait, icons, vision pictures) → redraw
    const touch = f => { if (f && f.path && f.path.startsWith(this.settings.folder + "/")) this.refresh(); };
    this.registerEvent(this.app.vault.on("create", touch));
    this.registerEvent(this.app.vault.on("delete", touch));
    this.registerEvent(this.app.vault.on("modify", touch));

    this.addRibbonIcon("castle", "Open Hearthbound Codex", () => this.activateView());
    this.addCommand({ id: "open", name: "Open dashboard", callback: () => this.activateView() });
    for (const [id, label, , subs] of TABS) {
      if (subs) for (const [sid, slabel] of subs) this.addCommand({ id: `tab-${id}-${sid}`, name: `Open ${label} → ${slabel}`, callback: () => this.activateView(id, sid) });
      else this.addCommand({ id: "tab-" + id, name: "Open " + label, callback: () => this.activateView(id) });
    }
    this.addSettingTab(new CodexSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(async () => {
      if (!saved.files) { await this.writeAssets(); await this.save(); this.activateView(); }
    });
  }
  onunload() { }
  async save() { await this.saveData({ settings: this.settings, files: this.data.files }); }
  changed() { clearTimeout(this._s); this._s = setTimeout(() => this.save(), 400); this.refresh(); }
  refresh() {
    clearTimeout(this._r);
    this._r = setTimeout(() => { for (const v of this.views) v.render(); for (const b of this.blocks) b.render(); }, 120);
  }
  async activateView(tab, sub) {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf(true); await leaf.setViewState({ type: VIEW_TYPE, active: true }); }
    this.app.workspace.revealLeaf(leaf);
    const v = leaf.view;
    if (tab && v && v.showTab) v.showTab(tab, sub);
    return v;
  }
  async openRecord(path, edit) {
    const v = [...this.views][0] || await this.activateView();
    if (v) v.showRecord(path, edit);
  }
  goBack() { const v = [...this.views][0]; return v ? v.back() : false; }
  // starter images (banner, portrait, vision placeholders, icons) — never overwrites
  async writeAssets() {
    let n = 0;
    for (const [rel, content] of Object.entries(SEED_ASSETS)) {
      const p = normalizePath(this.settings.folder + "/" + rel);
      if (this.app.vault.getAbstractFileByPath(p)) continue;
      let buf;
      if (typeof content === "string") buf = new TextEncoder().encode(content).buffer;
      else { const bin = atob(content.b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); buf = u8.buffer; }
      await this.codexApp.vault.createBinary(p, buf);
      n++;
    }
    return n;
  }
};
