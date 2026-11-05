<?php
require_once __DIR__ . '/environment.php';

define('DB_PATH', getenv('WP_DB_PATH') ?: '/var/www/html/wp-content/database/site.sqlite');
define('DB_NAME', 'granite_bay_energy');
define('DB_USER', '');
define('DB_PASSWORD', '');
define('DB_HOST', '');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');

$table_prefix = 'wp_';

/* Fly forwards plain HTTP, so without this every wp-admin request redirect-loops. */
if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && 'https' === $_SERVER['HTTP_X_FORWARDED_PROTO']) {
	$_SERVER['HTTPS'] = 'on';
}

define('WP_HOME', siteUrl);
define('WP_SITEURL', siteUrl);

$salts = array(
	'AUTH_KEY',
	'SECURE_AUTH_KEY',
	'LOGGED_IN_KEY',
	'NONCE_KEY',
	'AUTH_SALT',
	'SECURE_AUTH_SALT',
	'LOGGED_IN_SALT',
	'NONCE_SALT',
);

foreach ($salts as $salt) {
	$value = getenv('WP_' . $salt);

	if (! is_string($value) || '' === $value) {
		if (! isDevelopment) {
			throw new RuntimeException('Missing required secret: WP_' . $salt);
		}
		$value = 'development-only-' . strtolower($salt);
	}

	define($salt, $value);
}

unset($salts, $salt, $value);

/* Off in development so provisioning can install the Starter Templates importer. */
define('DISALLOW_FILE_MODS', ! isDevelopment);
define('DISALLOW_FILE_EDIT', true);
define('AUTOMATIC_UPDATER_DISABLED', true);
define('WP_AUTO_UPDATE_CORE', false);

/* SureForms bundles an ActionScheduler that is not PHP 8.4 clean, and displayed notices land in the markup. */
define('WP_DEBUG', isDevelopment);
define('WP_DEBUG_LOG', isDevelopment);
define('WP_DEBUG_DISPLAY', false);
define('SCRIPT_DEBUG', isDevelopment);
ini_set('display_errors', '0');

define('WP_POST_REVISIONS', 5);
define('EMPTY_TRASH_DAYS', 7);

if (! defined('ABSPATH')) {
	define('ABSPATH', __DIR__ . '/');
}

require_once ABSPATH . 'wp-settings.php';
