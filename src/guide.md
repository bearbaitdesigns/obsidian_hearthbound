# 📖 Guide

The Hearthbound Codex turns your life into a quiet little adventure: good habits earn **XP**, bad habits cost **XP and HP**, goals become **quests** with measurable milestones, and XP buys **rewards**.

Everything you track is stored inside the plugin itself. **No notes and no daily notes are created.** The only files written to your vault are pictures (the banner, your character portrait, cover images and custom icons) in the `The Hearthbound Codex` folder.

## The tabs
| Tab | What's there |
|---|---|
| **Overview** | Status, time remaining, quick add, XP chart, rewards, life areas, daily quest, penalty zone, quest milestones, chronicle |
| **Habits** | Today's good and bad habits |
| **Quests** | Side quests, then every quest with its progress and all its milestones: log progress, tick them off, add new ones |
| **Rewards** | The reward shop: spend the XP you've earned |
| **Arcanium → Quest Library** | Habits first: each habit's streaks, 30-day rate, 20-week heatmap and days-per-week chart, plus the summary table (retired habits live here too). Then main-quest stats (progress, milestones, XP earned, days active) and side-quest stats (completed, XP, on-time rate, weekly chart, full history). |
| **Arcanium → Adventure So Far** | Weekly and monthly overviews and long-term graphs |
| **Arcanium → Hall of Triumph** | Every quest you have completed, shown as trophies |
| **Profile** | Your character sheet (click the portrait to upload your own), life areas and the Icon Forge |

**Editing anything:** hover a card and click **✎** (or click its name). A pop-up lets you change its name, XP or cost, icon, cover image, notes and its other settings.

## Daily loop
1. **Complete** good habits as you do them. **I did it** when you slip on a bad habit.
2. Log milestone progress with **+ / −**, or type an amount and press Enter.
3. When every milestone of a quest is done, a **Claim victory** button appears on the quest.
4. Spend XP in the Reward Shop.

## Rules
- **XP:** good habits give their `xp`; bad habits take theirs away. Milestones give their `xp`; clearing a quest gives its reward (E 50 · D 100 · C 200 · B 400 · A 800 · S 1500 by default).
- **Daily Quest:** complete every ★ habit in a day for a bonus.
- **HP** carries over between days. Bad habits deal damage equal to their XP, each good habit heals 5, and you regenerate 10 per day. **At 0 HP you fall and lose a level**, then come back at full HP minus the extra damage.
- **Gold** (XP left) = total XP − rewards claimed. Spending never lowers your level.
- **Stats:** each life area grants a stat (VIT, STR, AGI, INT, WIS…) = 10 + 1 per 100 XP earned in it.
- **Removing:** habits and rewards are *retired* (their history stays); quests are *abandoned*. Restore them from the Habits, Rewards or Quests tab.

## Titles, ranks & jobs
Your **title** and **rank** are earned as you level:

| Level | Rank | Title |
|---|---|---|
| 1–4 | E | Hearthling |
| 5–9 | E | Kindled Wanderer |
| 10–19 | D | Lantern Bearer |
| 20–34 | C | Trailwarden |
| 35–49 | B | Keeper of the Hearth |
| 50–69 | A | Hearthbound Knight |
| 70–99 | S | Elder of the Glen |
| 100+ | Legend ★ | Legend of the Hearth |

Your **job** grows with you: the class comes from your strongest stat, and the rank word from your level.

| Strongest stat | Class | | Level | Rank word |
|---|---|---|---|---|
| STR (Fitness) | Knight | | 1–9 | Apprentice |
| VIT (Health) | Herbalist | | 10–34 | Journeyman |
| AGI (Work) | Ranger | | 35–69 | Master |
| INT (Self Development) | Scholar | | 70+ | Grand |
| WIS (Hobbies) | Druid | | | |

e.g. *Journeyman Ranger*. Rename a class in a life area's ✎ editor. Type your own job or title in **✎ Edit profile & settings** to override them. There is no maximum level.

## Quest milestones
Each milestone is measurable: a target, a unit, an XP value and a due date. Add them from the Quests tab or the Overview. Each milestone row has its own **✎** to change its description, target, unit, XP or due date.

## Your character & banner
- Click the portrait on the Overview or Profile tab to upload your character.
- **Profile → ✎ Edit profile & settings** changes your name, class, banner image and text, levelling curve and HP rules.

## Changing icons
- **Any card icon or picture** (habits, rewards, life areas, quests…): open the card's **✎** editor → **Change icon…** (emoji or **upload an image**) or **Cover image → Upload…**.
- **Interface icons** (stars, trophies, streak flames, rank badges…): **Profile → Icon Forge**, click the one you want to change.

## Side quests
Quick one-off tasks such as *Clean house* or *Call doctor*. Add them on the Overview or Quests tab with an XP reward and an optional due date, then tick them off for XP. Completing one also heals 5 HP, like a good habit. Finished side quests leave the list the next day; their XP stays and they're kept in **Arcanium → Quest Library**.

## Showing a Codex window inside your own notes
Any note can embed a window with a `codex` block:
````
```codex
status
```
````
Windows: `status` `character` `banner` `daily` `bad` `sidequests` `milestones` `icons` `actions` `time` `chart` `charts` `overview` `rewards` `areas` `quests` `hall` `library` `codex` `feed`.

## Backup
Settings → Hearthbound Codex → **Export backup** saves everything as a JSON file in your vault.
