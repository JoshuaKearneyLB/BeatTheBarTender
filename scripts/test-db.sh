#!/usr/bin/env bash
# Database test runner: spins up a throwaway Postgres cluster, applies a
# minimal Supabase-surface stub plus both migrations, then runs the RPC
# behavioral tests. Requires PostgreSQL server binaries (14+).
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)}"
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then
  command -v initdb >/dev/null 2>&1 && PGBIN="$(dirname "$(command -v initdb)")" || {
    echo "error: PostgreSQL server binaries not found (set PGBIN)" >&2
    exit 1
  }
fi

PORT="${PGPORT_TEST:-55433}"
DIR="$(mktemp -d)"

# Postgres refuses to run as root; drop to nobody when needed.
if [ "$(id -u)" = 0 ]; then
  chown nobody "$DIR"
  run() { su nobody -s /bin/bash -c "$*"; }
else
  run() { bash -c "$*"; }
fi

cleanup() {
  run "'$PGBIN/pg_ctl' -D '$DIR/data' stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$DIR"
}
trap cleanup EXIT

run "'$PGBIN/initdb' -D '$DIR/data' -U postgres -A trust" >/dev/null
run "'$PGBIN/pg_ctl' -D '$DIR/data' -o '-k $DIR -p $PORT -c listen_addresses=' -l '$DIR/pg.log' start" >/dev/null

PSQL=("$PGBIN/psql" -h "$DIR" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -c "create database baropoly_test"
MIGRATION_ARGS=(-f supabase/tests/supabase-stub.sql)
for m in supabase/migrations/*.sql; do MIGRATION_ARGS+=(-f "$m"); done
"${PSQL[@]}" -d baropoly_test "${MIGRATION_ARGS[@]}" 2>&1 | grep -v "wal_level\|^HINT" || true
"${PSQL[@]}" -d baropoly_test -f supabase/tests/rpc-test.sql 2>&1 | grep -E "PASS|FAIL|ERROR|ALL RPC"

echo "db tests: OK"
