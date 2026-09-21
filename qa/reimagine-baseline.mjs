// One chapter per invocation: node qa/reimagine-baseline.mjs sydney [tag].
// Fresh headed browser each time, with screenshots and ignored JSON evidence.
import { openHarness, snapshot, measureTicks, CHAPTERS } from './reimagine-harness.mjs';

const chapter = process.argv[2] || 'sydney';
if (!CHAPTERS.includes(chapter)) throw new Error('Unknown chapter: ' + chapter);
const tag = process.argv[3] || 'baseline';
if (!/^[\w.-]+$/.test(tag)) throw new Error('Tag must not contain a path.');
const name = 'reimagine-' + tag + '-' + chapter;
const h = await openHarness();
try {
  await h.start();
  await h.arrive(chapter);
  await h.page.waitForTimeout(2500);
  const arrival = await snapshot(h.page);
  await h.screenshot(name + '-arrival');
  const performance = await measureTicks(h.page);
  await h.hold('w', 700);
  const afterWalk = await snapshot(h.page);
  await h.screenshot(name + '-walk');
  const movement = Math.hypot(afterWalk.position.x - arrival.position.x, afterWalk.position.z - arrival.position.z);
  await h.page.setViewportSize({ width: 800, height: 760 });
  await h.page.waitForTimeout(500);
  const narrow = await snapshot(h.page);
  await h.screenshot(name + '-narrow');
  const out = { ...h.metadata, chapter, arrival, performance, afterWalk, movement, narrow };
  await h.result(name, out);
  console.log(JSON.stringify({ artifact: 'qa/' + name + '.json.png', chapter,
    renderer: h.metadata.renderer, performance, movement, errors: h.metadata.errors }, null, 2));
  if (h.metadata.errors.length || arrival.lastError || afterWalk.lastError) process.exitCode = 1;
} finally { await h.close(); }
