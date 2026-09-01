async page => {
  const out = {};
  const PK = 'capy3.prefs.v1';
  const wait = () => page.evaluate(() => new Promise(r => setTimeout(r, 4500)));

  // No addInitScript anywhere in this file, and for the same reason r3-save.js
  // has none: traps 10 and 19 — it fires on every navigation for the rest of
  // the browser context, and half of what is below is a write-then-reload test
  // of the very store it would wipe.
  const fresh = async () => {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await wait();
  };
  const start = async () => {
    await page.keyboard.press('Digit1');
    await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));
  };
  const shown = () => page.evaluate(() => {
    const el = document.querySelector('.capyui-pause');
    return !!el && el.classList.contains('show');
  });

  // ======================================================================
  // A. ESCAPE IS PAUSE. It used to open the departures board — a card with
  //    nineteen destinations, no resume and no settings on it.
  // ======================================================================
  await fresh();
  await start();
  await page.keyboard.press('Escape');
  await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
  out.escOpens = {
    pause: await shown(),
    journal: await page.evaluate(() => {
      const el = document.querySelector('.capyui-jr');
      return !!el && el.classList.contains('show');
    }),
    paused: await page.evaluate(() => !!window.__capy.state.paused),
    // The card has to name where you are and how long you have been going, or
    // it is a grey box with four buttons on it.
    sub: await page.evaluate(() => {
      const e = document.querySelector('.capyui-pausesub');
      return e ? e.textContent : null;
    }),
    buttons: await page.evaluate(() =>
      Array.from(document.querySelectorAll('.capyui-pausebtn'))
        .filter(b => !b.hidden).map(b => b.textContent)),
  };

  // ...and Escape again resumes, and the world runs again.
  await page.keyboard.press('Escape');
  await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
  out.escResumes = {
    pause: await shown(),
    paused: await page.evaluate(() => !!window.__capy.state.paused),
  };

  // ======================================================================
  // B. THE THREE FADERS MOVE THREE DIFFERENT GAINS.
  //    Measured on the audio graph, not on the slider: a fader that writes a
  //    number nobody reads is the exact shape this batch exists to fix.
  //    The AudioContext only exists once a real gesture has unlocked it, which
  //    is why this runs under playwright and not the hand-driven tick loop.
  // ======================================================================
  await page.keyboard.press('Escape');
  await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
  await page.click('.capyui-pausebtn:nth-of-type(2)');   // settings
  await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
  out.settingsOpens = await page.evaluate(() => {
    const s = document.querySelector('.capyui-set');
    return { visible: !!s && !s.hidden,
             rows: document.querySelectorAll('.capyui-setrange').length,
             names: Array.from(document.querySelectorAll('.capyui-setname')).map(e => e.textContent),
             calm: !!document.querySelector('.capyui-setcalm input') };
  });

  // A helper that drives a native range the way a pointer does — set the value
  // and fire `input`, which is the event the card listens on.
  const setRange = (i, v) => page.evaluate(o => {
    const r = document.querySelectorAll('.capyui-setrange')[o.i];
    r.value = String(o.v);
    r.dispatchEvent(new Event('input', { bubbles: true }));
  }, { i: i, v: v });

  const gains = () => page.evaluate(() => {
    const g = window.__capy;
    return (g.hud && g.hud.audioBuses) ? g.hud.audioBuses() : null;
  });
  out.busBefore = await gains();
  await setRange(0, 40);
  await setRange(1, 20);
  await setRange(2, 10);
  await page.evaluate(() => new Promise(r => setTimeout(r, 700)));
  out.busAfter = await gains();

  // ...AND THE CARD ITSELF HAS TO SAY SO, which is the leg this probe did not
  // have on its first run: it asserted on the graph, the graph was right, and
  // the three rows on the screen still read 100% over three faders one of which
  // was a third of the way along. Read the card WHILE IT IS OPEN — a reload
  // rebuilds it from the file and hides exactly this.
  out.cardEcho = await page.evaluate(() => ({
    vals: Array.from(document.querySelectorAll('.capyui-setval')).map(e => e.textContent),
    ranges: Array.from(document.querySelectorAll('.capyui-setrange')).map(e => e.value),
  }));

  // ...and the mutes, one per bus, each independent of the others.
  await page.evaluate(() => {
    document.querySelectorAll('.capyui-setmute')[2].click();
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 700)));
  out.busSfxMuted = await gains();
  out.cardEchoMute = await page.evaluate(() => ({
    vals: Array.from(document.querySelectorAll('.capyui-setval')).map(e => e.textContent),
    off: Array.from(document.querySelectorAll('.capyui-setmute')).map(e => e.classList.contains('off')),
    pressed: Array.from(document.querySelectorAll('.capyui-setmute'))
      .map(e => e.getAttribute('aria-pressed')),
  }));
  // The keys are the other writer of the same three buses, and the card is a
  // view of them too.
  await page.keyboard.press('KeyN');
  await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
  out.cardEchoKey = await page.evaluate(() => ({
    music: document.querySelectorAll('.capyui-setval')[1].textContent,
    off: document.querySelectorAll('.capyui-setmute')[1].classList.contains('off'),
  }));
  await page.keyboard.press('KeyN');
  await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

  // ======================================================================
  // C. THE CALM SWITCH WORKS AT RUNTIME.
  //    Three modules had three private copies of the media query. The one that
  //    would have been missed is weather.js's mote field, so it is measured
  //    through the game's own getter rather than through the class on <html>.
  // ======================================================================
  out.calmBefore = await page.evaluate(() => ({
    cls: document.documentElement.classList.contains('capy-calm'),
    box: document.querySelector('.capyui-setcalm input').checked,
  }));
  await page.evaluate(() => {
    const b = document.querySelector('.capyui-setcalm input');
    b.checked = true;
    b.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
  out.calmAfter = await page.evaluate(() => ({
    cls: document.documentElement.classList.contains('capy-calm'),
    live: !!(window.__capy.hud.calmOn && window.__capy.hud.calmOn()),
  }));

  // ======================================================================
  // D. IT IS ALL IN A FOURTH KEY, AND IT SURVIVES A RELOAD.
  //    The write is debounced 250 ms, so the read waits for it.
  // ======================================================================
  await page.evaluate(() => new Promise(r => setTimeout(r, 900)));
  out.prefsFile = await page.evaluate(k => {
    let o = null;
    try { o = JSON.parse(localStorage.getItem(k)); } catch (e) { o = null; }
    return { raw: localStorage.getItem(k), parsed: o,
             // ...and it is NOT in the journey file, which "start over" wipes.
             inJourney: (localStorage.getItem('capy3.journey.v1') || '').indexOf('"m":') >= 0 };
  }, PK);

  // A real reload — NOT a fresh() — because the whole point is that the file is
  // read before the audio graph is built.
  await page.reload();
  await wait();
  await start();
  await page.evaluate(() => new Promise(r => setTimeout(r, 1200)));
  out.afterReload = {
    buses: await gains(),
    calm: await page.evaluate(() => !!(window.__capy.hud.calmOn && window.__capy.hud.calmOn())),
    cls: await page.evaluate(() => document.documentElement.classList.contains('capy-calm')),
  };
  await page.keyboard.press('Escape');
  await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
  out.afterReloadCard = await page.evaluate(() => ({
    vals: Array.from(document.querySelectorAll('.capyui-setval')).map(e => e.textContent),
    ranges: Array.from(document.querySelectorAll('.capyui-setrange')).map(e => e.value),
    box: document.querySelector('.capyui-setcalm input').checked,
  }));

  // ======================================================================
  // E. QUIT ASKS FIRST, AND THE QUESTION SAYS WHAT HAPPENS.
  //    The reload itself is not driven here — this run has state in it that
  //    the later legs need — but the confirm's existence, its focus and its
  //    escape route are.
  // ======================================================================
  out.quit = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.capyui-pausebtn'));
    const q = btns.filter(b => /quit/i.test(b.textContent))[0];
    if (!q) return { found: false };
    q.click();
    const ask = document.querySelector('.capyui-pauseask');
    const focus = document.activeElement ? document.activeElement.textContent : null;
    return { found: true, asked: !!ask && !ask.hidden,
             hidBtn: q.hidden, focus: focus,
             line: ask ? ask.querySelector('.capyui-pauseaskline').textContent : null };
  });
  // Escape backs out of the question, not out of the card.
  await page.keyboard.press('Escape');
  await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
  out.quitEscape = {
    askShut: await page.evaluate(() => {
      const a = document.querySelector('.capyui-pauseask'); return !!a && a.hidden;
    }),
    stillShown: await shown(),
  };

  // ======================================================================
  // F. THE BOARD IS STILL ONE PRESS AWAY, and Tab still opens it directly.
  // ======================================================================
  out.toJournal = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.capyui-pausebtn'))
      .filter(x => /journey/i.test(x.textContent))[0];
    if (!b) return { found: false };
    b.click();
    return { found: true,
             pause: document.querySelector('.capyui-pause').classList.contains('show'),
             jr: document.querySelector('.capyui-jr').classList.contains('show'),
             paused: !!window.__capy.state.paused };
  });
  await page.keyboard.press('Escape');
  await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
  out.afterJournalClose = {
    paused: await page.evaluate(() => !!window.__capy.state.paused),
    pause: await shown(),
  };

  out.err = await page.evaluate(() => {
    const g = window.__capy; return g.state.lastError ? String(g.state.lastError) : null;
  });
  const b = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r4-pause.json', { method: 'POST', body: s }), b);
}
