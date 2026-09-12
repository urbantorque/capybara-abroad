#!/bin/sh
# L4 E1 — the walking-lens differential. Stashes the two lens files, runs
# qa/b5-cam.js against the shipped rig (tag l4before), pops, runs it again
# (tag l4after). The dev server serves from disk so a stash is a rebuild.
set -e
cd "$(dirname "$0")/.."
sed -i "s/const TAG = '[a-z0-9]*';/const TAG = 'l4before';/" qa/b5-cam.js
git stash push -q -- src/systems.js src/capybara.js src/shared.js src/kowloon.js
playwright-cli close-all >/dev/null 2>&1 || true
playwright-cli -s=capy open http://localhost:5188/ >/dev/null 2>&1
playwright-cli -s=capy run-code --filename=qa/b5-cam.js 2>&1 | grep -iE 'Error' | head -3 || true
git stash pop -q
sed -i "s/const TAG = '[a-z0-9]*';/const TAG = 'l4after';/" qa/b5-cam.js
playwright-cli close-all >/dev/null 2>&1 || true
playwright-cli -s=capy open http://localhost:5188/ >/dev/null 2>&1
playwright-cli -s=capy run-code --filename=qa/b5-cam.js 2>&1 | grep -iE 'Error' | head -3 || true
ls -la --time-style=+%H:%M:%S qa/b5-cam-l4before.json.png qa/b5-cam-l4after.json.png
git status --short src | head
