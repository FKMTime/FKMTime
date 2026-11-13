#!/usr/bin/env bash
# Removes this checkout's dev stack (docker-compose.yml) for good: its
# containers, network, volumes (the database too) and the images built for it,
# then clears the ports dev-ports.sh gave it. Paseo runs it when a workspace's
# worktree is archived (see paseo.json); it can also be run by hand.
#
#   ./scripts/dev-teardown.sh
#
# Only this checkout's compose project is touched (named after its directory),
# so stacks from other worktrees keep running. Never fails: with Docker down or
# no stack, there is nothing to remove, and archiving must not get stuck.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$ROOT" || exit 0

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    echo "Docker isn't running; no dev stack to remove."
elif [ -z "$(docker compose ps --all --quiet 2>/dev/null)" ] &&
    [ -z "$(docker compose volumes --quiet 2>/dev/null)" ]; then
    echo "No dev stack for $(basename "$ROOT")."
else
    docker compose down --volumes --remove-orphans --rmi local ||
        echo "Couldn't remove every part of the dev stack; see above." >&2
fi

if [ -f "$ROOT/.env" ]; then
    "$ROOT/scripts/dev-ports.sh" --clear || true
fi
exit 0
