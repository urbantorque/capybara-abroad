// WHO IS WRITING A KINEMATIC BODY'S POSITION EVERY FRAME, BY NAME.
//
// px-carriers.js counted the writes and found bodies that break CONTRACT.md's
// rule 2 ("move it with velocity, and NEVER by assigning position") in seven
// chapters. The contract names exactly three deliberate exceptions — the
// player's ferry, the balloon basket and Palawan's manta — so anything else is
// either a fourth exception nobody wrote down or a carrier that slides its
// passenger off on the first corner.
//
// Counting cannot tell you which. A STACK can: the patched setter throws a
// throwaway Error and keeps the first frame outside itself. The build strips
// comments, not function names, so the answer comes back as the name of the
// function doing the writing.
async page => {
  const CH = ['Digit1', 'Digit2', 'Digit3', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
              'Digit0', 'Equal', 'BracketLeft', 'BracketRight', 'Quote', 'Comma', 'Period'];
  const out = { chapters: [] };
  for (const key of CH) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(4200);
    await page.keyboard.press(key);
    await page.waitForTimeout(6000);
    const row = await page.evaluate(async () => {
      const g = window.__capy, K = g.CANNON.Body.KINEMATIC;
      const bodies = g.world.bodies.filter(b => b.type === K);
      const marks = bodies.map(b => {
        const rec = { setN: 0, vmax: 0, where: null };
        const p = b.position, real = p.set.bind(p);
        p.set = function (x, y, z) {
          rec.setN++;
          if (!rec.where) {
            const st = String(new Error().stack || '').split('\n');
            // [0] is "Error", [1] is this setter; [2] is the caller we want.
            rec.where = (st[2] || st[1] || '').trim().slice(0, 120);
          }
          return real(x, y, z);
        };
        rec.restore = () => { delete p.set; };
        rec.body = b;
        return rec;
      });
      const t0 = performance.now();
      await new Promise(res => {
        const id = setInterval(() => {
          for (const m of marks) {
            const v = Math.hypot(m.body.velocity.x, m.body.velocity.z);
            if (v > m.vmax) m.vmax = v;
          }
          if (performance.now() - t0 > 2500) { clearInterval(id); res(); }
        }, 33);
      });
      const secs = (performance.now() - t0) / 1000;
      const list = marks.map(m => {
        const r = { shapes: m.body.shapes.length, setHz: +(m.setN / secs).toFixed(1),
                    vmax: +m.vmax.toFixed(2), where: m.where };
        m.restore();
        return r;
      });
      // A body that MOVES and is WRITTEN is the one in question. An NPC is
      // written too, but it is not a carrier and it does not matter; the stack
      // is what separates the two.
      const writers = list.filter(x => x.vmax > 0.4 && x.setHz > 5);
      // roll up by the writing function, because thirty NPCs are one answer
      const byWhere = {};
      for (const w of writers) {
        const k = w.where || '(none)';
        if (!byWhere[k]) byWhere[k] = { n: 0, vmax: 0, shapes: w.shapes };
        byWhere[k].n++;
        if (w.vmax > byWhere[k].vmax) byWhere[k].vmax = w.vmax;
      }
      return { biome: g.biome.current, writers: writers.length, byWhere };
    });
    out.chapters.push(row);
  }
  await page.evaluate(o => fetch('/shot?name=px-carriers2.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
