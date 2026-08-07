#!/bin/bash
# Runs each page's suite against it in headless Chrome.
#
# The pages are self-contained HTML, so each suite is appended to a throwaway copy
# and the results are scraped back out of the DOM. Chrome needs a generous
# --virtual-time-budget: the suites fast-forward a lot of timers.
set -uo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || { echo "Chrome not found at: $CHROME (set \$CHROME)"; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# page:suite pairs. Add a line to cover a new page.
SUITES=(
  "grain-lab.html:grain-lab.tests.js"
)

# Only run the ones asked for, if any were named.
if [ "$#" -gt 0 ]; then
  FILTER="$*"
else
  FILTER=""
fi

fails=0
for pair in "${SUITES[@]}"; do
  page="${pair%%:*}"
  suite="${pair#*:}"
  if [ -n "$FILTER" ] && [[ "$page" != *"$FILTER"* ]]; then continue; fi
  [ -f "$page" ]  || { echo "missing page: $page";  fails=$((fails+1)); continue; }
  [ -f "$suite" ] || { echo "missing suite: $suite"; fails=$((fails+1)); continue; }

  PAGE="$WORK/$(basename "$page" .html)-run.html"
  {
    cat "$page"
    printf '\n<div id="results" style="white-space:pre"></div>\n<script>\n'
    cat "$suite"
    printf '\n</script>\n'
  } > "$PAGE"

  echo "── $page"
  # A desktop viewport is required: headless defaults to 800px wide, which is below
  # the layout breakpoints, and the suites assert against the wide arrangement.
  timeout 600 "$CHROME" --headless --disable-gpu --no-sandbox \
    --window-size=1600,1200 \
    --virtual-time-budget=400000 --dump-dom "file://$PAGE" 2>/dev/null \
  | python3 -c '
import sys, re, html
d = sys.stdin.read()
m = re.search(r"<div id=\"results\"[^>]*>(.*?)</div>", d, re.S)
if not m:
    print("   NO RESULTS — the page threw before the suite finished")
    sys.exit(1)
out = m.group(1)
out = html.unescape(out)
lines = [l for l in out.split("\n") if l.strip()]
bad = [l for l in lines if l.startswith("FAIL") or l.startswith("THREW")]
for l in bad:
    print("   " + l)
print("   %d passed, %d failed" % (
    len([l for l in lines if l.startswith("PASS")]), len(bad)))
sys.exit(0 if "ALL PASS" in out else 1)
'
  [ "${PIPESTATUS[1]}" -eq 0 ] || fails=$((fails+1))
done

if [ "$fails" -gt 0 ]; then
  echo "FAILED ($fails suite(s))"
  exit 1
fi
echo "OK"
