async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit1'); await page.waitForTimeout(7000);
  const r = await page.evaluate(()=>{
    const g=window.__capy, gl=g.renderer.getContext();
    const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
    // a window centred on the capybara's own screen position, fixed once
    const V=g.THREE.Vector3;
    const v=new V().copy(g.capy.position).project(g.camera);
    const sx=Math.round((v.x*0.5+0.5)*w), sy=Math.round((v.y*0.5+0.5)*h);
    const R=150;
    const x0=Math.max(0,Math.min(w-2*R,sx-R)), y0=Math.max(0,Math.min(h-2*R,sy-R));
    const ww=2*R, hh=2*R;
    const A=new Uint8Array(ww*hh*4), B=new Uint8Array(ww*hh*4);
    function darken(){
      g.state.noContact=false; g.tick(0,true); gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,A);
      g.state.noContact=true;  g.tick(0,true); gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,B);
      g.state.noContact=false;
      let s=0,n=0;
      for(let p=0;p<A.length;p+=4){
        const d=(0.2126*B[p]+0.7152*B[p+1]+0.0722*B[p+2])-(0.2126*A[p]+0.7152*A[p+1]+0.0722*A[p+2]);
        if(d>1.5){s+=d;n++;}
      }
      return {sum:Math.round(s/100), px:n, cam:[+g.camera.position.x.toFixed(3),+g.camera.position.y.toFixed(3),+g.camera.position.z.toFixed(3)]};
    }
    const out={win:[x0,y0,ww,hh]};
    const cy=g.capy.body.position.y;
    out.rest=darken();
    const lifts=[0.4,0.8,1.4,2.5,6.0];
    for(let i=0;i<lifts.length;i++){
      g.capy.body.position.y=cy+lifts[i];
      g.capy.body.velocity.set(0,0,0);
      out['lift'+lifts[i]]=darken();
    }
    g.capy.body.position.y=cy;
    out.back=darken();
    return out;
  });
  await page.evaluate((o)=>fetch('/shot?name=pr-ca.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),r);
}
