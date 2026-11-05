# Granite Bay Energy

A WordPress marketing site for a fictional Aberdeen oil and gas company, running on Fly.io against
SQLite. Built by [Dan Edwards](https://danedwardsdeveloper.com).

**Live:** https://granite-bay-energy.fly.dev

## The idea

Production holds no state that git does not. The whole site — WordPress core, the theme, the plugins,
the media and the database — is rebuilt from this repository by one `fly deploy`. There is nothing to
back up and nothing to restore, because `db/seed.sqlite` is the site's content and it is committed.

```
fly volumes destroy granite_bay_data && fly deploy
```

brings the site back exactly as it is now.

## How it fits together

| Piece | Where |
| --- | --- |
| WordPress core | the `wordpress:7.1.4-php8.4-apache` base image |
| Astra, Elementor, UAE, SureForms, SQLite integration | `composer.json`, pinned, installed at build time |
| Site design and content | `db/seed.sqlite` plus `wp-content/uploads`, both committed |
| Custom behaviour | `wp-content/mu-plugins`, as code rather than database state |
| Theme overrides and icons | `wp-content/themes/granite-bay` |
| Configuration | `config/wp-config.php`, hand-written |

The database is the only mutable thing. It lives on a Fly volume mounted at
`wp-content/database`, seeded on first boot by `bin/entrypoint.sh` and never written to by a deploy.

### Why SQLite

One machine instead of two, and about £3 a month instead of £6. The
[SQLite integration plugin](https://wordpress.org/plugins/sqlite-database-integration/) is still
officially a beta, which is a real caveat for a site that takes orders. For a brochure site whose
content is a committed artifact it is a reasonable trade.

`DB_PATH` is pinned in `config/wp-config.php`. Left to itself the plugin picks a randomised directory
under `wp-content/database`, which nothing could then seed or mount.

### Why the webroot is immutable

`DISALLOW_FILE_MODS` is on in production, so WordPress cannot install or update anything at runtime.
Upgrading a plugin means changing `composer.json` and deploying.

This has one consequence worth knowing about: **Elementor must use internal CSS**. Left on its default
it writes generated stylesheets into `wp-content/uploads/elementor/css`, which the production image
cannot do, and the site would serve unstyled pages. `bin/provision.sh` sets
`elementor_css_print_method` to `internal` — and does so *after* the template import, because the
import resets it.

## Working on it

Requires Docker, pnpm and Composer.

```bash
composer install
pnpm install
pnpm dev             # http://localhost:22000
```

`pnpm dev` runs the `development` build target, which adds WP-CLI and the Starter Templates importer.
Neither is in the production image.

```bash
docker compose exec -u www-data site wp --path=/var/www/html <command>
```

### Rebuilding the site from nothing

```bash
WP_ADMIN_PASSWORD=... pnpm provision -- --reset
```

`bin/provision.sh` installs WordPress, imports Astra's **Sierra Industry** starter template
(site `19824`), applies the settings, and writes `db/seed.sqlite`. It is the reproducible record of
how the site was made — the seed is its output, not a hand-made artifact.

Two things it has to get right, both learned the hard way:

- **The template's required plugins must already be installed.** If the importer has to fetch
  Elementor or SureForms itself, it installs the first one, activates it, and the run dies there with
  a zero exit code and nothing imported. Composer ships them so it never has to.
- **Theme mods are per-theme.** Menu locations, the logo and the header/footer builder layout are
  written against `astra` by the importer, so switching to the child theme afterwards orphans them
  unless they are copied across.

### Checks

```bash
pnpm quality    # biome, tsc, phpcs (WordPress standard), cspell
pnpm e2e        # Playwright against local Docker
```

To run the same suite against production:

```bash
PLAYWRIGHT_BASE_URL=https://granite-bay-energy.fly.dev pnpm e2e
```

## Deploying

```bash
pnpm deploy
```

Secrets are set once, and are not in this repository:

```bash
fly secrets set WP_AUTH_KEY=... WP_SECURE_AUTH_KEY=... # and the other six
```

`config/wp-config.php` throws rather than falling back to a default if a salt is missing in
production.

## Notes

- The site is `noindex, nofollow`, and `robots.txt` agrees. Granite Bay Energy is not a real company
  and should not turn up in search results against ones that are.
- Apache runs its master process as root and its workers as `www-data`, which is what the official
  image does. A fully non-root container would need Apache above port 1024 and a writable volume it
  does not own, for no gain here.
- The teardown date is **2026-12-03**. `pnpm teardown` destroys the app and its volume.

## Licence

[MIT](LICENSE). The Sierra Industry template is Astra's, and the photography came with it.
