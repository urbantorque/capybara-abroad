async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  // Every ridable animal, carried out of its own chapter and into the next.
  const LEGS = [
    { from: 'venice', to: 'antarctic' },
    { from: 'goreme', to: 'venice' },
    { from: 'manly', to: 'goreme' },
    { from: 'antarctic', to: 'manly' },
    { from: 'sydney', to: 'kyoto' },
    { from: 'kyoto', to: 'sydney' },
  ];
  const rows = [];
  for (const L of LEGS) {
    const r = await page.evaluate(async (a) => {
      const g = window.__capy;
      const out = { from: a.from, to: a.to };
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      g.completeTask('gather', true);
      g.completeTask('the-crossing', true);
      // ONE AT A TIME IS A RULE, AND IT ATE THE SECOND LEG. A stowaway left
      // over from the previous leg makes `biome:leave` return early — correctly
      // — so leg two reported no stowaway against a mechanic that had one. Get
      // rid of it before the leg starts, the way a player would.
      if (g.stowDebug().kind) { g.capy.launch(0, 8, 0); tick(200); }
      g.biome.switchTo(a.from);
      tick(150);
      let k = g.herdDebug().kinds[0];
      for (let w = 0; w < 40 && (!k || !k.n || !k.first); w++) { tick(60); k = g.herdDebug().kinds[0]; }
      if (!k || !k.first) { out.err = 'nothing offered'; return out; }
      const far = a.from === 'kyoto' ? 12.0 : 1.85;
      const px = k.first.x + far * 0.71, pz = k.first.z + far * 0.71;
      const pin = () => {
        g.capy.body.position.x = px; g.capy.body.position.z = pz;
        g.capy.body.velocity.set(0, 0, 0); g.capy.body.angularVelocity.set(0, 0, 0);
      };
      g.capy.body.position.set(px, k.first.y + 0.8, pz);
      tick(1);
      for (let i = 0; i < 240; i++) { pin(); g.tick(1 / 60, false); }
      for (let w = 0; w < 5; w++) {
        pin();
        g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
        for (let i = 0; i < 30; i++) { pin(); g.tick(1 / 60, false); }
      }
      for (let i = 0; i < 60 * 26 && g.perchCount() < 1; i++) {
        pin();
        if (i > 0 && i % 600 === 0) g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
        g.tick(1 / 60, false);
      }
      // THE LOOP ABOVE BREAKS ON THE FRAME IT MOUNTS, and `perchRISE` is 0.55 s
      // of climbing after that. The stowaway will not take a passenger that is
      // still on its way up (`s.mt < 1`), which is right — travelling during
      // the climb should lose it — and it made the first run of this probe
      // report `seated: 0` and no stowaway in all six chapters against a
      // mechanic that was working.
      for (let i = 0; i < 90; i++) { pin(); g.tick(1 / 60, false); }
      out.onBefore = g.perchCount();
      out.before = g.stowDebug();
      if (!out.onBefore) { out.err = 'never mounted'; return out; }
      // ---- and now cross a border ----------------------------------------
      g.biome.switchTo(a.to);
      // `switchTo` DOES NOT MOVE THE ANIMAL — that is `biomeGo`'s job — so it
      // arrives at the previous chapter's coordinates and is as likely to be in
      // the sea as on a floor. Two of six legs then reported a stowaway that
      // survived a launch, which is CORRECT (swimming is deliberately not a
      // dismount) and reads as a broken rule. Put it on the spawn.
      const sp = g.biome.spawnOf(a.to);
      if (sp) { g.capy.body.position.set(sp.x, sp.y + 0.6, sp.z); g.capy.body.velocity.set(0, 0, 0); }
      tick(150);
      out.swim = g.capy.swimming;
      out.grounded = g.capy.grounded;
      const d = g.stowDebug();
      out.stow = d;
      out.onAfter = g.perchCount();          // must be 0: the herd does not travel
      // where is it drawn, and is it on the back
      const seat = {};
      g.capy.back(0, seat);
      const obj = g.scene.children.filter(o => o.__stowTag);
      out.seat = { x: +seat.x.toFixed(2), y: +seat.y.toFixed(2), z: +seat.z.toFixed(2) };
      out.biome = g.biome.current;
      // ...AND IT GOES WHEN THE ANIMAL LEAVES THE GROUND. A Space press is the
      // honest input and it is not a reliable one here: `switchTo` does not
      // move the capybara, so it arrives at the PREVIOUS chapter's coordinates
      // and is as likely to be in the sea as on a floor it can push off. The
      // launch is the world throwing you, which is the other half of the same
      // rule and is deterministic.
      g.capy.launch(0, 8, 0);
      tick(40);
      out.afterHop = g.stowDebug();
      tick(60 * 3);
      out.afterGone = g.stowDebug();
      try { const raw = JSON.parse(localStorage.getItem("capy3.journey.v1")||"null"); out.finds = raw && raw.finds ? raw.finds.filter(f=>/stow/.test(f)) : null; } catch(e){}
      out.lastError = g.state.lastError || null;
      return out;
    }, L);
    rows.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=n3-stow.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
