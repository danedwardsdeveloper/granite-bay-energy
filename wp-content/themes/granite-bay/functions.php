<?php
declare(strict_types=1);

function graniteBayEnqueueStyles(): void {
	$stylesheet = get_stylesheet_directory() . '/style.css';

	wp_enqueue_style(
		'granite-bay',
		get_stylesheet_directory_uri() . '/style.css',
		array('astra-theme-css'),
		(string) filemtime($stylesheet)
	);
}
add_action('wp_enqueue_scripts', 'graniteBayEnqueueStyles', 20);
