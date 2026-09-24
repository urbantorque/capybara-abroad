// D3: run the shipped continuation gate, not a second policy implementation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s = readFileSync('src/systems.js', 'utf8');
const e = readFileSync('src/environment.js', 'utf8');
const body = s.match(/function sysEarnedLive\([^]*?\n\}/)?.[0];
assert.ok(body, 'shipped continuation gate exists');
const stale = Number(s.match(/const sysWOW_LIVE_STALE = ([\d.]+)/)[1]);
const gate = new Function('sysWOW_LIVE_STALE', body + ';return sysEarnedLive;')(stale);
const args = ['opera-stage', 'sydney', 'sydney', true, true, 'THE ENCORE', 0, false, 0, false];
let checks = 0;
function check(a, value, label) { checks++; assert.equal(gate(...a), value, label); }
check(args, true, 'earned explicit continuation');
for (const [index, values] of [[0, ['', null]], [1, ['', 'quay']], [2, ['quay']],
  [3, [false, null]], [4, [false]], [5, ['', null]], [6, [-1, .7, 1, Infinity, NaN]],
  [7, [true]], [8, [1, 2, 3]], [9, [true]]]) {
  for (const value of values) { const a = args.slice(); a[index] = value; check(a, false, `invalid gate argument ${index}`); }
}
for (let i = 0; i < 700; i++) { const a = args.slice(); a[6] = i / 1000; check(a, true, 'fresh publisher'); }
// Execute the actual publisher: ordinary calls must clear continuation ownership.
const publisher = s.match(/  function wowLive\([^]*?\n  \}/)[0];
const pub = new Function('game', 'clamp', `let wowLiveLine='',wowLiveT=-1,wowLiveSince=99,wowEarnedId='',wowEarnedBiome='';
  ${publisher}; return {send:wowLive,read:()=>({wowLiveLine,wowLiveT,wowLiveSince,wowEarnedId,wowEarnedBiome})};`)
  ({ biome: { current: 'sydney' } }, (x, lo, hi) => Math.max(lo, Math.min(hi, x)));
pub.send('THE ENCORE', 1, 'opera-stage');
assert.equal(pub.read().wowEarnedId, 'opera-stage');
assert.equal(pub.read().wowEarnedBiome, 'sydney');
pub.send('ordinary completed publisher', .5);
assert.equal(pub.read().wowEarnedId, '');
assert.equal(pub.read().wowEarnedBiome, '');
assert.equal(pub.read().wowLiveSince, 0);
assert.ok(e.includes("Math.ceil(envEncoreT) + ' s', 1, 'opera-stage')"), 'Sydney explicit opt-in');
assert.ok(s.includes('const wl = !!marqId && wowLiveSince < sysWOW_LIVE_STALE;'), 'musical live eligibility unchanged');
// T2a: a live marquee or ride (sysFrameOwned) cannot auto-tuck either
assert.ok(s.includes('const want = !wowEarnedOn && !owned && todoAwayT > sysTUCK_AFTER;'), 'active action cannot auto-tuck');
assert.ok(s.includes("marqEl.classList.toggle('continuation', earned)"), 'display-only visibility class');
assert.ok(s.includes('if (!game.state.paused && !game.state.noEarnedFocus'), 'paused panels hide continuation');
const blockStart = s.indexOf('const earnedBio = game.biome');
const block = s.slice(blockStart, s.indexOf('const earnedChanged', blockStart));
const eligibility = new Function('game', 'fixture', 'sysEarnedLive', `
  let wowEarnedId=fixture.id,wowEarnedBiome=fixture.owner;
  const transBusy=fixture.transition,taskRec={'opera-stage':{done:true,def:{chapter:1}}},
    wowLiveLine='THE ENCORE',wowLiveSince=fixture.age,chapterOf=()=>1;
  ${block}
  return {earned,id:wowEarnedId};`);
for (const paused of [false, true]) for (const cut of [false, true])
  for (const rung of [0, 1]) for (const transition of [false, true]) {
    const game = { state: { paused, noEarnedFocus: cut, perfRung: rung }, biome: { current: 'sydney' } };
    const fixture = { id: 'opera-stage', owner: 'sydney', age: .1, transition };
    const result = eligibility(game, fixture, gate);
    assert.equal(result.earned, !paused && !cut && rung < 1 && !transition, 'actual HUD gate combination');
    if (transition) assert.equal(result.id, '', 'transition releases owner');
  }
assert.ok(s.includes('if (earnedChanged) yuzuWalletReposition();'), 'state changes immediately redock wallet');
console.log(`Encore: ${checks} shipped-gate cases plus publisher ownership and HUD wiring passed.`);
