<?php
/**
 * Liveness probe. Deliberately does not boot WordPress, so a database fault cannot fail the check
 * that Fly uses to decide whether to replace the machine.
 *
 * @package GraniteBayEnergy
 */

header( 'Content-Type: text/plain; charset=utf-8' );
header( 'Cache-Control: no-store' );
echo "ok\n";
