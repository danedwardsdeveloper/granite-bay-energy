<?php
/**
 * Plugin Name: Granite Bay — site icon
 * Description: Serves the favicon set from the child theme rather than a media library attachment.
 * Author: Dan Edwards
 * Version: 1.0.0
 * License: MIT
 */

function graniteBayIconLinks(): void {
	$base = get_stylesheet_directory_uri() . '/assets';

	printf('<link rel="icon" href="%s/favicon.svg" type="image/svg+xml" />' . "\n", esc_url($base));
	printf('<link rel="icon" href="%s/favicon.ico" sizes="32x32" />' . "\n", esc_url($base));
	printf('<link rel="apple-touch-icon" href="%s/apple-touch-icon.png" />' . "\n", esc_url($base));
}
add_action('wp_head', 'graniteBayIconLinks', 2);
add_action('admin_head', 'graniteBayIconLinks', 2);

/* Core would otherwise inject a competing set from the site_icon option. */
remove_action('wp_head', 'wp_site_icon', 99);
