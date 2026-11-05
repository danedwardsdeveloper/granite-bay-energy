<?php
/**
 * Plugin Name: Granite Bay — site credit
 * Description: Attribution line in the footer, and /humans.txt.
 * Author: Dan Edwards
 * Author URI: https://danedwardsdeveloper.com
 * Version: 1.0.0
 * License: MIT
 */

const author = 'Dan Edwards';
const authorUrl = 'https://danedwardsdeveloper.com';
const repoUrl = 'https://github.com/danedwardsdeveloper/granite-bay-energy';

function graniteBayCreditBar(): void {
	printf(
		'<div class="granite-bay-credit"><span data-test-id="site-credit">%1$s <a href="%2$s" rel="author">%3$s</a></span></div>',
		esc_html__('Site by', 'granite-bay'),
		esc_url(authorUrl),
		esc_html(author)
	);
}
add_action('wp_footer', 'graniteBayCreditBar', 5);

function graniteBayAuthorMeta(): void {
	printf('<meta name="author" content="%s" />' . "\n", esc_attr(author));
}
add_action('wp_head', 'graniteBayAuthorMeta', 1);

function graniteBayHumansRoute(): void {
	$request = isset($_SERVER['REQUEST_URI']) ? sanitize_text_field(wp_unslash($_SERVER['REQUEST_URI'])) : '';

	if ('/humans.txt' !== wp_parse_url($request, PHP_URL_PATH)) {
		return;
	}

	$lines = array(
		'/* TEAM */',
		'Developer: ' . author,
		'Site: ' . authorUrl,
		'Location: Aberdeen, Scotland',
		'',
		'/* SITE */',
		'Components: WordPress, Astra, Elementor',
		'Software: Docker, Fly.io, SQLite',
		'Source: ' . repoUrl,
	);

	header('Content-Type: text/plain; charset=utf-8');
	echo esc_html(implode("\n", $lines) . "\n");
	exit;
}
add_action('init', 'graniteBayHumansRoute');
