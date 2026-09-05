async page => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5188/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1600);
  const m = await page.evaluate(() => {
    const card = document.querySelector('.capyui-card').getBoundingClientRect();
    const foot = document.querySelector('.capyui-p2 .capyui-foot').getBoundingClientRect();
    const t = document.querySelector('.capyui-title');
    return { cardH: Math.round(card.height), cardB: Math.round(card.bottom),
      footB: Math.round(foot.bottom), vh: window.innerHeight,
      scrollH: t.scrollHeight, clientH: t.clientHeight };
  });
  await page.evaluate(o => { document.title = JSON.stringify(o); }, m);
}
