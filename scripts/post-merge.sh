#!/bin/bash
# Post-merge setup: runs automatically after a task merge.
# Idempotent, non-interactive, fail-fast.
set -e

npm install --no-audit --no-fund
