// ===========================================================================
// A COMMENT STRIPPER THAT UNDERSTANDS WHAT A COMMENT IS
//
// 46% of this repo's source is whole-line comments — 3.5 MB of a 9.2 MB
// bundle — and the bundle is a single file that a player downloads or opens
// from a memory stick. The comments are the point of the source and they are
// dead weight in the artefact.
//
// THE REASON THIS IS NOT A REGEX. `/` is two things in JavaScript. Given
//
//     const re = /https:\/\/x/;   //  a regex containing "//"
//     const k = a / b;            //  division
//     const s = 'not // a comment';
//
// any pattern that hunts for `//` finds the wrong one, and the failure is
// silent: the file still parses, and something in the middle of it is gone.
// build.mjs already carries a warning about exactly this family of bug — see
// the `$'` note there — and the whole of that note is that the failure is not
// that something goes wrong, it is that NOTHING does.
//
// So this is a scanner with four states and one hard decision.
//
// THE HARD DECISION is whether a `/` opens a regex or is division, and it is
// decided the way every JavaScript tokeniser decides it: by the last
// significant token before it. After a value — an identifier, a number, a
// string, `)`, `]`, or one of the few keywords that are values — a `/` is
// division. Everywhere else it opens a regex. The one genuinely ambiguous case
// is `}`, which may close a block (regex may follow) or an object literal
// (division may follow); `}` is treated as NOT a value, because
// `if (a) {} /re/.test(b)` is legal and `({}) / 2` is not something anybody
// writes. The keyword list matters: `return /re/` and `typeof /re/` are both
// regexes and both follow an identifier-shaped token.
//
// The caller is expected to parse the result and fall back to the original on
// failure. See build.mjs: a bug in here must cost bytes, never correctness.
// ===========================================================================

// Words that are NOT values, so a `/` after one of them opens a regex.
const KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await', 'export', 'default',
]);

/**
 * @param {string} src
 * @param {{keepFirst?: boolean}} [opt]  keepFirst preserves a leading banner
 *        comment, which is how a licence notice survives a strip.
 * @returns {string}
 */
export function stripComments(src, opt) {
  const keepFirst = !!(opt && opt.keepFirst);
  const n = src.length;
  let out = '';
  let i = 0;
  // the last significant character emitted, and the last word, for the regex
  // decision. `lastWord` is only filled when the token was identifier-shaped.
  let lastCh = '';
  let lastWord = '';
  let firstKept = false;

  const isIdent = (c) => /[A-Za-z0-9_$]/.test(c);

  while (i < n) {
    const c = src[i];
    const d = src[i + 1];

    // ---- line comment ----------------------------------------------------
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      // the newline itself is kept: a stripped line comment must not join two
      // statements, and ASI depends on the line break surviving
      continue;
    }

    // ---- block comment ---------------------------------------------------
    if (c === '/' && d === '*') {
      const start = i;
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i = Math.min(i + 2, n);
      if (keepFirst && !firstKept) {
        firstKept = true;
        out += src.slice(start, i);
        lastCh = '/';
        lastWord = '';
        continue;
      }
      // A block comment can span lines, and removing it outright would join
      // the line before it to the line after. Emit one space, which cannot
      // change the meaning of anything, plus every newline it contained so
      // ASI and the line count are untouched.
      const nl = src.slice(start, i).split('\n').length - 1;
      out += nl > 0 ? '\n'.repeat(nl) : ' ';
      // a comment is not a token: what came before it is still the last one
      continue;
    }

    // ---- strings ---------------------------------------------------------
    if (c === "'" || c === '"') {
      const q = c;
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === q) { j++; break; }
        j++;
      }
      out += src.slice(i, j);
      lastCh = q; lastWord = '';
      i = j;
      continue;
    }

    // ---- template literals, which may contain code, which may contain
    //      another template. Depth-counted rather than recursive.
    if (c === '`') {
      let j = i + 1;
      let depth = 0;
      while (j < n) {
        const t = src[j];
        if (t === '\\') { j += 2; continue; }
        if (depth === 0 && t === '`') { j++; break; }
        if (depth === 0 && t === '$' && src[j + 1] === '{') { depth++; j += 2; continue; }
        if (depth > 0) {
          // Inside ${ }. Strings and nested templates in here have to be
          // skipped or a brace inside one closes the substitution early.
          if (t === '{') { depth++; j++; continue; }
          if (t === '}') { depth--; j++; continue; }
          if (t === "'" || t === '"') {
            const q = t;
            j++;
            while (j < n) {
              if (src[j] === '\\') { j += 2; continue; }
              if (src[j] === q) { j++; break; }
              j++;
            }
            continue;
          }
          if (t === '`') {
            // a nested template: scan it with the same rules, one level down
            let k = j + 1, d2 = 0;
            while (k < n) {
              if (src[k] === '\\') { k += 2; continue; }
              if (d2 === 0 && src[k] === '`') { k++; break; }
              if (d2 === 0 && src[k] === '$' && src[k + 1] === '{') { d2++; k += 2; continue; }
              if (d2 > 0 && src[k] === '{') d2++;
              if (d2 > 0 && src[k] === '}') d2--;
              k++;
            }
            j = k;
            continue;
          }
        }
        j++;
      }
      out += src.slice(i, j);
      lastCh = '`'; lastWord = '';
      i = j;
      continue;
    }

    // ---- regex or division ----------------------------------------------
    if (c === '/') {
      const valueBefore =
        (lastCh && (isIdent(lastCh) || lastCh === ')' || lastCh === ']' ||
                    lastCh === "'" || lastCh === '"' || lastCh === '`')) &&
        !KEYWORDS.has(lastWord);
      if (!valueBefore) {
        // scan a regex literal: [] classes hide a /, \ escapes hide anything
        let j = i + 1;
        let inClass = false;
        let ok = false;
        while (j < n) {
          const t = src[j];
          if (t === '\\') { j += 2; continue; }
          if (t === '\n') break;                 // a regex cannot span a line
          if (inClass) { if (t === ']') inClass = false; j++; continue; }
          if (t === '[') { inClass = true; j++; continue; }
          if (t === '/') { j++; ok = true; break; }
          j++;
        }
        if (ok) {
          while (j < n && /[a-z]/.test(src[j])) j++;   // flags
          out += src.slice(i, j);
          lastCh = '/'; lastWord = '';
          i = j;
          continue;
        }
        // not a terminated regex after all — fall through and treat it as one
        // character of code, which is what division is
      }
      out += c;
      lastCh = c; lastWord = '';
      i++;
      continue;
    }

    // ---- ordinary code ---------------------------------------------------
    if (isIdent(c)) {
      let j = i;
      while (j < n && isIdent(src[j])) j++;
      const w = src.slice(i, j);
      out += w;
      lastCh = w[w.length - 1];
      lastWord = w;
      i = j;
      continue;
    }
    out += c;
    if (!/\s/.test(c)) { lastCh = c; lastWord = ''; }
    i++;
  }

  // Collapse the runs of blank lines the strip leaves behind. Not the lines
  // themselves — a file that is 46% comment becomes a file that is 46% empty,
  // and the newlines are what ASI is standing on.
  return out.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
}
