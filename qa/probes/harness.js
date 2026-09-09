// QA harness — loaded by hand from the console during headless playtests.
window.__qaInstall = function () {
  const g = window.__capy;
  if (window.__qaReady) return 'already';
  window.__qaReady = true;
  window.__qaErrs = [];
  const ce = console.error.bind(console);
  console.error = function (...a) { window.__qaErrs.push(a.map(x => (x && x.stack) || String(x)).join(' ')); ce(...a); };
  window.__qaGo = function (name) {
    g.biome.switchTo(name);
    const sp = g.biome.spawnOf(name), b = g.capy.body;
    b.position.set(sp.x, sp.y, sp.z);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
    g.capy.position.set(sp.x, sp.y, sp.z);
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
  };
  window.__qaPut = function (x, y, z) {
    const b = g.capy.body;
    b.position.set(x, y, z);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
    g.capy.position.set(x, y, z);
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
  };
  window.__qaRun = function (tx, tz, frames, opts) {
    let contacts = 0;
    for (let i = 0; i < frames; i++) {
      const p = g.capy.position;
      const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw);
      const dx = tx - p.x, dz = tz - p.z, len = Math.hypot(dx, dz) || 1;
      const nx = dx / len, nz = dz / len;
      g.input.x = nx * cy - nz * sy;
      g.input.z = nx * sy + nz * cy;
      g.input.action = !!(opts && opts.action);
      g.input.run = !!(opts && opts.run);
      g.tick(1 / 60, false);
      const cs = g.world.contacts;
      for (let k = 0; k < cs.length; k++) if (cs[k].bi === g.capy.body || cs[k].bj === g.capy.body) contacts++;
      if (Math.hypot(g.capy.position.x - tx, g.capy.position.z - tz) < ((opts && opts.near) || 2.0)) break;
    }
    g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false;
    const p = g.capy.position;
    return { at: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], contacts,
             depth: +(g.capy.depth || 0).toFixed(2), cam: +g.camera.position.y.toFixed(2) };
  };
  window.__qaHold = function (frames, opts) {
    for (let i = 0; i < frames; i++) {
      g.input.x = (opts && opts.x) || 0; g.input.z = (opts && opts.z) || 0;
      g.input.action = !!(opts && opts.action);
      g.input.jump = !!(opts && opts.jump);
      g.tick(1 / 60, false);
    }
    g.input.action = false; g.input.x = 0; g.input.z = 0; g.input.jump = false;
  };
  window.__qaShot = function (name) {
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280 / 760; g.camera.updateProjectionMatrix();
    for (let i = 0; i < 3; i++) g.tick(1 / 60, true);
    return fetch('/shot?name=' + name, { method: 'POST', body: g.canvas.toDataURL('image/png') }).then(() => name);
  };
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
  for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
  return 'ready';
};
