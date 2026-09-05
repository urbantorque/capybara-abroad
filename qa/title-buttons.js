async page => {
  const out = {};
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5188/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);

  // tab order, from the top of the card
  out.tab = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    out.tab.push(await page.evaluate(() => {
      const a = document.activeElement;
      return a ? (a.tagName + '.' + (a.className || '') + ':' + a.textContent.trim().slice(0, 18)) : 'none';
    }));
  }
  // filled vs outline: exactly one accent-filled control on the page
  out.filled = await page.evaluate(() => {
    const acc = getComputedStyle(document.documentElement);
    return [...document.querySelectorAll('.capyui-p1 button')].filter(b => b.offsetParent)
      .map(b => ({ t: b.textContent.trim().slice(0, 18),
        bg: getComputedStyle(b).backgroundColor,
        filled: getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)' }));
  });

  // the outline button turns the page and does not start the game
  await page.click('.capyui-go.alt');
  await page.waitForTimeout(1200);
  out.afterChoose = await page.evaluate(() => ({
    started: window.__capy.state.started,
    page2: !document.querySelector('.capyui-p2').hidden,
  }));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  out.afterBack = await page.evaluate(() => ({
    focused: document.activeElement ? document.activeElement.textContent.trim().slice(0, 18) : 'none',
    page1: !document.querySelector('.capyui-p1').hidden,
  }));

  // and the filled one starts it
  await page.click('.capyui-go:not(.alt)');
  await page.waitForTimeout(2500);
  out.afterBegin = await page.evaluate(() => ({
    started: window.__capy.state.started,
    biome: window.__capy.biome ? window.__capy.biome.current : '',
  }));
  await page.evaluate(o => fetch('/shot?name=tbn.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
