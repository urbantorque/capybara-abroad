async page => {
  // Simulate what a stranger behind a proxy, an ad-blocker, or a CDN outage sees.
  await page.route('**cdn.jsdelivr.net**', r => r.abort());
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);

  const out = await page.evaluate(() => {
    const boot = document.getElementById('boot');
    const err = document.getElementById('err');
    return {
      scenario: 'cdn blocked',
      bootStillUp: !!boot && !boot.classList.contains('hidden'),
      bootText: boot ? boot.innerText.replace(/\s+/g, ' ').trim() : null,
      errPanelShown: err ? getComputedStyle(err).display !== 'none' : null,
      errText: err ? err.textContent.slice(0, 300) : null,
      hasGame: !!window.__capy,
      hasCanvas: !!document.querySelector('canvas')
    };
  });

  await page.evaluate(o => fetch('/shot?name=v52-cdn.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
