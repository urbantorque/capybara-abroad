async page => {
  const KEYS=[['Digit1','sydney'],['Minus','kowloon'],['Equal','palawan']];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(7500);
    const info = await page.evaluate((want)=>{
      const g=window.__capy;
      const sun=g.scene.children.filter(o=>o.isDirectionalLight)[0];
      const d=new g.THREE.Vector3().copy(sun.position).sub(sun.target.position).normalize();
      // look UP the sun's own bearing so the glow, if there is one, is centred
      const cam=g.camera;
      const eye=new g.THREE.Vector3().copy(g.capy.position).add(new g.THREE.Vector3(0,3,0));
      cam.position.copy(eye);
      cam.lookAt(eye.x+d.x*50, eye.y+d.y*50, eye.z+d.z*50);
      cam.updateMatrixWorld(true);
      g.renderer.render(g.scene, g.camera);
      fetch('/shot?name=pt-sky-'+want,{method:'POST',body:g.renderer.domElement.toDataURL('image/png')});
      return {want, biome:g.biome.current, sunDir:[+d.x.toFixed(2),+d.y.toFixed(2),+d.z.toFixed(2)],
              sunInt:+sun.intensity.toFixed(2)};
    },KEYS[i][1]);
    console.log(JSON.stringify(info));
  }
}
