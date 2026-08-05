#!/bin/bash
# Runs grain-lab.tests.js against grain-lab.html in headless Chrome.
#
# The page is a single self-contained HTML file, so the suite is appended to a
# throwaway copy and the results are scraped back out of the DOM. Chrome needs a
# generous --virtual-time-budget: the suite fast-forwards a lot of timers.
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || { echo "Chrome not found at: $CHROME (set \$CHROME)"; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PAGE="$WORK/run.html"

{
  cat grain-lab.html
  printf '\n<div id="results" style="white-space:pre"></div>\n<script>\n'
  cat grain-lab.tests.js
  printf '\n</script>\n'
} > "$PAGE"

# A desktop viewport is required: headless defaults to 800px wide, which is below
# the layout breakpoints, and the suite asserts the three-column arrangement.
timeout 600 "$CHROME" --headless --disable-gpu --no-sandbox \
  --window-size=1600,1200 \
  --virtual-time-budget=400000 --dump-dom "file://$PAGE" 2>/dev/null \
| python3 -c '
import sys, re, html
d = sys.stdin.read()
m = re.search(r"<div id=\"results\"[^>]*>(.*?)</div>", d, re.S)
if not m:
    print("NO RESULTS — the page threw before the suite finished")
    sys.exit(1)
out = html.unescape(m.group(1))
print(out)
lines = [l for l in out.split("\n") if l.strip()]
print("\n%d passed, %d failed" % (
    len([l for l in lines if l.startswith("PASS")]),
    len([l for l in lines if l.startswith("FAIL") or l.startswith("THREW")])))
sys.exit(0 if "ALL PASS" in out else 1)
'
