async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => {
    const g = window.__capy, c = g.capy;
    // COUNT WHAT IS ACTUALLY DRAWN, not what has `visible` set on it.
    // `traverse` does not stop at an invisible node and every costume mesh is
    // `visible: true` inside a hidden group, so an `o.visible` test alone
    // reports the same number for a bare animal and a dressed one — which is
    // exactly the trap the ghost bake had to be fixed for.
    const drawn = () => {
      let n = 0;
      c.group.traverse(o => {
        if (!o.isMesh) return;
        let v = o.visible, q = o.parent;
        while (v && q) { v = q.visible; q = q.parent; }
        if (v) n++;
      });
      return n;
    };
    const IDS = ['sunhat', 'ferrycap', 'plumes', 'boater', 'snorkel', 'flycap',
                 'surfcap', 'cavehelm', 'parka', 'black-tie'];
    c.wear(null);
    const bare = drawn();
    const per = {};
    for (const id of IDS) {
      c.wear(id);
      per[id] = { worn: c.worn, drawn: drawn() };
    }
    // one at a time: after wearing all ten in a row, exactly one is up
    c.wear('parka');
    const afterAll = drawn();
    c.wear(null);
    const off = drawn();
    // an unknown id takes everything off rather than throwing
    let unknownErr = null;
    try { c.wear('no-such-costume'); } catch (e) { unknownErr = String(e); }
    const afterUnknown = { worn: c.worn, drawn: drawn() };
    // the ghost must bake the ANIMAL, and must put the costume back after
    c.wear('cavehelm');
    let ghostErr = null;
    try { c.ghost.show(0, 0, 0, 0, 1); c.ghost.hide(); } catch (e) { ghostErr = String(e); }
    const afterGhost = { worn: c.worn, drawn: drawn(), ghostOn: c.ghost.on() };
    c.wear(null);
    return { bare, per, afterAll, off, unknownErr, afterUnknown, ghostErr, afterGhost,
             err: g.state.lastError || null };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=wearsmoke.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, r);
}
