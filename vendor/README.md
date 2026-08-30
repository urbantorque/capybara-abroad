# vendor/

The two libraries this game is built on, kept in the repository rather than
fetched from a CDN at boot.

| file | package | version | source | SHA-256 |
|---|---|---|---|---|
| `three.module.js` | [three](https://github.com/mrdoob/three.js) | 0.169.0 | `https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js` | `0a3368c165eea773490aec7b77c22de70e3eac288503409256fdbf4d12578416` |
| `cannon-es.js` | [cannon-es](https://github.com/pmndrs/cannon-es) | 0.20.0 | `https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js` | `f0700cbd3a482954949b9d58c1b0f76dcc74767750297647a39d8c40dd63d37c` |

Both files are byte-for-byte as published. Neither is patched, and nothing in
`src/` may edit them.

## Why they are here

They used to be resolved through an importmap pointing at jsdelivr. That put a
third-party host between a stranger and the first frame, and the failure was
silent: measured 31 Aug 2026, blocking the CDN left the game showing
`warming up the harbour…` on a pale blue field for ever, with no error, no
message and nothing to click. An ad-blocker, an office or school proxy, a
country that does not reach that host, a laptop away from a signal, or ten
minutes of jsdelivr being down all produce it.

A game whose first screen can be a permanent lie about loading is not a game
you can hand to anybody. Together these are 1.6 MB — about a fifth of what the
game itself weighs — and having them here means the only host involved in
starting the game is the one serving the game.

`build.mjs` inlines both into `dist/untitled-capybara-game.html`, each wrapped
in its own IIFE (they both declare a top-level `Material`, among others), so
the distributable really is the single self-contained file it has always
claimed to be.

## Upgrading

1. Download the new build to this directory under the same filename.
2. Update the version and SHA-256 in the table above (`sha256sum vendor/*.js`).
3. `node build.mjs` — it re-checks that each file is import-free, has exactly
   one trailing `export { ... };` and uses no `as` aliases in it, and refuses to
   build if any of that has changed. Those are the three assumptions the IIFE
   wrapper makes, and a silent mistranslation of an export list would produce a
   bundle that boots and then fails somewhere deep in a chapter.
4. Play a chapter before believing it.

## Licences

Both are MIT, and both notices are reproduced here because the build inlines
the code into a distributable file.

### three.js

> Copyright © 2010-2024 three.js authors
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

### cannon-es

> Copyright © 2015 cannon.js authors, © 2020 cannon-es authors
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.
