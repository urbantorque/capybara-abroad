---
name: capy3-routine-and-blame
description: "B12-B13: the tool that breaks a beat, blame armed from the chapter-neutral hook, and the one architectural cause behind three refusals"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0399a747-7207-4778-9720-3ffe4ce144bc
  modified: 2026-09-07T13:12:53.826Z
---

Items 5a and 5c of ROADMAP-FUN, built 7 Sep 2026 as `e3691f2` and `5e2bae6`.
5e was already built; 5b is refused.

**THE ONE FINDING THAT MATTERS ACROSS THREE BATCHES.** Everything in item 3 and
item 5 that could not be built has the same cause: **a local never writes its
own x/z — the chapter-neutral cast is a set of fixed points by design.** B7's
approach (people cannot walk to you), B11's plunge (ten chapters have a local at
a water edge and none can be knocked in), B13's denial (a doorman cannot stand
in a doorway he is not already standing in). Anything that wants a local to MOVE
is a different batch, and probably a different answer.

**THE HOOK THE ROADMAP NAMES KEEPS BEING THE NARROW ONE.** Fifth instance:
`npcWitnessChain` opens `if (live !== 'sydney' && live !== 'pasto') return 0`,
so blame armed there would have been a two-chapter feature. `localsReact` is the
chapter-neutral one and already computes `mine` (was the animal near enough for
this to be its doing). Same family as `sayNear`, `peopleNear`, `castReact` and
`startlePeople` — see [[capy3-people-have-bodies]].

**THE TOOL (5a).** `beat: { ..., tool: '<propType>' }` spawns a prop at the
person's anchor lazily on the first live tick (a local is registered while its
chapter is being built, before props.js has a world). `toolOut` is recomputed
every tick rather than flagged by the grab — a tool kicked into a canal is as
gone as a stolen one, and a flag would have to know every way a prop can leave.
The beat still STARTS and dies on the way down: no sfx, arm at 55 %, head down
0.55 rad to the empty hand.

`localOwnerOf` already gives a prop to whoever stands nearest to where it LIVES,
so a tool at a bench is that person's and `localOwnStart` fetches it — measured,
and in two chapters of five it was back before the probe could sample the
absence. **A probe measuring a broken routine has to keep the tool in the
animal's mouth.**

`localResolve(arr, rec)` now takes the speaker, because `tool: 'gone' | 'here'`
is the first line condition that is about the SPEAKER rather than the global
task table.

**BLAME (5c), AND HOW IT MEASURED WRONG TWICE.** Armed 5/5, said 1/5 — twice,
because the first fix was aimed at the wrong gate. `npcExStep` has FOUR gates
(the pair's clock, both mouths, a distance ceiling and a distance FLOOR) and
"armed and never said" is the same sentence for all four. Adding `near`,
`inWindow`, `aCd`, `bCd` to `exAudit` answered it in one run: `near` was 3.2,
5.3 and 3.9 m against `npcEX_MIN`'s 6. **`npcEX_MIN` exists so an exchange is
never mistaken for being about the player; an accusation IS about the player.**
Ignoring the floor took it to 5/5.

**WHEN A MECHANIC HAS SEVERAL GATES, THE AUDIT MUST NAME WHICH ONE REFUSED.**
A single armed/said pair costs two full measurement rounds to disambiguate.

**5e WAS ALREADY BUILT** — four chapters (Quay → Marrakech → Cappadocia →
Hanoi), one fixed `npcTRAV_FIG` so they are recognisable at six metres, lines
gated on tasks done in other chapters. hanoi.js says why it is four and not six:
"the joke only pays here, and it only pays if the three before it were quiet
about it." Fourth item in this pass that turned out to be built — check before
building.

Instruments: `qa/the-tool.js`, `qa/the-blame.js`, `qa/b12-shot.js`.
`game.beatAudit()` grew four tool columns; `game.exAudit()` and
`game.forceBlame()` are new.

Related: [[capy3-people-have-bodies]], [[capy3-the-locals]],
[[capy3-a-thing-inside-a-thing]], [[capy3-measure-the-premise]]
