#!/bin/sh
set -e
# Creates or upgrades the database schema from prisma/sql (src/db/apply-schema.ts),
# and refuses to start the API on a database it can't bring up to date
node /app/db/apply-schema.js
exec node /app/main.js
