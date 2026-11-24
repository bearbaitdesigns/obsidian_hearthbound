# 📖 Guide

The Hearthbound Codex turns your life into a quiet little adventure: good habits earn **XP**, bad habits cost **XP and HP**, goals become **quests** with measurable milestones, and XP buys **rewards**.

Everything you track is stored inside the plugin itself. **No notes and no daily notes are created.** The only files written to your vault are pictures (the banner, your character portrait, cover images and custom icons) in the `The Hearthbound Codex` folder.

## The tabs
| Tab | What's there |
|---|---|
| **Overview** | Status, time remaining, quick add, XP chart, rewards, life areas, daily quest, penalty zone, quest milestones, chronicle |
| **Habits** | Today's good and bad habits |
| **Quests** | The Quest Generator (folded away until you open it), side quests, then your quests. Each quest shows just its **current milestone**; the rest are under *All milestones* |
| **Rewards** | The reward shop: spend the XP you've earned |
| **Arcanium → Quest Library** | Habits first: each habit's streaks, 30-day rate, 20-week heatmap and days-per-week chart, plus the summary table (retired habits live here too). Then main-quest stats (progress, milestones, XP earned, days active) and side-quest stats (completed, XP, on-time rate, weekly chart, full history). |
| **Arcanium → Adventure So Far** | Weekly and monthly overviews and long-term graphs |
| **Arcanium → Hall of Triumph** | Every quest you have completed, shown as trophies |
| **Profile** | Your character sheet (click the portrait to upload your own) and life areas |

**Editing anything:** hover a card and click **✎** (or click its name). A pop-up lets you change its name, XP or cost, icon, cover image, notes and its other settings.

## Daily loop
1. **Complete** good habits as you do them. **I did it** when you slip on a bad habit.
2. Log milestone progress with **+ / −**, or type an amount and press Enter. When a milestone is done, the next one takes its place automatically.
3. When every milestone of a quest is done, a **Claim victory** button appears on the quest.
4. Spend XP in the Reward Shop.

## Rules
- **XP:** good habits give their `xp`; bad habits take theirs away. Milestones give their `xp`; clearing a quest gives its reward (E 50 · D 100 · C 200 · B 400 · A 800 · S 1500 by default).
- **Daily Quest:** complete every ★ habit in a day for a bonus.
- **HP** carries over between days. Bad habits deal damage equal to their XP, each good habit heals 5, and you regenerate 10 per day. **At 0 HP you fall and lose a level**, then come back at full HP minus the extra damage.
- **Gold** (XP left) = total XP − rewards claimed. Spending never lowers your level.
- **Stats:** each life area grants a stat (VIT, STR, AGI, INT, WIS…) = 10 + 1 per **50 XP** earned in it (change `stat_xp_per_point` in your profile). A small bar under each stat shows how close the next point is, and you get a **+1 STR!** message when one goes up. Only XP from items with a life area counts — anything marked **⚠ no area** doesn't feed a stat, so pick an area when you add things.
- **Retiring & deleting:** open a card's **✎** editor. **Retire** hides a habit or reward but keeps its history; **Abandon** does the same for a quest. Retired and abandoned items can be restored from their editor (find them in Arcanium → Quest Library → Retired, Rewards → Retired rewards, or Quests → Dormant). **Delete…** removes something for good: deleting a habit erases its history; deleting a quest or side quest removes the XP it gave.

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

Quests show **one milestone at a time** ("Milestone 2 of 4", with a dot for each step). Finish it and the next one moves up. If the next milestone counts the same thing to a bigger number (2 books → 4 books), it carries on from your total; otherwise any extra progress carries over. Open **All milestones** to see the full list or add new ones.

### Habits that count toward a quest
A habit can feed a quest. Open the habit's **✎**, pick **Counts toward quest**, and set **Progress added each time** in the milestone's unit. Example: the *Reading* habit adds **0.1 books** (about one chapter) to *Read 12 Books* every time you tick it off. Unticking takes the progress back. The habit card shows *↳ Read 12 Books +0.1* and the quest shows which habits feed it.

## Your character & banner
- The first time you open the Codex you create your character: name, job, portrait and up to **3 focus stats** you most want to improve. Focus stats get a ★, and the **Profile** tab's training window suggests how to raise the weakest of them (or your weakest stat overall if you haven't picked any).
- Click the portrait on the Overview or Profile tab to upload your character.
- **Profile → ✎ Edit profile & settings** changes your name, class, banner image and text, levelling curve and HP rules.

## Changing icons & pictures
Open any card's **✎** editor → **Change icon…** (pick an emoji, type your own, or **upload an image**) or **Cover image → Upload…**.

## Quest generator
On the **Quests** tab, the 🎲 **Quest Generator** rolls a random side quest or main quest (with ready-made milestones). It leans toward your focus stats and your weakest stat. **Roll again** until you like it, then **Accept quest**.

## Side quests
Quick one-off tasks such as *Clean house* or *Call doctor*. Add them on the Overview or Quests tab with an XP reward and an optional due date, then tick them off for XP. Completing one also heals 5 HP, like a good habit. Finished side quests leave the list the next day; their XP stays and they're kept in **Arcanium → Quest Library**. Set **Repeats** (every day, every 3 days, weekly, every 2 weeks, monthly, a weekday like every Sunday, or every N days) and a side quest comes back on its next date after you complete it.

## Showing a Codex window inside your own notes
Any note can embed a window with a `codex` block:
````
```codex
status
```
````
Windows: `level` `status` `character` `banner` `daily` `bad` `sidequests` `milestones` `actions` `time` `chart` `charts` `overview` `rewards` `areas` `quests` `hall` `library` `codex` `feed`.

Just your level, rank and title (great for a homepage or daily note):
````
```codex
level
```
````
Add `style: line` on a second line for a one-line version.

## Backup
Settings → Hearthbound Codex → **Export backup** saves everything as a JSON file in your vault.
