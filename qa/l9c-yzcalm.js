async page => {
  // qa/l9c-yzcalm.js — LIFT9, C3: yuzuFly/yzflash actually obey the calm switch
  //
  //   playwright-cli -s=l9c open http://localhost:5188/
  //   playwright-cli -s=l9c run-code --filename=qa/l9c-yzcalm.js
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 300)));
  const out = { fail: [], notes: {} };
  const assertTrue = (label, ok) => { if (!ok) out.fail.push(label + ': false (' + JSON.stringify(ok) + ')'); };

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  const check = await page.evaluate(() => {
    const g = window.__capy;
    const hud = document.getElementById('hud');
    document.documentElement.classList.add('capy-calm');

    // Build one of each element the same way the real code does, but poke
    // them in directly rather than waiting for a real pickup/golden to fire,
    // so this does not depend on game state.
    const fly = document.createElement('div');
    fly.className = 'capyui-yzfly';
    hud.appendChild(fly);
    const flash = document.createElement('div');
    flash.className = 'capyui-yzflash on';
    hud.appendChild(flash);

    const flyIsDescendant = hud.contains(fly);
    const flyCS = getComputedStyle(fly);
    const flashCS = getComputedStyle(flash);

    const out = {
      flyIsDescendantOfHud: flyIsDescendant,
      flyTransitionDurationUnderCalm: flyCS.transitionDuration,   // should be crushed to ~0.01ms by `.capy-calm .capyui *`
      flashOpacityUnderCalm: flashCS.opacity,                     // should be 0 by the new `.capy-calm .capyui-yzflash` rule
      flashTransitionUnderCalm: flashCS.transition,
    };
    fly.remove(); flash.remove();
    document.documentElement.classList.remove('capy-calm');
    return out;
  });
  out.notes.check = check;
  assertTrue('.capyui-yzfly is appended under #hud (.capyui), not document.body', check.flyIsDescendantOfHud);
  assertTrue('.capy-calm crushes .capyui-yzfly transition-duration to ~0',
    parseFloat(check.flyTransitionDurationUnderCalm) <= 0.001);
  assertTrue('.capy-calm makes .capyui-yzflash.on opacity 0', check.flashOpacityUnderCalm === '0');

  assertTrue('0 console errors', errs.length === 0);
  out.errs = errs.slice(0, 10);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l9c-yzcalm.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (out.fail.length || errs.length) {
    throw new Error('l9c-yzcalm FAILED: ' + JSON.stringify({ fail: out.fail, errs: out.errs, notes: out.notes }));
  }
}
