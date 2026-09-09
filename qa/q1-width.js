async page => {
  // THE LONGEST NAME ON THE NARROWEST LAYOUT, which is the roadmap's own
  // fourth premise and the touch pass's rule: measure it before writing the
  // thirty-sixth name, not after. The card is capped at min(86vw,520px) and
  // the name sets at clamp(14px,3.6vw,25px) bold — so the question is whether
  // "THE GONDOLIER'S FAREWELL" wraps to three lines, or overflows the card, at
  // a phone width.
  await page.waitForTimeout(1500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = { sizes: [] };
  const NAMES = ["THE GONDOLIER'S FAREWELL", 'THE SMASH AND GRAB', 'THE FLAT WHITE',
                 'BUTTERFINGERS', 'THE LOT'];
  for (const [w, h] of [[360, 740], [430, 932], [768, 1024], [1280, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(500);
    const rows = await page.evaluate((names) => {
      const g = window.__capy;
      const card = document.querySelector('.capyui-moment');
      const kick = card.querySelector('.capyui-momentkick');
      const text = card.querySelector('.capyui-momenttext');
      const note = card.querySelector('.capyui-momentnote');
      const res = [];
      for (const nm of names) {
        kick.textContent = 'AN INCIDENT';
        text.textContent = nm;
        note.textContent = 'One of those is an accident. Three is a decision.';
        note.style.display = '';
        card.classList.add('show');
        const cs = getComputedStyle(text);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.12;
        const r = text.getBoundingClientRect();
        const cr = card.getBoundingClientRect();
        res.push({ name: nm, lines: Math.round(r.height / lh),
                   fs: +parseFloat(cs.fontSize).toFixed(1),
                   textW: Math.round(r.width), cardW: Math.round(cr.width),
                   cardH: Math.round(cr.height),
                   overflowsCard: r.width > cr.width + 1,
                   offScreen: cr.left < 0 || cr.right > innerWidth + 1 });
      }
      card.classList.remove('show');
      return res;
    }, NAMES);
    out.sizes.push({ w, h, rows });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate((o) => fetch('/shot?name=q1-width.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
