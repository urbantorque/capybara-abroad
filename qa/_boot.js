// qa/_boot.js — THE BEGIN/CARRY-ON DOOR (L7, E7)
//
// Not imported by anything: run-code evals a page-fn file as a single
// expression with no module loader behind it, so every probe in this
// directory is self-contained by necessity (see qa/README.md — "nothing here
// is not self-contained"). This file is the one canonical copy of the door
// every probe should open with, kept here so the next probe copies FROM
// something rather than re-deriving it, and so a change to how the game
// starts has one place that says what the fix looked like.
//
// WHAT WAS WRONG. Four of the five named audits (qa/npchealth.js, props.js,
// pointers.js, audio2.js) opened with `page.mouse.click(400, 400)` — a raw
// pixel coordinate, the exact anti-pattern that regressed qa/fuzz.js to
// nineteen rows of maxSpeed 0 once already (see fuzz.js's own header, L4
// qa#1): the title card's pointerdown handler starts the game only on the
// BACKDROP, and a fixed pixel is one resize away from landing on the card
// instead. None of the five checked `g.state.started` before proceeding, so
// a probe that clicked the card would run its whole sweep against a title
// screen and report a clean pass. qa/kine.js and qa/pointers.js pressed
// nothing at all — a bare `page.reload()` and a wait, trusting the page was
// already past the title card from a previous run-code call in the same
// session.
//
// THE DOOR. Enter is the same key startResume answers for a player
// (fuzz.js's own choice, not a new one); `started` is read back and thrown
// on rather than trusted, so a probe that opens on a title card fails LOUDLY
// instead of reporting a clean sweep of nothing.
//
async page => {
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
  await page.evaluate(async (o) => {
    await fetch('/shot?name=_boot.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, { started });
  if (!started) throw new Error('_boot FAILED: the door did not open (state.started is false after Enter)');
}
