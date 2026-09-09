// DID ANYBODY PUT AN UMBRELLA UP?
//
// Photographs a local, in the rain, from the distance the player actually
// stands at. The whole point of the NPC half of this pass is a thing you can
// SEE from six metres, so it is verified with a picture and not with a number
// — the number would say `umb: 0.98` whether or not the canopy was inside the
// person's skull.
window.__wxLocals = async function (biome, idx, secs, shot) {
  const g = window.__capy, W = g.weather;
  g.state.started = true;
  g.renderer.setSize(1100, 660, false);
  g.camera.aspect = 1100 / 660; g.camera.updateProjectionMatrix(); g.post.resize();
  g.biome.switchTo(biome);
  for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
  const L = g.locals.filter(r => r.biome === biome && r.fig);
  const t = L[idx % L.length];
  // Stand the animal a short way off, on the local's own ground height, and
  // point the rig at them. Written through previousPosition/interpolatedPosition
  // as the contract requires for a teleport, or the render smears from wherever
  // it was.
  const b = g.capy.body;
  const gy = t.y + 1.2;
  b.position.set(t.x + 4.2, gy, t.z + 4.2);
  b.velocity.set(0, 0, 0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  g.input.camYaw = Math.atan2(4.2, 4.2) + Math.PI;
  W.set(biome, { rain: { odds: 1, peak: 0.72, hold: secs * 2.6, gap: 1 } });
  for (let i = 0; i < 60 * secs; i++) g.tick(1 / 60, false);
  g.tick(1 / 60, true);
  await fetch('/shot?name=' + shot, { method: 'POST',
    body: g.renderer.domElement.toDataURL('image/png') });
  return { biome: biome, rain: +W.drizzle().toFixed(2), gust: +Math.hypot(W.gust().x, W.gust().z).toFixed(1),
           local: { x: +t.x.toFixed(1), z: +t.z.toFixed(1) },
           umb: +t.umb.toFixed(2), umbVisible: !!(t.umbG && t.umbG.visible),
           huddle: +t.hud.toFixed(2), look: +t.look.toFixed(2),
           lean: +t.group.rotation.x.toFixed(3),
           capy: [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)] };
};
