async page => {
  await page.waitForTimeout(4000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    await fetch('/shot?name=b4fz-boot.json', { method: 'POST', body: btoa(JSON.stringify({ started: !!window.__capy.state.started, biome: window.__capy.biome.current })) })
  });
}
