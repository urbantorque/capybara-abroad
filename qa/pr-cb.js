async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit1'); await page.waitForTimeout(7000);
  const r = await page.evaluate(()=>{
    const g=window.__capy, gl=g.renderer.getContext();
    const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
    const V=g.THREE.Vector3;
    const v=new V().copy(g.capy.position).project(g.camera);
    const cx=Math.round((v.x*0.5+0.5)*w), cy=Math.round((v.y*0.5+0.5)*h);
    const R=150;
    const x0=Math.max(0,Math.min(w-2*R,cx-R)), y0=Math.max(0,Math.min(h-2*R,cy-R));
    const ww=2*R, hh=2*R;
    const A=new Uint8Array(ww*hh*4), B=new Uint8Array(ww*hh*4);
    const NR=6, band=R/NR;
    function rings(){
      g.state.noContact=false; g.tick(0,true); gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,A);
      g.state.noContact=true;  g.tick(0,true); gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,B);
      g.state.noContact=false;
      const s=new Array(NR).fill(0);
      for(let py=0;py<hh;py++) for(let px=0;px<ww;px++){
        const i=(py*ww+px)*4;
        const dx=(x0+px)-cx, dy=(y0+py)-cy;
        const rr=Math.sqrt(dx*dx+dy*dy);
        const k=Math.floor(rr/band); if(k>=NR) continue;
        const d=(0.2126*B[i]+0.7152*B[i+1]+0.0722*B[i+2])-(0.2126*A[i]+0.7152*A[i+1]+0.0722*A[i+2]);
        if(d>1.5) s[k]+=d;
      }
      return s.map(x=>Math.round(x/100));
    }
    const out={ringPx:Math.round(band), camY:+g.camera.position.y.toFixed(2)};
    const by=g.capy.body.position.y;
    out.rest=rings();
    const lifts=[0.8,1.4,2.5];
    for(let i=0;i<lifts.length;i++){
      g.capy.body.position.y=by+lifts[i]; g.capy.body.velocity.set(0,0,0);
      out['lift'+lifts[i]]=rings();
    }
    g.capy.body.position.y=by;
    out.back=rings();
    out.camY2=+g.camera.position.y.toFixed(2);
    return out;
  });
  await page.evaluate((o)=>fetch('/shot?name=pr-cb.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),r);
}
