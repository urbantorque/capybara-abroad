---
name: capy3-the-through-line
description: "P6 — acts for nine chapters, a chapter layer for dialogue, the traveller, and the CRLF trap that eats multi-line anchors"
metadata: 
  node_type: memory
  type: project
  originSessionId: 58965c1c-b475-4eb2-bd2b-46df963489e0
  modified: 2026-09-02T14:02:12.680Z
---

Batch P6 of `ROADMAP-POLISH.md`, 3 Sep 2026, commit `2469ed1`. Contract section
**THE THROUGH-LINE — P6**. Almost no code, as the roadmap promised.

## AN ACT IS A BOUNDARY THE GEOGRAPHY ALREADY HAD

Nine chapters gained acts and **not one task moved** — the lists were already
sorted by where you are, so every boundary is a place you travel to and the
`wow` sits at the end of the movement that earns it. 56 `act:` tags.

**Chapter 1 keeps its flat list on purpose.** The Pasto note has said so since
R8: the point of chapter 2 having a shape is that chapter 1 did not.

`qa/p6-static.cjs` holds five invariants, each a way an act silently does
nothing: an empty act never becomes the live act so its heading is unreachable;
a task pointing past the declared count; an act of exactly one row; an arrival
behind a movement; and `open` being act one's line. **Run it before touching
CHAPTERS.**

## THREE LAYERS OF DIALOGUE

`npcLOC_SAY` is written to a rule its own comments state four times — no
season, no country, no building — which is right, and is exactly why a Venetian
and an Antarctic diesel mechanic both said "You again."

`npcPLACE_SAY[biome][kind]` sits between a person's own `says` and that pool.
It may break the rule because it only ever plays where it is written. `wary` and
`incident` authored for the **seventeen** chapters that have locals (Sydney and
Pasto use the instanced crowds, which have their own arrays).

**`sayAudit` returns the LAYER.** Asserting a Venetian says something Venetian
does not prove the chapter row was reached rather than a neutral pool sitting in
front of it. Same lesson as [[capy3-names-nothing-publishes]].

## THE TRAVELLER

**A figure in this game IS its palette** — there is no other way to be
recognised at six metres. So `game.addTraveller` fixes the palette in one place
and the four chapters supply only position, lines and the task that gates them.
Four copies of a palette is four chances for one to drift and for the joke to
stop working with nothing failing.

Measured as one person: shirt `a8c4a2`, hat `faf6ec`, `y === terrainHeight`, and
reachable in all four.

## TWO AUDITS WORTH KEEPING

- **Cross-file repeated sentences** caught a line said verbatim in Rio and
  Marrakech, and the ferry card writing chapter 3's name and subtitle a second
  time. It agreed with CHAPTERS. Nothing made it.
- **Within-file repeated sentences** caught five people given their own
  three-line pool who filled two of three from the chapter's shared array — the
  arrangement that makes somebody look as though they have a voice while
  guaranteeing they mostly do not.

## THE TRAP THAT COST THE MOST TIME

**The nineteen chapter files are CRLF; `shared.js`, `systems.js` and `npc.js`
are LF.** A multi-line anchor written with `\n` matches nothing in a CRLF file,
and that reads exactly like a stale anchor. Normalise the anchor to the file's
own ending before replacing.

Second: **the Bash tool eats backslashes even inside a quoted heredoc.** A
regex written through `node -e` or `cat <<'EOF'` arrives with `\\s` collapsed to
`s`. Use the Write tool for any script containing escapes — already recorded in
[[capy3-the-punctuation]] and hit twice more here.

Third: a picker key is a one-based index and it bit again — `Semicolon` is 15
(the Pantanal), not Manly, which is 14 (`BracketRight`).

## SMALL THINGS THAT MATTER

- The Pantanal souvenir is now `nothing. it was yours already.` with `keepNone`
  suppressing the drawn object. The empty frame beside Sydney's hat is the
  point, and it only works because the other eighteen are not exceptions.
- `open` is the arrival toast at +700 ms; the act kick heads the paper at the
  same moment. They must not be the same sentence.
- The note goes on a leaf only when the chapter is FINISHED — it is past tense
  about a place that is over.

Related: [[capy3-the-punctuation]], [[capy3-the-locals]], [[capy3-the-paper]],
[[capy3-faces-and-bodies]], [[headless-qa-harness]]
