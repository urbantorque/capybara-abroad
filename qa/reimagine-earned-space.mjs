// D5 shipped moment visibility, timer intent and deferred ownership. No browser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/systems.js', 'utf8');
const top = source.match(/function sysMomentVisible\([^]*?\n\}/)[0];
const fn = name => source.match(new RegExp('  function ' + name + '\\([^]*?\\n  \\}'))[0];
const cardMs = Number(source.match(/const sysMOMENT_CARD\s*=\s*([\d.]+)/)[1]);
const deferSeconds = Number(source.match(/const sysMOMENT_DEFER\s*=\s*([\d.]+)/)[1]);
const gate = new Function(top + ';return sysMomentVisible;')();
let checks = 0;
const equal = (actual, expected, label) => { assert.equal(actual, expected, label); checks++; };
equal(cardMs, 2600, 'authored moment lifetime retained');
equal(deferSeconds, 8, 'authored deferred watchdog retained');

for (const wanted of [false, true]) for (const incidental of [false, true])
for (const card of [false, true, 'THE CONCERT']) for (const encore of [false, true])
for (const cut of [undefined, false, true]) for (const rung of [undefined, 0, 1, 2, 5]) {
  equal(gate(wanted, incidental, card, encore, cut, rung),
    wanted && (!incidental || (!card && !encore) || !!cut || (rung | 0) >= 1),
    'exhaustive visibility gate, including actual headline-string input');
}

function fixture() {
  let now = 0, sequence = 0, classWrites = 0;
  const timers = new Map(), classes = new Set();
  const nodes = { momentEl: { classList: { toggle: (name, on) => {
    classWrites++; if (on) classes.add(name); else classes.delete(name);
  } } } };
  for (const name of ['momentKick', 'momentText', 'momentNote']) nodes[name] = { textContent: '', style: {} };
  const game = { state: { noEarnedSpace: false, perfRung: 0 } };
  const ctx = new Function('game', 'nodes', 'sysWall', 'setTimeout', 'clearTimeout', `
    const {momentEl,momentKick,momentText,momentNote}=nodes;
    let momentTimer=0,momentWanted=false,momentIncidental=false,momentVisible=false,
        placeEarned=false,showPlaceLast='',wowEarnedOn=false,wowLiveOn=false,sysMomentDefer=null;
    const sysMOMENT_CARD=${cardMs},sysMOMENT_DEFER=${deferSeconds};
    ${top};${fn('momentVisibilityTick')};${fn('showMoment')};${fn('showMomentNow')};${fn('sysMomentTick')};
    return {show:showMoment,now:showMomentNow,tick:sysMomentTick,
      earned:(on,title=on?'THE CONCERT':'')=>{placeEarned=on;showPlaceLast=title;},
      encore:on=>{wowEarnedOn=on;},live:on=>{wowLiveOn=on;},
      state:()=>({wanted:momentWanted,incidental:momentIncidental,deferred:sysMomentDefer})};
  `)(game, nodes, () => now, (callback, ms) => {
    const id = ++sequence; timers.set(id, { callback, due: now + ms / 1000, ms }); return id;
  }, id => timers.delete(id));
  return { ...ctx, game, nodes, timers, visible: () => classes.has('show'), writes: () => classWrites,
    advance(seconds) {
      const target = now + seconds;
      for (;;) {
        const next = [...timers.entries()].filter(([, t]) => t.due <= target).sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        timers.delete(next[0]); now = next[1].due; next[1].callback();
      }
      now = target;
    } };
}

for (const busy of ['earned', 'encore']) {
  const f = fixture(); f[busy](true); f.show('AN INCIDENT', 'generic caption', '', true);
  equal(f.visible(), false, busy + ' hides only generic caption');
  equal(f.state().wanted, true, 'hidden moment retains live intent');
  equal(f.timers.size, 1, 'hidden moment still owns original timer');
  equal([...f.timers.values()][0].ms, cardMs, 'no replacement lifetime');
  for (const mode of ['flag', 'rung']) {
    f.game.state.noEarnedSpace = mode === 'flag'; f.game.state.perfRung = mode === 'rung' ? 1 : 0; f.tick();
    equal(f.visible(), true, mode + ' reveals unexpired caption');
    equal(f.timers.size, 1, 'cut does not restart timer');
    f.game.state.noEarnedSpace = false; f.game.state.perfRung = 0; f.tick();
    equal(f.visible(), false, 'live mode yields again');
  }
  const writes = f.writes(); f.tick(); f.tick();
  equal(f.writes(), writes, 'unchanged state makes no class writes');
  f.advance(cardMs / 1000);
  equal(f.state().wanted, false, 'actual timer clears hidden intent');
  for (const mode of ['flag', 'rung', 'free']) {
    f.game.state.noEarnedSpace = mode === 'flag'; f.game.state.perfRung = mode === 'rung' ? 1 : 0;
    if (mode === 'free') f[busy](false);
    f.tick(); equal(f.visible(), false, 'expired caption cannot resurrect: ' + mode);
  }
}

{
  const f = fixture(); f.show('AN INCIDENT', 'already visible', '', true);
  equal(f.visible(), true, 'ordinary incidental visible outside earned space');
  f.earned(true); f.tick(); equal(f.visible(), false, 'earned start hides existing caption');
  f.earned(false); f.tick(); equal(f.visible(), true, 'earned end restores remaining lifetime');
  f.earned(true); f.show('THE HERD', 'protected instruction', 'keep this');
  equal(f.visible(), true, 'default nonincidental overrides hidden caption');
  equal(f.state().incidental, false, 'replacement clears incidental bit');
  equal(f.nodes.momentNote.textContent, 'keep this', 'protected contents retained');
  equal(f.timers.size, 1, 'replacement cancels previous timer');
  f.advance(cardMs / 1000); equal(f.visible(), false, 'protected moment retains ordinary expiry');
}

{
  const f = fixture(); f.earned(true); f.live(true); f.show('AN INCIDENT', 'deferred generic', '', true);
  equal(f.timers.size, 0, 'deferred publication does not start card timer');
  equal(f.state().deferred.incidental, true, 'deferred slot carries incidental ownership');
  f.advance(deferSeconds - 0.001); f.tick(); equal(f.state().wanted, false, 'watchdog waits until boundary');
  f.advance(0.001); f.tick();
  equal(f.state().deferred, null, 'original eight-second watchdog drains despite live marquee');
  equal(f.state().incidental, true, 'drained generic retains bit');
  equal(f.visible(), false, 'drained generic yields without extending deferral');
  equal(f.timers.size, 1, 'drain starts original lifetime even while hidden');
  f.advance(cardMs / 1000); f.earned(false); f.tick(); equal(f.visible(), false, 'deferred hidden timer also cannot resurrect');
}

{
  const f = fixture(); f.live(true); f.encore(true); f.show('AN INCIDENT', 'older', '', true);
  f.advance(1); f.show('THE HERD', 'new protected lesson', 'note');
  equal(f.state().deferred.incidental, false, 'new protected publication replaces bit in existing slot');
  f.live(false); f.tick();
  equal(f.visible(), true, 'original early drain delivers protected content during encore');
  equal(f.nodes.momentText.textContent, 'new protected lesson', 'latest deferred contents retained');
  equal(f.nodes.momentNote.style.display, '', 'optional note retains inherited display');
}

const incidentCall = source.match(/showMoment\(tier === 2 \? 'A SCENE'[^]*?\);/)[0];
for (const tier of [1, 2]) for (const named of [null, { name: 'A NAMED CHAIN' }]) {
  let args;
  new Function('showMoment', 'tier', 'named', 'sentence', incidentCall)((...a) => { args = a; }, tier, named, 'sentence');
  equal(args[3], !named, 'only unnamed incident publisher opts in');
  equal(args[1], named ? named.name : 'sentence', 'named reward contents unchanged');
}
const compact = source.match(/const wantMarq = ([^;]+);/)[1];
const helmGate = new Function('busy', 'want', 'wowLiveOn', 'wowEarnedOn', 'marqId', 'game', 'return ' + compact);
for (const busy of [false, true]) for (const tucked of [false, true])
for (const live of [false, true]) for (const encore of [false, true])
for (const id of ['', 'marquee']) for (const helm of [false, true]) {
  equal(helmGate(busy, tucked, live, encore, id, { capy: { atHelm: helm } }),
    !busy && !tucked && (live || encore || (!!id && helm)), 'actual compact-paper eligibility');
}
equal((source.match(/momentEl.classList.toggle\('show'/g) || []).length, 1, 'one moment visibility writer');
equal((source.match(/momentEl.classList\.(add|remove)\('show'/g) || []).length, 0, 'no competing moment show writers');
assert.ok(source.includes('showMoment: function (k, t, n, incidental) { showMoment(k, t, n, incidental); }'));
checks++;
console.log(`Earned space: ${checks} actual-function gate, timer, deferred, publisher and helm checks passed.`);
