// Monaco town-only layout comparison. It renders a frozen geometry diagnostic,
// not the authored beauty view; no production or save state is changed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { openHarness } from './reimagine-harness.mjs';

const tag = process.argv[2] || 'v1';
assert.match(tag, /^[\w.-]+$/, 'safe artifact tag');
const workSource = readFileSync(new URL('../src/monaco.js', import.meta.url), 'utf8');
const baseSource = execFileSync('git', ['show', '50083ad:src/monaco.js'], { encoding: 'utf8' });
function extractFunction(source, name) {
  const at = source.indexOf('function ' + name + '('); assert(at >= 0, name + ' exists');
  const open = source.indexOf('{', at); let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(at, i + 1);
  }
  throw Error('unterminated ' + name);
}
function constText(source, name, end = '\n];') {
  const at = source.indexOf('const ' + name + ' ='); assert(at >= 0, name + ' exists');
  const stop = source.indexOf(end, at); assert(stop > at, name + ' ends');
  return source.slice(at, stop + end.length);
}
const trackText = constText(workSource, 'monTRACK');
const halfText = workSource.match(/const monTRACK_HALF\s*=\s*[\d.]+;/)[0];
const townText = constText(workSource, 'monTOWN');
const townFn = extractFunction(workSource, 'monTownRoadClear');
const { monTOWN, monTownRoadClear } = vm.runInNewContext(
  trackText + '\n' + halfText + '\n' + townText + '\n' + townFn + '\n({ monTOWN, monTownRoadClear })');
const removed = monTOWN.filter(t => !monTownRoadClear(t));
assert.equal(removed.length, 11, 'working source removes the authored eleven');
function patchTown(source) {
  const fn = extractFunction(source, 'monBuildTown');
  const patched = fn.replace('  root.add(m);', '  m.name = \'qa-town\';\n  root.add(m);');
  assert.notEqual(patched, fn, 'town diagnostic patch applied');
  return source.replace(fn, patched);
}

async function runVariant(source, label, keep = false) {
  const h = await openHarness({ pinRung: false });
  try {
    await h.page.route('**/src/monaco.js', route => route.fulfill({ contentType: 'text/javascript', body: patchTown(source) }));
    await h.page.reload({ waitUntil: 'load' });
    await h.page.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-go'));
    await h.start(); await h.arrive('monaco'); await h.page.bringToFront();
    const full = await h.screenshot('homecoming-monaco-layout-' + tag + '-' + label + '-full');
    await h.page.addStyleTag({content:'body > :not(canvas) { visibility:hidden !important; }'});
    const diag = await h.page.evaluate(async removedRows => {
      const THREE = await import('three');
      const g = window.__capy, town = g.scene.getObjectByName('qa-town');
      if (!town) throw Error('qa-town not found');
      const saved = [];
      g.scene.traverse(o => { saved.push([o, o.visible]); o.visible = false; });
      for (let p = town; p; p = p.parent) p.visible = true;
      town.traverse(o => {
        if (!o.isMesh) return;
        o.material = new THREE.MeshBasicMaterial({ vertexColors: !!o.geometry.getAttribute('color'), fog: false });
      });
      const cam = new THREE.PerspectiveCamera(50, 1280 / 760, 0.1, 1000);
      cam.position.set(160, 180, -220); cam.lookAt(0, 25, 40); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      g.tick = () => {};
      const rects = removedRows.map(t => {
        const c = Math.cos(t[5]), s = Math.sin(t[5]), x0 = t[2] * 0.5 + 3, z0 = t[3] * 0.5 + 3;
        const base = g.monaco.terrainHeight(t[0], t[1]);
        const pts = [];
        for (const x of [-x0, x0]) for (const z of [-z0, z0]) for (const y of [base - 3, base + t[4] + 3]) {
          pts.push(new THREE.Vector3(t[0] + x * c + z * s, y, t[1] - x * s + z * c).project(cam));
        }
        const xs = pts.map(p => (p.x + 1) * 640), ys = pts.map(p => (1 - p.y) * 380);
        return { x0: Math.max(0, Math.floor(Math.min(...xs))), x1: Math.min(1279, Math.ceil(Math.max(...xs))),
          y0: Math.max(0, Math.floor(Math.min(...ys))), y1: Math.min(759, Math.ceil(Math.max(...ys))) };
      });
      g.scene.background = new THREE.Color(0); g.renderer.shadowMap.enabled = false;
      g.renderer.setRenderTarget(null); g.renderer.render(g.scene, cam);
      return { rects, vertices: town.geometry?.attributes?.position?.count || 0 };
    }, removed);
    const diagnostic = await h.page.screenshot({ path: resolve('qa', 'homecoming-monaco-layout-' + tag + '-' + label + '-diagnostic.png') });
    if (!keep) await h.close();
    return { h, full, diagnostic, diag };
  } catch (e) { await h.close(); throw e; }
}

const name = 'homecoming-monaco-layout-' + tag;
let working;
try {
  const baseline = await runVariant(baseSource, 'baseline');
  working = await runVariant(workSource, 'working', true);
  const comparison = await working.h.page.evaluate(async ({ oldB64, newB64, rects }) => {
    async function pixels(b64) {
      const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
      const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      const x = c.getContext('2d'); x.drawImage(bmp, 0, 0); return x.getImageData(0, 0, bmp.width, bmp.height).data;
    }
    const a = await pixels(oldB64), b = await pixels(newB64); let changed = 0, outside = 0;
    const inside = (x, y) => rects.some(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
    for (let y = 0; y < 760; y++) for (let x = 0; x < 1280; x++) {
      const i = (y * 1280 + x) * 4, d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      if (d > 8) { changed++; if (!inside(x, y)) outside++; }
    }
    return { changed, outside, pixels: 1280 * 760 };
  }, { oldB64: baseline.diagnostic.toString('base64'), newB64: working.diagnostic.toString('base64'), rects: working.diag.rects });
  const out = { tag, removedCount: removed.length, baseline: baseline.diag, working: working.diag, comparison, diagnostic: true,
    scope: 'town geometry-only frozen render; full-world screenshots are context, not claims', pass: comparison.changed > 1000 && comparison.outside === 0 };
  assert(out.pass, 'town diff escaped mask or was too small');
  await working.h.result(name, out); console.log(JSON.stringify({ name, pass: true, comparison }));
} catch (e) {
  console.error(e.message); process.exitCode = 1;
} finally { if (working) await working.h.close(); }
