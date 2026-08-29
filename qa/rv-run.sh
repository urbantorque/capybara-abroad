#!/bin/sh
# Re-open the browser and run one probe. The CLI session in this environment
# drops between invocations often enough that retrying by hand costs more than
# simply reopening every time.
f="$1"
name="$2"
cd /c/Users/roger/OneDrive/Desktop/capy3
rm -f "qa/$name.json.png"
for try in 1 2 3; do
  playwright-cli close-all >/dev/null 2>&1
  playwright-cli -s=rv open http://localhost:5188/ >/dev/null 2>&1
  playwright-cli -s=rv run-code --filename="$f" >/dev/null 2>&1
  if [ -f "qa/$name.json.png" ]; then break; fi
  echo "(retry $try)"
done
echo "--- $name"
cat "qa/$name.json.png" 2>/dev/null || echo "(no output)"
