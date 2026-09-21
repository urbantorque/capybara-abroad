// ROADMAP-REIMAGINE F2. Execute shipped speech admission and delivery with
// small world/DOM doubles. The renderer and audio synth are downstream.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';

const src = stripComments(readFileSync('src/npc.js', 'utf8'));
function fn(name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  const open = src.indexOf('{', start);
  let depth = 1, end = open + 1;
  while (depth && end < src.length) {
    if (src[end] === '{') depth++;
    if (src[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0, name + ' balanced');
  return src.slice(start, end);
}
const begin = src.indexOf('const npcSpeechIdle =');
const end = src.indexOf('function sayBubble(', begin);
assert.ok(begin > 0 && end > begin);
const companyConstants = [...src.matchAll(/const npcLOC_CO_[A-Z]+\s*=\s*[^;]+;/g)].map(m => m[0]).join('\n');
const real = src.slice(begin, end) + companyConstants + fn('npcBubblesLive') + fn('sayBubble') +
  fn('localLine') + fn('pickLine') + fn('localsCompany') + fn('localsChat') + fn('chatStep');
let checks = 0;
function world() {
  const calls = [], bubbles = Array.from({ length: 4 }, () => ({ owner: null, t: 0,
    life: 0, shown: false, el: {}, txt: {} }));
  const game = { state: { started: true, time: 100, perfRung: 0 },
    biome: { current: 'sydney' }, capy: { position: { x: 0, y: 0, z: 0 } },
    hud: { incidentalQuiet: () => false } };
  const q = vm.createContext({ game, BUB: 4, bubbles, npcStartAt: 0,
    npcFIRST_T: 10, npcFIRST_CAP: 2, npcSpeak: {}, npcSayOpt: {},
    sfx: (...args) => calls.push(args),
    localResolve: a => a || [], npcEchoHas: () => false, npcEchoPush: () => {},
    randInt: () => 0, rand: (a, b) => (a + b) / 2,
    npcLINES: { idle: ['A passing line.'], chatA: ['An opener.'], chatB: ['An answer.'] }, npcLastGlobal: {},
    locals: [], locCoReply: null, locCoWhen: 0, locCoSpeech: null, locCoT: 0,
    locCoPairs: {}, locCoN: 0, locCoRows: [], locChatRec: null, locChatWhen: 0,
    locChatSpeech: null, locChatT: 0, npcLOC_CHAT_R: 13, npcLOC_CHAT_LOOK: 3,
    npcSay: () => undefined, npcSayFor: () => undefined,
    npcLOC_CHAT: { open: ['A passing opener.'], back: ['A passing reply.'] },
    chatReplyRec: null, chatReplyT: 0, chatReplyKey: '', chatReplyBiome: '',
    chatReplySpeech: null, chatT: 0, npcCHAT_CALM: { idle: 1 }, chatKeys: () => ['chatA', 'chatB'] });
  vm.runInContext(real, q);
  function person(x = 1) {
    const rec = { group: { position: { x, y: 0, z: 0 } }, x, z: 0, bags: {},
      biome: 'sydney', fig: true, chatT: 0, fl: 0, moving: 0, sat: 0, gest: 0,
      near: 1, cd: 0, cool: 10, chatty: true, state: 'idle', chatCd: 0, dejected: 0 };
    rec.speak = (text, speech) => q.sayBubble(rec, text, speech);
    rec.anchor = { group: rec.group, speak: (text, speech) => q.sayBubble(rec.anchor, text, speech) };
    return rec;
  }
  const expire = () => bubbles.forEach(b => { b.t = b.life; });
  return { q, calls, bubbles, game, person, expire, idle: { category: 'idle' } };
}
function test(name, run) { run(); checks++; console.log('pass  ' + name); }

test('Six single voices per rolling sixty seconds, exact boundary', () => {
  const w = world(), r = w.person();
  for (let i = 0; i < 6; i++) assert.equal(w.q.npcSpeechVoice(r, w.idle), true);
  assert.equal(w.q.npcSpeechVoice(r, w.idle), false);
  w.game.state.time = 159.999;
  assert.equal(w.q.npcSpeechVoice(r, w.idle), false);
  w.game.state.time = 160;
  assert.equal(w.q.npcSpeechVoice(r, w.idle), true);
});
test('Distance and guidance checks precede token consumption', () => {
  const w = world(), near = w.person(14), far = w.person(14.01);
  assert.equal(w.q.npcSpeechVoice(far, w.idle), false);
  assert.equal(w.game.speechAudit().tokens.length, 0);
  w.game.hud.incidentalQuiet = () => true;
  assert.equal(w.q.npcSpeechVoice(near, w.idle), false);
  assert.equal(w.game.speechAudit().tokens.length, 0);
  w.game.hud.incidentalQuiet = () => false;
  assert.equal(w.q.npcSpeechVoice(near, w.idle), true);
});
test('Pair reserves both voices only when both people are audible', () => {
  const w = world(), a = w.person(1), b = w.person(15);
  const speech = w.q.npcSpeechPair(a, b, 'company');
  assert.equal(w.q.npcSpeechVoice(a, speech), false);
  assert.equal(w.game.speechAudit().tokens.length, 0);
  b.group.position.x = 2;
  for (let i = 0; i < 5; i++) w.q.npcSpeechVoice(a, w.idle);
  assert.equal(w.q.npcSpeechVoice(a, speech), false, 'one remaining place cannot open a pair');
  assert.equal(w.q.npcSpeechVoice(b, w.q.npcSpeechReply(speech)), false);
});
test('Reserved answer survives intervening singles; its own clock sets expiry', () => {
  const w = world(), a = w.person(), b = w.person(2);
  const speech = w.q.npcSpeechPair(a, b, 'chat');
  assert.equal(w.q.npcSpeechVoice(a, speech), true);
  for (let i = 0; i < 4; i++) assert.equal(w.q.npcSpeechVoice(a, w.idle), true);
  assert.equal(w.q.npcSpeechVoice(a, w.idle), false);
  w.game.state.time = 102;
  assert.equal(w.q.npcSpeechVoice(b, w.q.npcSpeechReply(speech)), true);
  w.game.state.time = 160;
  for (let i = 0; i < 5; i++) assert.equal(w.q.npcSpeechVoice(a, w.idle), true);
  assert.equal(w.q.npcSpeechVoice(a, w.idle), false, 'answer still occupies its rolling minute');
  w.game.state.time = 162;
  assert.equal(w.q.npcSpeechVoice(a, w.idle), true);
});
test('Abandoned reservation expires; duplicate or expired answer stays silent', () => {
  const w = world(), a = w.person(), b = w.person(2);
  const speech = w.q.npcSpeechPair(a, b, 'chat');
  w.q.npcSpeechVoice(a, speech);
  w.game.state.time = 108;
  assert.equal(w.q.npcSpeechVoice(b, w.q.npcSpeechReply(speech)), false);
  assert.equal(w.game.speechAudit().tokens.length, 1);
  const next = w.q.npcSpeechPair(a, b, 'chat');
  w.q.npcSpeechVoice(a, next);
  assert.equal(w.q.npcSpeechVoice(b, w.q.npcSpeechReply(next)), true);
  assert.equal(w.q.npcSpeechVoice(b, w.q.npcSpeechReply(next)), false);
});
test('Audio exhaustion preserves bubble words and protected dialogue sound', () => {
  const w = world(), r = w.person();
  for (let i = 0; i < 6; i++) w.q.npcSpeechVoice(r, w.idle);
  w.q.sayBubble(r, 'The words remain visible.', w.idle);
  assert.equal(w.bubbles[0].txt.textContent, 'The words remain visible.');
  assert.equal(w.calls.length, 0);
  w.q.sayBubble(r, 'A task answer.', undefined);
  assert.equal(w.calls.length, 1);
  assert.equal(w.calls[0][2], 0.26);
  assert.equal(w.bubbles[0].incidental, false);
});
test('Two incidental bubbles prefer nearest; protected lines can fill all four', () => {
  const w = world();
  const a = w.person(8), b = w.person(10), c = w.person(12), d = w.person(1);
  w.q.sayBubble(a, 'First passing line.', w.idle);
  w.q.sayBubble(b, 'Second passing line.', w.idle);
  w.q.sayBubble(c, 'Too far behind.', w.idle);
  assert.equal(w.q.npcBubblesLive(), 2);
  assert.ok(!w.bubbles.some(x => x.owner === c));
  w.q.sayBubble(d, 'Nearest passing line.', w.idle);
  assert.ok(w.bubbles.some(x => x.owner === d));
  assert.ok(!w.bubbles.some(x => x.owner === b));
  for (let i = 0; i < 4; i++) w.q.sayBubble(w.person(i + 1), 'A protected action.');
  assert.equal(w.q.npcBubblesLive(), 4);
  assert.ok(w.bubbles.every(x => !x.incidental));
  const owners = w.bubbles.map(x => x.owner);
  w.q.sayBubble(w.person(0), 'Cannot evict protected.', w.idle);
  assert.deepEqual(w.bubbles.map(x => x.owner), owners);
});
test('Same speaker idle cannot replace its protected line; guidance admits protected', () => {
  const w = world(), r = w.person();
  w.q.sayBubble(r, 'A protected answer.');
  w.q.sayBubble(r, 'An idle distraction.', w.idle);
  assert.equal(w.bubbles[0].txt.textContent, 'A protected answer.');
  w.game.hud.incidentalQuiet = () => true;
  w.q.sayBubble(w.person(2), 'Weather observation.', { category: 'weather' });
  assert.equal(w.q.npcBubblesLive(), 1);
  w.q.sayBubble(w.person(3), 'A traveller answer.');
  assert.equal(w.q.npcBubblesLive(), 2);
});
test('Cut and governor restore inherited volume, voices and four-bubble behavior', () => {
  for (const state of [{ noQuiet: true }, { perfRung: 1 }]) {
    const w = world(); Object.assign(w.game.state, state);
    w.game.hud.incidentalQuiet = () => true;
    for (let i = 0; i < 8; i++) w.q.sayBubble(w.person(90), 'An inherited line.', w.idle);
    assert.equal(w.calls.length, 8); assert.equal(w.q.npcBubblesLive(), 4);
    assert.ok(w.calls.every(c => c[2] === 0.26));
    assert.equal(w.game.speechAudit().tokens.length, 0);
  }
});
test('Quiet volume affects incidental speech only; origin metadata does not leak', () => {
  const w = world(), r = w.person();
  w.q.localLine(r, ['An ambient line.'], w.idle);
  assert.equal(w.calls.at(-1)[2], 0.164);
  w.q.localLine(r, ['A gift reply.']);
  assert.equal(w.calls.at(-1)[2], 0.26);
  const h = w.person(2);
  w.q.pickLine(h, 'idle', w.idle); assert.equal(w.calls.at(-1)[2], 0.164);
  w.q.pickLine(h, 'idle'); assert.equal(w.calls.at(-1)[2], 0.26);
  h.trav = true;
  assert.equal(w.q.npcSpeechPair(r, h, 'chat'), null);
  assert.ok(!('category' in w.q.npcSayOpt));
});
test('Audit identifies acceptance and suppression by surface and category', () => {
  const w = world(), r = w.person(30);
  w.q.npcSpeechVoice(r, { category: 'weather' });
  w.q.sayBubble(r, 'A protected line.');
  const audit = w.game.speechAudit();
  assert.equal(audit.counts['voice:weather:distance'], 1);
  assert.equal(audit.counts['voice:protected:protected'], 1);
  assert.equal(audit.counts['bubble:protected:accepted'], 1);
  audit.rows[0].reason = 'mutated';
  assert.equal(w.game.speechAudit().rows[0].reason, 'distance');
});
test('Actual company scan reserves and delivers a quieter pair', () => {
  const w = world(), a = w.person(5), b = w.person(8); w.q.locals = [a, b];
  w.q.localsCompany(0.1);
  assert.equal(w.calls.length, 1); assert.equal(w.calls[0][2], 0.126);
  assert.equal(w.game.speechAudit().tokens.length, 2);
  w.game.state.time += 2; w.q.localsCompany(2);
  assert.equal(w.calls.length, 2); assert.equal(w.calls[1][2], 0.126);
  assert.equal(w.game.speechAudit().tokens.filter(t => t.pending).length, 0);
  const cut = world(); cut.game.state.noQuiet = true;
  cut.q.locals = [cut.person(5), cut.person(8)];
  cut.q.localsCompany(0.1); cut.q.localsCompany(2);
  assert.equal(cut.calls.length, 2); assert.ok(cut.calls.every(c => c[2] === 0.20));
});
test('Actual local and roster exchanges forward paired metadata to both lines', () => {
  for (const kind of ['locals', 'roster']) {
    const w = world(), a = w.person(5), b = w.person(8);
    if (kind === 'locals') { w.q.locals = [a, b]; w.q.localsChat(0.1); }
    else w.q.chatStep(0.1, [a, b]);
    assert.equal(w.calls.length, 1, kind); assert.equal(w.calls[0][2], 0.164, kind);
    w.game.state.time += 3;
    if (kind === 'locals') w.q.localsChat(3); else w.q.chatStep(3, [a, b]);
    assert.equal(w.calls.length, 2, kind); assert.equal(w.calls[1][2], 0.164, kind);
    assert.equal(w.game.speechAudit().counts['voice:chat:accepted'], 2, kind);
    assert.equal(w.game.speechAudit().tokens.length, 2, kind);
  }
});
console.log('\nF2 speech: ' + checks + ' behavioral groups passed.');

// Optional live integration: isolated headful profile, trusted keys, natural
// timers. Audit counts admissions; the synth's own throttle may accept fewer.
if (process.argv.includes('--browser')) {
  const { openHarness, snapshot } = await import('./reimagine-harness.mjs');
  const h = await openHarness();
  try {
    await h.start();
    await h.page.keyboard.press('Escape');
    const skip = h.page.getByRole('button', { name: 'skip the guided walk', exact: true });
    if (await skip.isVisible()) await skip.click();
    else await h.page.keyboard.press('Escape');
    const before = await snapshot(h.page);
    const rows = [], start = Date.now();
    while (Date.now() - start < 60000) {
      if (Date.now() - start > 30000) await h.hold(rows.length % 2 ? 'w' : 's', 1500);
      else await h.page.waitForTimeout(1500);
      rows.push(await h.page.evaluate(() => ({ wall: performance.now(), time: window.__capy.state.time,
        hidden: document.hidden, paused: window.__capy.state.paused,
        rung: window.__capy.state.perfRung, held: window.__capy.hud.incidentalQuiet(),
        speech: window.__capy.speechAudit(), sfx: window.__capy.sfxAudit() })));
      if (rows.length === 8) await h.screenshot('reimagine-speech-live-early');
    }
    const after = await snapshot(h.page);
    await h.screenshot('reimagine-speech-live');
    const report = { metadata: h.metadata, before, after, wallSeconds: (Date.now() - start) / 1000, rows };
    await h.result('reimagine-speech-live', report);
    assert.equal(h.metadata.errors.length, 0, 'no browser errors');
    assert.ok(rows.every(r => !r.hidden && !r.paused && r.rung === 0), 'foreground normal play');
    assert.ok(rows.every(r => r.speech.bubbles.filter(b => b.incidental).length <= 2), 'incidental bubble cap');
    assert.ok(rows.every(r => r.speech.tokens.length <= 6), 'shared budget capacity');
    console.log(JSON.stringify({ browser: h.metadata.renderer, wallSeconds: report.wallSeconds,
      gameSeconds: after.time - before.time, counts: rows.at(-1).speech.counts,
      acceptedSfx: rows.at(-1).sfx, errors: h.metadata.errors,
      report: 'qa/reimagine-speech-live.json.png' }, null, 2));
  } finally { await h.close(); }
}
