async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  // The candidate gift per chapter: something already in that chapter's own
  // palette wherever one reads as the regular's, and the snack where nothing
  // does. A type is global, so the question is not "does it exist" but "does
  // it spawn, settle, and can it be picked up, HERE".
  const PICK = { quay: 'ticket', kyoto: 'dango', cali: 'cuencobowl', rio: 'snack',
    iceland: 'sandwich', sahara: 'cuencobowl', drift: 'mug', venice: 'winebottle',
    kowloon: 'chips', palawan: 'basket', goreme: 'mug', manly: 'towel',
    pantanal: 'hat', cave: 'mug', antarctic: 'mug', monaco: 'sunglasses',
    hanoi: 'phobowl' };
  const rows = [];
  for (const nm of Object.keys(PICK)) {
    rows.push(await page.evaluate(async (a) => {
      const [nm, kind] = a;
      const g = window.__capy;
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      g.biome.switchTo(nm);
      tick(90);
      const f = g.palAudit().found.filter(x => x.b === nm)[0];
      if (!f) return { biome: nm, kind, err: 'no regular' };
      const rec = (g.locals || []).filter(l => l.biome === nm &&
        Math.abs(l.x - f.x) < 0.2 && Math.abs(l.z - f.z) < 0.2)[0];
      let p = null, err = null;
      try { p = g.physics.spawnProp(kind, rec.x + 1.2, rec.z + 0.6, rec.y); }
      catch (e) { err = String(e); }
      if (!p) return { biome: nm, kind, err: err || 'spawnProp returned null' };
      const y0 = p.body.position ? +p.body.position.y.toFixed(2) : null;
      tick(60 * 6);
      const gy = (g[nm] && g[nm].terrainHeight) ? g[nm].terrainHeight(p.body.position.x, p.body.position.z) : 0;
      return { biome: nm, kind, y0, err,
               y: +p.body.position.y.toFixed(2), ground: +gy.toFixed(2),
               above: +(p.body.position.y - gy).toFixed(2),
               grabbable: !!p.grabbable,
               name: p.name,
               mass: p.mass,
               moved: +Math.hypot(p.body.position.x - (rec.x + 1.2), p.body.position.z - (rec.z + 0.6)).toFixed(1),
               owner: !!p.owner };
    }, [nm, PICK[nm]]));
  }
  await page.evaluate((o) => fetch('/shot?name=o2-gift.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
