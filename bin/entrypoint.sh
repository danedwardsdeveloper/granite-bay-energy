#!/usr/bin/env bash
set -euo pipefail

db_path="${WP_DB_PATH:-/var/www/html/wp-content/database/site.sqlite}"
db_dir="$(dirname "$db_path")"
seed='/seed/seed.sqlite'

mkdir -p "$db_dir"

if [[ ! -f "$db_path" && -s "$seed" ]]; then
	echo "entrypoint: seeding $db_path"
	cp "$seed" "$db_path"
fi

# A Fly volume mounts owned by root, so Apache cannot write the database until this runs.
chown -R www-data:www-data "$db_dir" /var/www/html/wp-content/uploads

exec "$@"
