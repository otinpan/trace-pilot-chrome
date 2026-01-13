#!/bin/bash
npx esbuild ./background/background.ts --bundle --format=esm --platform=browser --outfile=../dist/background/background.js
npx esbuild ./content/content.ts --bundle --format=esm --platform=browser --outfile=../dist/content/content.js