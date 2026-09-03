async page => {
  // DOES ANY HUNG THING REACH THROUGH THE FLOOR?
  //
  // Every one of the nineteen hangs off the exit board's header at
  //   pivot = boardY + topY - 0.10
  // and reaches `len` below that, so the clearance over the door's own floor is
  //   topY - 0.10 - len
  // — which is a per-chapter number only because topY and len are both
  // per-chapter. Five of the nineteen are strands two metres long and those are
  // the ones with anything to lose. Nothing in src has ever checked it.
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} });
  await page.goto('http://localhost:5188/');
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(5000);
  const ALL = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
               'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
               'cave', 'antarctic', 'monaco', 'hanoi'];
  const rows = [];
  for (let i = 0; i < ALL.length; i++) {
    await page.evaluate(n => window.__capy.biome.switchTo(n), ALL[i]);
    await wait(2600);
    rows.push(await page.evaluate(function (name) {
      const g = window.__capy;
      const b = g.exitBoard(), h = g.hangAudit();
      if (!b || !h.rows.length) return { n: name, none: true };
      const r = h.rows[0];
      return { n: name, kind: r.voice, len: r.len,
               boardY: +b.y.toFixed(2), topY: +b.topY.toFixed(2),
               pivot: r.y, bottom: +(r.y - r.len).toFixed(2),
               clear: +(r.y - r.len - b.y).toFixed(2),
               overCapy: +(r.y - r.len - b.y - 0.55).toFixed(2) };
    }, ALL[i]));
  }
  const bl = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify({ rows: o }, null, 1)))), rows);
  await page.evaluate(s => fetch('/shot?name=d10-clear.json', { method: 'POST', body: s }), bl);
}
