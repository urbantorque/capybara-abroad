// ROADMAP-REIMAGINE E1: one live hardware session, pinned camera, hide-and-diff.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openHarness, measureTicks } from './reimagine-harness.mjs';

const require = createRequire(import.meta.url);
const { PNG } = require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs'));
const h = await openHarness();
try {
  await h.start();
  await h.page.waitForTimeout(12000);
  const frames = {};
  const performance = [];
  // Alternate order to expose warm-up bias; CPU submission, not GPU queries.
  for (const cut of [true, false, false, true]) {
    await h.page.evaluate(cut => { window.__capy.state.noLawnComposition = cut; }, cut);
    await h.page.waitForTimeout(500);
    performance.push({ cut, ...await measureTicks(h.page, 2500) });
  }
  await h.page.evaluate(() => {
    const g = window.__capy;
    window.__lawnTick = g.tick;
    g.tick = () => {};
    window.__lawnCamera = g.camera.clone();
  });
  await h.page.addStyleTag({ content: '* { animation-play-state: paused !important; transition: none !important; }' });
  const audit = {};
  for (const [name, cut, grass] of [
    ['before', true, true], ['before-ground', true, false],
    ['after', false, true], ['after-ground', false, false],
  ]) {
    audit[name] = await h.page.evaluate(({ cut, grass }) => {
      const g = window.__capy;
      g.state.noLawnComposition = cut;
      g.env.update(0); g.grass.update(0);
      for (let i = 0; i < 8 && g.grass.audit().compositionPending; i++) g.grass.update(0);
      g.scene.getObjectByName('grsField').visible = grass;
      g.camera.copy(window.__lawnCamera); g.camera.updateMatrixWorld();
      g.post.render();
      return { ground: g.env.lawnAudit(), grass: g.grass.audit() };
    }, { cut, grass });
    frames[name] = PNG.sync.read(await h.screenshot('reimagine-lawn-' + name));
  }
  const { width, height } = frames.before;
  const difference = (a, b, i) => Math.max(...[0, 1, 2].map(c => Math.abs(a.data[i * 4 + c] - b.data[i * 4 + c])));
  let grassMask = 0, grassChanged = 0, lawnPixels = 0, lawnChanged = 0;
  // Central lower field excludes paper, map and dialogue. The grass mask is
  // the union of actual hidden-vs-visible grass in the exact same scene.
  for (let y = Math.floor(height * .50); y < height * .78; y++) {
    for (let x = Math.floor(width * .27); x < width * .80; x++) {
      const i = y * width + x;
      const mask = difference(frames.before, frames['before-ground'], i) > 4 ||
        difference(frames.after, frames['after-ground'], i) > 4;
      if (mask) {
        grassMask++;
        if (difference(frames.before, frames.after, i) > 4) grassChanged++;
      }
      lawnPixels++;
      if (difference(frames['before-ground'], frames['after-ground'], i) > 4) lawnChanged++;
    }
  }
  assert.ok(grassMask > 100, 'actual grass mask has visible pixels');
  assert.ok(grassChanged > 100, 'composition changes visible grass within its mask');
  assert.ok(lawnChanged > 100, 'ground layer changes the lower field');
  const parking = await h.page.evaluate(() => {
    const g = window.__capy;
    g.state.noLawnComposition = false; g.state.perfRung = 1;
    g.env.update(0); g.grass.update(0);
    const out = { ground: g.env.lawnAudit(), grass: g.grass.audit() };
    g.state.perfRung = 0; g.tick = window.__lawnTick;
    return out;
  });
  assert.equal(parking.ground.live, false, 'ground parks at rung one');
  assert.equal(parking.grass.compositionActive, false, 'grass parks at rung one');
  const out = { metadata: h.metadata, audit, performance, parking,
    pixels: { grassMask, grassChanged, lawnPixels, lawnChanged },
    note: 'Pixel differences prove contribution, not aesthetic quality. Inspect paired PNGs.' };
  await h.result('reimagine-lawn', out);
  console.log(JSON.stringify({ pixels: out.pixels, performance, errors: h.metadata.errors }, null, 2));
  assert.equal(h.metadata.errors.length, 0, 'no runtime errors');
} finally { await h.close(); }
