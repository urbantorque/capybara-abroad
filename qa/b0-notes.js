async page => {
  // ---------------------------------------------------------------------------
  // qa/b0-notes.js — READ THE SESSION BACK (ROADMAP-FUN item 0)
  //
  // Run after the stranger has finished. Writes two things into qa/:
  //
  //   B0-session.txt.png   the timeline, readable, one line an event
  //   b0-notes.json.png    the same as JSON, plus the summary row
  //
  // THE SUMMARY ROW IS THE POINT. It is deliberately the same four numbers
  // `qa/first-five.js` prints for its random-walk driver — first tick, first
  // sight of the marquee, seen in, longest gap — so the stranger's row can be
  // put directly under the driver's table in ROADMAP-FUN and read against it.
  // The roadmap's own rule: "If B0's stranger disagrees with the driver about
  // where they stalled, the stranger is right."
  // ---------------------------------------------------------------------------
  const B = await page.evaluate(() => {
    const b = window.__b0;
    if (!b) return null;
    b.ended = true;
    const total = b.t0 ? (performance.now() - b.t0) / 1000 : 0;
    // SPLIT AT BEGIN. At the title card the number keys ARE the picker's own
    // labels — every tile prints its key — so a Digit1 there is not 'a thing
    // they tried that the game never mentioned', and the first cut listed it
    // as one. B0 is asking about the game, not the card in front of it.
    const S = b.startedAt < 0 ? 1e9 : b.startedAt;
    const tried = [], known = [], onCard = [];
    for (const k in b.keys) {
      const r = { key: k, n: b.keys[k].n, first: b.keys[k].first };
      if (r.first < S) onCard.push(r);
      else (b.keys[k].inLegend ? known : tried).push(r);
    }
    const firstTask = (b.rows.filter(function (r) { return r.kind === 'task'; })[0] || {}).t;
    const places = b.rows.filter(function (r) { return r.kind === 'place'; })
                         .map(function (r) { return r.what; });
    return {
      total: +total.toFixed(1), startedAt: b.startedAt, titleFor: b.titleFor,
      onCard: onCard.sort(function (a, c) { return a.first - c.first; }),
      firstMove: b.firstMove,
      firstTask: firstTask === undefined ? null : firstTask,
      tasks: b.rows.filter(function (r) { return r.kind === 'task'; }).length,
      marqSee: b.marqSee,
      marqPct: b.marqSamples ? +(100 * b.marqSeen / b.marqSamples).toFixed(1) : 0,
      gapMax: b.gapMax, gapAt: b.gapAt, clicks: b.clicks,
      places: places,
      readControls: b.rows.some(function (r) { return r.kind === 'read the controls'; }),
      offLegend: tried.sort(function (a, c) { return a.first - c.first; }),
      onLegend: known.sort(function (a, c) { return a.first - c.first; }),
      rows: b.rows,
      legend: b.legend,
    };
  });
  if (!B) {
    await page.evaluate(() => fetch('/shot?name=b0-notes.json', {
      method: 'POST',
      body: btoa('{"err":"no recorder in this page - run qa/b0-watch.js first"}'),
    }));
    return;
  }
  const pad = (s, n) => (s + '                    ').slice(0, n);
  const mmss = (t) => (t === null || t === undefined || t < 0) ? '  —  '
    : (Math.floor(t / 60) + ':' + ('0' + Math.floor(t % 60)).slice(-2));
  const L = [];
  L.push('B0 — WHAT THE STRANGER DID');
  L.push('='.repeat(64));
  L.push('');
  // EVERY TIME BELOW IS FROM THE MOMENT THEY PRESSED BEGIN, not from page
  // load. How long the title card held them is its own line and a real B0
  // number; folding it into everything else made it the longest silence in
  // every session and pushed each timing out by however long they read.
  const rel = function (t) { return (t === null || t === undefined || t < 0) ? t : t - B.startedAt; };
  L.push('time on the title card ' + mmss(B.titleFor));
  L.push('then, from Begin:');
  L.push('  length of play       ' + mmss(B.total - B.startedAt));
  L.push('  first moved at       ' + mmss(rel(B.firstMove)));
  L.push('  first task ticked    ' + mmss(rel(B.firstTask)) + '   (' + B.tasks + ' in all)');
  L.push('  first saw the marquee ' + mmss(rel(B.marqSee)) + '  (in frame ' + B.marqPct + '% of samples)');
  L.push('  longest idle         ' + B.gapMax + 's, at ' + mmss(rel(B.gapAt)));
  L.push('places entered         ' + (B.places.join(', ') || '—'));
  L.push('went looking for the controls  ' + (B.readControls ? 'YES' : 'no'));
  L.push('');
  L.push('KEYS THEY TRIED THAT THE GAME HAS NEVER MENTIONED');
  L.push('(the legend is: ' + B.legend.join(' ') + ')');
  if (!B.offLegend.length) L.push('  none');
  for (const k of B.offLegend) {
    L.push('  ' + pad(k.key, 14) + ' first at ' + mmss(rel(k.first)) + ',  ' + k.n + ' time(s)');
  }
  if (B.onCard.length) {
    L.push('');
    L.push('...and what they pressed at the title card, before Begin');
    for (const k of B.onCard) {
      L.push('  ' + pad(k.key, 14) + ' at ' + mmss(k.first) + ' of the card');
    }
  }
  L.push('');
  L.push('KEYS ON THE LEGEND, IN THE ORDER THEY FOUND THEM');
  for (const k of B.onLegend) {
    L.push('  ' + pad(k.key, 14) + ' first at ' + mmss(rel(k.first)) + ',  ' + k.n + ' time(s)');
  }
  L.push('');
  L.push('THE TIMELINE');
  L.push('-'.repeat(64));
  for (const r of B.rows) {
    L.push(pad(mmss(rel(r.t)), 8) + pad(r.kind, 22) + (r.what || ''));
  }
  L.push('');
  L.push('FOR THE TABLE IN ROADMAP-FUN — the stranger\'s row, against the driver\'s:');
  L.push('  first tick ' + mmss(rel(B.firstTask)) + '  ·  marquee ' + mmss(rel(B.marqSee)) +
         '  ·  seen in ' + B.marqPct + '%  ·  longest gap ' + B.gapMax + 's');
  const text = L.join('\n');

  await page.evaluate((s) => fetch('/shot?name=B0-session.txt', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(s))),
  }), text);
  await page.evaluate((o) => fetch('/shot?name=b0-notes.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), B);
}
