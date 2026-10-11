#!/usr/bin/env bash
# Prints ai-questions.html to AI-Questions.pdf with headless Chrome/Chromium (same way the Arcade poster was made).
set -euo pipefail
cd "$(dirname "$0")"
CHROME="${CHROME:-$(command -v google-chrome || command -v chromium || echo /opt/pw-browsers/chromium)}"
"$CHROME" --headless --no-sandbox --disable-gpu --no-pdf-header-footer --allow-file-access-from-files \
  --print-to-pdf="$PWD/AI-Questions.pdf" "file://$PWD/ai-questions.html" 2>/dev/null
echo "wrote AI-Questions.pdf"
