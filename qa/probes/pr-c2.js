async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit1'); await page.waitForTimeout(7000);
  const r = await page.evaluate(()=>{
    const g=window.__capy;
    const gl=g.renderer.getContext();
    const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
    function profile(){
      g.tick(1/60,true);
      // project the capybara's BASE to screen
      const p = g.capy.position;
      const v = new g.THREE.Vector3(p.x, p.y - 0.42, p.z);
      v.project(g.camera);
      const sx = Math.round((v.x*0.5+0.5)*w);
      const sy = Math.round((v.y*0.5+0.5)*h);
      // a horizontal scanline 26 px BELOW the base (in front of the animal,
      // clear of its own silhouette), 480 px wide
      const y = Math.max(0, sy - 26), x0 = Math.max(0, sx - 240), ww = Math.min(480, w - x0);
      const buf = new Uint8Array(ww*4);
      gl.readPixels(x0, y, ww, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const out=[];
      for (let i=0;i<ww;i+=16){
        const R=buf[i*4],G=buf[i*4+1],B=buf[i*4+2];
        out.push(Math.round(0.2126*R+0.7152*G+0.0722*B));
      }
      return { sx, sy, prof: out };
    }
    const a = profile();
    return { biome: g.biome.current, capy: [ +g.capy.position.x.toFixed(2), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(2) ], a };
  });
  await page.evaluate((o)=>fetch('/shot?name=pr-c2.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),r);
}
