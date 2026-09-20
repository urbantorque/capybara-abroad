# The stranger — the first walk played by somebody who read nothing (20 Sep 2026)

The L6 method wants a second agent that reads no code and no roadmap, plays
three minutes, and is asked the six verbs afterwards. No second agent was
available to this wave, so this is the nearest honest thing and is labelled
as such: `qa/wow2-stranger.js` is a bot that presses NOTHING but what the
pill's words name. It has no table of beats, reads no game state to decide
anything, and does not steer by the arrow (the main bot does; this one does
not — it knows the keyboard and English and that is all). "the bench",
"that hat" and "the board" it cannot find, so it walks a little and tries the
key, which is what a stranger who has not spotted the thing does too. The
counters below are the game's own (distance from `capy.position`, seconds at
`capy.isRunning`, `capy:land`, `capy:wheek`, `capy:grab`, the journal's
`.show`, `input.camYaw` accumulated), not the bot's opinion of itself.

One run, fresh file, Sydney, 1280x760. Begin to the end of the walk: 103.4 s
(the bot's clock 107.9 s from Begin). Eight pills, in order, at 5.8 / 8.3 /
10.8 / 32.9 / 35.2 / 55.6 / 59.8 / 62.1 s. Five of the eight beats closed on
the stranger's own action; three timed out.

## The six verbs the pills named, and what happened

| verb | the pill named it | the stranger pressed it | had its effect (the game's counter) |
|---|---|---|---|
| move (W, A, S, D) | yes, beat 1 | W 36 holds, A 4, S 1, D 22 | yes — 243.5 m walked over the run; beat 1 closed at 2.5 s |
| run (Shift) | yes, beat 2 | Shift 16 holds | yes — 1.6 s at `isRunning`; beat 2 closed at 2.5 s |
| hop (Space) | yes, beat 3 | Space 10 taps | hopped 8 times (`capy:land`) — but never ONTO the bench: the beat timed out at 20 s. Without the arrow the stranger does not find the bench |
| wheek (Q) | yes, beat 4 | Q once | yes — 1 wheek, the `wheek` row ticked; beat 4 closed at 2.3 s |
| take (E) | yes, beat 5 | E 14 taps | no — 0 grabs. The stranger pressed E on the lawn fourteen times with no hat in reach; the beat timed out at 20 s |
| the paper (Tab) | yes, beat 6 | Tab once, Esc once | yes — the journal opened once; beat 6 closed at 4.2 s |

The two the six do not cover: **look** (beat 7, "drag, or C") — C pressed
once, the camera turned (578° accumulated over the run, 60° inside the beat);
closed at 2.3 s. **The door** (beat 8, "the board by the gate") — no key to
press; the stranger ran and turned at random, never came within 12 m of the
wharf, and the beat timed out at 45 s. The audit: `hits 5`, `how 'walked'`,
`skipped false`, `tut 1` on the save.

## What this says about the walk

- The four beats that are a KEY (move, run, wheek, Tab) and the look are
  learned by a stranger from the words alone: five of five, each in under
  five seconds.
- The three beats that are a KEY AT A PLACE (the bench, the hat, the board)
  need the arrow. The main bot, which reads the arrow and the chart's metres
  the way a player would, closes all three; the stranger, which does not
  look at the paper at all, closes none. That is the arrow doing its job and
  not a fault in the lines — but it is the honest limit of a bot that reads
  only the pill: the pill says "at the bench" and the arrow says where.
- Nothing fired that the pills did not ask for. Zero non-tutorial keys were
  pressed; the stranger's Esc was the journal's close, not the pause.

A human stranger is still owed. This file is the scripted stand-in and says so.
