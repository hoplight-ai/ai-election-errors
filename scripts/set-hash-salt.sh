#!/usr/bin/env bash
# Sets REPORTER_HASH_SALT on the Vercel project to a fresh random value, never printed.
# Changing it later only means repeat submitters before and after the change no longer group.
set -euo pipefail
for env in production preview; do
  openssl rand -hex 32 | tr -d '\n' | vercel env add REPORTER_HASH_SALT "$env" --sensitive --force >/dev/null
  echo "set REPORTER_HASH_SALT for $env"
done
