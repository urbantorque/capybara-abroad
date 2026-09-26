# Capybara Abroad

**Play it: https://urbantorque.github.io/capybara-abroad/**. It's one file:
no install, no account, and it saves in your browser.

A cosy, mischievous travel game. A capybara follows a traveller's bag
through nineteen real places and brings one memory home from each, for the
shelf in Sydney's Botanic Gardens. On the way it knocks things over, steals
hats and gets chased. An ibis from the Gardens keeps trying to steal its
yuzu.

The places: Sydney, Pasto, Circular Quay, Kyoto and Uji, Cali, Rio,
Iceland, Marrakech, the Drift, Venice, Hong Kong, Palawan, Cappadocia,
Manly, the Pantanal, Sơn Đoòng, Antarctica, Monte Carlo and Hanoi. Each one
has a big experience (a condor ride, a ferry to steer, a balloon at sunrise),
a quieter way to the same memory, and small things to find.

## Playing

| | |
|---|---|
| Move · run · hop | W A S D · Shift · Space |
| Take / drop · wheek | E · Q |
| The list of things to do · next thing | L · F |
| Journal · look around · mute | Tab · drag or C · M |
| The map | hover over or hold the corner map |
| Photo · hide the HUD · pause | K · P · Esc |

- **Story** opens places two memories at a time.
- **Free roam** opens all nineteen at once. It's on the title screen, and
  it keeps everything you've done.
- **Trouble costs something.** If someone who saw you comes over and
  catches you, it costs a yuzu or three. Hiding in water or cover, or just
  walking off, pays.

## Running it

```
npm start          # serves src/ unbundled on http://localhost:5188
node build.mjs     # one self-contained dist/untitled-capybara-game.html
npm test           # 77 static checks, ~2 minutes, no browser
```

There are no dependencies. Three.js and cannon-es are vendored in `vendor/`
and inlined by the build. Browser checks live in `qa/`, run against the dev
server in headful Edge (see `qa/reimagine-harness.mjs`).

## The repository

| | |
|---|---|
| `src/` | 30 modules: `shared.js` (palette, chapters, tasks, shaders), `systems.js` (HUD, save, score, camera), `npc.js` (people and animals), `capybara.js`, `props.js`, `rival.js`, `havoc.js` (Free Roam's HAVOC), and one file per place |
| `qa/` | Instruments and checks. Results (`qa/**/*.png`) are git-ignored |
| `docs/CONTRACT.md` | What shipped, newest first, with the measured numbers |
| `docs/roadmaps/` | One roadmap per pass. `ROADMAP-AAA.md` is the latest |
| `docs/handoff/` | State of play and working notes for whoever picks this up next |
| `docs/archive/` | Retired reviews and the old long README |
| `AGENTS.md` | The rules for working on the code: read it first |

## Licence

None yet: see `LICENSING.md`. Playing is fine; redistributing isn't, until
the author picks a licence.
