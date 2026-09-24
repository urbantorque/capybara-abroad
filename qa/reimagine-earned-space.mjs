// D5 shipped moment visibility, timer intent and deferred ownership. No browser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/systems.js', 'utf8');
const top = source.match(/function sysMomentVisible\([^]*?\n\}/)[0];
const endingTop = source.match(/function sysEndingSpace\([^]*?\n\}/)[0];
const fn = name => source.match(new RegExp('  function ' + name + '\\([^]*?\\n  \\}'))[0];
const endingClosure = fn('endingSpace');
const incidentalQuiet = source.match(/incidentalQuiet:\s*(function \([^]*?\n    \})/)[1];
const cardMs = Number(source.match(/const sysMOMENT_CARD\s*=\s*([\d.]+)/)[1]);
const deferSeconds = Number(source.match(/const sysMOMENT_DEFER\s*=\s*([\d.]+)/)[1]);
const gate = new Function(top + ';return sysMomentVisible;')();
const endingGate = new Function(endingTop + ';return sysEndingSpace;')();
let checks = 0;
const equal = (actual, expected, label) => { assert.equal(actual, expected, label); checks++; };
equal(cardMs, 2600, 'authored moment lifetime retained');
equal(deferSeconds, 8, 'authored deferred watchdog retained');
for (const closing of [undefined, false, true, 0, 1, 'closing'])
for (const cut of [undefined, false, true, 0, 1])
for (const rung of [undefined, -2, 0, .9, 1, 2, 5, NaN]) {
  equal(endingGate(closing, cut, rung), !!closing && !cut && (rung | 0) < 1,
    'exhaustive closing-only space gate');
}

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
  const game = { state: { noEarnedSpace: false, noEndingSpace: false, perfRung: 0, time: 10 } };
  const ctx = new Function('game', 'nodes', 'sysWall', 'setTimeout', 'clearTimeout', `
    const {momentEl,momentKick,momentText,momentNote}=nodes;
    let momentTimer=0,momentWanted=false,momentIncidental=false,momentVisible=false,
        placeEarned=false,showPlaceLast='',wowEarnedOn=false,wowLiveOn=false,sysMomentDefer=null,
        sysFinClosing=false,tutOn=false,tutEl=null,sysTickLastAt=0;
    const sysMOMENT_CARD=${cardMs},sysMOMENT_DEFER=${deferSeconds};
    // ROADMAP-TEN T2a: the card ranks the three functions now read
    ${source.match(/  const sysPRI_HOLD_MIN[^\n]*\n  const sysPRI_HOLD_BASE[^\n]*\n  let sysCardPri[^\n]*\n  let sysMomentDropped[^\n]*\n  const sysMomentShown[^\n]*\n/)[0]}
    const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
    ${fn('sysCardClaim')};${fn('sysCardBusy')};${fn('sysMomentHold')};
    ${top};${endingTop};${endingClosure};${fn('momentVisibilityTick')};${fn('showMoment')};${fn('showMomentNow')};${fn('sysMomentTick')};
    return {show:showMoment,now:showMomentNow,tick:sysMomentTick,
      earned:(on,title=on?'THE CONCERT':'')=>{placeEarned=on;showPlaceLast=title;},
      encore:on=>{wowEarnedOn=on;},live:on=>{wowLiveOn=on;},
      closing:on=>{sysFinClosing=on;},ending:endingSpace,quiet:${incidentalQuiet},
      tutorial:on=>{tutOn=on;tutEl=on?{parentNode:{},dataset:{}}:null;},
      recent:on=>{sysTickLastAt=on?game.state.time:0;},
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

const endingCards = [
  ['generic', ['AN INCIDENT', 'generic caption', '', true]],
  ['named', ['A NAMED CHAIN', 'named reward', 'a note', false]],
  ['mini', ['SMALL VICTORY', 'mini task completed']],
];
for (const [kind, args] of endingCards) for (const timing of ['preexisting', 'new']) {
  const f = fixture();
  if (timing === 'preexisting') {
    f.show(...args); equal(f.visible(), true, kind + ' visible before closing');
    f.advance(.5);
  }
  f.closing(true);
  if (timing === 'new') f.show(...args); else f.tick();
  equal(f.visible(), false, kind + '/' + timing + ' yields to closing coda');
  equal(f.state().wanted, true, 'closing hides presentation without deleting intent');
  equal(f.nodes.momentText.textContent, args[1], 'reward/lesson text retained');
  equal(f.timers.size, 1, 'original card timer retained during closing');
  const timer = [...f.timers.values()][0], writes = f.writes();
  f.tick(); f.tick(); equal(f.writes(), writes, 'unchanged closing writes no classes');
  for (const mode of ['flag', 'rung']) {
    f.game.state.noEndingSpace = mode === 'flag'; f.game.state.perfRung = mode === 'rung' ? 1 : 0; f.tick();
    equal(f.visible(), true, mode + ' exactly restores unexpired ' + kind);
    equal([...f.timers.values()][0], timer, 'fallback does not replace or extend timer');
    const cutWrites = f.writes(); f.tick(); equal(f.writes(), cutWrites, 'unchanged fallback writes no classes');
    f.game.state.noEndingSpace = false; f.game.state.perfRung = 0; f.tick();
    equal(f.visible(), false, 'live closing hides restored ' + kind);
  }
  f.closing(false); f.tick(); equal(f.visible(), true, 'short closing restores only remaining lifetime');
  equal([...f.timers.values()][0], timer, 'closing end leaves original expiry unchanged');
  f.closing(true); f.tick();
  f.advance(cardMs / 1000 - (timing === 'preexisting' ? .5 : 0) - .001);
  equal(f.state().wanted, true, 'intent remains just before original expiry');
  f.advance(.001); equal(f.state().wanted, false, 'original 2.6s timer expires while hidden');
  for (const mode of ['flag', 'rung', 'ended']) {
    f.game.state.noEndingSpace = mode === 'flag'; f.game.state.perfRung = mode === 'rung' ? 1 : 0;
    f.closing(mode !== 'ended'); f.tick();
    equal(f.visible(), false, kind + ' never resurrects after expiry: ' + mode);
  }
}
for (const [kind, args] of endingCards) for (const drain of ['early', 'watchdog']) {
  const f = fixture(); f.live(true); f.show(...args); f.closing(true);
  equal(f.timers.size, 0, 'deferred ' + kind + ' has no premature timer');
  equal(f.state().deferred.text, args[1], 'deferred content not dropped by closing');
  if (drain === 'early') f.live(false); else f.advance(deferSeconds);
  f.tick(); equal(f.state().deferred, null, drain + ' still drains during closing');
  equal(f.state().wanted, true, 'drained card owns original intent');
  equal(f.visible(), false, 'drained ' + kind + ' hidden only for closing');
  equal([...f.timers.values()][0].ms, cardMs, 'drain uses original 2.6s lifetime');
  f.game.state.noEndingSpace = true; f.tick(); equal(f.visible(), true, 'cut exposes unexpired deferred ' + kind);
  f.game.state.noEndingSpace = false; f.tick();
  f.advance(cardMs / 1000); f.closing(false); f.tick();
  equal(f.visible(), false, 'expired deferred ' + kind + ' does not return after coda');
}
{
  const f = fixture();
  equal(f.quiet(), false, 'ordinary idle does not silence incidental speech');
  f.closing(true); equal(f.ending(), true, 'actual closure reads closing state');
  equal(f.quiet(), true, 'actual HUD speech accessor yields during closing');
  for (const mode of ['flag', 'rung']) {
    f.game.state.noEndingSpace = mode === 'flag'; f.game.state.perfRung = mode === 'rung' ? 1 : 0;
    equal(f.quiet(), false, mode + ' restores inherited incidental eligibility');
    f.tutorial(true); equal(f.quiet(), true, mode + ' retains protected tutorial quiet');
    f.tutorial(false); f.recent(true); equal(f.quiet(), true, mode + ' retains existing earned-action quiet');
    f.recent(false);
  }
  f.game.state.noEndingSpace = false; f.game.state.perfRung = 0;
  f.closing(false); equal(f.quiet(), false, 'closing end restores ordinary speech eligibility');
  f.earned(true); f.show('AN INCIDENT', 'generic', '', true); f.closing(true);
  f.game.state.noEndingSpace = true; f.tick();
  equal(f.visible(), false, 'ending cut preserves independent earned-space suppression');
  f.game.state.noEarnedSpace = true; f.tick(); equal(f.visible(), true, 'both cuts restore inherited generic card');
}

const incidentCall = source.match(/showMoment\(tier === 2 \? 'A SCENE'[^]*?\);/)[0];
for (const tier of [1, 2]) for (const named of [null, { name: 'A NAMED CHAIN' }]) {
  let args;
  new Function('showMoment', 'tier', 'named', 'sentence', incidentCall)((...a) => { args = a; }, tier, named, 'sentence');
  equal(args[3], !named, 'only unnamed incident publisher opts in');
  equal(args[1], named ? named.name : 'sentence', 'named reward contents unchanged');
}
const compact = source.match(/const wantMarq = ([^;]+);/)[1];
// T2a: `owned` (a live marquee or ride, sysFrameOwned) is false here: the inherited gate
const helmGate = new Function('busy', 'want', 'wowLiveOn', 'wowEarnedOn', 'marqId', 'game', 'const owned = false; return ' + compact);
for (const busy of [false, true]) for (const tucked of [false, true])
for (const live of [false, true]) for (const encore of [false, true])
for (const id of ['', 'marquee']) for (const helm of [false, true]) {
  equal(helmGate(busy, tucked, live, encore, id, { capy: { atHelm: helm } }),
    !busy && !tucked && (live || encore || (!!id && helm)), 'actual compact-paper eligibility');
}
equal((source.match(/momentEl.classList.toggle\('show'/g) || []).length, 1, 'one moment visibility writer');
equal((source.match(/momentEl.classList\.(add|remove)\('show'/g) || []).length, 0, 'no competing moment show writers');
const finaleClose = fn('sysFinaleClose');
const closingAt = finaleClose.indexOf('sysFinClosing = true;');
const visibilityAt = finaleClose.indexOf('momentVisibilityTick();');
equal(closingAt >= 0 && visibilityAt > closingAt && visibilityAt < finaleClose.indexOf('sysFinaleCoda();'),
  true, 'closing edge hides existing card before the coda is scheduled');
assert.ok(source.includes('showMoment: function (k, t, n, incidental) { showMoment(k, t, n, incidental); }'));
checks++;
console.log(`Earned space: ${checks} actual-function gate, timer, deferred, publisher and helm checks passed.`);
