#!/bin/sh

find /frontend -name "*.js" -exec sed -i "s|{{BACKEND_ORIGIN}}|${BACKEND_ORIGIN:-}|g" {} +
find /frontend -name "*.js" -exec sed -i "s|{{WCA_ORIGIN}}|${WCA_ORIGIN:-}|g" {} +
find /frontend -name "*.js" -exec sed -i "s|{{WCA_CLIENT_ID}}|${WCA_CLIENT_ID:-}|g" {} +

exec /entrypoint.sh
