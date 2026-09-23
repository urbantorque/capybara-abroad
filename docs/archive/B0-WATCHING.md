# B0 — watching somebody play

`ROADMAP-FUN.md` item 0, and the only item in this repository that cannot be
done by an agent:

> Before any of the six: sit one person who has never seen it in front of the
> title card, let them pick a place, say nothing, and take notes for ten
> minutes. Then a second place. Write down the first thing they try that does
> nothing, the first time they read the paper for instructions, whether they
> ever *see* the marquee, the first laugh and the first sigh. Items 1–3 are
> *predictions* of that list; the session either confirms them or replaces
> them.

Fifteen batches were built on those predictions. This is the session that
checks them. It costs about half an hour of your evening and one person who
has never seen the game.

---

## Before they arrive

```bash
PORT=5188 node server.mjs
```

```bash
npx playwright-cli -s=b0 open http://localhost:5188/
```

```bash
npx playwright-cli -s=b0 run-code --filename=qa/b0-watch.js
```

That clears the save (a stranger must meet **Begin**, not "Carry on — you were
last in Venice"), installs a passive recorder, and leaves the title card up. It
survives reloads. Do not touch the keyboard after this.

Sit where you can see their face and their hands, not the screen. **The screen
is the one thing being recorded for you.**

---

## While they play

**Say nothing.** Not "try pressing E", not "you can go anywhere", not a laugh at
the right moment. The whole value of the half hour is that they are the only
person in the room who does not know how it works. If they ask a direct
question, the honest answer is "I want to see what you do" — and then nothing.

Let them pick the place. Ten minutes. Then ask them to pick a second one and
give them another ten.

The recorder is already writing down every key they press, every task that
ticks, every card they open, every silence over twenty seconds, and whether the
marquee was ever actually on screen and unoccluded. **Do not write any of that
down.** Write down the five things it cannot see:

| | |
|---|---|
| **the first laugh** | what was on screen, in your words |
| **the first sigh** | and what they were trying to do |
| **what they said out loud** | verbatim if you can, especially questions |
| **where their eyes went** | did they ever look at the paper? at the marquee? |
| **what they thought they were doing** | ask once, at the end, and not before |

One question at the very end, after the second place, and only this one:
*"What did you think you were supposed to be doing?"* Write the answer down
word for word. It is the single most useful sentence the session produces.

---

## Afterwards

```bash
npx playwright-cli -s=b0 run-code --filename=qa/b0-notes.js
```

```bash
npx playwright-cli close-all
```

The first command writes `qa/B0-session.txt.png` — a plain-text timeline, one
line per event, every time measured from the moment they pressed Begin. It ends
with a row in the same four numbers `qa/first-five.js` prints for its
random-walk driver:

> first tick · marquee · seen in · longest gap

`ROADMAP-FUN.md` has that table for all nineteen chapters, measured in B1. Put
the stranger's row under the driver's row for the chapters they played. The
roadmap's own rule for what happens if they disagree:

> **If B0's stranger disagrees with the driver about where they stalled, the
> stranger is right.**

---

## What the recorder is, and what it is not

It is listeners on the event bus, one interval and a legend scrape. It wraps no
game function, prevents no default and writes no game state — a recorder that
changed the session it was recording would be worse than none, because the
notes would still look fine.

**"A key the game has never mentioned"** is judged against the game's own
legend, scraped from the controls fold. That is deliberate and it was the
second attempt: the obvious signal is `e.defaultPrevented`, and
`qa/b0-keys.js` measured what that actually marks — arrows, Space, Tab, J and
H, because preventDefault here suppresses the *browser's* default and says
nothing about whether the game uses a key. Built on that, the notes would have
filed every press of W as a thing that did nothing.

So J and Escape show up as unmentioned even though they work. That is not a
bug in the recorder — the legend says `Tab` and `Esc`, and a player who found
J found it by guessing.

`qa/b0-selftest.js` drives a fake session through the same shape (Begin,
wander, four unmentioned keys, a long silence, the journal, the controls fold)
and exists so that the recorder is never first tried on the one thing here that
is expensive: the person.
