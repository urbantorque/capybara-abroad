// qa/xmodule.mjs — CROSS-MODULE IDENTIFIER AUDIT
//
//   node qa/xmodule.mjs [srcDir]
//
// WHY THIS EXISTS. `node build.mjs` reports "no collisions", which means no two
// modules declare the same top-level name. It does NOT check that a name a file
// USES belongs to that file — and because the bundler concatenates every module
// into one scope, a call to another module's helper resolves silently in the
// build and throws ReferenceError in the unbundled dev server, which is what
// index.html serves.
//
// Two real bugs of this exact shape, both found by hand:
//
//   noiseBuf()   systems.js, v41 — declared NOWHERE. 61 uncaught throws a
//                minute in Kyoto; the chapter's two lead instruments never
//                played a note.
//   biomeLive()  systems.js, v44 — declared in NPC.JS. Would have resolved in
//                the bundle to another module's helper (hard-coded to Sydney)
//                and thrown on the first frame of every chapter in dev.
//
// An earlier version of this scanner unioned the declarations of all files and
// asked "is this name declared anywhere". That is the bundle's question, and it
// answers "yes" for biomeLive. THE QUESTION IS PER FILE: a name must be
// declared in the file that uses it, imported by it, or a known global.
//
// It is a text scan and not a parser, so it is deliberately conservative: it
// reports only names it can see no declaration for in the using file, and every
// hit is either a real bug or a name worth prefixing per the contract's
// module-tag rule.

import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const DIR = process.argv[2] || 'src';
const files = readdirSync(DIR).filter(f => f.endsWith('.js')).sort();

const GLOBALS = new Set(('Array Object Math JSON Date Promise Map Set WeakMap WeakSet Error ' +
  'TypeError RangeError SyntaxError Symbol Proxy Reflect BigInt RegExp String Number Boolean ' +
  'Function eval parseFloat parseInt isNaN isFinite encodeURIComponent decodeURIComponent ' +
  'encodeURI decodeURI structuredClone queueMicrotask btoa atob ' +
  'Float32Array Float64Array Uint8Array Uint16Array Uint32Array Int8Array Int16Array Int32Array ' +
  'Uint8ClampedArray ArrayBuffer DataView TextEncoder TextDecoder ' +
  'setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame ' +
  'fetch console window document navigator localStorage sessionStorage location history screen ' +
  'performance matchMedia getComputedStyle alert confirm prompt ' +
  'AudioContext webkitAudioContext OfflineAudioContext Image Audio Blob URL FileReader ' +
  'XMLHttpRequest WebSocket Worker OffscreenCanvas Path2D ResizeObserver IntersectionObserver ' +
  'MutationObserver KeyboardEvent MouseEvent WheelEvent PointerEvent TouchEvent CustomEvent ' +
  'Event DOMMatrix DOMPoint CanvasRenderingContext2D ' +
  'addEventListener removeEventListener dispatchEvent postMessage ' +
  'if for while switch catch return typeof new delete void in of do else try finally throw ' +
  'yield await async function class const let var export import default extends instanceof ' +
  'break case continue super this null true false').split(/\s+/));

// Comment- and string-stripping good enough for a declaration scan.
//
// IT MUST RUN OVER THE WHOLE FILE AND IT MUST PRESERVE NEWLINES. The first cut
// stripped line by line, which cannot see a `/* */` that spans lines — and this
// codebase's jsdoc blocks are long English prose full of sentences like "the
// position it is at (x, z)" and "one per chapter (see over)". That produced 187
// findings, essentially all of them words in comments. Blanking the comment but
// keeping its newlines is what lets the usage scan keep honest line numbers.
function strip(src) {
  let out = '', i = 0, n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; }
      i += 2; continue;
    }
    if (c === '"' || c === "'") {
      const q = c; i++;
      while (i < n && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') i++; i++; }
      i++; out += '""'; continue;
    }
    if (c === '`') {
      // A template literal is kept as a blank of the same shape: several modules
      // build GLSL in one, and a `vec3(` in a shader is not a JS call.
      i++;
      while (i < n && src[i] !== '`') { if (src[i] === '\n') out += '\n'; if (src[i] === '\\') i++; i++; }
      i++; out += '""'; continue;
    }
    out += c; i++;
  }
  return out;
}

const declRe = [
  /\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)/g,
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
  /\bclass\s+([A-Za-z_$][\w$]*)/g,
  // destructured declarations: const { a, b } = ...   and   const [a, b] = ...
  /\b(?:const|let|var)\s*[{[]([^}\]]*)[}\]]/g,
  // every function's parameter list, however it is written
  /(?:function\s*\*?\s*[A-Za-z_$][\w$]*)?\s*\(([^()]*)\)\s*(?:=>|\{)/g,
  // Object-literal and class method shorthand. NOT anchored to the start of a
  // line: main.js declares four of these on one line — `toast() {}, shake() {}`
  // — and an anchored pattern sees only the first of them.
  /(?:^|[{,;])[ \t]*(?:get[ \t]+|set[ \t]+|static[ \t]+|async[ \t]+)*([A-Za-z_$][\w$]*)[ \t]*\([^()]*\)[ \t]*\{/gm,
  // catch (e), for (const x of ...)
  /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g,
];
const importRe = [
  /\bimport\s*\*\s*as\s+([A-Za-z_$][\w$]*)/g,
  /\bimport\s*\{([^}]*)\}/g,
  /\bimport\s+([A-Za-z_$][\w$]*)\s*(?:,|from)/g,
];
// A call, and only a call: `foo(` not preceded by a dot or a `?.`
const callRe = /(?:^|[^\w$.])([a-z_$][\w$]*)\s*\(/g;

const declaredIn = new Map();   // file -> Set
const usedIn = new Map();       // file -> Map(name -> firstLine)

for (const f of files) {
  const raw = readFileSync(join(DIR, f), 'utf8');
  const src = strip(raw);
  const decl = new Set();
  for (const re of declRe) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      for (const part of String(m[1]).split(',')) {
        const name = part.trim().split(/[:=]/)[0].replace(/^\.\.\./, '').trim();
        if (/^[A-Za-z_$][\w$]*$/.test(name)) decl.add(name);
      }
    }
  }
  for (const re of importRe) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      for (const part of String(m[1]).split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop().trim();
        if (/^[A-Za-z_$][\w$]*$/.test(name)) decl.add(name);
      }
    }
  }
  declaredIn.set(f, decl);

  const used = new Map();
  const lines = src.split(/\r?\n/);        // the STRIPPED file, line numbers intact
  for (let i = 0; i < lines.length; i++) {
    callRe.lastIndex = 0;
    let m;
    while ((m = callRe.exec(lines[i]))) {
      if (!used.has(m[1])) used.set(m[1], i + 1);
    }
  }
  usedIn.set(f, used);
}

const findings = [];
for (const f of files) {
  const mine = declaredIn.get(f);
  for (const [name, line] of usedIn.get(f)) {
    if (GLOBALS.has(name) || mine.has(name)) continue;
    const owners = files.filter(o => o !== f && declaredIn.get(o).has(name));
    findings.push({ file: f, line, name, owners });
  }
}

findings.sort((a, b) => (a.owners.length - b.owners.length) || a.file.localeCompare(b.file));
if (!findings.length) {
  console.log('clean: every called name is declared in, or imported by, the file that uses it');
} else {
  let undef = 0, cross = 0;
  for (const x of findings) {
    if (x.owners.length) {
      cross++;
      console.log('CROSS-MODULE  ' + x.file + ':' + x.line + '  ' + x.name +
                  '()  ->  declared in ' + x.owners.join(', '));
    } else {
      undef++;
      console.log('UNDECLARED    ' + x.file + ':' + x.line + '  ' + x.name + '()  ->  nowhere');
    }
  }
  console.log('---');
  console.log(undef + ' undeclared, ' + cross + ' cross-module. ' +
              'Both throw in the dev build; the second also resolves to the wrong function in the bundle.');
  process.exitCode = 1;
}
