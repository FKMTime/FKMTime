#!/usr/bin/env bash
# Gives this checkout its own host ports, so its dev stack (docker-compose.yml)
# can run next to a stack from another worktree. Writes the FKMTIME_* variables
# to the gitignored .env, which docker compose reads on its own.
#
#   ./scripts/dev-ports.sh                  pick free ports, skip the connector
#   ./scripts/dev-ports.sh --with-connector pick free ports, keep the connector
#   ./scripts/dev-ports.sh --clear          back to the default ports
#
# Ports move by 100 per slot (slot 1: backend 5100, panel 5273, ...). The first
# slot whose ports are all free wins; a port counts as taken when something
# listens on it, a Docker container publishes it, or another worktree's .env
# claims it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
ENV_FILE="$ROOT/.env"
KEYS=(FKMTIME_BACKEND_PORT FKMTIME_FRONTEND_PORT FKMTIME_DATABASE_PORT FKMTIME_DUMMY_WCA_PORT FKMTIME_DUMMY_WCA_LIVE_PORT FKMTIME_MICRO_CONNECTOR)
DEFAULTS=(5000 5173 5433 3005 4000)

with_connector=0
clear=0
for arg in "$@"; do
    case "$arg" in
        --with-connector) with_connector=1 ;;
        --clear) clear=1 ;;
        *) echo "Unknown option: $arg" >&2; exit 2 ;;
    esac
done

# .env without our keys, so other settings in it survive
strip_keys() {
    [[ -f "$ENV_FILE" ]] || return 0
    local pattern
    pattern="^($(IFS='|'; echo "${KEYS[*]}"))="
    grep -Ev "$pattern" "$ENV_FILE" || true
}

if [[ $clear -eq 1 ]]; then
    rest="$(strip_keys)"
    if [[ -n "$rest" ]]; then printf '%s\n' "$rest" > "$ENV_FILE"; else rm -f "$ENV_FILE"; fi
    echo "Cleared. The stack uses the default ports again."
    exit 0
fi

if [[ -f "$ENV_FILE" ]] && grep -q '^FKMTIME_BACKEND_PORT=' "$ENV_FILE"; then
    echo "This checkout already has its ports in .env:" >&2
    grep -E "^($(IFS='|'; echo "${KEYS[*]}"))=" "$ENV_FILE" >&2
    echo "Run with --clear first to pick new ones." >&2
    exit 1
fi

# A port is taken when something listens on it, or when a stack that is not up
# yet will want it: a Docker container publishes it (stopped ones too; lsof
# misses Docker's ports anyway), or another worktree's .env claims it. Without
# Docker, the .env claims and lsof still apply.
claimed_ports="$(
    docker inspect --format '{{range .HostConfig.PortBindings}}{{range .}}{{.HostPort}} {{end}}{{end}}' \
        $(docker ps -aq 2>/dev/null) 2>/dev/null || true
    git -C "$ROOT" worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p' |
        while IFS= read -r tree; do
            if [[ "$tree" != "$ROOT" && -f "$tree/.env" ]]; then
                sed -nE 's/^FKMTIME_[A-Z_]+_PORT=([0-9]+).*/\1/p' "$tree/.env"
            fi
        done || true
)"
claimed_ports="$(tr -s ' ' '\n' <<<"$claimed_ports")"
port_busy() {
    grep -qx "$1" <<<"$claimed_ports" && return 0
    lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

ports=()
for slot in 1 2 3 4 5 6 7 8 9; do
    candidate=()
    for base in "${DEFAULTS[@]}"; do candidate+=($((base + slot * 100))); done
    free=1
    for port in "${candidate[@]}"; do
        if port_busy "$port"; then free=0; break; fi
    done
    if [[ $free -eq 1 ]]; then ports=("${candidate[@]}"); break; fi
done

if [[ ${#ports[@]} -eq 0 ]]; then
    echo "No free slot found; set the FKMTIME_*_PORT variables in .env by hand." >&2
    exit 1
fi

{
    strip_keys
    for i in "${!DEFAULTS[@]}"; do echo "${KEYS[$i]}=${ports[$i]}"; done
    echo "FKMTIME_MICRO_CONNECTOR=$with_connector"
} > "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"

cat <<EOF
Wrote $ENV_FILE:
  Panel                http://localhost:${ports[1]}
  Backend              http://localhost:${ports[0]}/health
  Database             localhost:${ports[2]}
  Dummy WCA / WCA Live http://localhost:${ports[3]} / http://localhost:${ports[4]}
EOF
if [[ $with_connector -eq 0 ]]; then
    echo "The micro connector is off in this stack; Bluetooth stays with the stack that runs it."
fi
