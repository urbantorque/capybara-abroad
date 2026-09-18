async page => {
  // qa/l8-balance.js — THE BALANCE PASS (L8, wave 3): a naive player's half
  // hour in a chapter, ledgered rows-vs-ground.
  //
  //   node server.mjs                                   (PORT=5188)
  //   playwright-cli -s=l8b open http://localhost:5188/
  //   playwright-cli -s=l8b run-code --filename=qa/l8-balance.js
  //
  // The roadmap's wave 3 asks for yuzu earned per half hour, ROWS and GROUND
  // separately, in three chapters of different size, played the way a new
  // player would. This drives a NAIVE BOT rather than a scripted route: it
  // reads the paper's own visible rows (rendered rects, trap 32), walks the
  // arrow's target with the closed-loop steer (trap 26), and at the target
  // does what a first-timer does — presses E, wheeks, hops, bumps into the
  // thing — for fifteen seconds before giving up and trying the next row. It
  // diverts to any drop within NOTICE_M (the minimap's own dots), always goes
  // for a bath (its pill says so from anywhere), and meets the traveller once.
  // Every credit lands in `game.state.qaYuzuLog` (yuzuAdd's own ledger), with
  // `ground:true` for the pickup listener, the pair bonus and the bath.
  //
  // ACCELERATED, AND SAID SO. The bot is driven by `game.tick(1/60)` in
  // one-second evaluates of SPEED*6 ticks, so setTimeout-deferred code (the
  // pickup's own deferred removal, the pair bonus) still fires between chunks
  // — the trap qa/l8-chaos.js's single long evaluate would have hit here.
  // Measured: a tick costs ~4-7 ms on this machine, so this runs at only
  // 2.5-4x real time (an in-page setInterval was throttled to ~1x and was
  // dropped). Drop timers and the bot's own clocks are all `dt`
  // accumulators, so the ground half is exactly what real time would give;
  // the row half depends on the bot's competence, which is the same at any
  // speed. SPEED = 0 is a real-time run, the game's own rAF clock, for
  // cross-checking one chapter (see the CONTRACT's L8 closeout for the
  // numbers both ways).
  //
  // STATE AT THE CHECKPOINT (18 Sep): the first full Sydney half hour ran
  // while the pickup rework (yuzu taken by walking through, not by E) was
  // half-landed in the tree — props.js had already made the yuzu
  // non-grabbable, the proximity credit did not exist yet — so its ground
  // column read 0 and means nothing. Rows measured 31 (8 arrival, 5
  // traveller, 4 plain tasks, 3 finds). Re-run once the rework lands; the
  // rework's own credit must go through yuzuAddGround (systems.js) or the
  // ledger will file it under rows.
  const PLAY = ['sydney', 'kyoto', 'quay'];   // small / middle / big (dropCapFor 4 / ~7 / 10)
  const SIM_MIN = 30;
  const SPEED = 20;            // extra ticks per real frame; 0 = the game's own clock only
  const NOTICE_M = 40;
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 300)));
  const out = { fail: [], chapters: [], simMin: SIM_MIN, speed: SPEED, noticeM: NOTICE_M };

  const BOT = `
    (function (cfg) {
      const g = window.__capy;
      const S = { goal: null, goalKind: '', goalId: '', atT: 0, gaveUp: {}, stuckT: 0, lastX: 0, lastZ: 0,
                  moveT: 0, travMet: false, travTried: 0, eT: 0, qT: 0, jT: 0, tick: 0, log: [],
                  stepT: 0, doneT0: 0, tasks0: 0, wander: null, wanderT: 0, seed: 7 };
      const rnd = () => { S.seed = (S.seed * 1103515245 + 12345) & 0x7fffffff; return S.seed / 0x7fffffff; };
      const down = {};
      // A held key is RE-SENT every step (the handler ignores a repeat via its
      // own keys[] latch): the game clears keys[] on its own on some cards,
      // and a bot that only sends the edge once then stands still for the
      // rest of the session — measured, 23 "stuck" in one half hour.
      const MOVE = { KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, ShiftLeft: 1 };
      const key = (code, on) => {
        if (!on && !down[code]) return;
        if (on && down[code] && !MOVE[code]) return;   // Escape and friends act above the latch — one edge only
        down[code] = !!on;
        window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: code, key: code, bubbles: true }));
      };
      // A PRESS IS A HOLD, NOT AN EDGE. The grab has a wind-up that reads
      // input.action HELD across frames (capybara.js's own "latch at source"
      // comment); a keydown+keyup in one JS turn is cancelled on the next
      // tick, and the first cut of this bot stood 1 m from a yuzu pressing E
      // for thirty minutes and took nothing. Held for dur sim-seconds.
      const holds = {};
      const tap = (code, dur) => { key(code, true); holds[code] = Math.max(holds[code] || 0, dur || 0.35); };
      const holdsTick = (dt) => { for (const c in holds) { holds[c] -= dt; if (holds[c] <= 0) { delete holds[c]; key(c, false); } } };
      const pos = () => g.capy && g.capy.position;
      const d2 = (a, b) => { const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz; };
      const wayPt = () => { try { return g.hintTarget('__way'); } catch (e) { return null; } };
      const visibleRows = () => {
        const rows = [];
        const lis = document.querySelectorAll('.capyui-todo li');
        for (let i = 0; i < lis.length; i++) {
          const li = lis[i];
          const r = li.getBoundingClientRect();
          if (r.height <= 0 || r.width <= 0) continue;
          const txt = (li.textContent || '').trim();
          for (let j = 0; j < cfg.tasks.length; j++) {
            const t = cfg.tasks[j];
            if (txt.indexOf(t.text) >= 0) { rows.push(t.id); break; }
          }
        }
        return rows;
      };
      const pickGoal = () => {
        const p = pos(); if (!p) return;
        const now = g.state.time;
        // 1. the ground: a bath from anywhere, anything else within NOTICE_M
        let best = null, bestD = Infinity, bath = null;
        const drops = (g.drops && g.drops.where) ? g.drops.where() : [];
        for (let i = 0; i < drops.length; i++) {
          const d = drops[i];
          const gk = S.gaveUp['drop@' + d.x.toFixed(0)];
          if (gk && now - gk < 90) continue;   // a used bath, or one the bot could not reach
          const dd = d2(p, d);
          if (d.kind === 'bath') { if (!bath || dd < d2(p, bath)) bath = d; }
          if (dd < bestD) { bestD = dd; best = d; }
        }
        if (bath) { S.goal = { x: bath.x, z: bath.z }; S.goalKind = 'bath'; S.goalId = ''; return; }
        if (best && bestD < cfg.noticeM * cfg.noticeM) { S.goal = { x: best.x, z: best.z }; S.goalKind = 'drop'; S.goalId = best.kind; return; }
        // 2. the traveller, once, if he is around and not absurdly far
        if (!S.travMet && S.travTried < 3) {
          let tw = null; try { tw = g.travWhere ? g.travWhere() : null; } catch (e) { tw = null; }
          if (tw && typeof tw.x === 'number' && d2(p, tw) < 90 * 90) { S.goal = { x: tw.x, z: tw.z }; S.goalKind = 'trav'; S.goalId = ''; return; }
        }
        // 3. the paper's own rows, top first, skipping what the bot has given up on
        const rows = visibleRows();
        for (let i = 0; i < rows.length; i++) {
          const id = rows[i];
          if (g.taskDone(id)) continue;
          if (S.gaveUp[id] && now - S.gaveUp[id] < 150) continue;
          let t = null; try { t = g.hintTarget(id); } catch (e) { t = null; }
          if (!t) { S.gaveUp[id] = now; continue; }
          S.goal = { x: t.x, z: t.z }; S.goalKind = 'task'; S.goalId = id; return;
        }
        // 4. nothing pointed at: wander toward a random map mark's ballpark for a while
        if (!S.wander || now > S.wanderT) {
          const a = rnd() * 6.283, r = 15 + rnd() * 30;
          S.wander = { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r };
          S.wanderT = now + 8;
        }
        S.goal = S.wander; S.goalKind = 'wander'; S.goalId = '';
      };
      const steer = (goal, sprint) => {
        const p = pos(); if (!p) return;
        let ux = goal.x - p.x, uz = goal.z - p.z;
        const m = Math.hypot(ux, uz) || 1; ux /= m; uz /= m;
        const yaw = g.input.camYaw || 0, cy = Math.cos(yaw), sy = Math.sin(yaw);
        const ix = ux * cy - uz * sy, iz = ux * sy + uz * cy;
        key('KeyW', iz < -0.38); key('KeyS', iz > 0.38);
        key('KeyA', ix < -0.38); key('KeyD', ix > 0.38);
        key('ShiftLeft', !!sprint && (g.capy.stamina === undefined || g.capy.stamina > 0.25));
      };
      const stop = () => { key('KeyW', false); key('KeyS', false); key('KeyA', false); key('KeyD', false); key('ShiftLeft', false); };
      const step = (dt) => {
        holdsTick(dt);
        S.stepT += dt;
        if (S.stepT < 0.25) return;
        const sdt = S.stepT; S.stepT = 0;
        if (!g.state.started) return;
        if (g.state.paused) { stop(); tap('Escape'); return; }
        const p = pos(); if (!p) return;
        const now = g.state.time;
        // re-pick every 2 s, or the moment a goal is gone
        S.moveT += sdt;
        // a rolling yuzu moves: a drop goal is "still there" if any drop sits within 6 m of it
        const goalGone = !S.goal ? false
                       : S.goalKind === 'task' ? g.taskDone(S.goalId)
                       : (S.goalKind === 'drop' || S.goalKind === 'bath') ? !(g.drops.where().some(d => d2(d, S.goal) < 36))
                       : false;
        if (!S.goal || goalGone || S.moveT > 2) {
          const prevKind = S.goalKind, prevId = S.goalId;
          const prevGoal = S.goal;
          pickGoal(); S.moveT = 0;
          if (!(S.goalKind === prevKind && S.goalId === prevId)) { S.atT = 0; S.stuckT = 0; }
          if (prevKind === 'drop' && goalGone) S.log.push({ t: +now.toFixed(1), ev: 'took', kind: prevId });
        }
        if (!S.goal) return;
        // a rolling yuzu moves: keep its live position
        if (S.goalKind === 'drop' || S.goalKind === 'bath') {
          const ds = g.drops.where();
          let near = null, nd = Infinity;
          for (let i = 0; i < ds.length; i++) { const dd = d2(ds[i], S.goal); if (dd < nd && dd < 36) { nd = dd; near = ds[i]; } }
          if (near) S.goal = { x: near.x, z: near.z };
        }
        if (!S.goal) return;
        const dist = Math.sqrt(d2(p, S.goal));
        const reach = S.goalKind === 'bath' ? 1.0 : S.goalKind === 'drop' ? 1.6 : S.goalKind === 'trav' ? 2.4 : 2.6;
        // stuck: no progress while far from the goal
        const moved = Math.hypot(p.x - S.lastX, p.z - S.lastZ);
        S.lastX = p.x; S.lastZ = p.z;
        if (dist > reach + 1 && moved < 0.25 * sdt) S.stuckT += sdt; else S.stuckT = Math.max(0, S.stuckT - sdt * 0.5);
        if (S.stuckT > 3) { tap('Space'); if (S.stuckT > 5) { key('KeyA', rnd() < 0.5); key('KeyD', rnd() < 0.5); } }
        if (S.stuckT > 18) {
          S.log.push({ t: +now.toFixed(1), ev: 'stuck', kind: S.goalKind, id: S.goalId, dist: +dist.toFixed(1) });
          if (S.goalKind === 'task') S.gaveUp[S.goalId] = now;
          if (S.goalKind === 'trav') S.travTried++;
          if (S.goalKind === 'drop' || S.goalKind === 'bath') S.gaveUp['drop@' + S.goal.x.toFixed(0)] = now;
          S.goal = null; S.stuckT = 0; stop(); return;
        }
        if (dist > reach) {
          S.atT = 0;
          steer(S.goal, dist > 10);
          // a drop right beside the path is grabbed on the way past
          if (S.goalKind === 'drop' && dist < 3.5) { S.eT += sdt; if (S.eT > 0.5) { S.eT = 0; tap('KeyE'); } }
          return;
        }
        // AT THE TARGET: the first-timer's repertoire
        stop();
        S.atT += sdt;
        S.eT += sdt; S.qT += sdt; S.jT += sdt;
        const wp = wayPt();
        const nearWay = wp && d2(p, wp) < 14 * 14;
        if (S.goalKind === 'drop' || S.goalKind === 'bath') {
          if (S.eT > 0.5) { S.eT = 0; tap('KeyE'); }
          if (S.atT > 12) { S.gaveUp['drop@' + S.goal.x.toFixed(0)] = now; S.log.push({ t: +now.toFixed(1), ev: 'left', kind: S.goalId }); S.goal = null; }
          return;
        }
        if (S.goalKind === 'trav') {
          if (S.eT > 0.8) { S.eT = 0; tap('KeyE'); }
          if (S.atT > 4) { S.travMet = true; S.goal = null; }
          return;
        }
        if (S.goalKind === 'task') {
          if (S.eT > 0.7) { S.eT = 0; tap('KeyE'); }
          if (S.qT > 2.2 && !nearWay) { S.qT = 0; tap('KeyQ'); }
          if (S.jT > 1.7) { S.jT = 0; tap('Space'); }
          // shuffle about a little — barge the thing, come at it from another side
          const a = rnd() * 6.283;
          if (rnd() < 0.35) steer({ x: S.goal.x + Math.cos(a) * 2.5, z: S.goal.z + Math.sin(a) * 2.5 }, false);
          if (S.atT > 15) {
            S.gaveUp[S.goalId] = now;
            S.log.push({ t: +now.toFixed(1), ev: 'gaveup', id: S.goalId });
            S.goal = null;
          }
          return;
        }
        if (S.goalKind === 'wander') { S.goal = null; }
      };
      const t0 = g.state.time;
      const simEnd = t0 + cfg.simS;
      S.t0 = t0; S.simEnd = simEnd;
      // ACCELERATED: the probe calls run(n) in short evaluates, so the event
      // loop turns between chunks (deferred removals, the pair bonus). The
      // game's own rAF loop is muted meanwhile (its tick+render was eating
      // half the CPU and the run measured ~1x real time with it on); the
      // patch is on game.tick because mainLoop reads it off the object.
      // (No backticks in this template's comments — trap 20.)
      const rawTick = g.tick;
      if (cfg.speed > 0) g.tick = function (dt, render) { if (render) return; return rawTick.call(g, dt, render); };
      S.run = function (n) {
        try {
          for (let i = 0; i < n && g.state.time < simEnd; i++) { rawTick.call(g, 1 / 60, false); step(1 / 60); }
          if (g.state.time >= simEnd) { stop(); S.done = true; g.tick = rawTick; }
        } catch (e) { S.err = String(e && e.message || e); stop(); S.done = true; }
        return { done: !!S.done, err: S.err || null, t: g.state.time - t0 };
      };
      // REAL TIME (speed 0): the game's own rAF clock ticks; the bot only steers.
      if (cfg.speed === 0) {
        let last = performance.now();
        const timer = setInterval(() => {
          const now = performance.now(); const dt = Math.min(0.25, (now - last) / 1000); last = now;
          try { step(dt); if (g.state.time >= simEnd) { clearInterval(timer); stop(); S.done = true; } }
          catch (e) { S.err = String(e && e.message || e); clearInterval(timer); stop(); S.done = true; }
        }, 50);
      }
      window.__bot = S;
    })
  `;

  for (const biome of PLAY) {
    // fresh file every chapter: the arrival bonus is part of the half hour
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto('http://localhost:5188/');
    // a loaded machine boots slowly: poll for the game, up to 60 s, rather than a fixed wait
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(2000);
      if (await page.evaluate(() => !!(window.__capy && document.querySelector('.capyui-go')))) break;
    }
    await page.waitForTimeout(1500);
    // the ledger opens BEFORE the door: Sydney's own first look pays at Begin
    await page.evaluate(() => { window.__capy.state.qaYuzuLog = []; });
    await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click(); });
    await page.waitForTimeout(3500);
    let started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
    if (!started) {   // trap 3: the first gesture after a goto sometimes lands on nothing
      await page.waitForTimeout(4000);
      await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click(); });
      await page.waitForTimeout(3500);
      started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
    }
    if (!started) throw new Error('l8-balance: the door did not open');
    if (biome !== 'sydney') {
      // a crossing's ledger starts at the crossing: Sydney's 8 is not this chapter's
      await page.evaluate(() => { window.__capy.state.qaYuzuLog = []; });
      await page.evaluate((b) => window.__capy.hud.cross(b), biome);
      await page.waitForTimeout(9000);
    }
    const live = await page.evaluate(() => window.__capy.biome.current);
    if (live !== biome) throw new Error('l8-balance: wanted ' + biome + ', got ' + live);
    const tasks = await page.evaluate(async (b) => {
      const sh = await import('/src/shared.js');
      const n = sh.chapterOf(b);
      return sh.TASKS.filter(t => (t.chapter || 1) === n).map(t => ({ id: t.id, text: t.text, tier: t.wow ? 'wow' : t.mini ? 'mini' : 'plain' }));
    }, biome);
    const wall0 = Date.now();
    await page.evaluate(({ src, cfg }) => { eval(src)(cfg); }, { src: BOT, cfg: { tasks, simS: SIM_MIN * 60, speed: SPEED, noticeM: NOTICE_M } });
    // drive it in short evaluates (trap 2): SPEED ticks a chunk, ~1 s real each
    for (let i = 0; i < 200000; i++) {
      let st;
      if (SPEED > 0) st = await page.evaluate((n) => window.__bot ? window.__bot.run(n) : null, SPEED * 6);
      else { await page.waitForTimeout(2000); st = await page.evaluate(() => { const b = window.__bot; return b ? { done: !!b.done, err: b.err || null, t: window.__capy.state.time - b.t0 } : null; }); }
      if (!st) throw new Error('l8-balance: the bot vanished (a reload?)');
      if (st.err) throw new Error('l8-balance: bot threw: ' + st.err);
      if (st.done) break;
    }
    const res = await page.evaluate((b) => {
      const g = window.__capy;
      const S = window.__bot;
      const log = (g.state.qaYuzuLog || []).slice();
      const t0 = S.t0;
      const rows = { total: 0, byWhy: {} }, ground = { total: 0, n: 0, byN: {} };
      const buckets = [];   // 5-minute buckets, rows / ground
      for (const e of log) {
        const rel = Math.max(0, e.t - t0);
        const bi = Math.min(5, Math.floor(rel / 300));
        while (buckets.length <= bi) buckets.push({ rows: 0, ground: 0 });
        if (e.ground) { ground.total += e.n; ground.n++; ground.byN[e.n] = (ground.byN[e.n] || 0) + 1; buckets[bi].ground += e.n; }
        else { rows.total += e.n; const k = e.why || ('n' + e.n); rows.byWhy[k] = (rows.byWhy[k] || 0) + e.n; buckets[bi].rows += e.n; }
      }
      const done = [];
      for (const id of b.ids) if (g.taskDone(id)) done.push(id);
      const dc = g.capy && g.capy.dropCap;
      return { biome: g.biome.current, simS: +(g.state.time - t0).toFixed(0), wallet: g.state.qaYuzu(),
               rows, ground, buckets, tasksDone: done, tasksOf: b.ids.length, travMet: S.travMet,
               dropCap: dc, dropsLiveNow: g.drops.where().length, botLog: S.log.slice(-60),
               lastError: g.state.lastError || null };
    }, { ids: tasks.map(t => t.id) });
    res.wallS = Math.round((Date.now() - wall0) / 1000);
    res.tasksTier = {};
    for (const id of res.tasksDone) { const t = tasks.find(x => x.id === id); const k = t ? t.tier : '?'; res.tasksTier[k] = (res.tasksTier[k] || 0) + 1; }
    out.chapters.push(res);
    await page.screenshot({ path: 'qa/l8-balance-' + biome + '.png' });
    await page.evaluate(async (o) => {
      await fetch('/shot?name=l8-balance.json', { method: 'POST',
        body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
    }, out);
  }
  out.errs = errs.slice(0, 10);
  for (const c of out.chapters) {
    if (c.lastError) out.fail.push(c.biome + ': lastError ' + c.lastError);
    if (c.simS < SIM_MIN * 60 - 5) out.fail.push(c.biome + ': only ' + c.simS + ' s simulated');
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l8-balance.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (out.fail.length) throw new Error('l8-balance FAILED: ' + JSON.stringify(out.fail));
}
