// Shipped map rehearsal builder with a tiny DOM; no save or game surface exists here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('src/systems.js', 'utf8');
const at = source.indexOf('  function learnMapPractice()');
assert(at >= 0, 'map practice builder exists');
const start = source.indexOf('{', at);
let depth = 0, end = start;
for (; end < source.length; end++) {
  if (source[end] === '{') depth++;
  if (source[end] === '}' && --depth === 0) break;
}

class El {
  constructor(tag, cls, text) {
    this.tag = tag; this.className = cls || ''; this.textContent = text || '';
    this.children = []; this.events = {}; this.hidden = false; this.disabled = false;
    this.dataset = {}; this.attrs = {}; this.style = { setProperty() {} }; this.focused = 0;
  }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, fn) { this.events[name] = fn; }
  setAttribute(name, value) { this.attrs[name] = value; }
  focus() { this.focused++; }
}
const sysEl = (tag, cls, text) => new El(tag, cls, text);
const context = vm.createContext({
  sysEl, document: { createTextNode: text => new El('#text', '', text) },
  PALETTE:new Proxy({}, {get:()=>1}),sysHex:String,sysRgba:String,
});
const pool=source.match(/const sysLEARN_MAP = \{[\s\S]*?\n\};/)[0];
vm.runInContext(pool+'\n'+source.slice(at, end + 1), context);
const host = context.learnMapPractice();
// Construction precedes the live legend. Its real labels/shapes are read only
// after the user's click, never captured early or duplicated in this fixture.
vm.runInContext(source.match(/  const mapLegendRows = \[[\s\S]*?\n  \];/)[0],context);
const open = host.children[0], panel = host.children[1];
assert.equal(open.className, 'capyui-mappractice-open');
open.events.click();
assert.equal(panel.hidden, false);
const question = panel.children[1], answers = panel.children[2];
const status = panel.children[3], next = panel.children[4], reset = panel.children[5];
assert.equal(question.focused, 1, 'open moves focus to question');
assert.deepEqual(answers.children.map(button => button.dataset.shape), ['coin', 'ring', 'boat']);
answers.children[1].events.click();
assert.match(status.textContent, /another/);
assert.equal(next.disabled, true);
answers.children[0].events.click();
assert.match(status.textContent, /Next/);
assert.equal(next.disabled, false);
next.events.click();
assert.match(question.textContent, /swim/);
assert.equal(question.focused, 2, 'next moves focus to question');
for (const correct of [1, 2]) {
  answers.children[correct].events.click();
  next.events.click();
}
assert.equal(next.hidden, true);
assert.equal(reset.hidden, false);
assert(answers.children.every(answer=>answer.disabled),'completed choices stop accepting input');
assert.match(status.textContent, /unchanged/);
assert.equal(reset.focused, 1, 'completion focuses reset');
reset.events.click();
assert.match(question.textContent, /upgrade/);
assert.equal(next.hidden, false);
assert.equal(reset.hidden, true);
assert.equal(question.focused, 4, 'reset moves focus to question');
console.log('HOMECOMING map practice: 12 builder checks pass.');
