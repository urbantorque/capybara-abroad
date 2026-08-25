async page => {
  await page.keyboard.up('KeyE');
  await page.evaluate(() => {
    const g = window.__capy;
    const b = g.capy.body, k = g.kowloon, inp = g.input;
    b.position.set(-19, 35.2, 0); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i=0;i<60*180;i++) {
      inp.camYaw=0; inp.x=0; inp.z=0; inp.action=false; inp.run=false;
      g.tick(1/60,false);
      if (k.showing() && i > 60*20) break;
    }
    window.__hk = { y:+b.position.y.toFixed(2), x:+b.position.x.toFixed(2), z:+b.position.z.toFixed(2),
                    on:k.showing(), lit:k.litTowers(), show:+k.show().toFixed(2), neon:k.neon?k.neon():null };
  });
  await page.waitForTimeout(2500);
}
