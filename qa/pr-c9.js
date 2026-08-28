async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit1'); await page.waitForTimeout(7000);
  const r = await page.evaluate(()=>{
    const g=window.__capy, gl=g.renderer.getContext();
    const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
    const out={};
    try{
      const V=g.THREE.Vector3;
      const wp=new V(), v=new V();
      let best=null,bd=1e9,bsx=0,bsy=0;
      for(let i=0;i<g.npcs.length;i++){
        const p=g.npcs[i];
        if(!p||!p.group||!p.group.visible) continue;
        p.group.getWorldPosition(wp);
        v.copy(wp).project(g.camera);
        if(v.x<-0.75||v.x>0.75||v.y<-0.60||v.y>0.75||v.z>1) continue;
        const d=wp.distanceTo(g.capy.position);
        if(d<bd){bd=d;best=p;bsx=Math.round((v.x*0.5+0.5)*w);bsy=Math.round((v.y*0.5+0.5)*h);}
      }
      if(!best){out.err='no on-screen npc';return out;}
      const R=110;
      const x0=Math.max(0,Math.min(w-2*R,bsx-R)), y0=Math.max(0,Math.min(h-2*R,bsy-R));
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
        return {sum:Math.round(s/100), px:n};
      }
      out.subject={kind:best.kind, dToCapy:+bd.toFixed(1), win:[x0,y0]};
      const my=best.group.position.y, by=best.body?best.body.position.y:0;
      out.rest=darken();
      const lifts=[0.5,1.0,2.0,5.0];
      for(let i=0;i<lifts.length;i++){
        best.group.position.y=my+lifts[i];
        if(best.body) best.body.position.y=by+lifts[i];
        best.group.updateMatrixWorld(true);
        out['lift'+lifts[i]]=darken();
      }
      best.group.position.y=my; if(best.body) best.body.position.y=by;
      best.group.updateMatrixWorld(true);
      out.back=darken();
    }catch(e){ out.err=String(e && e.stack || e).slice(0,500); }
    return out;
  });
  await page.evaluate((o)=>fetch('/shot?name=pr-c9.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),r);
}
