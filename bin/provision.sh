#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

readonly sierra_industry_site_id=19824
readonly site_title='Granite Bay Energy'
readonly site_tagline='Subsea and topside engineering for the North Sea'
readonly admin_user='dan'
readonly admin_email='admin@granite-bay-energy.fly.dev'
readonly local_db='.local/database/site.sqlite'
readonly seed='db/seed.sqlite'

wp() {
	docker compose exec -T -u www-data site wp --path=/var/www/html "$@"
}

log() {
	printf '\n==> %s\n' "$1"
}

if [[ "${1:-}" == '--reset' ]]; then
	log 'Tearing down the local database'
	docker compose down
	rm -rf .local/database
	# The entrypoint restores the seed baked into the image, so a reset that leaves it in place
	# simply reinstates the site it was trying to discard. Provisioning writes it back at the end.
	rm -f "$seed"
fi

log 'Starting the site'
mkdir -p .local/database
docker compose up -d --build --wait

if wp core is-installed 2>/dev/null; then
	log 'WordPress is already installed - re-run with --reset to start clean'
else
	log 'Installing WordPress'
	wp core install \
		--url='http://localhost:22000' \
		--title="$site_title" \
		--admin_user="$admin_user" \
		--admin_password="${WP_ADMIN_PASSWORD:?set WP_ADMIN_PASSWORD before provisioning}" \
		--admin_email="$admin_email" \
		--skip-email
fi

log 'Activating theme and plugins'
wp theme activate astra
wp plugin activate sqlite-database-integration elementor header-footer-elementor sureforms astra-sites

# The importer dies part-way through if it has to install Spectra or SureForms itself, so Composer
# ships both and they are activated above before the import is asked for.
log "Importing Sierra Industry (site $sierra_industry_site_id)"
wp starter-templates import "$sierra_industry_site_id" --yes

log 'Switching to the child theme'
wp theme activate granite-bay

# Theme mods are stored per theme, so the menu locations, logo and header/footer builder layout the
# import wrote against astra do not follow the child theme across on their own.
wp eval '
$mods = get_option( "theme_mods_astra" );
if ( is_array( $mods ) ) {
	update_option( "theme_mods_granite-bay", $mods );
	echo "copied " . count( $mods ) . " theme mods\n";
}'

# Both of these are reset by the import, so they are set after it rather than before. External CSS
# means Elementor writing into uploads, which the production image cannot do.
log 'Configuring Elementor'
wp option update elementor_css_print_method internal
wp option update elementor_meta_generator_tag 1

log 'Regenerating cached CSS'
wp eval 'if ( function_exists( "astra_clear_all_assets_cache" ) ) { astra_clear_all_assets_cache(); echo "astra cache cleared\n"; }'
wp elementor flush-css 2>/dev/null || true
wp cache flush

log 'Applying site settings'
wp option update blogname "$site_title"
wp option update blogdescription "$site_tagline"
wp option update timezone_string 'Europe/London'
wp option update date_format 'j F Y'
wp option update start_of_week 1
wp rewrite structure '/%postname%/' --hard
wp rewrite flush --hard

log 'Removing the defaults the template leaves behind'
wp eval '
foreach ( get_posts( array( "post_type" => array( "page", "post" ), "post_status" => "any", "numberposts" => -1 ) ) as $post ) {
	if ( in_array( $post->post_title, array( "Sample Page", "Hello world!" ), true ) ) {
		wp_delete_post( $post->ID, true );
		echo "deleted {$post->post_title} ({$post->ID})\n";
	}
}'
wp plugin delete hello akismet 2>/dev/null || true
wp comment delete "$(wp comment list --format=ids)" --force 2>/dev/null || true

log 'Setting the logo and footer text'
logo_id="$(wp media import /var/www/html/wp-content/themes/granite-bay/assets/logo-light.png \
	--title='Granite Bay Energy' --porcelain | tr -d '\r')"

# The template runs a transparent header, whose logo is a URL inside astra-settings rather than the
# custom_logo attachment the rest of the theme reads.
wp eval "
set_theme_mod( 'custom_logo', ${logo_id} );
\$settings = (array) get_option( 'astra-settings', array() );
\$settings['transparent-header-logo'] = wp_get_attachment_url( ${logo_id} );
\$settings['footer-html-1'] = 'Copyright &copy; [current_year] [site_title]';
update_option( 'astra-settings', \$settings );
echo 'logo attachment ${logo_id}' . PHP_EOL;"

log 'Replacing the template placeholder copy'
docker compose cp bin/siteCopy.php site:/tmp/siteCopy.php
wp eval-file /tmp/siteCopy.php

log 'Tidying page slugs'
wp eval '
$page = get_page_by_path( "product-2" );
if ( $page instanceof WP_Post && ! get_page_by_path( "products" ) ) {
	wp_update_post( array( "ID" => $page->ID, "post_name" => "products" ) );
	echo "renamed product-2 to products\n";
}'
wp rewrite flush --hard

log 'Exporting the seed'
docker compose stop site
mkdir -p db
cp "$local_db" "$seed"
docker compose start site

log "Done. $seed is $(du -h "$seed" | cut -f1); the site is at http://localhost:22000"
