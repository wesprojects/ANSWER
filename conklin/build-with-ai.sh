#!/usr/bin/env bash
# Prints build-with-ai.html to Work-with-AI.pdf with headless Chrome/Chromium (same way the Arcade poster was made).
set -euo pipefail
cd "$(dirname "$0")"
CHROME="${CHROME:-$(command -v google-chrome || command -v chromium || echo /opt/pw-browsers/chromium)}"
"$CHROME" --headless --no-sandbox --disable-gpu --no-pdf-header-footer --allow-file-access-from-files \
  --print-to-pdf="$PWD/Work-with-AI.pdf" "file://$PWD/build-with-ai.html" 2>/dev/null
echo "wrote Work-with-AI.pdf"
