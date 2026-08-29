async page => {
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(6000);
  await page.evaluate(() => {
    const g = window.__capy;
    const h = g.quay.boat.helm;
    g.capy.body.position.set(h.x, h.y + 0.4, h.z);
    g.capy.body.velocity.set(0, 0, 0);
  });
  await page.waitForTimeout(600);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'qa/CAM-helm-berth.png' });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(7000);
  await page.screenshot({ path: 'qa/CAM-helm-ahead.png' });
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'qa/CAM-helm-turn.png' });
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(9000);
  await page.screenshot({ path: 'qa/CAM-helm-open.png' });
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'qa/CAM-helm-stopped.png' });
  // ...and step off the wheel: the deck camera, which had the same fault
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'qa/CAM-deck-stood.png' });
}
