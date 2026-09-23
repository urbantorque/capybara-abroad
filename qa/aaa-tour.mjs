// AAA review tour: one headful Edge, Free Roam, a still of each place after
// arrival settles. Pictures only (qa/**/*.png is ignored); no assertions.
// Usage: node qa/aaa-tour.mjs [tag] [chapter ...]
import { openHarness } from './reimagine-harness.mjs';

const tag = process.argv[2] || 'tour';
const list = process.argv.length > 3 ? process.argv.slice(3)
  : ['sydney', 'kyoto', 'venice', 'iceland', 'sahara', 'hanoi', 'palawan', 'goreme'];
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
try {
  await h.start();
  for (const c of list) {
    await h.arrive(c);
    await h.page.waitForTimeout(4000);
    await h.screenshot('aaa-' + tag + '-' + c);
    console.log('shot', c);
  }
} finally { await h.close(); }
