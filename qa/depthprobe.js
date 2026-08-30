async page => {
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(6000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const T = g.THREE, r = g.renderer, gl = r.getContext();
    const res = { webgl2: !!gl.getParameter, ver: gl.getParameter(gl.VERSION) };
    const w = 640, h = 380;
    function build(samples) {
      const dt = new T.DepthTexture(w, h);
      dt.type = T.UnsignedIntType;
      dt.format = T.DepthFormat;
      const rt = new T.WebGLRenderTarget(w, h, {
        type: T.HalfFloatType, samples: samples, depthTexture: dt,
        depthBuffer: true, stencilBuffer: false,
      });
      return rt;
    }
    // Read the depth texture back by drawing it through a tiny shader into an
    // 8-bit target and reading THAT — depth textures are not readPixels-able.
    function probe(samples, tag) {
      let rt, read, ok = false, err = null, vals = null;
      try {
        rt = build(samples);
        const prev = r.getRenderTarget();
        r.setRenderTarget(rt);
        r.clear(true, true, true);
        r.render(g.scene, g.camera);
        read = new T.WebGLRenderTarget(w, h, { type: T.UnsignedByteType, depthBuffer: false });
        const q = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
          uniforms: { tD: { value: rt.depthTexture } },
          vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=vec4(position.xy,0.,1.); }',
          fragmentShader: 'uniform sampler2D tD; varying vec2 vU; void main(){' +
            ' float d = texture2D(tD, vU).x;' +
            ' gl_FragColor = vec4(vec3(pow(clamp((d-0.985)/0.015,0.,1.),1.0)),1.0); }',
        }));
        const sc = new T.Scene(); sc.add(q);
        const cam = new T.Camera();
        r.setRenderTarget(read);
        r.render(sc, cam);
        const buf = new Uint8Array(w * h * 4);
        r.readRenderTargetPixels(read, 0, 0, w, h, buf);
        let mn = 255, mx = 0, sum = 0, n = 0;
        for (let i = 0; i < buf.length; i += 4 * 37) {
          const v = buf[i]; if (v < mn) mn = v; if (v > mx) mx = v; sum += v; n++;
        }
        vals = { min: mn, max: mx, mean: +(sum / n).toFixed(1), n: n };
        ok = mx > mn + 4;
        r.setRenderTarget(prev);
        q.geometry.dispose(); q.material.dispose(); read.dispose(); rt.dispose();
      } catch (e) { err = String(e && e.message || e); }
      return { tag: tag, samples: samples, ok: ok, vals: vals, err: err,
               glErr: gl.getError() };
    }
    res.ms4 = probe(4, 'multisampled');
    res.ms0 = probe(0, 'single-sample');
    return res;
  });
  await page.evaluate(o => fetch('/shot?name=depthprobe.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
