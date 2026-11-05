<?php
/**
 * Plugin Name: Granite Bay — headers
 * Description: Security response headers, the robots policy, and the sitemap's contents.
 * Author: Dan Edwards
 * Version: 1.0.0
 * License: MIT
 */

function graniteBaySecurityHeaders($headers) {
	$headers['X-Content-Type-Options'] = 'nosniff';
	$headers['Referrer-Policy']        = 'strict-origin-when-cross-origin';
	$headers['X-Frame-Options']        = 'SAMEORIGIN';
	$headers['Permissions-Policy']     = 'geolocation=(), microphone=(), camera=()';

	return $headers;
}
add_filter('wp_headers', 'graniteBaySecurityHeaders');

function graniteBayRobotsTxt(): string {
	$lines = array(
		'User-agent: *',
		'Disallow: /wp-admin/',
		'Allow: /wp-admin/admin-ajax.php',
		'',
		'Sitemap: ' . esc_url_raw(home_url('/wp-sitemap.xml')),
	);

	return implode("\n", $lines) . "\n";
}
add_filter('robots_txt', 'graniteBayRobotsTxt', 99);

/* Core would otherwise list the SureForms post type and the author archive beside the five real pages. */
function graniteBaySitemapPostTypes($post_types) {
	return array_intersect_key($post_types, array_flip(array('page')));
}
add_filter('wp_sitemaps_post_types', 'graniteBaySitemapPostTypes');

add_filter('wp_sitemaps_add_provider', 'graniteBaySitemapProviders', 10, 2);

function graniteBaySitemapProviders($provider, $name) {
	return in_array($name, array('users', 'taxonomies'), true) ? false : $provider;
}

/*
Without these, a browser opening either sitemap renders core's XSL instead of the XML: a WordPress
heading, a blurb about search engines and a URL count. Crawlers never see it and it is not ours to
put our name under, so the stylesheet goes and the document shows the tree it actually contains.
*/
add_filter('wp_sitemaps_stylesheet_url', '__return_false');
add_filter('wp_sitemaps_stylesheet_index_url', '__return_false');
