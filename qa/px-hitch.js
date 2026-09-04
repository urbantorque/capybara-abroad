// DOES A VELOCITY-ONLY CARRIER LOSE GROUND UNDER A HITCH?
//
// The shelf says velocity-only carriers "drift at refresh rates other than
// 60 Hz, because cannon integrates them for STEP per substep and the velocity
// is derived from the frame dt". That mechanism is wrong: main.js calls the
// three-argument `world.step(1/60, dt, 5)`, so cannon owns an accumulator and
// the integrated time equals the elapsed time. At 144 Hz the body travels
// exactly as far per second as its target does.
//
// What can break it is a frame longer than five substeps — 83 ms. Past that the
// world under-steps on purpose ("run slow rather than tunnel"), so the body
// travels less than the elapsed time's worth, while the carrier's own
// bookkeeping advances by the full dt and CONTRACT.md rule 3 forbids looking at
// the body to notice. The error is never seen and never corrected.
//
// ---- WHAT THE FIRST VERSION OF THIS PROBE GOT WRONG -----------------------
// It compared `lap()` — the ridden car's route position — against a body it
// picked separately as "the fastest kinematic body", which is not necessarily
// the same car; and `lap()` wraps modulo the lap length. It reported a
// shortfall of -6.997 m on a CLEAN run, which is not a small error, it is a
// meaningless one.
//
// This version never leaves one body. It integrates the velocity the chapter
// COMMANDED — sampling wall-clock so a stalled interval contributes its whole
// gap — and compares it with the distance that same body actually covered.
// Commanded minus actual is the accumulation, in metres, and it is zero on a
// clean run by construction.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Period');            // 18 = monaco
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);

  const run = async (stallMs) => page.evaluate(async (ms) => {
    const g = window.__capy;
    const cars = g.world.bodies.filter(b => b.type === g.CANNON.Body.KINEMATIC &&
      Math.hypot(b.velocity.x, b.velocity.z) > 2.5);
    if (!cars.length) return null;
    cars.sort((x, y) => Math.hypot(y.velocity.x, y.velocity.z) - Math.hypot(x.velocity.x, x.velocity.z));
    const car = cars[0];                          // ONE body, held for the whole run
    let commanded = 0, actual = 0, worstDt = 0;
    let px = car.position.x, pz = car.position.z;
    let tPrev = performance.now();
    const t0 = tPrev;
    await new Promise(res => {
      let stalled = false;
      const id = setInterval(() => {
        const now = performance.now();
        const dt = (now - tPrev) / 1000;
        tPrev = now;
        if (dt > worstDt) worstDt = dt;
        // the speed the chapter is asking this body to travel at, over the
        // wall-clock gap since the last sample — the stall's gap included
        commanded += Math.hypot(car.velocity.x, car.velocity.z) * dt;
        actual += Math.hypot(car.position.x - px, car.position.z - pz);
        px = car.position.x; pz = car.position.z;
        if (ms && !stalled && now - t0 > 500) {
          stalled = true;
          const end = performance.now() + ms;
          while (performance.now() < end) { /* block the main thread */ }
        }
        if (now - t0 > 2000) { clearInterval(id); res(); }
      }, 16);
    });
    return { secs: +((performance.now() - t0) / 1000).toFixed(3),
             commanded: +commanded.toFixed(3), actual: +actual.toFixed(3),
             lost: +(commanded - actual).toFixed(3),
             worstFrame: +worstDt.toFixed(3) };
  }, stallMs);

  out.clean1 = await run(0);
  await page.waitForTimeout(800);
  out.hitch300 = await run(300);
  await page.waitForTimeout(800);
  out.clean2 = await run(0);
  await page.waitForTimeout(800);
  out.hitch600 = await run(600);
  await page.evaluate(o => fetch('/shot?name=px-hitch.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
