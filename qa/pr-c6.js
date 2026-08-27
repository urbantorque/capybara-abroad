async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit1'); await page.waitForTimeout(7000);
  const r = await page.evaluate(()=>{
    const g=window.__capy, gl=g.renderer.getContext();
    const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
    // pick the prop nearest the camera that is on the ground and unheld
    let best=null,bd=1e9;
    for(const p of g.props){
      if(!p||!p.mesh||p.held) continue;
      const d=p.mesh.position.distanceTo(g.camera.position);
      if(d<bd){bd=d;best=p;}
    }
    if(!best) return {err:'no prop'};
    // a window around THAT prop only, so nothing else in the frame can move the number
    const v=new g.THREE.Vector3().copy(best.mesh.position).project(g.camera);
    const sx=Math.round((v.x*0.5+0.5)*w), sy=Math.round((v.y*0.5+0.5)*h);
    const R=120;
    const x0=Math.max(0,sx-R), y0=Math.max(0,sy-R);
    const ww=Math.min(2*R,w-x0), hh=Math.min(2*R,h-y0);
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
      return {sum:Math.round(s/100), px:n};
    }
    const out={ prop:best.type, dist:+bd.toFixed(1), win:[ww,hh] };
    const py=best.mesh.position.y, by=best.body?best.body.position.y:0;
    out.rest = darken();
    // Raise the prop. dt=0 so nothing steps; the mesh is the only thing that moves.
    for(const lift of [0.5,1.0,2.0,5.0]){
      best.mesh.position.y = py + lift;
      if(best.body) best.body.position.y = by + lift;
      best.mesh.updateMatrixWorld(true);
      out['lift'+lift] = darken();
    }
    best.mesh.position.y=py; if(best.body) best.body.position.y=by;
    best.mesh.updateMatrixWorld(true);
    out.back = darken();
    return out;
  });
  await page.evaluate((o)=>fetch('/shot?name=pr-c6.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),r);
}
