async page => {
  await page.evaluate(() => {
    const g = window.__capy;
    const b = g.capy.body, k = g.kowloon, inp = g.input;
    b.position.set(-19, 35.2, -8); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i=0;i<60*400;i++) {
      inp.camYaw=0; inp.x=0; inp.z=-1; inp.action=false; inp.run=false;
      g.tick(1/60,false);
      if (k.showing() && k.litTowers() >= 15) break;
    }
    window.__hk = { on:k.showing(), lit:k.litTowers(), sky:+k.skyward().toFixed(2) };
  });
  await page.waitForTimeout(600);
}
