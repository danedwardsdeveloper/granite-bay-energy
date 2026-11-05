<?php
$copy = array(
	'Home' => array(
		'editor' => array(
			'Granite Bay Energy has engineered subsea and topside systems for North Sea operators since 1994. We take projects from concept study through detailed design, fabrication and offshore commissioning, working to the tolerances a harsh-environment basin demands.',
		),
	),
	'About' => array(
		'editor' => array(
			'Founded in Aberdeen in 1994, Granite Bay Energy grew from a small fabrication shop in Torry into an engineering business of 180 people. We have delivered work on more than forty installations across the UK and Norwegian continental shelves.',
			'Our engineers, welders and project managers hold the certifications the sector expects, and we are audited annually to ISO 9001 and ISO 45001. Safety performance is reported to clients monthly rather than on request.',
		),
	),
	'Products' => array(
		'editor' => array(
			'Every connector, module and clamp we supply is engineered for North Sea service conditions and tested before it leaves Aberdeen. Specifications, material certificates and inspection records are issued with each delivery.',
		),
		'infocard_description' => array(
			'Connectors, modules and clamps built to order for North Sea service, with certification and inspection records supplied on delivery.',
		),
	),
	'Projects' => array(
		'editor' => array(
			'A subsea tie-back in the Central North Sea, connecting two satellite wells to an existing host platform. Granite Bay Energy supplied the flowline connectors and managed the offshore hook-up campaign.',
			'Topside module replacement on a producing platform west of Shetland, completed inside a fourteen-day shutdown window with no lost-time incidents.',
			'Pipeline inspection and integrity work across a sixty-kilometre export line, including repair clamp design and installation at three identified defect locations.',
			'Decommissioning support for a late-life asset, covering plug and abandonment engineering, topside deconstruction planning and materials recovery.',
		),
	),
	'Contact' => array(
		'infocard_description' => array(
			'Our engineering desk answers technical enquiries within one working day, and tender requests are acknowledged the same day they arrive.',
		),
	),
);

$textFields = array('editor', 'infocard_description');

$isPlaceholder = static function (string $value): bool {
	return 1 === preg_match('/Lorem ipsum|Click edit button/i', $value);
};

$replaced = 0;
$unmatched = array();

foreach (get_posts(array('post_type' => 'page', 'numberposts' => -1, 'post_status' => 'publish')) as $page) {
	$raw = get_post_meta($page->ID, '_elementor_data', true);

	if (! is_string($raw) || '' === $raw) {
		continue;
	}

	$data = json_decode($raw, true);

	if (! is_array($data)) {
		continue;
	}

	$pageCopy = $copy[$page->post_title] ?? array();
	$counters = array();
	$pageReplaced = 0;

	$walk = static function (array &$nodes) use (&$walk, &$counters, &$pageReplaced, &$unmatched, $pageCopy, $textFields, $isPlaceholder, $page): void {
		foreach ($nodes as &$node) {
			foreach ($textFields as $field) {
				$value = $node['settings'][$field] ?? null;

				if (! is_string($value) || ! $isPlaceholder($value)) {
					continue;
				}

				$index = $counters[$field] ?? 0;
				$counters[$field] = $index + 1;

				if (! isset($pageCopy[$field][$index])) {
					$unmatched[] = sprintf('%s has no %s copy at index %d', $page->post_title, $field, $index);
					continue;
				}

				$node['settings'][$field] = 'editor' === $field
					? '<p>' . $pageCopy[$field][$index] . '</p>'
					: $pageCopy[$field][$index];
				++$pageReplaced;
			}

			if (! empty($node['elements']) && is_array($node['elements'])) {
				$walk($node['elements']);
			}
		}
	};

	$walk($data);

	if ($pageReplaced > 0) {
		update_post_meta($page->ID, '_elementor_data', wp_slash(wp_json_encode($data)));
		$replaced += $pageReplaced;
		printf("%s: replaced %d\n", $page->post_title, $pageReplaced);
	}
}

printf("replaced %d placeholder passages\n", $replaced);

foreach ($unmatched as $warning) {
	printf("WARNING %s\n", $warning);
}

Elementor\Plugin::$instance->files_manager->clear_cache();
