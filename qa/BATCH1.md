# BATCH 1 — Foundation and comedy (Payoff Pass)

Started 25 Aug 2026. Model: claude-opus-5.

## Checklist

### Job 1 — baseline audit
- [ ] (a) fresh-save playthrough soak across 17 chapters; two-direction task approach; save/reload at hostile moments; act sequencing + paper
- [ ] (a) extend qa/pacing.mjs, qa/audit-tasks.mjs, qa/lines.mjs, qa/fuzz.js
- [ ] (b) solidity/phasing/NPC health ch14-17 + spot 1-3 (audit-solid.js, npchealth.js), live-biome gated
- [ ] fixes applied + committed

### Job 2 — the mischief economy
- [ ] Ownership: local retrieves taken/knocked prop; HARD CEILING on the state
- [ ] Produce: grazing someone's produce -> line + shoo
- [ ] Chains: one witness draws a second look
- [ ] Wind: gust can blow a light prop across a square (turbulent kick + speed cap)
- [ ] Adoption: >= 2 authored reaction chains per chapter (17 x 2)

### Job 3 — stillness as a verb
- [ ] auto-loaf on capyRestT (NOT capyStillT)
- [ ] sit posture, camera eases wider, musCalm swells
- [ ] critter registry INVERTS past calm threshold, per species
- [ ] Iceland hot-spring soak marquee adoption

### Finish
- [ ] CONTRACT.md new version section
- [ ] qa audits for new invariants
- [ ] project memory
- [ ] qa/BATCH1.md handover
- [ ] playwright-cli close-all
- [ ] chain batch 2 (VERY LAST ACTION)

## Log

### Log

- **Job 1(a)** — `qa/pf-soak.js`: a two-direction fresh-save journey through all 17
  chapters (act order and reverse). 199 tasks, 0 issues, 0 console errors both ways.
  Static audits green: `audit-tasks.mjs` 0/0 over 199, `lines.mjs` 0/0 over 426
  conditional lines, `pacing.mjs` 1 ordinary task short of band (Kyoto) — unchanged.
- **Job 1(a)** — `qa/pf-restore.js`: save/reload at mid-act, mid-carrier, mid-dive,
  mid-ceremony. FOUND AND FIXED: the save debounce aged on the SCALED dt, so a marquee
  tick wrote at 1046 ms against a spec of 700 (713/719 after). `qa/pf-savelag.js`.
- **Job 1(b)** — solidity 14-17 + 1-3: no new bugs. Everything left is on the
  cry-wolf list (instanced vegetation, the terrain shell, the sky dome) or is the
  Manly flag, which is a 5.5 cm pole you are meant to pick up.
  `qa/audit-solid.js` now prints an identity that survives a reload.
- **Job 1(b)** — `qa/pf-npchealth.js`: locals audited for the first time (fifteen
  chapters' entire population). All live-gated. 0 drift, 0 body desync, 0 sunk after
  the gate was corrected.
- **Job 2** — the mischief economy landed. See the commit and CONTRACT v23.
