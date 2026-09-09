async page => {
  await page.keyboard.down('KeyE');
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('kowloon');
    const b = g.capy.body, k = g.kowloon, inp = g.input;
    b.position.set(-8.2, 0.4, 0); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i=0;i<60*180;i++) {
      inp.camYaw=0; inp.x=-1; inp.z=0; inp.action=true; inp.run=false;
      g.tick(1/60,false);
      if (k.showing() && i > 60*15) break;
    }
    window.__hk = { y: +b.position.y.toFixed(2), on: k.showing(), lit: k.litTowers ? k.litTowers() : null };
  });
  await page.waitForTimeout(2200);
}
