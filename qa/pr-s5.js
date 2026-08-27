async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Equal'); await page.waitForTimeout(7000);
  const info = await page.evaluate(()=>{
    const g=window.__capy;
    let fr=null;
    g.scene.traverse(o=>{ if(o.isInstancedMesh&&o.visible&&o.count>300&&
        o.geometry.attributes.position.count===12) fr=fr||o; });
    if(!fr) return {err:'no fronds'};
    const M=new g.THREE.Matrix4(), P=new g.THREE.Vector3();
    // the crown nearest the capybara, so the shot is somewhere the player goes
    let best=null,bd=1e9;
    for(let i=0;i<fr.count;i+=9){
      fr.getMatrixAt(i,M); P.setFromMatrixPosition(M); fr.localToWorld(P);
      const d=P.distanceTo(g.capy.position);
      if(d<bd){bd=d;best=P.clone();}
    }
    // park the camera off to the side of the crown, level with it
    const cam=g.camera;
    cam.position.set(best.x+9, best.y+1.5, best.z+9);
    cam.lookAt(best.x,best.y,best.z);
    cam.updateMatrixWorld(true);
    g.tick(0,true);
    const a=g.renderer.domElement.toDataURL('image/png');
    fetch('/shot?name=pr-sway-a',{method:'POST',body:a});
    const t0=g.state.time; g.state.time=t0+1.35;
    cam.position.set(best.x+9, best.y+1.5, best.z+9);
    cam.lookAt(best.x,best.y,best.z); cam.updateMatrixWorld(true);
    g.tick(0,true);
    const b=g.renderer.domElement.toDataURL('image/png');
    fetch('/shot?name=pr-sway-b',{method:'POST',body:b});
    g.state.time=t0;
    return {crown:[+best.x.toFixed(1),+best.y.toFixed(1),+best.z.toFixed(1)], dToCapy:+bd.toFixed(1),
            cam:[+cam.position.x.toFixed(2),+cam.position.y.toFixed(2),+cam.position.z.toFixed(2)]};
  });
  await page.evaluate((o)=>fetch('/shot?name=pr-s5.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),info);
}
