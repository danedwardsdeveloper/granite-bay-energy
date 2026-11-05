# CLAUDE.md

## Workflow rules (read first)

- **This repo is deliberately not a fleet project.** It is not in `fleet-hq`'s `fleetProjects.ts` and
  must not be added. Nothing enumerates the parent directory, so it is invisible to `fleet-diff`,
  `fleet-sync` and the rest. Never create `src/fleet`, `src/fleetPerProject`, `scripts/scriptsFleet`,
  `scripts/scriptsFleetPerProject`, `fleet-docs` or `.claude/hooks` here.
- **Fleet code here is a one-way snapshot.** `biome.json`, the tsconfigs and `tests/helpers/seoTags.ts`
  were copied from the fleet. Nothing syncs them back and `fleet-diff` will never see them drift.
- **It is a public repo.** No secrets in the tree, ever — not even gitignored ones, which is the
  fleet's pattern and is wrong here. Salts live in `fly secrets`.
- **Ports: the 22000 block.** The fleet owns 21000–21899 and 23000–25999. Do not take a fleet number.
- **Working files go in `/scratch`**, never the session scratchpad.
- **Solo project, no branching.** Commit straight to `main`.

## The seed is the site

`db/seed.sqlite` is the committed database. `bin/entrypoint.sh` copies it onto the volume on first
boot and never afterwards. Editing content in wp-admin changes the volume, not the repo — to make a
change permanent, re-run provisioning and commit the new seed, or export the volume's copy over it.

`bin/provision.sh --reset` deletes `db/seed.sqlite` before rebuilding. It has to: the entrypoint would
otherwise restore the very site the reset is trying to discard.

## Things that will bite

- **Set Elementor's options after the import, never before.** The Starter Templates import resets
  `elementor_css_print_method`. External CSS cannot work in production, where the webroot is read-only.
- **Pre-install the template's required plugins.** The importer dies silently, exit code 0, if it has
  to install and activate one itself.
- **Copy theme mods when switching to the child theme.** They are stored per theme, so the menu
  locations and builder layout the import wrote against `astra` do not follow on their own.
- **`WP_DEBUG_DISPLAY` is off even in development.** SureForms bundles an ActionScheduler that is not
  PHP 8.4 clean and its notices land in the markup.

## Commands

- `pnpm dev` — docker compose up, http://localhost:22000
- `pnpm provision -- --reset` — rebuild the site from nothing, needs `WP_ADMIN_PASSWORD`
- `pnpm quality` — biome, tsc, phpcs, cspell
- `pnpm e2e` — Playwright; `PLAYWRIGHT_BASE_URL` points it at production
- `pnpm deploy` / `pnpm teardown`
