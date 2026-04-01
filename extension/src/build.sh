#!/bin/bash
set -euo pipefail

npx esbuild ./background/background.ts \
  --bundle --format=esm --platform=browser \
  --outfile=../dist/background/background.js

npx esbuild ./content/content.ts \
  --bundle --format=iife --platform=browser \
  --outfile=../dist/content/content.js

mkdir -p ../dist/offscreen

npx esbuild ./offscreen/offscreen.ts \
  --bundle --format=iife --platform=browser \
  --outfile=../dist/offscreen/offscreen.js

cp ./offscreen/offscreen.html ../dist/offscreen/offscreen.html
