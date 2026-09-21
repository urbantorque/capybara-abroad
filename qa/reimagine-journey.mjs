// REIMAGINE B: execute the actual authored table and predicate. The shared
// module also builds Three.js geometry, so evaluate just its data section.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/shared.js', import.meta.url), 'utf8');
const first = source.indexOf('export const TASKS =');
const last = source.indexOf('// RECORDS —', first);
assert(first >= 0 && last > first, 'task/chapter data section exists');
const data = runInNewContext(source.slice(first, last).replace(/^export /gm, '') +
  '\n({TASKS, CHAPTERS, JOURNEY, CHAPTER_EXPERIENCES, chapterExperience})');
const { TASKS, CHAPTERS, JOURNEY, CHAPTER_EXPERIENCES, chapterExperience } = data;
const tasks = new Map(TASKS.map(task => [task.id, task]));
const chapters = new Map(CHAPTERS.map(chapter => [chapter.n, chapter]));
let cases = 0;
const check = (value, message) => { assert(value, message); cases++; };
const from = (n, ids) => { const done = new Set(ids); return chapterExperience(n, id => done.has(id)); };

check(CHAPTERS.length === 19 && chapters.size === 19, 'all nineteen destinations remain');
check(CHAPTERS.every((chapter, i) => chapter.n === i + 1), 'stable chapter numbers');
check(JOURNEY.join(',') === '1,3,2,4,12,15,19', 'authored route and harbour-before-flight order');
check(new Set(JOURNEY).size === 7, 'seven unique destinations plus the return home');
check(Object.keys(CHAPTER_EXPERIENCES).length === JOURNEY.length, 'one experience per route place');

for (const n of JOURNEY) {
  const chapter = chapters.get(n), experience = CHAPTER_EXPERIENCES[n];
  check(!!chapter && !!experience, 'route place exists: ' + n);
  const signature = tasks.get(experience.signature);
  check(signature?.chapter === n && !!signature.wow, 'signature is this chapter’s marquee: ' + n);
  check(experience.supports.length >= 2, 'at least two supporting choices: ' + n);
  check(new Set(experience.supports).size === experience.supports.length, 'unique supports: ' + n);
  check(!experience.supports.includes(experience.signature), 'signature cannot count twice: ' + n);
  for (const id of experience.supports) {
    check(tasks.get(id)?.chapter === n, 'support belongs here: ' + id);
    check(id !== chapter.arrive, 'automatic arrival earns no supporting credit: ' + id);
    check(!id.startsWith('to-') || (n === 3 && id === 'to-quay'), 'only actual casting off uses to-prefix: ' + id);
  }
  const empty = from(n, []);
  check(!empty.enough && !empty.signatureDone && empty.supportDone === 0 && empty.supportMissing === 2,
    'empty chapter needs signature and two actions: ' + n);
  const arrival = from(n, chapter.arrive ? [chapter.arrive] : []);
  check(!arrival.enough && arrival.supportDone === 0, 'arrival alone never earns a memory: ' + n);
  const onlySignature = from(n, [experience.signature]);
  check(!onlySignature.enough && onlySignature.signatureDone && onlySignature.supportMissing === 2,
    'signature alone leaves two choices: ' + n);
  const otherTasks = TASKS.filter(task => task.chapter === n &&
    task.id !== experience.signature && !experience.supports.includes(task.id)).map(task => task.id);
  check(!from(n, [...otherTasks, experience.signature]).enough, 'unrelated checklist ticks cannot substitute: ' + n);
  for (let i = 0; i < experience.supports.length; i++) {
    const one = from(n, [experience.signature, experience.supports[i]]);
    check(!one.enough && one.supportMissing === 1, 'one support is not two: ' + n + '/' + i);
    for (let j = i + 1; j < experience.supports.length; j++) {
      const pair = [experience.supports[i], experience.supports[j]];
      check(!from(n, pair).enough, 'support pair still needs the signature: ' + n + '/' + i + '/' + j);
      const partial = from(n, [experience.signature, ...pair]);
      check(partial.enough && partial.supportDone === 2 && partial.supportMissing === 0 &&
        partial.supportOpen.length === experience.supports.length - 2,
        'every authored pair earns partial completion: ' + n + '/' + i + '/' + j);
    }
  }
  const full = from(n, TASKS.filter(task => task.chapter === n).map(task => task.id));
  check(full.enough && full.supportDone === experience.supports.length && full.supportMissing === 0 &&
    full.supportOpen.length === 0, 'fully complete save remains enough: ' + n);
  full.supports.length = 0;
  full.supportOpen.push('not-a-task');
  check(from(n, []).supports.length === experience.supports.length &&
    !from(n, []).supportOpen.includes('not-a-task'), 'returned arrays do not mutate authored data: ' + n);
}
for (const chapter of CHAPTERS) {
  if (!JOURNEY.includes(chapter.n)) check(chapterExperience(chapter.n, () => true) === null,
    'optional trip delegates its own eligibility: ' + chapter.biome);
}
check(!chapters.get(3).arrive && tasks.get('to-quay').chapter === 3,
  'Quay casting-off task remains an action, not automatic arrival');
for (const n of [0, 20, -1, NaN, '1', 'toString']) {
  check(chapterExperience(n, () => true) === null, 'invalid chapter returns no experience: ' + n);
}
console.log('REIMAGINE journey: ' + cases + ' assertions passed; 7 route places, 12 optional trips, 19 preserved.');
