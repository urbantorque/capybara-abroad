// Cold-process startup evidence, not proof an intermittent crash cannot recur.
import assert from 'node:assert/strict';
import { freemem } from 'node:os';
import { openHarness } from './reimagine-harness.mjs';

const tag = process.argv[2] || 'v1';
assert.match(tag, /^[\w.-]+$/);
const report = { at: new Date().toISOString(), scope: 'Six sequential fresh owned Edge processes, real start and movement; no retries or production changes.', rows: [] };
let failed = false;
for (let cycle = 1; cycle <= 6; cycle++) {
  let h;
  const row = { cycle, freeBytes: freemem(), stage: 'launch', metadata: null };
  report.rows.push(row);
  try {
    h = await openHarness({ pinRung: false, story: true });
    row.metadata = h.metadata;
    row.stage = 'trusted-start'; await h.start();
    row.stage = 'movement'; await h.hold('w', 1500);
    await h.hold('d', 1000);
    row.state = await h.page.evaluate(() => ({
      started: window.__capy.state.started, hidden: document.hidden,
      focused: document.hasFocus(), time: window.__capy.state.time,
      position: window.__capy.capy.body.position.toArray()
    }));
    assert.equal(row.state.started, true);
    assert.equal(row.state.hidden, false);
    assert.equal(row.state.focused, true);
    assert.ok(row.state.position.every(Number.isFinite));
    assert.equal(h.metadata.errors.length, 0);
    row.stage = 'passed';
  } catch (error) {
    row.metadata ||= error.harnessMetadata || null;
    row.error = String(error.stack || error); failed = true;
  } finally {
    if (h) await h.close();
    const response = await fetch('http://localhost:5188/shot?name=homecoming-startup-' + tag + '.json', {
      method: 'POST', body: Buffer.from(JSON.stringify(report, null, 2)).toString('base64'),
      signal: AbortSignal.timeout(20000)
    });
    assert.ok(response.ok, 'driver-side evidence persists even after a crash');
  }
  console.log(JSON.stringify({ cycle, stage: row.stage, errors: row.metadata?.errors, error: row.error }));
  if (failed) break;
}
process.exitCode = failed ? 1 : 0;
