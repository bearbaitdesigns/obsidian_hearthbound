#!/usr/bin/env python3
"""Builds the release files (main.js, styles.css) from src/.

    python3 src/build.py

- src/main.template.js  plugin shell (view, tabs, data store, settings)
- src/engine.js         renderer for every Codex window
- src/styles.css        theme
- src/guide.md          text of the Guide tab
- src/seed/             starter data: *.md records are stored in the plugin's data,
                        images (and _System/Icons/*) are written to the vault folder
"""
import base64, json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
IMAGE_EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif")


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def seed():
    files, assets = {}, {}
    base = os.path.join(SRC, "seed")
    for d, dirs, names in os.walk(base):
        dirs.sort()  # same order on every machine
        for n in sorted(names):
            p = os.path.join(d, n)
            rel = os.path.relpath(p, base).replace(os.sep, "/")
            if n.lower().endswith(IMAGE_EXT):
                with open(p, "rb") as f:
                    assets[rel] = {"b64": base64.b64encode(f.read()).decode()}
            elif not n.endswith(".md") or rel.startswith("_System/Icons/"):
                assets[rel] = read(p)
            else:
                files[rel] = re.sub(r"```codex\nnav\n```\n?", "", read(p))
    return files, assets


def main():
    files, assets = seed()
    tpl = read(os.path.join(SRC, "main.template.js"))
    for marker in ("/*__SEED_FILES__*/{}", "/*__SEED_ASSETS__*/{}", '/*__GUIDE__*/""', "/*__ENGINE__*/"):
        if marker not in tpl:
            sys.exit(f"build: marker {marker} missing from main.template.js")
    out = (tpl.replace("/*__SEED_FILES__*/{}", json.dumps(files, ensure_ascii=False, sort_keys=True))
              .replace("/*__SEED_ASSETS__*/{}", json.dumps(assets, ensure_ascii=False, sort_keys=True))
              .replace('/*__GUIDE__*/""', json.dumps(read(os.path.join(SRC, "guide.md")), ensure_ascii=False))
              .replace("/*__ENGINE__*/", read(os.path.join(SRC, "engine.js"))))
    with open(os.path.join(ROOT, "main.js"), "w", encoding="utf-8") as f:
        f.write(out)
    shutil.copy(os.path.join(SRC, "styles.css"), os.path.join(ROOT, "styles.css"))
    version = json.load(open(os.path.join(ROOT, "manifest.json")))["version"]
    print(f"built main.js ({len(out):,} bytes, {len(files)} records, {len(assets)} assets) + styles.css — version {version}")


if __name__ == "__main__":
    main()
