#!/bin/bash
# shot2.sh <shot> <out.jpg> [seed] — capture a Steel Strike dossier frame.
# Steel Strike serves on 8080 (node serve.ts); chrome headless screenshot.
set -e
CHROME="$HOME/workspace/.chrome-temp/chrome-linux64/chrome"
SHOT="$1"; OUT="$2"; SEED="${3:-1}"
TMP="/tmp/polish2-$SHOT.png"
rm -rf "/tmp/polish2-chrome-$SHOT"
"$CHROME" --headless=new --disable-gpu --no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --user-data-dir="/tmp/polish2-chrome-$SHOT" --window-size=1280,720 --hide-scrollbars \
  --virtual-time-budget=3500 --screenshot="$TMP" \
  "http://localhost:8080/index.html?shot=$SHOT&seed=$SEED" 2>/tmp/polish2-chrome-$SHOT.err
python3 - "$TMP" "$OUT" <<'PYEOF'
import sys, os
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
print('captured', im.size)
for q in (88, 80, 70, 60):
    im.save(sys.argv[2], quality=q)
    if os.path.getsize(sys.argv[2]) <= 256 * 1024:
        print(f'saved {sys.argv[2]} {im.size} quality={q} size={os.path.getsize(sys.argv[2])}')
        break
else:
    print('WARN: still >256KiB at q60', os.path.getsize(sys.argv[2]))
PYEOF
ls -la "$OUT"
