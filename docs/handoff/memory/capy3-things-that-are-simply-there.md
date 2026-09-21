---
name: capy3-things-that-are-simply-there
description: "capy3's ambient movers — the objects that are on no list, and the rules that keep them from becoming irritations"
metadata: 
  node_type: memory
  type: project
  originSessionId: b557d31b-0533-4d0c-b6a7-7f2898d00c6e
  modified: 2026-08-20T23:35:00.000Z
---

Built 20 Aug 2026 alongside the second minis. **A chapter needs objects that are not switches**,
or every single thing in it is something the player is supposed to DO, and the place stops being
a place. Seven of them, none on any list, none rideable, robbable or completable:

- **Sydney, the floatplane** (`envPlaneStep`). Idles at a mooring, taxis, makes its run, one wide
  circuit at 58 m, puts down. A 94 s cycle so it is never the thing you are watching — it is the
  thing that turns out to have been happening. Verified by trace: it leaves the mooring at exactly
  t = 13.4 s.
- **Kyoto, the heron** (`kyoUpdateHeron`). Stands in the shallows of the mirror pond for 26 s or
  until you are within 9 m, then one harsh croak and a lazy arc to the other end. There were
  already koi in that pond and they are the right kind of life for it; what the garden had nothing
  of was something that could DECIDE to leave.
- **Marrakech, the storks** (`sahUpdateStorks`). Five, one InstancedMesh. Four wheeling the
  Koutoubia, one static on the parapet clattering its bill — which is the only noise a stork can
  make, they have no syrinx. Everything else in that chapter wants something from you; these want
  nothing.

**FOUR MORE, 20 Aug 2026:** Pasto's vencejos round the bell tower (28, and they scatter when the
bell goes — `pastoBellSwinging` was already there to read); Cali's five cometas over San Antonio
on forty metres of drawn string, because a kite with no line is a diamond hanging in the sky;
Iceland's arctic fox, which STOPS AND LOOKS instead of running, because that is what they do and
a white thing bolting into the dark is a worse picture; and the Drift's skein of long birds,
which is there to give the void a SIZE — there was nothing in the middle distance to measure a
twenty-five metre gap against.

**AND CAPPADOCIA GOT NONE, ON PURPOSE.** Balloons, eleven horses, a chase truck, a hundred and
sixty pigeons on the cliff and five launch crews: it is the busiest chapter in the game. Adding a
seventh moving thing to the place that already has six is padding, and the brief said a few
surprises, not a fairground.

**THE THREE RULES THAT KEEP THEM FROM BECOMING IRRITATIONS:**

1. **Ration the sound and scale it by distance.** The plane's engine is ONE note every 1.4 s,
   volume `clamp(0.26 - far * 0.0014, 0.03, 0.26)`, and silent at the mooring. A drone on a loop
   is the fastest way to turn a nice thing into a thing the player wants gone. Same shape as the
   Whippy van's chime, which is already gated on `far < 56`.
2. **Silhouette first, and check it FROM ABOVE.** Every camera in this game looks down. The
   bonde's roof was a dark plate over the whole car and photographed as a black slab with a yellow
   skirt; the lion's head and body were both `hkTaxi` and it read as a red van with a face on one
   end. Head gold, body red, and a dark CAP down the spine rather than a lid.
3. **A resting pose is not a moving pose with the speed set to zero.** The heron's wings are their
   own group and are `visible = false` while it stands — two boards sticking out of a bird that is
   not using them is the difference between a heron and a weathervane.

**AND THE THINGS THAT ARE ALSO AMBIENT WITHOUT BEING ONLY AMBIENT:** Venice's Volo cradle runs its
whole cycle whether or not anybody is in it (a rig that only moves when the player stands in it is
a lift, not a festival); Hong Kong's lion dances the poles on a clock either way; Rio's SECOND
bonde exists only to be passed.

Related: [[capy3-the-middle-rung]], [[capy3-world-size-audit]], [[headless-qa-harness]]
