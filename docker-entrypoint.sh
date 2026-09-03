#!/bin/sh
set -e

# Corre las migraciones pendientes contra la DB del compose antes de levantar Nest.
npx tsx ./node_modules/typeorm/cli.js -d src/database/data-source.ts migration:run

exec "$@"
