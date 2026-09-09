async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit1'); await page.waitForTimeout(7000);
  await page.keyboard.down('Space');
  const r = await page.evaluate(()=>{
    const g=window.__capy, gl=g.renderer.getContext();
    const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
    const V=g.THREE.Vector3;
    const v=new V().copy(g.capy.position).project(g.camera);
    const cx=Math.round((v.x*0.5+0.5)*w), cy=Math.round((v.y*0.5+0.5)*h);
    const R=140;
    const x0=Math.max(0,Math.min(w-2*R,cx-R)), y0=Math.max(0,Math.min(h-2*R,cy-R));
    const ww=2*R, hh=2*R;
    const A=new Uint8Array(ww*hh*4), B=new Uint8Array(ww*hh*4);
    const rows=[];
    for(let f=0;f<70;f++){
      g.state.noContact=false; g.tick(1/60,true); gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,A);
      g.state.noContact=true;  g.tick(0,true);   gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,B);
      g.state.noContact=false;
      let s=0;
      for(let p=0;p<A.length;p+=4){
        const d=(0.2126*B[p]+0.7152*B[p+1]+0.0722*B[p+2])-(0.2126*A[p]+0.7152*A[p+1]+0.0722*A[p+2]);
        if(d>1.5)s+=d;
      }
      rows.push([ +(g.capy.group.position.y).toFixed(2), Math.round(s/100) ]);
    }
    return rows;
  });
  await page.keyboard.up('Space');
  await page.evaluate((o)=>fetch('/shot?name=pr-cd.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}),r);
}
