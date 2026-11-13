---
type: profile
cssclasses: [sl-page]
player_name: Player
job_class: Adventurer
title:
character: The Hearthbound Codex/_System/Assets/character.svg
level_base_xp: 100
level_step_xp: 50
daily_quest_bonus: 25
banner: The Hearthbound Codex/_System/Assets/banner.jpg
banner_title: The Hearthbound Codex
banner_subtitle: Level Up In Life
hp_max: 100
hp_regen: 10
hp_heal_per_habit: 5
---
# Player Profile

```codex
nav
```

```codex
character
```


## Codex settings (edit the properties above)
| Property | What it does |
|---|---|
| `player_name` | Name shown in the Status window |
| `job_class` | Your class — rename freely (Adventurer, Hedge Witch, Ranger, Bard…) |
| `title` | Leave empty to auto-earn titles as you level (Unawakened → Awakened One → Gate Breaker → Dungeon Diver → Raid Leader → Guild Master → Monarch-Class → Sovereign of Habits) |
| `character` | Your character portrait — click the portrait in the Status or Character window to upload one, or put the path of any image in your vault |
| `level_base_xp` / `level_step_xp` | Level 1→2 costs *base* XP; each next level costs *step* more |
| `daily_quest_bonus` | Bonus XP for clearing every ★ Daily Quest habit in a day |
| `banner` / `banner_title` / `banner_subtitle` | Dashboard banner image (any image in your vault) and the text drawn on top of it. Leave a text field empty to hide it. |
| `hp_max` / `hp_regen` / `hp_heal_per_habit` | Health pool, HP regenerated each day, HP healed per good habit completed |

## Rules of the Codex
- **Good habit** done → **+XP** (its `xp` property). **Bad habit** done → **−XP**.
- **Milestone** checked → **+XP** (its `[xp:: ]`). **Quest** cleared → **+xp_reward** (default by rank: E 50 · D 100 · C 200 · B 400 · A 800 · S 1500).
- **Adventurer rank** by level: E (1–9) · D (10–19) · C (20–34) · B (35–49) · A (50–69) · S (70–99) · National (100+).
- **Stats** — each Life Area grants a stat (VIT, STR, AGI, INT, WIS…) = 10 + 1 per 100 XP earned in that area.
- **HP** carries over between days: each bad habit deals damage equal to its XP, each good habit heals `hp_heal_per_habit`, and you regenerate `hp_regen` every day. **If HP reaches 0 you fall: you lose a level** (your XP drops to the start of the previous level) and revive at full HP (minus any excess damage). Undoing the slip undoes the fall. **Gold** (XP left) = total XP − rewards claimed.
