// REIMAGINE D: actual hint entries and destination APIs, without rendering.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';

const read = name => stripComments(readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8'));
const systems = read('systems'), hanoi = read('hanoi'), pantanal = read('pantanal');
const palawan = read('palawan'), shared = read('shared');
function block(source, start) {
  assert.ok(start >= 0, 'source boundary exists');
  let depth = 0, quote = '', escaped = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if ('\'"`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw Error('Unclosed source block');
}
function entry(id) {
  const table = systems.indexOf('const sysHINTS =');
  const at = systems.indexOf("'" + id + "':", table);
  assert.ok(table >= 0 && at > table, 'shipped hint ' + id);
  return block(systems, systems.indexOf('{', at));
}
function declaration(source, name) {
  const row = source.match(new RegExp('^const ' + name + '\\s*=\\s*[^;]+;', 'm'));
  assert.ok(row, 'authored ' + name);
  return row[0];
}
function apiFunction(source, name) {
  const prefix = 'api.' + name + ' = function';
  const at = source.indexOf(prefix);
  assert.ok(at >= 0, 'shipped API ' + name);
  const start = source.indexOf('{', at);
  return source.slice(at, start) + block(source, start) + ';';
}
function property(source, name) {
  const at = source.indexOf(name + ': {');
  assert.ok(at >= 0, 'shipped target ' + name);
  return block(source, source.indexOf('{', at));
}
const q = vm.createContext({ game: {}, hintObj: value => value,
  api: {}, hanCubX: 40, hanCubZ: -25, panCrossT: 0 });
vm.runInContext([
  declaration(hanoi, 'hanGROUND'), declaration(hanoi, 'hanCUB'),
  declaration(pantanal, 'panCROSS'), declaration(pantanal, 'panRIVER'),
  apiFunction(hanoi, 'cubAt'), apiFunction(hanoi, 'cubStall'),
  'const authored = { hanGROUND, hanCUB, panCROSS, panRIVER };',
  'const crossingHint = ' + entry('the-crossing') + ';',
  'const phoHint = ' + entry('pho-run') + ';',
  'const riverHint = ' + entry('uji-run') + ';',
  'const nearBank = ' + property(pantanal, 'bank') + ';',
  'const farBank = ' + property(pantanal, 'farBank') + ';',
].join('\n'), q);
const data = vm.runInContext('({ authored, crossingHint, phoHint, riverHint, nearBank, farBank })', q);
let checks = 0, groups = 0;
const check = (ok, why) => { assert.ok(ok, why); checks++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const group = (name, run) => { try { run(); groups++; } catch (e) { e.message = name + ': ' + e.message; throw e; } };

group('authored target endpoints', () => {
  const a = data.authored;
  check(same(q.api.cubStall(), { x: a.hanCUB.x, y: a.hanGROUND, z: a.hanCUB.z }), 'refill uses authored stall and ground');
  check(same(data.nearBank, { x: a.panCROSS.x, z: a.panRIVER.z1 + 3 }), 'entry bank uses authored crossing');
  check(same(data.farBank, { x: a.panCROSS.x, z: a.panRIVER.z0 - 3 }), 'far bank uses authored opposite shore');
  check(data.farBank.z < a.panRIVER.z0 - 1, 'destination lies past completion threshold');
  const fixed = JSON.stringify(q.api.cubStall());
  q.hanCubX = -100; q.hanCubZ = 90;
  check(same(q.api.cubAt(), { x: -100, y: a.hanGROUND, z: 90 }), 'scooter target moves');
  check(JSON.stringify(q.api.cubStall()) === fixed, 'refill target never follows scooter');
});
group('crossing target follows progress', () => {
  let n = 0, crossing = false;
  const herd = { x: 10, z: 10 };
  q.game.pantanal = { following: () => n, crossing: () => crossing, herd: () => herd,
    bank: data.nearBank, farBank: data.farBank };
  for (n = 0; n < 4; n++) check(data.crossingHint.where() === herd, 'gather before crossing: ' + n);
  n = 4; check(data.crossingHint.where() === data.nearBank, 'four followers lead to departure bank');
  crossing = true;
  for (n = 0; n <= 5; n++) {
    check(data.crossingHint.where() === data.farBank, 'committed crossing stays pointed forward: ' + n);
    check(!data.crossingHint.clue().includes('near the herd'), 'crossing clue does not send lost followers back: ' + n);
  }
  crossing = false; n = 2;
  check(data.crossingHint.where() === herd, 'abandoned crossing resumes gathering');
  q.game.pantanal = null;
  check(data.crossingHint.where() === null, 'unbuilt chapter has no invented target');
});
group('crossing API reports actual attempt', () => {
  const at = pantanal.indexOf('crossing() { return panCrossT > 0; }');
  assert.ok(at >= 0, 'actual crossing API');
  const bodyAt = pantanal.indexOf('{', at);
  vm.runInContext('function isCrossing() ' + block(pantanal, bodyAt), q);
  q.panCrossT = 0; check(!q.isCrossing(), 'no attempt at zero');
  q.panCrossT = .01; check(q.isCrossing(), 'attempt active before success threshold');
  q.panCrossT = 0; check(!q.isCrossing(), 'reset clears guidance commitment');
});
const cases = [
  ['off', { on: false, run: false, done: false }, 'scooter', /press E/],
  ['active bowls', { on: true, run: true, done: false }, 'drop', /lit lantern/],
  ['expired mounted', { on: true, run: false, done: false, hold: 1 }, 'stall', /pho stall.*press E/],
  ['empty active', { on: true, run: true, done: false, bowls: 0, hold: 1 }, 'stall', /empty.*stall.*refill/],
  ['completed idle', { on: true, run: false, done: true }, 'scooter', null],
  ['completed replay', { on: true, run: true, done: true }, 'drop', /lit lantern/],
  ['completed empty replay', { on: true, run: true, done: true, bowls: 0 }, 'stall', /refill/],
];
for (const [name, overrides, expected, clue] of cases) group('pho ' + name, () => {
  const state = { on: false, run: false, done: false, bowls: 3, next: 1, hold: -1, ...overrides };
  const scooter = q.api.cubAt(), stall = q.api.cubStall(), drop = { x: 60, z: 22.5 };
  let selected = -1;
  q.game.hanoi = { cub: () => state, cubAt: () => scooter, cubStall: () => stall,
    dropAt: n => { selected = n; return drop; } };
  check(data.phoHint.where() === ({ scooter, stall, drop })[expected], 'correct target');
  check(expected === 'drop' ? selected === state.next : selected === -1, 'delivery lookup only during deliverable run');
  if (clue) check(clue.test(data.phoHint.clue()), 'instruction matches recovery/action');
});
group('unbuilt Hanoi', () => {
  q.game.hanoi = null;
  check(data.phoHint.where() === null, 'no target before chapter API exists');
  check(typeof data.phoHint.clue() === 'string', 'fallback instruction remains readable');
});
group('river hint follows the channel', () => {
  const bridge={x:4,z:128},mill={x:126,z:152};let wet=false,calls=[];
  q.game.capy={position:{x:80,z:122}};
  q.game.kyoto={bridge,mill,inRiver:()=>wet,aheadOnRiver:(x,z,ahead)=>{calls.push([x,z,ahead]);return{x:x+7,z:z+12};}};
  check(data.riverHint.where()===bridge,'dry approach retains bridge');
  check(calls.length===0,'dry approach does not query river');
  wet=true;
  check(same(data.riverHint.where(),{x:87,z:134}),'wet arrow follows bend rather than mill chord');
  check(same(calls[0],[80,122,16]),'actual position and authored sixteen-metre lookahead');
  q.game.capy.position={x:151,z:150};
  check(same(data.riverHint.where(),{x:158,z:162}),'target recomputed as animal moves');
  q.game.kyoto.aheadOnRiver=()=>null;
  check(data.riverHint.where()===mill,'unbuilt centreline falls back to mill');
  delete q.game.kyoto.aheadOnRiver;
  check(data.riverHint.where()===mill,'older API fallback');
  q.game.capy=null;
  check(data.riverHint.where()===mill,'absent body fallback');
  q.game.kyoto=null;
  check(data.riverHint.where()===null,'unbuilt chapter no invented coordinates');
});

function tableRow(table, key) {
  const start = systems.indexOf('const ' + table + ' =');
  assert.ok(start >= 0, 'shipped table ' + table);
  const body = block(systems, systems.indexOf('{', start));
  const at = body.indexOf(key + ':');
  assert.ok(at >= 0, 'shipped row ' + key);
  return block(body, body.indexOf('{', at));
}
const pal = vm.createContext({ PALETTE: new Proxy({}, { get: (_, key) => key }), Math });
vm.runInContext([
  'const map = ' + tableRow('sysMAP_WORLDS', 'palawan') + ';',
  'const dress = ' + tableRow('sysBOARD_DRESS', 'palawan') + ';',
  declaration(palawan, 'palJETTY'), declaration(shared, '_BD_PANEL_W'),
  'const sysMAP_WORLDS = { palawan: map };',
].join('\n'), pal);
const palData = vm.runInContext('({ map, dress, jetty: palJETTY })', pal);
group('Palawan map, dressing and chapter way agree', () => {
  const { map, dress, jetty } = palData;
  check(same({ x: map.way.x, z: map.way.z }, dress.at), 'map and physical board share a coordinate');
  check(same(dress.at, { x: 2, z: 32 }), 'shore approach coordinate remains authored');
  check(!('get' in map.way), 'map no longer resolves to the seaward jetty API');
  check(!('floorY' in dress), 'board measures local sand rather than retaining deck height');
  check(dress.yaw === 0, 'board face points toward beach arrival rather than offshore map centre');
  check(dress.at.z > jetty.z1, 'board stands beyond the landward end');
  const chapterStart = shared.indexOf("{ n: 12, biome: 'palawan'");
  const chapter = block(shared, chapterStart);
  const way = chapter.match(/\bway:\s*('[^']*')/);
  check(!!way && /beside the shore end/.test(vm.runInNewContext(way[1])), 'chapter instruction describes relocated shore approach');
});
group('Palawan board clears the actual deck collider', () => {
  // Evaluate the shipped collider call, not a second hand-written deck box.
  const deckCall = palawan.match(/palStaticBox\(game, J\.x, J\.y - 0\.15,[^;]+;/);
  check(!!deckCall, 'authored jetty collider call found');
  pal.game = {};
  pal.palStaticBox = (_game, x, y, z, w, h, d) => ({ x, y, z, w, h, d });
  const deck = vm.runInContext('const J = palJETTY; ' + deckCall[0], pal);
  const boardStart = shared.indexOf('export function exitBoard(');
  const board = block(shared, shared.indexOf('{', boardStart));
  const width = board.match(/const W = ([^;]+);/);
  const half = board.match(/hx:\s*([^,\n]+),\s*hz:\s*([^\n}]+)/);
  check(!!width && !!half, 'actual board default width and collider half-extents found');
  const dims = vm.runInContext('const opt = dress; const W = ' + width[1] +
    '; ({ hx: ' + half[1] + ', hz: ' + half[2] + ' })', pal);
  const radius = Math.hypot(dims.hx, dims.hz);
  check(dims.hx * 2 > deck.w, 'inherited board wider than the jetty');
  check(palData.dress.at.x + radius < deck.x - deck.w * .5,
    'entire board footprint stays outside deck at every yaw');
  check(palData.dress.at.z - radius > deck.z + deck.d * .5,
    'entire board footprint stays landward of deck at every yaw');
});
group('Palawan departure follows earned route or legacy bloom', () => {
  const door = systems.match(/\bconst palDoor = [^;]+;/);
  const predicate = systems.match(/\bconst atPal = [^;]+;/);
  check(!!door && !!predicate, 'actual departure declarations found');
  vm.runInContext('function eligible(inPal, p, game, chapEnough) {' + door[0] + predicate[0] + 'return atPal;}', pal);
  const at = palData.map.way;
  for (const earned of [false, true]) for (const bloom of [false, true]) {
    for (const distance of [0, 3.499, 3.5, 3.501]) {
      for (const [dx, dz] of [[distance, 0], [0, -distance]]) {
        const chapters = [], game = { palawan: { seenBloom: () => bloom } };
        const actual = pal.eligible(true, { x: at.x + dx, z: at.z + dz }, game,
          n => { chapters.push(n); return earned; });
        check(actual === (distance < 3.5 && (earned || bloom)),
          'eligibility earned=' + earned + ' bloom=' + bloom + ' distance=' + distance);
        check(chapters.every(n => n === 12), 'only Palawan route memory consulted');
      }
    }
  }
  check(!pal.eligible(false, at, { palawan: { seenBloom: () => true } }, () => true), 'another chapter cannot trigger departure');
  check(!pal.eligible(true, at, {}, () => true), 'unbuilt Palawan cannot trigger departure');
  check(pal.eligible(true, at, { palawan: { seenBloom() { throw Error('unneeded legacy lookup'); } } }, () => true),
    'earned route exits without requiring optional bloom');
});
console.log(JSON.stringify({ groups, checks, failed: 0,
  scope: 'Shipped hint entries and target APIs with controlled gameplay state; no browser or navigation claim.' }, null, 2));
