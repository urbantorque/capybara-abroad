async page => {
  await page.waitForTimeout(2000);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = {};
  // A. THE RANKING, over hand-written rings. The question is never "does it
  //    match" — it is "does the RIGHT one win", and a table of thirty-six
  //    patterns has thirty-six chances to be beaten by something vaguer.
  out.rank = await page.evaluate(() => {
    const g = window.__capy;
    const E = (k, t) => ({ k: k, t: t });
    const cases = [
      ['three hats',            [E('bang', 'hat'), E('bang', 'hat'), E('bang', 'hat')]],
      ['coffee spilt + two',    [E('spill', 'coffee'), E('bang', 'bin'), E('bang', 'cone')]],
      ['two spills, one coffee', [E('spill', 'coffee'), E('spill', 'chips'), E('bang', 'bin')]],
      ['broken camera',         [E('break', 'camera'), E('bang', 'bin'), E('bang', 'cone')]],
      ['break + theft',         [E('break', 'mug'), E('theft', 'hat'), E('bang', 'bin')]],
      ['three in the water',    [E('water', 'bin'), E('water', 'cone'), E('water', 'sign')]],
      ['three bins',            [E('bang', 'bin'), E('bang', 'bin'), E('bang', 'bin')]],
      ['three kinds',           [E('bang', 'bin'), E('spill', 'chips'), E('water', 'cone')]],
      ['four kinds',            [E('bang', 'bin'), E('spill', 'chips'), E('water', 'cone'), E('theft', 'hat')]],
      ['five kinds',            [E('bang', 'bin'), E('spill', 'chips'), E('water', 'cone'), E('theft', 'hat'), E('break', 'mug')]],
      ['ball + towel + one',    [E('bang', 'ball'), E('bang', 'towel'), E('bang', 'thong')]],
      ['basket + esky + one',   [E('bang', 'basket'), E('bang', 'esky'), E('bang', 'bin')]],
      ['one bang only',         [E('bang', 'bin')]],
      ['two bangs',             [E('bang', 'bin'), E('bang', 'cone')]],
      ['three different props', [E('bang', 'bin'), E('bang', 'cone'), E('bang', 'sign')]],
      ['sign + sign + cone + cone', [E('bang', 'sign'), E('bang', 'sign'), E('bang', 'cone'), E('bang', 'cone')]],
    ];
    return cases.map(([label, ring]) => {
      const r = g.repDebug(ring);
      return { label, got: r.name, id: r.id, alsoMatched: r.all.map(a => a.id + '/' + a.s) };
    });
  });
  // B. THE SAME RING IN A LOCKED CHAPTER, which must outrank the neutral name.
  out.locked = await page.evaluate(async () => {
    const g = window.__capy;
    const E = (k, t) => ({ k: k, t: t });
    const ring = [E('water', 'bin'), E('water', 'cone'), E('bang', 'sign')];
    const rows = [];
    for (const nm of ['quay', 'venice', 'monaco', 'goreme', 'hanoi']) {
      g.biome.switchTo(nm);
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
      rows.push({ b: nm, name: g.repDebug(ring).name });
    }
    return rows;
  });
  // C. THE WHOLE TABLE, so a pattern nothing can ever reach is visible.
  out.table = await page.evaluate(() => window.__capy.repDebug().n);
  await page.evaluate((o) => fetch('/shot?name=q1-match.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
