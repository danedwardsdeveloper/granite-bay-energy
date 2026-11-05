# No comments in this file
FROM composer:2.10 AS vendor
WORKDIR /build
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --no-scripts

FROM composer:2.10 AS vendor-dev
WORKDIR /build
COPY composer.json composer.lock ./
RUN composer install --no-interaction --no-progress --no-scripts

FROM wordpress:7.1.4-php8.4-apache AS base
COPY --from=wordpress:cli-php8.4 /usr/local/bin/wp /usr/local/bin/wp
RUN set -eux; \
	cp -a /usr/src/wordpress/. /var/www/html/; \
	rm -rf /var/www/html/wp-content; \
	a2enmod headers
COPY config/php.ini /usr/local/etc/php/conf.d/zz-site.ini
COPY config/wp-config.php /var/www/html/wp-config.php
COPY config/environment.php /var/www/html/environment.php
COPY public/healthz.php /var/www/html/healthz.php
COPY bin/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY wp-content /var/www/html/wp-content
COPY --from=vendor /build/wp-content/plugins /var/www/html/wp-content/plugins
COPY --from=vendor /build/wp-content/themes /var/www/html/wp-content/themes
COPY db/ /seed/
RUN set -eux; \
	sed \
		-e 's#{SQLITE_IMPLEMENTATION_FOLDER_PATH}#/var/www/html/wp-content/plugins/sqlite-database-integration#g' \
		-e 's#{SQLITE_PLUGIN}#sqlite-database-integration/load.php#g' \
		/var/www/html/wp-content/plugins/sqlite-database-integration/db.copy \
		> /var/www/html/wp-content/db.php; \
	mkdir -p /var/www/html/wp-content/database /var/www/html/wp-content/uploads; \
	chown -R www-data:www-data /var/www/html; \
	chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["apache2-foreground"]

FROM base AS development
ENV WP_ENV=development
COPY --from=vendor-dev /build/wp-content/plugins/astra-sites /var/www/html/wp-content/plugins/astra-sites
RUN chown -R www-data:www-data /var/www/html/wp-content/plugins/astra-sites

FROM base AS production
ENV WP_ENV=production
