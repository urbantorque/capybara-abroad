async page => {
  await page.mouse.click(400, 400);
  await page.waitForTimeout(1500);
  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy;
    // stand perfectly still and watch the model's roll and the head's yaw
    let rollMax = 0, yawMax = 0, beats = 0, wasIdle = false;
    const model = g.capy.group.children.find(c => c.children && c.children.length);
    let last = 0;
    for (let i = 0; i < 1400; i++) {
      await sleep(20);
      // walk the tree to whatever carries the roll — the squash node's parent
      let roll = 0, yaw = 0;
      g.capy.group.traverse(o => {
        if (Math.abs(o.rotation.z) > Math.abs(roll)) roll = o.rotation.z;
        if (Math.abs(o.rotation.y) > Math.abs(yaw) && o !== g.capy.group) yaw = o.rotation.y;
      });
      if (Math.abs(roll) > rollMax) rollMax = Math.abs(roll);
      if (Math.abs(yaw) > yawMax) yawMax = Math.abs(yaw);
      const idle = Math.abs(roll) > 0.03 || Math.abs(yaw) > 0.06;
      if (idle && !wasIdle) beats++;
      wasIdle = idle;
    }
    return { rollMax: +rollMax.toFixed(3), yawMax: +yawMax.toFixed(3), beats,
             seconds: 28, lastError: g.state.lastError || null,
             grounded: g.capy.grounded };
  });
  await page.evaluate(async (o) => { await fetch('/shot?name=idlebeat.json', { method: 'POST', body: btoa(JSON.stringify(o)) }); }, out);
}
