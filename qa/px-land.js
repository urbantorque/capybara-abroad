async page => {
  const out = [];
  for (const [w, h] of [[844, 390], [740, 360], [390, 844], [1280, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(500);
    const r = await page.evaluate(o => {
      document.querySelector('.capyui-touch').classList.add('on');
      const box = (s) => { const e = document.querySelector(s); if (!e) return null;
        const b = e.getBoundingClientRect();
        return { s, top: Math.round(b.top), bottom: Math.round(b.bottom),
                 right: Math.round(innerWidth - b.right) }; };
      const l = box('.capyui-look'), m = box('.capyui-menu'), k = box('.capyui-back');
      const fan = ['.capyui-slide', '.capyui-wheek', '.capyui-grab', '.capyui-hop'].map(box);
      const lb = document.querySelector('.capyui-look').getBoundingClientRect();
      const clash = fan.filter(f => { const e = document.querySelector(f.s).getBoundingClientRect();
        return !(e.right < lb.left || e.left > lb.right || e.bottom < lb.top || e.top > lb.bottom); })
        .map(f => f.s);
      return { vp: o, look: l, menu: m, stuck: k, fits: l.bottom <= innerHeight, clash };
    }, [w, h]);
    out.push(r);
  }
  await page.evaluate(o => fetch('/shot?name=px-land.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
