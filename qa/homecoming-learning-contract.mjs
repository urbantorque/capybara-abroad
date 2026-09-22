// Shipped guide builder with a tiny DOM; browser probe owns layout and keys.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';
const s = stripComments(readFileSync('src/systems.js', 'utf8'));
const data = s.match(/const sysLEARN = \[[\s\S]*?\n\];/);
assert(data, 'lesson pool exists');
const at = s.indexOf('function learnGuide()');
assert(at >= 0, 'guide builder exists');
const start = s.indexOf('{', at);
let depth = 0, end = start;
for (; end < s.length; end++) {
  if (s[end] === '{') depth++;
  if (s[end] === '}' && --depth === 0) break;
}
function el(tag, cls, text) {
  return { tag, cls, textContent: text || '', children: [], events: {},
    appendChild(child) { this.children.push(child); },
    addEventListener(name, fn) { this.events[name] = fn; } };
}
const q = vm.createContext({ sysEl: el, sysSay: s => s, mode: 'keyboard', homecomingArc: true,
  learnShopPractice: () => el('div', 'capyui-learnshop'),
  learnMapPractice: () => el('div', 'capyui-learnmap'),
  sysScheme: (keyboard, touch, pad) => q.mode === 'touch' ? touch : q.mode === 'pad' ? pad : keyboard });
vm.runInContext(data[0] + '\n' + s.slice(at, end + 1), q);
const guide = q.learnGuide();
assert(guide.children[2].children[1].textContent.includes('quieter route'));
q.homecomingArc = false; guide.children[2].events.toggle();
assert(!guide.children[2].children[1].textContent.includes('Two memories'));
q.homecomingArc = true;
assert.equal(guide.children.length, 5);
let checks = 1;
for (const [i, lesson] of guide.children.entries()) {
  assert.equal(lesson.tag, 'details');
  assert.equal(lesson.children[0].tag, 'summary');
  assert(lesson.children[0].textContent.startsWith((i + 1) + '.'));
  assert(lesson.children[1].textContent && lesson.children[2].textContent);
  checks += 4;
}
for (const [mode, phrase] of [['keyboard', 'W, A, S, D'], ['touch', 'movement stick'], ['pad', 'left stick']]) {
  q.mode = mode; guide.children[0].events.toggle();
  assert(guide.children[0].children[1].textContent.includes(phrase)); checks++;
}
for (const code of ['Enter', 'Space', 'Escape', 'Tab']) {
  let stopped = false;
  guide.events.keydown({ code, stopPropagation() { stopped = true; } });
  assert.equal(stopped, code === 'Enter' || code === 'Space'); checks++;
}
for (const event of ['pointerdown', 'click']) {
  let stopped = false;
  guide.events[event]({ stopPropagation() { stopped = true; } });
  assert(stopped); checks++;
}
console.log('HOMECOMING learning: ' + checks + ' builder checks pass.');
