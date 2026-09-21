---
name: capy3-sounds-people-make
description: "Why capy3's chapters sound like a racket — the NPC sfx helper with no volume and no position, and the three shapes of idle noise"
metadata: 
  node_type: memory
  type: project
  originSessionId: c57a1972-dc84-45df-bcc0-f55810c063e0
  modified: 2026-08-28T02:55:33.056Z
---

Found 28 Aug 2026, reported by the player as "a lot of random audio noises in Sydney, maybe NPCs
talking". It was not random and it was not the ambience — it was four actors with no distance
law between them and the ear.

**`npc.js`'s `sfx()` was `game.sfx(n)`: no volume, no position.** That is volume 1.0, dead
centre, in both ears — the loudest thing this game can play — for every gasp, pop, bark, thud
and strum in nineteen chapters. `systems.js`'s ambience ladder had exactly this bug and was
fixed by putting its ninety-six calls on a ring; the PEOPLE were never done. The file already
had the right helper, `sfxAt(name, x, z, vol, pitch)` (near 7, far 70), and only the ibises
were calling it.

Measured on the Sydney lawn, ninety seconds, standing perfectly still:

    strum  x24  volume 1.0   the busker, 33 m away, playing inside your head
    gull   x10  volume 0.42  the lorikeet flush...
    rustle x10  volume 0.50  ...both halves of it, both centred
    chime  x10  up to 0.42   the ice cream van
    ...eighty sounds in ninety seconds, one every 1.1 s.  After: 52, all placed.

**THE THREE SHAPES OF IDLE NOISE, AND THEY ARE DIFFERENT BUGS:**

1. **No distance law.** A fixed-position actor (busker, dog) heard at full volume from anywhere
   in the chapter. The fix is position, not silence — walk toward him and he gets louder.
   Delivered level at the Sydney spawn went 1.0 -> ~0.18 from position alone.
2. **A state you can stand in, fired as if it were an event.** The lorikeet flush tested "is
   the capybara within r of this tree", so standing under a fig — AND THE SPAWN IS UNDER ONE —
   put the same flock up every time the cooldown expired, for ever. Birds that have been put up
   do not come back and get put up again by an animal that has not moved. A flush is an
   ARRIVAL: fire on the rising edge of entering the radius (keep a per-tree `Uint8Array` of
   was-inside), plus always on a wheek, because that is the player asking for it.
   **Watch the ordering:** the cooldown `continue`s before the presence flag is updated, which
   is correct — it means entering during a cooldown still reads as one arrival when it lapses.
3. **A hand-rolled rolloff with no pan.** The van chime computed `0.42 - far * 0.005` by hand,
   so it got quieter with distance and a van behind you sounded exactly like a van in front.

Levels that read as "ambient" in this game: the ladder in systems.js runs **0.05-0.20**, the
ibis squabble 0.16-0.44. `npcSFX_VOL` is now **0.34** as the default through the distance law;
1.0 is reserved for things that happen TO the player, and an NPC noise never is one.

`qa/tune-audio.js` is the instrument: it wraps `game.sfx` and tags every call with the `src/`
file and line that made it, because a count alone cannot tell a busker from a sprinkler (this is
harness note 16 — a soak that counts should also name). Run it for 90 s standing still; anything
over ~35 sounds a minute, or any volume over ~0.4 that is not positional, is the bug.

Related: [[capy3-external-forces-on-the-capybara]], [[headless-qa-harness]], [[capy3-the-locals]],
[[capy3-things-that-are-simply-there]]
