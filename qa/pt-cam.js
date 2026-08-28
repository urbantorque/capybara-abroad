async page => {
  const KEYS=[['Digit1','sydney'],['Digit6','rio'],['Equal','palawan']];
  const out=[];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(7500);
    out.push(await page.evaluate((want)=>{
      const g=window.__capy;
      const cam=g.camera; cam.updateMatrixWorld(true);
      const V=g.THREE.Vector3;
      // unproject the TOP EDGE of the frame and measure its elevation
      function elev(ndcY){
        const p=new V(0, ndcY, 0.5).unproject(cam).sub(cam.position).normalize();
        return +(Math.asin(p.y)*180/Math.PI).toFixed(1);
      }
      const sun=g.scene.children.filter(o=>o.isDirectionalLight)[0];
      const sd=new V().copy(sun.position).sub(sun.target.position).normalize();
      const sunElev=+(Math.asin(sd.y)*180/Math.PI).toFixed(1);
      // is the sun inside the frustum at all?
      const sp=new V().copy(cam.position).addScaledVector(sd,200).project(cam);
      return {want, biome:g.biome.current,
              topEdgeElevDeg:elev(1), centreElevDeg:elev(0), bottomEdgeElevDeg:elev(-1),
              sunElevDeg:sunElev,
              sunInFrame: sp.x>=-1&&sp.x<=1&&sp.y>=-1&&sp.y<=1&&sp.z<=1,
              sunNdc:[+sp.x.toFixed(2),+sp.y.toFixed(2)]};
    },KEYS[i][1]));
  }
  await page.evaluate((o)=>fetch('/shot?name=pt-cam.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}),out);
}
