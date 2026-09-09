async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const o = { trace: [] };
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('sydney');
    tick(120);
    g.capy.body.position.set(6, 1.0, 34);
    g.capy.body.velocity.set(0, 0, 0);
    tick(240);
    // ---- THE ALBUM MUST NOT LOSE A HAND-TAKEN SHOT ----------------------
    // Fill it past its own cap with rows that are NOT the game's, then sleep
    // for long enough to take a dozen of the game's, and count what survives.
    // The whole point of the tag is that this number does not move.
    o.mine0 = g.hud && g.hud.albumAudit ? g.hud.albumAudit().n : null;
    // ---- and then leave it entirely alone for twelve minutes -------------
    // Long enough for eight nap shots at ninety seconds apart, which is the
    // tagged cap, plus four more to prove the ninth evicts the first and not
    // somebody's own picture.
    const yaw0 = g.camInfo ? null : null;
    let firstAsleep = -1;
    for (let s = 0; s < 12 * 60; s++) {
      tick(60);
      if (firstAsleep < 0 && g.capy.nap > 0.9) firstAsleep = s;
      if (s % 45 === 0) {
        const d = g.napDebug();
        o.trace.push({ t: s, nap: d.nap, slept: d.slept, shots: d.shots,
                       album: d.album, tagged: d.tagged, nextIn: d.nextIn });
      }
    }
    o.firstAsleepAt = firstAsleep;
    o.end = g.napDebug();
    // ---- ...AND THE LENS TURNED --------------------------------------
    // A drift that is written and never reaches the rig is the failure this
    // whole file keeps finding. Sample the yaw over ten seconds of sleep.
    const y0 = g.camera.rotation.y;
    const px0 = g.camera.position.x, pz0 = g.camera.position.z;
    tick(600);
    o.turned = {
      dyaw: +Math.abs(g.camera.rotation.y - y0).toFixed(3),
      moved: +Math.hypot(g.camera.position.x - px0, g.camera.position.z - pz0).toFixed(2),
      clear: +g.camInfo.clear.toFixed(3),
    };
    // ---- and a key wakes it, and somebody says something -----------------
    const said = [];
    const rawSay = g.sayNear;
    g.sayNear = function (x, z, r, t) { said.push(t); return rawSay.call(g, x, z, r, t); };
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', bubbles: true }));
    tick(120);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', key: 'q', bubbles: true }));
    tick(120);
    o.wokeTo = +g.capy.nap.toFixed(3);
    o.said = said;
    g.sayNear = rawSay;
    o.lastError = g.state.lastError || null;
    return o;
  });
  await page.evaluate((o) => fetch('/shot?name=n5-nap.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
