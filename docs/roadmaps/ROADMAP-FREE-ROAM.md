# ROADMAP-FREE-ROAM — gentler pests, 17 October 2026

The owner's Free Roam playtest found the bird and officer too aggressive.
Tune the existing HAVOC gull and warden, shared hit protection and shove.
No new difficulty setting, save field, visual/audio term or parameter writer.
Existing `noPests` cuts the system; the existing Free Roam gate excludes Story.
No added per-frame traversal or allocation. Spawn rows and challenge goals stay
as authored; challenge opponents use the same gentler attacks as exploration.

## R1: Give the player time to react

| Behaviour | Before | After |
| --- | ---: | ---: |
| Bird circling before an attempt | 3–5 s | 6–8 s |
| Bird target-shadow warning | 0.8 s | 1.4 s |
| Bird dive speed | 17 m/s | 12 m/s |
| Bird velocity prediction | 0.5 s | 0.2 s |
| Officer approach speed | 2.4 m/s | 1.8 m/s |
| Officer charge trigger distance | 8.5 m | 6.5 m |
| Officer net warning | 1.0 s | 1.6 s |
| Officer straight charge | 8.5 m/s, at most 1.2 s | 6 m/s, at most 1.1 s |
| Officer recovery | 1.6 s | 3.5 s |
| Protection after a hit | 1.2 s | 2.5 s |
| Maximum hit shove | 6 m/s | 4 m/s |

The shadow growth and raised-net animation span their longer warnings. The
officer resets its phase clock when recovering. A hit still costs one heart;
V still knocks pests out. There is no new damage multiplier or hidden assist.

## Validation

`qa/free-roam-pressure.mjs` uses fresh profiles, a headful browser on the GPU,
real clock ticks, real D/V keys and the existing pest placement probe. Staging
is limited to putting a pest in front of the capybara and disabling the nearby
challenge ring. It does not inject hits or advance the simulation manually.
Captures and traces are ignored files under `qa/free-roam-*.png`.

Baseline: 8 assertions passed. Officer warning/rest measured 0.974/1.623 s;
bird warning/initial circling measured 0.811/3.904 s. An ignored officer charge
cost a heart, V knocked it out, and walking sideways evaded the bird.

Tuned: 13 assertions passed. Officer warning/rest measured 1.582/3.515 s;
bird warning/initial circling measured 1.348/8.017 s (40 ms sampling and frame
quantisation). Hit events showed 2.5 s protection. The same V and sideways-walk
checks passed; Story's pest system remained inactive. Screenshots were read
for the existing net pose and the successful dodge. These are focused staged
combat checks, not a full human difficulty playthrough across nineteen places.

`node --check` passes for the edited source and instrument. `node build.mjs`
passes on both the itch release branch and the isolated GitHub Pages base.
Both complete `npm test` runs pass all 81 assertions. Existing soak reporting
is informational; no long soak was repeated for these constant changes.

## Publication

Carry the same source patch on the itch release branch and on GitHub Pages'
existing master base, without merging unrelated release or marketing work.
The GitHub Pages deployment and hosted build check follow the passing gates.
The itch.io uploads are not part of this browser-test deployment.
