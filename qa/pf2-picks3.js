async page => {
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => new Promise(r => setTimeout(r, 1600)));
  const r = await page.evaluate(() => ({
    shots: document.querySelectorAll('.capyui-pickshot').length,
    visible: !!document.querySelector('.capyui-pickshot') &&
             document.querySelector('.capyui-pickshot').getBoundingClientRect().width > 0,
    natural: document.querySelector('.capyui-pickshot')
      ? document.querySelector('.capyui-pickshot').naturalWidth : 0
  }));
  await page.evaluate(o => fetch('/shot?name=pf2-picks3.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), r);
}
