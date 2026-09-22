import { openHarness } from './reimagine-harness.mjs';

const chapters = ['sydney', 'kyoto', 'hanoi', 'palawan', 'iceland'];
const tag = process.argv[2];
if (!tag || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(tag)) {
  throw new Error('Usage: node qa/homecoming-art-review.mjs <safe-tag>');
}

let harness;
try {
  harness = await openHarness();
  await harness.start();
  for (const chapter of chapters) {
    await harness.arrive(chapter);
    const sample = await harness.page.evaluate(() => {
      const game = window.__capy;
      return {
        chapter: game.biome.current,
        focus: document.hasFocus(),
        hidden: document.hidden,
        lastError: game.state.lastError || null,
        camera: {
          position: game.camera.position.toArray(),
          quaternion: game.camera.quaternion.toArray(),
          fov: game.camera.fov,
        },
        perfRung: game.state.perfRung,
        renderer: {
          calls: game.renderer.info.render.calls,
          triangles: game.renderer.info.render.triangles,
          points: game.renderer.info.render.points,
        },
      };
    });
    await harness.screenshot(`homecoming-art-review-${tag}-${chapter}`);
    await harness.result(`homecoming-art-review-${tag}-${chapter}`, {
      ...sample,
      runtimeErrors: harness.metadata.errors,
    });
    if (sample.lastError || harness.metadata.errors.length) {
      throw new Error(`Runtime error at ${chapter}: ${sample.lastError || harness.metadata.errors[0].message}`);
    }
  }
} finally {
  if (harness) await harness.close();
}
