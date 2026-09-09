async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit1'); await page.waitForTimeout(7000);
  const r = await page.evaluate(()=>{
    const g=window.__capy, gl=g.renderer.getContext();
    const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
    const V=g.THREE.Vector3;
    const v=new V().copy(g.capy.position).project(g.camera);
    const cx=Math.round((v.x*0.5+0.5)*w), cy=Math.round((v.y*0.5+0.5)*h);
    const R=150, NR=6, band=R/NR;
    const x0=Math.max(0,Math.min(w-2*R,cx-R)), y0=Math.max(0,Math.min(h-2*R,cy-R));
    const ww=2*R, hh=2*R;
    const A=new Uint8Array(ww*hh*4), B=new Uint8Array(ww*hh*4);
    const grp=g.capy.group;
    const base=grp.position.y;
    let lift=0;
    function shot(buf){
      // re-apply the lift AFTER tick, then render by hand: tick() rewrites the
      // group from the physics state, so the write has to land after it and the
      // pool has to be told about it. Two ticks: the first moves the world on
      // by nothing (dt 0), the second sees the lifted group and pools it.
      g.tick(0,true);
      grp.position.y = base + lift; grp.updateMatrixWorld(true);
      g.tick(0,true);
      grp.position.y = base + lift; grp.updateMatrixWorld(true);
      g.renderer.render(g.scene, g.camera);
      gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,buf);
      return +grp.position.y.toFixed(3);
    }
    function rings(){
      g.state.noContact=false; const held=shot(A);
      g.state.noContact=true;  shot(B);
      g.state.noContact=false;
      const s=new Array(NR).fill(0);
      for(let py=0;py<hh;py++) for(let px=0;px<ww;px++){
        const i=(py*ww+px)*4;
        const dx=(x0+px)-cx, dy=(y0+py)-cy;
        const k=Math.floor(Math.sqrt(dx*dx+dy*dy)/band); if(k>=NR) continue;
        const d=(0.2126*B[i]+0.7152*B[i+1]+0.0722*B[i+2])-(0.2126*A[i]+0.7152*A[i+1]+0.0722*A[i+2]);
        if(d>1.5) s[k]+=d;
      }
      return { groupY: held, rings: s.map(x=>Math.round(x/100)), tot: Math.round(s.reduce((a,b)=>a+b,0)/100) };
    }
    const out={ baseY:+base.toFixed(3), camY:+g.camera.position.y.toFixed(2) };
    out.rest=rings();
    const L=[0.6,1.2,2.0];
    for(let i=0;i<L.length;i++){ lift=L[i]; out['lift'+L[i]]=rings(); }
    lift=0; out.back=rings();
    out.camY2=+g.camera.position.y.toFixed(2);
    return out;
  });
  await page.evaluate((o)=>fetch('/shot?name=pr-cc.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),r);
}
