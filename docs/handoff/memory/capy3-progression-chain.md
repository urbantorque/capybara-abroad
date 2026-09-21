---
name: capy3-progression-chain
description: "How the nine capy3 worlds connect, and why the three-whistle exit now opens a board instead of a fixed destination"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6cafba14-b59c-4b34-9fc3-4981c76be36b
  modified: 2026-08-19T21:48:09.497Z
---

As of 21 Aug 2026 the game has SEVENTEEN biomes, all authored in the SAME world coordinates with
only one attached at a time: `sydney`, `quay` (Sydney Harbour to Manly), `pasto`, `kyoto`,
`cali`, `rio`, `iceland` (Reykjavik, a geyser field and a glacier, at night), `sahara`
(Marrakech, the souk and the Erg), `drift` (floating islands over a cloud sea, a third of
a gravity — see [[capy3-drift-air-and-gravity]]), `venice` (San Marco, the Grand Canal, and a
TIDE that decides which ground exists) and `kowloon` (Mong Kok, a bamboo scaffold and the
Symphony of Lights — see [[capy3-chapters-ten-eleven]]), `palawan` (El Nido: a reef, a drop-off,
and a hidden lagoon reached by DIVING under a rock lintel) and `goreme` (Cappadocia at dawn, where
the only vehicle has no steering) — the last two are [[capy3-dive-and-balloon]]. Then THREE MORE on 20 Aug 2026: `manly`
(the ocean side of the peninsula, where the waterline is a function of POSITION — see
[[capy3-the-sea-has-a-shape]]), `pantanal` (the flooded campo, where other capybaras
follow you in a line — [[capy3-the-herd]]) and `cave` (Son Doong, where the wheek is
the torch — [[capy3-the-dark]]).


And a SEVENTEENTH on 21 Aug 2026: `antarctic` (the Peninsula, where the land is four rocks
and a glacier eleven hundred metres apart and the verb is STEER - see [[capy3-the-pack-and-the-pod]]).
Its one way out is the head of the station jetty, once the orca pod has formed up on you.

`CHAPTERS` in shared.js is now the single source of truth for EVERYTHING per-place: biome,
name, subtitle, the arrival task, the camera far plane, whether the shadow frustum goes deep,
the music palette index, the title card's hint line and the toast you land on. It absorbed
ELEVEN separate if-ladders across five files on 19 Aug 2026 — the ninth chapter had shipped
with two of them missing a rung, and a table cannot be missing a rung.

**The design rule is unchanged: every place that is not Sydney has exactly ONE way out of it,
standing somewhere obvious, using a verb the player already has.** Each exit: Pasto = in the
crater; Kyoto = on the Uji bridge; Cali = the bridge over the Rio Cali; Rio = the rock at
Arpoador; Iceland = the end of the pier in the old harbour; Marrakech = the fire at the desert
camp (and only after the storm has passed, so it is the last thing you do); Venice = the two
columns on the Molo, once you have seen the square go under; Hong Kong = the end of the Star
Ferry pier, once the far shore has done its trick; the
Drift = the lantern's plinth, and only once the lantern is LIT, which makes it the last line of the chapter
by construction rather than by a rule.

**What changed is where the exit LEADS.** The third wheek used to teleport you: to Sydney from
abroad, and from Manly down a hard-coded ladder of the next unfinished chapter. Getting abroad
therefore cost ferry -> Quay -> helm -> 700 m of open water -> the Corso -> three wheeks, and
with eight chapters that toll was going to be paid seven times. The third wheek now opens the
**departures board** (the same card `Tab` opens read-only), and you pick. `goHome()` and
`goOverseas()` are gone.

Open destinations: Sydney always; anywhere you have already stood (`jrSeen`); plus the lowest
incomplete chapter **counting from two** — it must skip chapter 1, because Sydney is 18 tasks
and is almost never finished early, so "lowest incomplete" is Sydney for most of the game and
the board showed one unlocked line for two hours.

The run also SAVES now (`capy3.journey.v1`), so `completeTask(id, silent)` exists for restoring
without firing forty toasts and six chapter ceremonies in the first second.

**A NEW CHAPTER HAS A FIFTH REGISTRATION AND IT IS NOT IN src/.** `build.mjs` keeps a hand-written
`ORDER` array, and chapters 12 and 13 were never added to it — so `node build.mjs` produced a dist
that ran Sydney through Hong Kong and simply did not contain Palawan or Cappadocia. Nothing
catches it: dev serves `src/main.js` as ES modules and is always right, the bundler cheerfully
reports "no collisions" because there is nothing to collide with, and the omission only exists in
the artefact nobody opens locally. Adding a chapter means CHAPTERS, TASKS, sysMAP_WORLDS, a music
palette — and `ORDER`. Fixed 20 Aug 2026, with a static audit that now checks all five.

The full registration list as of chapter 16, because it is longer than five: CHAPTERS,
TASKS (1 wow, 1-2 mini), RECORDS, PALETTE colours, `src/<biome>.js`, main.js (import,
`<NAME>_SPAWN`, the game field, the create call, the `all` array, `updaterNames`),
`build.mjs` ORDER, and in systems.js: `sysMUS_PAL` (with a `lift` row), `sysGRADES`,
`sysSKY_TOP` or `sysSKY_OWN`, `sysMARKS`, `sysMAP_WORLDS`, `sysAIR` (new — the
atmosphere is a table now, see [[capy3-layouts-that-scale]]), the three-wheek exit
ladder, the ambience rung, and a clue row per task. `qa/audit-tasks.mjs` catches five of
them; `qa/pointers.js` catches the clue rows.

Related: [[headless-qa-harness]], [[capy3-biome-build-gotchas]], [[capy3-slip-and-sky]], [[capy3-the-lift]],
[[capy3-layouts-that-scale]]
