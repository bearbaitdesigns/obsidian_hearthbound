# 🏰 Hearthbound Codex

A cozy, gamified life dashboard for [Obsidian](https://obsidian.md). Good habits earn **XP**, bad habits cost **XP and HP**, goals become **quests** with measurable milestones, quick errands become **side quests**, and XP buys **rewards**.

Everything opens in its own dashboard tab — no Dataview, no daily notes, no clutter in your vault.

## Features
- **Overview** — status window (level, rank, title, HP/EXP bars, stats), daily quest, penalty zone, side quests, quest milestones, XP chart, reward shop, life areas and a chronicle of everything you've earned.
- **Habits** — complete good habits, log slips on bad ones. Streaks, clean streaks and a Daily Quest bonus for clearing every ★ habit.
- **Quests** — main quests broken into measurable milestones (`current / target / unit`, XP, due date). Log progress with + / −, then **Claim victory**.
- **Side quests** — one-off tasks ("Clean house", "Call doctor") with XP and an optional due date. Finished ones clear from the list the next day and stay in your history.
- **Rewards** — spend the XP you earn; one-time or repeatable rewards, level-locked rewards.
- **Arcanium**
  - **Quest Library** — every habit's streaks, 30-day rate, 20-week heatmap and weekly chart, then main-quest and side-quest stats.
  - **Adventure So Far** — weekly and monthly overviews, XP growth, level progression and consistency graphs.
  - **Hall of Triumph** — every quest you've cleared, as trophies.
- **Profile** — character sheet with your own portrait, life areas (VIT, STR, AGI, INT, WIS…) and the **Icon Forge** for swapping any interface icon for an emoji or your own image.
- **HP & falling** — bad habits deal damage, good habits heal, you regenerate daily. Hit 0 HP and you lose a level.
- **Edit anything in place** — every card has a ✎ pop-up for name, XP / cost, icon, cover image, notes and its own settings.

## Install with BRAT (beta)
1. Install **BRAT** from *Settings → Community plugins → Browse* and enable it.
2. Run the command **BRAT: Add a beta plugin for testing** (or *Settings → BRAT → Add beta plugin*).
3. Paste `bearbaitdesigns/obsidian_hearthbound` and confirm.
4. Enable **Hearthbound Codex** under *Settings → Community plugins*.
5. Click the 🏰 castle icon in the left ribbon (or run **Hearthbound Codex: Open dashboard**).

BRAT will keep the plugin updated whenever a new release is published.

## Manual install
Download `main.js`, `manifest.json` and `styles.css` from the [latest release](../../releases/latest) into `<your vault>/.obsidian/plugins/hearthbound-codex/`, then enable the plugin.

## Where your data lives
Habits, quests, rewards and history are stored in the plugin's own `data.json` (inside `.obsidian/plugins/hearthbound-codex/`). The only files written to your vault are pictures — the banner, your portrait, cover images and custom icons — in the folder set in the plugin's settings (default `The Hearthbound Codex`). *Settings → Hearthbound Codex → Export backup* saves everything as JSON.

## Embedding windows in your own notes
````
```codex
status
```
````
Windows: `status` `character` `banner` `daily` `bad` `sidequests` `milestones` `actions` `time` `chart` `charts` `overview` `rewards` `areas` `quests` `hall` `library` `codex` `feed` `icons`.

## Development
```
src/main.template.js   plugin shell: dashboard view, tabs, data store, settings
src/engine.js          renderer for every window
src/styles.css         theme
src/guide.md           Guide tab
src/seed/              starter habits, quests, rewards, areas, side quests and images
src/build.py           assembles main.js + styles.css
```
Build with `python3 src/build.py` (Python 3 only, no npm).

## Releasing
Releases are made by the **Release** GitHub Action (`.github/workflows/release.yml`):
- **Actions → Release → Run workflow**, choose `patch`, `minor`, `major` (or type `1.2.3`). It bumps `manifest.json` + `versions.json`, builds, commits, tags and publishes a release with `main.js`, `manifest.json` and `styles.css` — the files BRAT installs.
- Or edit `version` in `manifest.json` and push to `main`; a release is created if that version hasn't been released yet.
