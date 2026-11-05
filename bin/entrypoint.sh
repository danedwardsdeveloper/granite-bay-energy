#!/usr/bin/env bash
set -euo pipefail

db_path="${WP_DB_PATH:-/var/www/html/wp-content/database/site.sqlite}"
db_dir="$(dirname "$db_path")"
seed='/seed/seed.sqlite'
seed_url='http://localhost:22000'

mkdir -p "$db_dir"

seeded=false
if [[ ! -f "$db_path" && -s "$seed" ]]; then
	echo "entrypoint: seeding $db_path"
	cp "$seed" "$db_path"
	seeded=true
fi

# The seed is provisioned against localhost, and Elementor writes absolute image URLs into post meta and
# caches its generated CSS there too, so a seeded production database asks the browser for images on
# localhost. WP_HOME and WP_SITEURL reach neither. The replacement is longer than what it replaces, so a
# sed over the file would corrupt every serialised array it touched - hence WP-CLI, which re-serialises.
if [[ "$seeded" == true ]]; then
	site_url="$(php -r 'require "/var/www/html/environment.php"; echo siteUrl;')"

	if [[ "$site_url" != "$seed_url" ]]; then
		echo "entrypoint: rewriting $seed_url to $site_url"
		chown -R www-data:www-data "$db_dir"
		su www-data -s /bin/bash -c "wp search-replace '$seed_url' '$site_url' \
			--path=/var/www/html --all-tables --skip-columns=guid --precise --report-changed-only"
	fi
fi

# A Fly volume mounts owned by root, so Apache cannot write the database until this runs.
chown -R www-data:www-data "$db_dir" /var/www/html/wp-content/uploads

exec "$@"
