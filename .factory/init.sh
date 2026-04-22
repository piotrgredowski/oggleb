#!/bin/sh
set -eu

if [ -f package.json ]; then
  npm install
else
  echo "package.json not present yet; skipping install"
fi
