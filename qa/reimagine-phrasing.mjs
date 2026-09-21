// REIMAGINE F3: real composition/scheduler/voice-leading, mocked AudioParams.
// Normal clocks, in-flight entry and stalled-clock recovery are contracts.
// These automation fixtures do not render audio or establish listening quality.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';

const source = stripComments(readFileSync(new URL('../src/systems.js', import.meta.url), 'utf8'));
function ending(start, functionBody = false) {
  let quote = '', escape = false, depth = 0;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === quote) quote = '';
      continue;
    }
    if ('\'"`'.includes(c)) { quote = c; continue; }
    if (functionBody && c === '{') depth++;
    if (functionBody && c === '}' && --depth === 0) return i + 1;
    if (!functionBody && c === ';') return i + 1;
  }
  throw Error('Unclosed source term at ' + start);
}
function fn(name) {
  const at = source.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'shipped function ' + name);
  return source.slice(at, ending(source.indexOf('{', at), true));
}
const declarations = [...source.matchAll(/^const sysMUS_\w+\s*=/gm)].map(m => source.slice(m.index, ending(m.index)));
assert.ok(declarations.length > 100, 'actual composition declarations extracted');
const names = ['sysMidiHz', 'sysMusPick', 'musFold', 'musSnap', 'musDegOff', 'musThemeNotes',
  'musProgChord', 'musProgLen', 'musThemeBase', 'musOcaBase', 'musStmtBeat', 'musStmtNoteT',
  'musStmtStart', 'musStmtTick', 'musStmtEnd', 'musSetChord', 'musSetChordTo'];
// A future clarity helper is also sourced, never duplicated in the fixture.
for (const helper of ['sysPhraseClarity', 'musPhraseClarity', 'sysScorePhraseClarity']) {
  if (source.includes('function ' + helper + '(')) names.push(helper);
}
const program = new vm.Script(declarations.join('\n') + '\n' + names.map(fn).join('\n'));
let assertions = 0;
const failures = [];
const check = (ok, label) => { assertions++; if (!ok) failures.push(label); };
const json = value => JSON.parse(JSON.stringify(value));

function simulation(palette, kind, mode = 'live', scenario = null) {
  const issues = [], params = [], notes = [], chords = [], picks = [], chordState = [];
  let writeOrder = 0, now = 0;
  function param(id, value = 0, bankGain = null) {
    const events = [];
    const p = { get value() { return p.at(now); }, events, id,
      at(time) {
        let t = 0, v = value;
        for (const e of events.slice().sort((a, b) => a.t - b.t || a.order - b.order)) {
          if (e.t > time) return e.type === 'ramp' && e.t > t ? v + (e.v - v) * Math.max(0, (time - t) / (e.t - t)) : v;
          t = e.t; v = e.v;
        }
        return v;
      },
      setValueAtTime(v, t) {
        assert.ok(Number.isFinite(v) && Number.isFinite(t), 'finite automation');
        const context = { calledAt: now, clarity: !q.game.state.noPhraseClarity && q.game.state.perfRung < 1 };
        if (bankGain && bankGain.at(t) > 1e-7 && events.length) issues.push({ ...context, kind: 'retuneAudibleBank', id, t, gain: bankGain.at(t) });
        const pending = events.some(e => e.type === 'ramp' && e.t > t + 1e-8);
        if (!bankGain && pending && Math.abs(p.at(t) - v) > 1e-7) issues.push({ ...context, kind: 'restartUnfinishedGain', id, t, from: p.at(t), to: v });
        events.push({ type: 'set', v, t, order: writeOrder++, calledAt: now });
      },
      linearRampToValueAtTime(v, t) { events.push({ type: 'ramp', v, t, order: writeOrder++, calledAt: now }); },
      cancelScheduledValues(t) {
        for (let i = events.length - 1; i >= 0; i--) if (events[i].t >= t) events.splice(i, 1);
      },
      cancelAndHoldAtTime(t) { const v = p.at(t); p.cancelScheduledValues(t); p.setValueAtTime(v, t); },
    };
    params.push(p); return p;
  }
  function voice(centre, level, prefix) {
    return { centre, level, note: centre, active: 0, banks: [0, 1].map(b => {
      const gain = param(prefix + '.bank' + b + '.gain', b ? 0 : level);
      return { g: { gain }, lvlNow: b ? 0 : level,
        oscs: [{ frequency: param(prefix + '.bank' + b + '.hz', 440, gain) }] };
    }) };
  }
  const q = vm.createContext({
    Math, game: { state: { noPhraseClarity: mode === 'legacy', perfRung: mode === 'rung1' ? 1 : 0 } },
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), rand: (a, b) => (a + b) / 2,
    randInt: a => a, ac: { currentTime: 0, state: 'running' }, musVol: {},
    musStmt: null, musStmtReq: null, musStmtChapN: 0, musStmtRestT: 0, musStmtRestGap: 0,
    musStmtN: { full: 0, A: 0, wake: 0, tag: 0 }, musStmtMoment: { arrive: 0, rest: 0 },
    musStmtLast: null, musStmtCmN: 0, musStmtCut: 0, musOstArmed: false,
    musMotifEv: { sydneyOpen: 0 }, musMotifN: { home: 0 },
    musChordAt: 0, musChordStart: 0, musHarmonyReadyAt: 0, musDwellNow: 12, musNextIdx: -1, musVerseN: 0,
    musIdx: 0, musProg: 1, musSleep: 0, musBreath: 1, musBassIn: null,
    musUsed: [], musPrevChord: null, musBarAnchor: 0.1, musBeatLen: 0,
    musVel: v => v, musLiftNote: (...args) => notes.push(args), voice,
    logPick: (...args) => picks.push(json(args)), logChord: (...args) => {
      chords.push(json(args));
      chordState.push({ calledAt: now, dwell: q.musDwellNow,
        clarity: !q.game.state.noPhraseClarity && q.game.state.perfRung < 1 });
    },
  });
  program.runInContext(q);
  const lookahead = vm.runInContext('sysMUS_LOOK', q);
  assert.equal(lookahead, 2, 'fixture follows shipped two-second horizon');
  vm.runInContext(`
    musPalN = ${palette}; musPal = sysMUS_PAL[musPalN]; musCurChord = musPal.chords[0];
    musBeatLen = musPal.band === 'salsa' ? musPal.eighth * 2 :
      musPal.band === 'samba' ? musPal.sixteenth * musPal.barSixteenths / 2 :
      musPal.band === 'gnawa' ? musPal.pulse * musPal.cellPulses / 4 :
      musPal.band === 'baroque' ? musPal.quaver * musPal.barQuavers / 4 :
      musPal.band ? musPal.sixteenth * musPal.barSixteenths / 4 : 0;
    musVoices = sysMUS_CENTRE.map((n,i) => voice(n,sysMUS_LEVEL[i],'pad'+i));
    musVoices.push(voice(sysMUS_SHIM,sysMUS_SHIM_L,'shimmer'));
    sysMUS_CHOIR_C.forEach((n,i) => musVoices.push(voice(n,sysMUS_CHOIR_L[i],'choir'+i)));
    sysMUS_LIFT.forEach((n,i) => musVoices.push(voice(n,sysMUS_LIFT_L[i],'lift'+i)));
    musBassV = voice(33,.5,'bass'); musBass2V = voice(45,sysMUS_VOICE.bass2,'bassPartial');
    const rawPick = sysMusPick;
    sysMusPick = function(...args) { const n = rawPick(...args); logPick(n); return n; };
    const rawChord = musSetChordTo;
    musSetChordTo = function(...args) { logChord(...args); return rawChord(...args); };
  `, q);
  // This closure-local table selects the same bass-walk behavior as the game.
  const bassWalk = source.match(/const sysMUS_BASSWALK\s*=\s*[^;]+;/)?.[0];
  assert.ok(bassWalk); vm.runInContext(bassWalk, q);
  if (scenario === 'entry') {
    q.musSetChord(1, 0, q.musPal.xfade);
    q.ac.currentTime = now = .2;
  }
  const legacyStart = q.musSnap(q.ac.currentTime + .15);
  q.musStmtStart({ kind, moment: 'arrive', scale: null }, q.ac.currentTime);
  const livePlan = q.musStmt;
  let planned = json(livePlan);
  const originalPlan = json(planned);
  const chordOffset = chords.length, pickOffset = picks.length;
  const end = planned.end;
  let stall = null, transition = null;
  const tick = t => {
    q.ac.currentTime = now = t;
    q.musStmtTick(t, t + lookahead);
  };
  if (scenario?.startsWith('return-')) {
    const stage = scenario.slice(7);
    const target = stage === 'pre' ? 0 : stage === 'early' ? 1 :
      stage === 'mid' ? Math.ceil(livePlan.ev.length * .35) : livePlan.ev.length;
    for (let t = now; livePlan.i < target && t < end; t += .1) tick(t);
    transition = { i: livePlan.i, before: json(livePlan.ev), at: now + .1,
      readyAt: q.musHarmonyReadyAt, chordCount: chords.length - chordOffset, handed: !!livePlan.handed };
    q.game.state.noPhraseClarity = false;
    q.game.state.perfRung = 0;
    tick(transition.at);
  } else if (scenario === 'late') {
    stall = { i: 0, before: json(livePlan.ev), at: now };
    // Six seconds without scheduler service before its first event.
    q.ac.currentTime = now = planned.t0 + 6;
    tick(now);
  } else if (scenario === 'mid' || scenario === 'tail') {
    const target = scenario === 'mid' ? Math.ceil(livePlan.ev.length * .35) : livePlan.ev.length;
    for (let t = now; livePlan.i < target && t < end; t += .1) tick(t);
    stall = { i: livePlan.i, before: json(livePlan.ev), at: now };
    tick(now + 6);
  }
  for (let t = now; t < Math.max(end, livePlan.end) + 2 && t < end + 30; t += .1) {
    tick(t);
  }
  planned = json(livePlan);
  const scheduled = chords.slice(chordOffset), stepChords = planned.ev.filter(e => e.kind === 'chord');
  const noteEvents = planned.ev.filter(e => e.kind === 'note');
  const scheduleFailures = [];
  for (let i = 0; i < stepChords.length; i++) {
    const actual = scheduled[i];
    const deadline = i + 1 < stepChords.length ? stepChords[i + 1].t : planned.end;
    if (!actual) { scheduleFailures.push({ chord: i, missing: true }); continue; }
    if (actual[3] + actual[4] > deadline + 1e-7) scheduleFailures.push({ chord: i,
      when: actual[3], fade: actual[4], deadline, dwell: stepChords[i].dwell });
  }
  const pastWrites = params.flatMap(p => p.events.filter(e => e.t < e.calledAt - 1e-7)
    .map(e => ({ id: p.id, ...e })));
  return { palette, kind, mode, scenario, paletteFade: q.musPal.xfade, legacyStart,
    planned, originalPlan, stall, transition, scheduled, noteEvents,
    chordState: chordState.slice(chordOffset),
    dwell: q.musDwellNow, chordStart: q.musChordStart,
    dwellTarget: (q.musPal.dwellA + q.musPal.dwellB) / 2,
    bassWalk: vm.runInContext('musPal.bassWalk !== undefined ? musPal.bassWalk : (sysMUS_BASSWALK[musPalN] || 0)', q),
    bassEvents: params.filter(p => /^bass(?:Partial)?\.bank\d\.hz$/.test(p.id))
      .flatMap(p => p.events.map(e => ({ id: p.id, ...e }))),
    notes: json(notes), picks: json(picks.slice(pickOffset)), voiceCount: q.musVoices.length,
    scheduleFailures, issues, handoff: { idx: q.musIdx, at: q.musChordAt,
      statement: !!q.musStmt, completed: q.musStmtChapN, ostArmed: q.musOstArmed },
    pastWrites, automationCount: params.reduce((n, p) => n + p.events.length, 0) };
}

const baseline = new Map();
for (let palette = 0; palette < 21; palette++) for (const kind of ['full', 'A', 'tag', 'wake']) {
  const live = simulation(palette, kind), old = simulation(palette, kind, 'legacy');
  const rung = simulation(palette, kind, 'rung1'), key = palette + '/' + kind;
  baseline.set(key, old);
  check(live.noteEvents.length === (kind === 'full' ? 20 : kind === 'tag' ? 3 : 8), key + ' authored note count');
  check(JSON.stringify(live.planned.ev) === JSON.stringify(old.planned.ev), key + ' unchanged score events');
  check(JSON.stringify(live.picks) === JSON.stringify(old.picks), key + ' unchanged nearest-tone selection');
  check(live.picks.length === live.scheduled.length * live.voiceCount, key + ' every chord voice-led once');
  check(JSON.stringify(live.handoff) === JSON.stringify(old.handoff), key + ' unchanged drift handoff');
  check(JSON.stringify(rung.scheduled) === JSON.stringify(old.scheduled), key + ' governor restores legacy schedule');
  check(live.scheduled.every((c, i) => JSON.stringify(c.slice(0, 4)) === JSON.stringify(old.scheduled[i].slice(0, 4))), key + ' unchanged chord/root/next/time');
  check(!live.scheduleFailures.length, key + ' fade finishes before next chord: ' + JSON.stringify(live.scheduleFailures[0] || null));
  check(!live.issues.length, key + ' stable-clock banks do not restart unfinished envelopes: ' + JSON.stringify(live.issues[0] || null));
  check(!live.handoff.statement && live.handoff.completed === 1, key + ' statement completes once');
}
let edgeCases = 0;
const composition = r => r.planned.ev.map(({ t, ...e }) => e);
const heardNotes = r => r.notes.map(([inst, t, ...note]) => [inst, ...note]);
const harmony = r => r.scheduled.map(c => c.slice(0, 3));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (let palette = 0; palette < 21; palette++) for (const kind of ['full', 'A', 'tag', 'wake']) {
  for (const scenario of ['entry', 'late', ...(kind === 'full' ? ['mid'] : [])]) {
    const r = simulation(palette, kind, 'live', scenario);
    const old = simulation(palette, kind, 'legacy', scenario);
    const rung = simulation(palette, kind, 'rung1', scenario);
    const normal = baseline.get(palette + '/' + kind), key = palette + '/' + kind + '/' + scenario;
    edgeCases++;
    check(!r.issues.length, key + ' no unfinished bank reuse: ' + JSON.stringify(r.issues[0] || null));
    check(!r.scheduleFailures.length, key + ' every chord settles before its successor');
    check(!r.pastWrites.length, key + ' no automation scheduled in the past');
    check(same(composition(r), composition(normal)), key + ' preserves ordered score excluding absolute clock');
    check(same(heardNotes(r), heardNotes(normal)), key + ' every lead/answer note delivered once in order');
    check(same(harmony(r), harmony(normal)), key + ' chord/root/next sequence preserved');
    check(r.picks.length === r.scheduled.length * r.voiceCount, key + ' each chord voice-led exactly once');
    check(!r.handoff.statement && r.handoff.completed === 1 && r.handoff.ostArmed, key + ' handoff exactly once');
    check(same(old.scheduled, rung.scheduled) && same(old.notes, rung.notes) && same(old.handoff, rung.handoff), key + ' flag and governor give exact same legacy timing');
    check(old.scheduled.every(c => c[4] === old.paletteFade), key + ' legacy retains authored fade values');
    check(old.originalPlan.t0 === old.legacyStart && same(old.planned.ev, old.originalPlan.ev), key + ' legacy retains old entry/late event timing');
    if (scenario === 'entry') {
      // The old fade began at zero. Its end is precisely the authored xfade.
      check(r.planned.t0 >= old.scheduled[0][4] + .04 - 1e-7, key + ' waits for inherited drift banks');
    } else {
      check(r.stall.i < r.planned.ev.length && (scenario !== 'mid' || r.stall.i > 0), key + ' stall genuinely interrupts unscheduled events');
      const shifts = r.planned.ev.map((e, i) => e.t - r.stall.before[i].t);
      const shift = shifts[r.stall.i];
      check(shift > 0, key + ' overdue remainder actually shifted');
      check(shifts.every((s, i) => Math.abs(s - (i < r.stall.i ? 0 : shift)) < 1e-7), key + ' leaves queued events intact and preserves remainder intervals');
      check(Math.abs((r.planned.end - r.originalPlan.end) - shift) < 1e-7, key + ' handoff end follows delay');
    }
  }
}
// Every event is queued before this stall. Recovery must move the handoff,
// not replay the melody or rewrite already scheduled note times.
let tailCases = 0;
for (let palette = 0; palette < 21; palette++) for (const kind of ['full', 'A', 'tag', 'wake']) {
  const r = simulation(palette, kind, 'live', 'tail');
  const old = simulation(palette, kind, 'legacy', 'tail');
  const rung = simulation(palette, kind, 'rung1', 'tail');
  const normal = baseline.get(palette + '/' + kind), key = palette + '/' + kind + '/tail';
  edgeCases++; tailCases++;
  check(r.stall.i === r.planned.ev.length, key + ' all events queued before stall');
  check(!r.pastWrites.length, key + ' handoff never schedules past automation: ' + JSON.stringify(r.pastWrites[0] || null));
  check(!r.issues.length, key + ' handoff never reuses unfinished banks');
  check(!r.scheduleFailures.length, key + ' authored phrase fades still finish on time');
  check(same(r.planned.ev, r.originalPlan.ev), key + ' queued note times unchanged');
  check(same(heardNotes(r), heardNotes(normal)), key + ' ordered notes delivered once');
  check(same(harmony(r), harmony(normal)), key + ' home chord/root sequence preserved');
  check(!r.handoff.statement && r.handoff.completed === 1 && r.handoff.ostArmed, key + ' completes once');
  check(same(old.scheduled, rung.scheduled) && same(old.notes, rung.notes) && same(old.handoff, rung.handoff), key + ' exact legacy/governor fallback');
  if (!r.planned.own) {
    check(r.scheduled.at(-1)[3] >= r.stall.at + 6 + .01 - 1e-7, key + ' delayed handoff starts after resumed clock');
    check(old.scheduled.at(-1)[3] === old.planned.end, key + ' legacy keeps original handoff time');
  }
}
// A governor recovery can happen inside a phrase, with inherited long fades
// already queued. Judge new clarity writes, not collisions queued before it.
let transitionCases = 0, bassWalkCases = 0;
function checkHandoffDwell(r, key) {
  if (r.planned.own) return;
  const hand = r.scheduled.at(-1), state = r.chordState.at(-1);
  check(Math.abs(r.dwell - r.dwellTarget) < 1e-7, key + ' handoff dwell excludes scheduler delay');
  check(Math.abs(state.dwell - r.dwellTarget) < 1e-7, key + ' chord writer receives new dwell before scheduling bass');
  check(Math.abs(r.handoff.at - hand[3] - r.dwellTarget) < 1e-7, key + ' next drift change measured from actual handoff');
  if (!(r.bassWalk > 0 && r.dwellTarget > 4)) return;
  bassWalkCases++;
  const events = r.bassEvents.filter(e => e.calledAt === state.calledAt);
  const expected = [hand[3], hand[3] + r.dwellTarget * .5 - .02,
    hand[3] + r.dwellTarget * .5, hand[3] + r.dwellTarget - .35];
  check(events.length === 8, key + ' both bass banks receive root/fifth/approach');
  check(events.every(e => expected.some(t => Math.abs(t - e.t) < 1e-7)), key + ' bass walk uses actual handoff interval');
  check(events.every(e => e.t >= hand[3] && e.t < r.handoff.at), key + ' bass walk stays inside new drift dwell');
}
for (let palette = 0; palette < 21; palette++) for (const kind of ['full', 'A', 'tag', 'wake']) {
  checkHandoffDwell(simulation(palette, kind), palette + '/' + kind + '/dwell');
  checkHandoffDwell(simulation(palette, kind, 'live', 'tail'), palette + '/' + kind + '/tail-dwell');
  for (const stage of ['pre', 'early', 'mid', 'tail']) {
    const scenario = 'return-' + stage;
    const flag = simulation(palette, kind, 'legacy', scenario);
    const rung = simulation(palette, kind, 'rung1', scenario);
    const normal = baseline.get(palette + '/' + kind);
    check(same(flag.scheduled, rung.scheduled) && same(flag.notes, rung.notes) && same(flag.handoff, rung.handoff),
      palette + '/' + kind + '/' + scenario + ' flag and governor recover identically');
    for (const r of [flag, rung]) {
      transitionCases++;
      const key = palette + '/' + kind + '/' + scenario + '/' + r.mode;
      const tr = r.transition;
      const freshIssues = r.issues.filter(i => i.clarity && i.calledAt >= tr.at);
      check(!freshIssues.length, key + ' resumed clarity never reuses unfinished banks: ' + JSON.stringify(freshIssues[0] || null));
      check(!r.pastWrites.filter(e => e.calledAt >= tr.at).length, key + ' recovery never writes past automation');
      check(!tr.handed, key + ' transition occurs before handoff');
      // Some tags fit wholly inside the real two-second first horizon.
      // Their earliest possible active transition is necessarily a tail.
      const firstHorizonTail = tr.i === r.planned.ev.length && r.originalPlan.ev.at(-1).t < 2;
      check(stage === 'pre' ? tr.i === 0 : stage === 'tail' ? tr.i === r.planned.ev.length :
        tr.i > 0 && (tr.i < r.planned.ev.length || firstHorizonTail), key + ' requested queue boundary exercised');
      check(same(composition(r), composition(normal)), key + ' ordered score content unchanged');
      check(same(heardNotes(r), heardNotes(normal)), key + ' all melody/answer notes delivered once');
      check(same(harmony(r), harmony(normal)), key + ' chord/root/next sequence unchanged');
      check(r.picks.length === r.scheduled.length * r.voiceCount, key + ' every chord voice-led exactly once');
      check(!r.handoff.statement && r.handoff.completed === 1, key + ' exactly one handoff');
      const shifts = r.planned.ev.map((e, i) => e.t - tr.before[i].t);
      const shift = tr.i < shifts.length ? shifts[tr.i] : 0;
      check(shifts.every((s, i) => Math.abs(s - (i < tr.i ? 0 : shift)) < 1e-7),
        key + ' queued events unchanged and unsaid intervals preserved');
      if (tr.i < shifts.length && tr.before[tr.i].t < tr.readyAt + .04) {
        check(r.planned.ev[tr.i].t >= tr.readyAt + .04 - 1e-7, key + ' unsaid remainder waits for inherited fade');
      }
      checkHandoffDwell(r, key);
    }
  }
}
console.log(JSON.stringify({ assertions, edgeCases, tailCases, transitionCases, bassWalkCases, failed: failures.length, failures: failures.slice(0, 15),
  scope: 'Actual score events/scheduler/voice-leading with deterministic random midpoint and mock AudioParams; not rendered audio or listening evidence.' }, null, 2));
if (failures.length) process.exitCode = 1;
