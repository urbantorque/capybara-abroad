async page => {
  // ---------------------------------------------------------------------------
  // qa/b0-watch.js — THE SESSION RECORDER FOR B0 (ROADMAP-FUN item 0)
  //
  // B0 is "sit one person who has never seen it in front of the title card, let
  // them pick a place, say nothing, and take notes for ten minutes". It cannot
  // be done by an agent and this does not pretend to: **a person still has to
  // watch**. What this removes is the part of the watching that is clerical —
  // the timestamps, the key presses, the gaps — so the watcher can spend ten
  // minutes looking at the player's face instead of at a stopwatch.
  //
  // Run it, hand over the keyboard, and run `qa/b0-notes.js` afterwards.
  //
  //   npx playwright-cli -s=b0 open http://localhost:5188/
  //   npx playwright-cli -s=b0 run-code --filename=qa/b0-watch.js
  //   ... the stranger plays ...
  //   npx playwright-cli -s=b0 run-code --filename=qa/b0-notes.js
  //
  // ---- IT IS PASSIVE, AND THAT IS LOAD-BEARING --------------------------
  // Nothing here wraps a game function, preventDefaults anything, or writes to
  // any game state. It is listeners on the event bus, one interval, and a
  // MutationObserver. A recorder that changed the session it was recording
  // would be worse than no recorder, because the notes would look fine.
  //
  // ---- WHAT "A THING THEY TRIED THAT DID NOTHING" IS, MEASURED ----------
  // The obvious signal is `e.defaultPrevented` — systems.js is the only
  // keydown handler, so surely a key it takes is a key it prevents. MEASURED
  // (`qa/b0-keys.js`), pressing the whole plausible keyboard in three states:
  //
  //   the game claims, by preventDefault ....  arrows, Space, Tab, J (and H)
  //   it does NOT claim ....................  W A S D E Q K G Z X C M N ...
  //
  // Because preventDefault here is about suppressing the BROWSER's default —
  // arrows and Space scroll, Tab moves focus — and not about whether the game
  // uses the key. A recorder built on it would have filed every press of W as
  // a thing that did nothing. So the source is THE GAME'S OWN LEGEND instead,
  // scraped from the controls fold: a key that is not in the legend is a key
  // the game never told this player about, which is the honest version of the
  // question B0 is really asking.
  //
  // (The same probe paid for a second trap: systems.js binds a bare
  // `addEventListener('keydown')`, which is WINDOW's, and a document-level
  // bubble listener fires BEFORE window's. The first cut read every key as
  // unclaimed, including a J that had just opened the journal.)
  // ---------------------------------------------------------------------------

  // A STRANGER MUST MEET THE TITLE CARD AS A STRANGER, so the save goes first:
  // "Carry on — you were last in Venice" is a different first screen from
  // "Begin", and B0 is about the first screen. Reload, clear, reload — a clear
  // followed by one reload does not empty it, because the reload's own
  // pagehide flush writes the live journey straight back.
  await page.reload();
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    try { localStorage.removeItem('capy3.journey.v1'); } catch (e) {}
    try { localStorage.removeItem('capy3.album.v1'); } catch (e) {}
  });

  // Installed as an init script so it survives the reload below AND any reload
  // the stranger causes themselves. It lives for the life of the playwright
  // SESSION, so `close-all` is what ends it.
  await page.addInitScript(() => {
    if (window.__b0) return;
    const B = {
      t0: 0, startedAt: -1, titleFor: -1, rows: [], keys: {}, clicks: 0, legend: [],
      firstMove: -1, marqSee: -1, marqSeen: 0, marqSamples: 0,
      lastInput: 0, gapMax: 0, gapAt: 0, ended: false,
    };
    window.__b0 = B;
    const now = function () { return B.t0 ? (performance.now() - B.t0) / 1000 : 0; };
    const put = function (kind, what, extra) {
      B.rows.push(Object.assign({ t: +now().toFixed(1), kind: kind, what: what || '' },
                                extra || {}));
      if (B.rows.length > 4000) B.rows.shift();
    };

    // ---- the legend, which is the list of things the game has told them ---
    const legendKeys = function () {
      const out = {};
      const caps = document.querySelectorAll('.capyui-legend kbd, .capyui-legrow kbd');
      for (let i = 0; i < caps.length; i++) {
        const t = (caps[i].textContent || '').toUpperCase();
        // "WASD / arrows", "G (held)", "E / left click", "Z / X · C"
        const m = t.match(/[A-Z]+/g) || [];
        for (const w of m) {
          if (w === 'WASD') { out.KEYW = 1; out.KEYA = 1; out.KEYS = 1; out.KEYD = 1; continue; }
          if (w === 'ARROWS') {
            out.ARROWUP = 1; out.ARROWDOWN = 1; out.ARROWLEFT = 1; out.ARROWRIGHT = 1;
            continue;
          }
          if (w === 'HELD' || w === 'LEFT' || w === 'CLICK' || w === 'DRAG' ||
              w === 'WHEEL' || w === 'OR' || w === 'AND') continue;
          if (w.length === 1) out['KEY' + w] = 1;
          else out[w] = 1;
        }
      }
      out.SPACE = 1; out.ESCAPE = 1;   // both are on the legend as words
      return out;
    };

    const boot = function () {
      const g = window.__capy;
      if (!g || !g.events) { setTimeout(boot, 400); return; }
      B.t0 = performance.now();
      B.lastInput = 0;
      const lg = legendKeys();
      B.legend = Object.keys(lg).sort();

      // ---- what they pressed, and whether the game had ever mentioned it --
      window.addEventListener('keydown', function (e) {
        if (e.repeat) return;
        const code = String(e.code || '').toUpperCase();
        const known = !!lg[code] || !!lg[code.replace('LEFT', '').replace('RIGHT', '')];
        const r = B.keys[e.code] || (B.keys[e.code] = { n: 0, first: -1, inLegend: known });
        r.n++;
        if (r.first < 0) { r.first = +now().toFixed(1); put('key', e.code, { legend: known }); }
        B.lastInput = now();
      });
      window.addEventListener('pointerdown', function () {
        B.clicks++; B.lastInput = now();
      }, true);

      // ---- the game's own bus ---------------------------------------------
      const on = function (n, f) { try { g.events.on(n, f); } catch (e) {} };
      on('task:complete', function (p) { put('task', (p && p.id) || ''); });
      on('biome:enter', function (p) { put('place', (p && p.name) || ''); });
      on('npc:startled', function () { put('startled'); });
      on('capy:incident', function (p) { put('incident', (p && p.tier) === 2 ? 'a scene' : 'an incident'); });
      on('npc:photo', function () { put('photographed by somebody'); });
      on('npc:gift', function () { put('gave something'); });
      on('pal:warm', function () { put('a regular warmed'); });
      on('hud:toast', function (p) { put('toast', (p && p.text) || ''); });

      // ---- and the things only the DOM knows ------------------------------
      const seen = {};
      const watch = function (sel, name) {
        const el = document.querySelector(sel);
        return function () {
          const e2 = el || document.querySelector(sel);
          if (!e2) return;
          const up = e2.classList ? e2.classList.contains('show') : false;
          if (up !== !!seen[name]) { seen[name] = up; put(up ? 'opened' : 'closed', name); }
        };
      };
      const cards = [watch('.capyui-jr', 'the journal'), watch('.capyui-led', 'the ledger'),
                     watch('.capyui-alb', 'the album'), watch('.capyui-pause', 'the pause card'),
                     watch('.capyui-photo', 'the camera')];

      setInterval(function () {
        if (B.ended) return;
        const t = now();
        // THE ONE B0 ASKS FOR BY NAME: "the first time they read the paper for
        // instructions". The controls are a fold and it stays open once
        // opened, so the moment it opens is the moment they went looking.
        const keys = document.querySelector('.capyui-jrkeys');
        if (keys && keys.open && !seen.controls) { seen.controls = 1; put('read the controls'); }
        for (let i = 0; i < cards.length; i++) cards[i]();
        if (window.__capy && window.__capy.state && window.__capy.state.started &&
            B.startedAt < 0) {
          B.startedAt = +t.toFixed(1);
          const here = (window.__capy.biome && window.__capy.biome.current) || '';
          put('began', here);
          // THE PLACE THEY START IN FIRES NO `biome:enter` — see W2, which
          // found the same hole in the save's own `seen` list. Without this
          // the notes read 'places entered: —' for a session spent entirely
          // in Sydney.
          put('place', here);
          // ...AND THE CLOCK ON THE IDLE GAPS RESTARTS HERE. The title card
          // is read, and a stranger who reads it for a minute is not idle —
          // but a gap measured from page load counted that minute and made it
          // the longest silence of every session. How long they spent on the
          // card is its own number, below.
          B.titleFor = +t.toFixed(1);
          B.gapMax = 0; B.gapAt = 0; B.lastInput = t;
        }
        // the first time the animal actually moved
        try {
          const c = window.__capy.capy;
          if (B.firstMove < 0 && c && c.body &&
              Math.hypot(c.body.velocity.x, c.body.velocity.z) > 1.2) {
            B.firstMove = +t.toFixed(1);
            put('moved');
          }
        } catch (e) {}
        // the longest they went without touching anything — the sigh, in numbers
        const gap = t - B.lastInput;
        if (gap > B.gapMax) { B.gapMax = +gap.toFixed(1); B.gapAt = +t.toFixed(1); }
        if (gap > 20 && B.startedAt >= 0 && !seen['idle' + Math.floor(t / 20)]) {
          seen['idle' + Math.floor(t / 20)] = 1;
          put('nothing pressed for ' + Math.round(gap) + 's');
        }
        // ---- did they ever SEE the marquee ---------------------------------
        // Lifted from qa/first-five.js, which is the instrument B0's numbers
        // are meant to be compared against — the same frustum test and the
        // same occlusion walk, so a stranger's "seen in" is the same number as
        // the driver's and the two can be put side by side.
        try {
          const gg = window.__capy, THREE = gg.THREE;
          const m = gg.marqueePoint ? gg.marqueePoint() : null;
          if (!m || !gg.state.started) return;
          B.marqSamples++;
          const p = new THREE.Vector3(m.x, m.y, m.z);
          const ndc = p.clone().project(gg.camera);
          if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || ndc.z <= -1 || ndc.z >= 1) return;
          const cam = gg.camera.position;
          const dir = p.clone().sub(cam);
          const len = dir.length();
          if (len < 2) return;
          dir.normalize();
          const rc = new THREE.Raycaster(cam.clone(), dir, 0.6, len - 1.5);
          const hits = rc.intersectObjects(gg.scene.children, true);
          const drawn = function (o) {
            for (let q = o; q; q = q.parent) if (!q.visible) return false;
            return true;
          };
          for (let i = 0; i < hits.length; i++) {
            const o = hits[i].object;
            if (!o.isMesh || !o.material || !drawn(o)) continue;
            if (o.material.transparent && o.material.opacity < 0.5) continue;
            const bs = o.geometry && o.geometry.boundingSphere;
            if (bs && bs.radius > 400) continue;
            return;                       // blocked
          }
          B.marqSeen++;
          if (B.marqSee < 0) { B.marqSee = +t.toFixed(1); put('saw the marquee'); }
        } catch (e) {}
      }, 500);
      put('watching');
    };
    boot();
  });

  await page.reload();
  await page.waitForTimeout(5500);
  const ready = await page.evaluate(() => ({
    on: !!window.__b0,
    legend: window.__b0 ? window.__b0.legend : null,
    card: !!document.querySelector('.capyui-title'),
    carry: !!document.querySelector('.capyui-carry'),
  }));
  await page.evaluate((o) => fetch('/shot?name=b0-watch.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), ready);
}
