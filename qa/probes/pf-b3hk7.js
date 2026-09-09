async page => {
  await page.evaluate(() => {
    const g = window.__capy;
    const b = g.capy.body, k = g.kowloon, inp = g.input;
    b.position.set(-19, 35.2, 0); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    let best = 0;
    for (let i=0;i<60*400;i++) {
      inp.camYaw=0; inp.x=0; inp.z=0; inp.action=false; inp.run=false;
      g.tick(1/60,false);
      best = Math.max(best, k.litTowers());
      if (k.showing() && k.litTowers() >= 14) break;
    }
    window.__hk = { on:k.showing(), lit:k.litTowers(), best, show:+k.show().toFixed(2),
                    y:+b.position.y.toFixed(2) };
  });
  await page.waitForTimeout(700);
}
