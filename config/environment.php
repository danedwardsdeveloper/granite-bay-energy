<?php
const environments = array(
	'development' => 'http://localhost:22000',
	'staging'     => 'https://granite-bay-energy-staging.fly.dev',
	'production'  => 'https://granite-bay-energy.fly.dev',
);

$granite_bay_env = getenv('WP_ENV');

if (! is_string($granite_bay_env) || ! array_key_exists($granite_bay_env, environments)) {
	throw new RuntimeException(
		sprintf(
			'Invalid WP_ENV: %s. Expected one of: %s.',
			var_export($granite_bay_env, true),
			implode(', ', array_keys(environments))
		)
	);
}

define('WP_ENV', $granite_bay_env);
define('IS_PRODUCTION', 'production' === WP_ENV);
define('isDevelopment', 'development' === WP_ENV);
define('siteUrl', environments[WP_ENV]);

if (! isDevelopment && 0 !== strpos(siteUrl, 'https://')) {
	throw new RuntimeException('A deployed environment must have an https site URL, found: ' . siteUrl);
}

unset($granite_bay_env);
