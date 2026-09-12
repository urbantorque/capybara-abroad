#!/bin/sh
# L4 E3 — the first-minute differential: qa/l4-first-minute.js against the
# stashed tree (before), then against the working tree (after), then the
# settled frames resumed. The server serves from disk; a stash is a rebuild.
set -e
cd "$(dirname "$0")/.."
git stash push -q -- src/systems.js src/capybara.js src/shared.js src/kowloon.js
playwright-cli close-all >/dev/null 2>&1 || true
playwright-cli -s=capy open http://localhost:5188/ >/dev/null 2>&1
playwright-cli -s=capy run-code --filename=qa/l4-first-minute.js 2>&1 | grep -iE '^### Error|Error:' | head -3 || true
cp qa/l4-first-minute.json.png qa/l4-first-minute-before.json.png
git stash pop -q
playwright-cli close-all >/dev/null 2>&1 || true
playwright-cli -s=capy open http://localhost:5188/ >/dev/null 2>&1
playwright-cli -s=capy run-code --filename=qa/l4-first-minute.js 2>&1 | grep -iE '^### Error|Error:' | head -3 || true
cp qa/l4-first-minute.json.png qa/l4-first-minute-after.json.png
playwright-cli -s=capy run-code --filename=qa/l4-shots3.js 2>&1 | grep -iE '^### Error|Error:' | head -3 || true
playwright-cli -s=capy run-code --filename=qa/l4-shots3.js 2>&1 | grep -iE '^### Error|Error:' | head -3 || true
ls qa/l4c-*.png | wc -l
git status --short src | head
