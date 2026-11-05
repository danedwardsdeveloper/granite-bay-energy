<?php
/**
 * Plugin Name: Granite Bay — metadata
 * Description: Titles, descriptions, canonicals and social cards. Core emits none of them.
 * Author: Dan Edwards
 * Version: 1.0.0
 * License: MIT
 */

const descriptionMin = 70;
const descriptionMax = 155;
const titleMin = 40;
const titleMax = 65;

const ogImagePath = '/wp-content/themes/granite-bay/assets/og.png';

const pageMetadata = array(
	'/' => array(
		'title'       => 'Granite Bay Energy | Subsea and topside engineering, Aberdeen',
		'description' => 'Subsea and topside engineering for North Sea operators, from concept studies through fabrication to offshore commissioning.',
	),
	'/about/' => array(
		'title'       => 'About Granite Bay Energy | North Sea engineering since 1994',
		'description' => 'Three decades of North Sea engineering from an Aberdeen base. Meet the team behind Granite Bay Energy subsea and topside projects.',
	),
	'/products/' => array(
		'title'       => 'Subsea connectors and topside modules | Granite Bay Energy',
		'description' => 'Subsea connectors, topside modules and pipeline equipment, engineered and fabricated in Aberdeen for North Sea operating conditions.',
	),
	'/projects/' => array(
		'title'       => 'Selected North Sea projects | Granite Bay Energy',
		'description' => 'Selected Granite Bay Energy work across the North Sea: subsea tie-backs, topside upgrades and platform decommissioning programmes.',
	),
	'/contact/' => array(
		'title'       => 'Contact Granite Bay Energy | Aberdeen engineering desk',
		'description' => 'Talk to Granite Bay Energy in Aberdeen about subsea and topside engineering enquiries, tenders and technical support for North Sea assets.',
	),
);

function graniteBayCurrentPath(): string {
	if (is_front_page()) {
		return '/';
	}

	if (! is_singular()) {
		return '';
	}

	$permalink = get_permalink();

	return is_string($permalink) ? (string) wp_make_link_relative($permalink) : '';
}

function graniteBayMetadata(): array {
	$path = graniteBayCurrentPath();

	if (isset(pageMetadata[$path])) {
		return pageMetadata[$path];
	}

	return array(
		'title'       => wp_get_document_title(),
		'description' => pageMetadata['/']['description'],
	);
}

function graniteBayCanonical(): string {
	$path = graniteBayCurrentPath();

	return '' === $path ? siteUrl . '/' : siteUrl . $path;
}

function graniteBayOgImage(): string {
	return siteUrl . ogImagePath;
}

/*
Titles and descriptions outside their windows get rewritten by Google when short and truncated when
long, and a page that falls back to a generated one lands as escaped body copy. Failing in
development is what stops that reaching production.
*/
function graniteBayValidateMetadata(): void {
	if (! isDevelopment) {
		return;
	}

	$windows = array(
		'title'       => array(titleMin, titleMax),
		'description' => array(descriptionMin, descriptionMax),
	);

	foreach (pageMetadata as $path => $entry) {
		foreach ($windows as $field => $window) {
			$length = strlen($entry[$field]);

			if ($length < $window[0] || $length > $window[1]) {
				throw new RuntimeException(
					sprintf('The %s for %s is %d characters, outside %d-%d.', $field, $path, $length, $window[0], $window[1])
				);
			}
		}
	}
}
add_action('init', 'graniteBayValidateMetadata');

function graniteBayDocumentTitle($title) {
	$path = graniteBayCurrentPath();

	return isset(pageMetadata[$path]) ? pageMetadata[$path]['title'] : $title;
}
add_filter('pre_get_document_title', 'graniteBayDocumentTitle');

function graniteBayMetaTags(): void {
	$metadata = graniteBayMetadata();
	$canonical = graniteBayCanonical();
	$image = graniteBayOgImage();

	printf('<link rel="canonical" href="%s" />' . "\n", esc_url($canonical));

	$tags = array(
		array('name', 'description', $metadata['description']),
		array('property', 'og:title', $metadata['title']),
		array('property', 'og:description', $metadata['description']),
		array('property', 'og:site_name', (string) get_bloginfo('name')),
		array('property', 'og:type', 'website'),
		array('property', 'og:url', $canonical),
		array('property', 'og:image', $image),
		array('property', 'og:image:alt', 'Granite Bay Energy'),
		array('property', 'og:locale', 'en_GB'),
		array('name', 'twitter:card', 'summary_large_image'),
		array('name', 'twitter:title', $metadata['title']),
		array('name', 'twitter:description', $metadata['description']),
		array('name', 'twitter:image', $image),
	);

	foreach ($tags as $tag) {
		printf('<meta %1$s="%2$s" content="%3$s" />' . "\n", esc_attr($tag[0]), esc_attr($tag[1]), esc_attr($tag[2]));
	}
}
add_action('wp_head', 'graniteBayMetaTags', 5);

remove_action('wp_head', 'rel_canonical');
