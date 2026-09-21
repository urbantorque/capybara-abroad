---
name: capy3-fourth-pass-ten-eleven
description: "The fourth pass over Venice and Mong Kok: the corridor audit nothing had ever run, two landmarks that were never in the chapter at all, and the four ways a thing can be built and not seen"
metadata: 
  node_type: memory
  type: project
  originSessionId: 094d4e36-537b-44bc-b91f-c172e87077a9
  modified: 2026-08-22T18:35:25.667Z
---

Done 23 Aug 2026, briefed for **+30 % triangles and +30 % juice** in chapters 10 and 11,
plus NPCs, marquee, audio and a bug sweep. Result: Venice 126,346 → **168,506** and Kowloon
118,522 → **152,970**, frame time unmoved (1.7 / 2.3 ms against 16.6). Both are past the
CONTRACT's 130k, deliberately and on the record — see [[capy3-world-size-audit]].

Three earlier passes had already been through these two ([[capy3-chapters-ten-eleven]],
[[capy3-chapters-nine-ten-eleven]], [[capy3-third-pass-nine-ten-eleven]]), so almost nothing
left was a wrong number. What was left was **things that were never there at all**, and one
whole class of bug nothing in the project had ever looked for.

## THE THIRD QUESTION: is there a corridor at all

The project has two solidity checks. `audit-solid` asks *is this thing solid*. A driven walk
asks *can I get past it this way*. **Neither asks whether a continuous corridor exists**, and
that is the one that catches a route sealed by two objects that are each individually correct.

`qa/wn-clear.js` is nine lines: every static/kinematic Box as an AABB; for each half metre
along a corridor, sweep across it and report the widest unblocked run, inflated by the
animal's half-width; anything under 1.0 m is a report. On Mong Kok it found the west pavement
**0.0 m wide for five metres** — a bakery counter that had been there since the chapter was
written, plus a taxi parked half on the kerb — **with the chapter's first task at the end of
it.** Nothing had ever noticed, because the task is reachable from the road side, both objects
are properly solid, and the other pavement walks fine.

It also prices every local standing mid-pavement: a 0.6 m figure plus a 0.9 m animal on a
3.3 m footway leaves 0.4 m. **Locals go against the shopfront; street furniture goes on the
kerb line**, or they are a wall with dialogue. Five of Kowloon's eleven were in the middle.
And a crossing was put in at z 26, which is the bakery — furniture and shopfronts are the two
ends of the same three metres and have to be placed knowing about each other.

## BUILT AND NOT SEEN, four different mechanisms in one day

1. **Drawn after `M.build()`.** The siu mei shop went into the market's merger below the line
   that builds it. Same failure as the Drift's pennants; I reproduced it inside a day of
   having read the note about it. The tell is *nothing appears and no error*.
2. **Inside its own mass.** The Torre dell'Orologio's terrace was authored at `TOP − 3` and
   the tower's mass runs to `TOP`, so the terrace, the bell, its frame and both bronze Moors
   were three metres down inside 1,500 m³ of solid stone. Every number was right. The only
   tell was that the tower had a flat top.
3. **Behind its own light.** Sixty shopfronts had their counter and shelves at `hkFACE − 0.52`
   and the lit pane at `− 0.60` — the silhouettes were *deeper into the building* than the
   thing lighting them, so the street was sixty blank cream rectangles. On a `+x` wall, "in
   front" is SMALLER x. Same bug then hit the pier's destination boards on the opposite sign.
4. **Level with the thing it should be above.** San Marco's crocketed gables topped out at
   22.7 and its domes at 22.8, so five gold tents stood in front of five gold domes and
   neither could be told from the other. A façade needs its layers separated in HEIGHT, not
   just in depth.

## THE TWO LANDMARKS THAT WERE NOT IN THE CHAPTER

- **The Torre dell'Orologio.** Piazza San Marco's north-east corner is not an arcade, it is a
  clock tower with a passage under it, and this square ran fifty metres of Procuratie straight
  into the flank of the basilica. It is now the shape everybody knows — deep arch, blue-and-
  gold face with hands that run on the TIDE clock (one revolution a cycle, so the face is a
  tide gauge), the winged lion on a starred field, and the two bronze Moors who strike the
  bell. The old one is two minutes early and the young one two minutes late, which is the
  oldest joke in the city and costs one offset.
- **The Tsim Sha Tsui clock tower** was 8 m of tan box with a white disc glued to the side.
  Twenty-six metres of red brick with granite banding, an arched door, a colonnaded cupola and
  a lit clock face on all four sides — and it is what closes the view down the whole street.

## TRIANGLES: AUTHOR THE EXPENSIVE VERSION ONLY WHERE THE PLAYER STANDS

Venice's fifty palazzi carry nine windows each. The full Venetian-Gothic ogee (pane, four
steps of head, two jambs, ten arch stones, sill) is **97,000 triangles — three quarters of the
chapter** — on buildings mostly a hundred metres away behind other buildings. The eight round
the Rialto get it; the other forty-two get the four boxes that carry the silhouette. 97k → 27k
and the picture is identical from every camera anybody uses. This is the same lever as
Palawan's warped seabed but applied to *detail level* rather than *grid density*, and it is
the cheapest 70k in the game.

Also: **the ground is still the first place to look.** Venice's was 150 × 124 over 280 × 230 m
= 37,200 triangles on a city whose height is one number everywhere except two squares, a quay
and two channels — all 3.5 m blends or wider. 128 × 106 resolves every one and gives 10k back.
Third chapter running.

## SMALLER THINGS WORTH NOT RE-DERIVING

- **A LOCAL'S y IS BELIEVED, NOT SNAPPED.** npc.js puts the figure exactly where told, and
  Venice is the one chapter whose ground is not one number (square 0, city 1.30, Molo 1.00,
  fondamente 1.55). The café waiter was authored at `venCITY_Y` and Florian's is at 0.67, so
  the man the second task is about stood **62 cm in the air with his own shadow underneath
  him**. And the campo local was authored at `venCAMPO` — which is the wellhead's own centre,
  so he stood inside a 1.9 m box of stone in front of the task that asks you to climb on it.
  Every local is placed off `venTerrain()` now. The same property is a FEATURE once you know
  it: it is how Kowloon's foreman ended up on the scaffold's second working deck at 11.7 m.
- **THE PIAZZA IS TRACHYTE, NOT ISTRIAN.** The field was drawn in the same near-white as the
  ribs laid across it, and three things followed: the pattern the square is famous for was
  invisible, 180 grey pigeons had nothing to stand against, and a metre of green water came
  out the same VALUE as the dry stone next to it — which is the one thing the marquee moment
  of that chapter may not do. Grey field, white ribs. It is the single biggest change in the
  chapter and it is two colours.
- **A COVERED SPACE NEEDS A LIGHT AND A POOL, and the market had neither.** Five emissive
  tubes and six bulbs over a floor as black as the road outside. Sixth time this project has
  learned it (the Drift's lamp-post, Venice's loggia, sixty neon signs, this).
- **THE DOME RIB ROTATION.** A rib is a segment of a MERIDIAN, so with the merger's 'YXZ' it
  wants `ry = a` and `rx = −(π/2 + th)`. Check both ends: at the equator local +z must be
  straight up, at the pole horizontal and inward. The first cut used `−th * 0.9`, which draws
  five gold spikes fanning out of the dome like a mace. And `k / nr * PI` puts every rib on
  the half with x > 0 — a meridian is a half circle, but the AZIMUTHS go all the way round.
- **THE CAMPANILE WAS INSIDE THE DOGE'S PALACE.** Seven metres of tower shared cubic metres
  with the palace between y 7 and 16, which is why it never read as free-standing from the
  Piazzetta. The palace's north wall moved, not the tower — `venVOLO_B` sits at z −21.6
  *precisely because* it clears the tower's near wall at −20.9.
- **A ROOF IS A PLACE.** Kowloon's marquee is watched from one deck and it was five water
  tanks. A rooftop hut, a pigeon loft, an aerial forest, four dishes, nine potted plants and
  one plastic chair facing the harbour — and nine tar patches, because 19 × 32 m of a single
  flat value under the player's feet is a sheet of card.
- **ONE VOICE PER EVENT.** Il Volo scares a 12 m disc of pigeons nine times a second for
  twenty-two seconds; a rustle per burst measured **73 sounds in 44 s**. Routing it through
  the flock's own take-off detector (which watches the airborne COUNT and claps once when it
  jumps, whatever caused the jump) got it to 7. The bell was worse in principle: an "hour" was
  a twelfth of the tide clock — a 17-second hour, six blows each. Four strikes a tide, and the
  count now also says where in the tide you are.
- **MEASURE AUDIO BY COUNTING CALLS, and watch the wrapper.** Wrapping `game.sfx` per biome in
  a loop nests the wrappers, so the second biome's counts come out exactly 2× real.

Related: [[capy3-chapters-ten-eleven]], [[capy3-third-pass-nine-ten-eleven]],
[[capy3-solid-or-drawn]], [[capy3-the-locals]], [[capy3-world-size-audit]],
[[headless-qa-harness]], [[capy3-the-picture]]
