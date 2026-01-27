#!/bin/bash
set -euo pipefail

npx esbuild ./background/background.ts \
  --bundle --format=esm --platform=browser \
  --outfile=../dist/background/background.js

npx esbuild ./content/content.ts \
  --bundle --format=iife --platform=browser \
  --outfile=../dist/content/content.js

