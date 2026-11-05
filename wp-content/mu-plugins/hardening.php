<?php
/**
 * Plugin Name: Granite Bay — hardening
 * Description: Closes the surfaces a brochure site has no use for.
 * Author: Dan Edwards
 * Version: 1.0.0
 * License: MIT
 */

add_filter('xmlrpc_enabled', '__return_false');

remove_action('wp_head', 'wp_generator');
add_filter('the_generator', '__return_empty_string');

remove_action('wp_head', 'rsd_link');
remove_action('wp_head', 'wlwmanifest_link');
remove_action('wp_head', 'wp_shortlink_wp_head');

function graniteBayRemoveUserEndpoints($endpoints) {
	unset($endpoints['/wp/v2/users'], $endpoints['/wp/v2/users/(?P<id>[\d]+)']);

	return $endpoints;
}
add_filter('rest_endpoints', 'graniteBayRemoveUserEndpoints');

function graniteBayGenericLoginError(): string {
	return esc_html__('Those details are not correct.', 'granite-bay');
}
add_filter('login_errors', 'graniteBayGenericLoginError');

function graniteBayStripPingbackHeader($headers) {
	unset($headers['X-Pingback']);

	return $headers;
}
add_filter('wp_headers', 'graniteBayStripPingbackHeader');
