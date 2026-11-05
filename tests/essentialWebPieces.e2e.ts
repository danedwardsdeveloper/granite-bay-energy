import { essentialWebPieces } from './essentialWebPieces'
import {
	expect,
	pwGetHtmlElement,
	pwGetLinkTag,
	pwGetMetaTag,
	pwGetPageHeading,
	pwGotoHome,
	pwGotoUnroutedPath,
	test,
} from './helpers/seoTags'

const { siteName, home, staticAssets, textRoutes } = essentialWebPieces

test.describe('Essential web pieces', () => {
	for (const asset of staticAssets) {
		test(`static asset ${asset.path} -> 200, ${asset.contentType}`, async ({ request }) => {
			const response = await request.get(asset.path)
			expect(response.status(), `${asset.path} should be served`).toBe(200)
			expect(response.headers()['content-type'] ?? '', `${asset.path} content-type`).toContain(asset.contentType)
		})
	}

	for (const route of textRoutes) {
		test(`route ${route.path} -> 200, ${route.contentType}, expected content`, async ({ request }) => {
			const response = await request.get(route.path)
			expect(response.status(), `${route.path} should be served`).toBe(200)
			expect(response.headers()['content-type'] ?? '', `${route.path} content-type`).toContain(route.contentType)
			const body = await response.text()
			for (const needle of route.mustContain) {
				if (needle instanceof RegExp) expect(body, `${route.path} body`).toMatch(needle)
				else expect(body, `${route.path} body`).toContain(needle)
			}
		})
	}

	test('home page renders with an <h1>', async ({ page }) => {
		await pwGotoHome(page)
		await expect(page).toHaveTitle(home.titlePattern)
		await expect(pwGetPageHeading(page)).toContainText(home.headingPattern)
	})

	test('home page ships the full metadata surface', async ({ page }) => {
		await pwGotoHome(page)
		const canonical = pwGetLinkTag({ page, rel: 'canonical' })
		await expect(canonical).toHaveCount(1)
		await expect(canonical).toHaveAttribute('href', /^https?:\/\//)
		await expect(pwGetMetaTag({ page, key: 'name', value: 'description' })).toHaveAttribute('content', /.{50,}/)
		await expect(pwGetMetaTag({ page, key: 'property', value: 'og:title' })).toHaveAttribute('content', home.titlePattern)
		await expect(pwGetMetaTag({ page, key: 'property', value: 'og:description' })).toHaveAttribute('content', /.{50,}/)
		await expect(pwGetMetaTag({ page, key: 'property', value: 'og:site_name' })).toHaveAttribute('content', siteName)
		await expect(pwGetMetaTag({ page, key: 'property', value: 'og:type' })).toHaveAttribute('content', 'website')
		await expect(pwGetMetaTag({ page, key: 'property', value: 'og:image' })).toHaveAttribute('content', home.ogImagePattern)
		await expect(pwGetMetaTag({ page, key: 'property', value: 'og:image:alt' })).toHaveAttribute('content', /.+/)
		await expect(pwGetMetaTag({ page, key: 'property', value: 'og:url' })).toHaveAttribute('content', /^https?:\/\//)
		await expect(pwGetMetaTag({ page, key: 'name', value: 'twitter:card' })).toHaveAttribute('content', 'summary_large_image')
		await expect(pwGetMetaTag({ page, key: 'name', value: 'twitter:image' })).toHaveAttribute('content', home.ogImagePattern)
		await expect(pwGetMetaTag({ page, key: 'charset' })).toHaveCount(1)
		await expect(pwGetMetaTag({ page, key: 'name', value: 'viewport' })).toHaveCount(1)
		await expect(pwGetHtmlElement(page)).toHaveAttribute('lang', /.+/)
	})

	test('the site is open to search indexes', async ({ page, request }) => {
		await pwGotoHome(page)
		const robotsContents = await pwGetMetaTag({ page, key: 'name', value: 'robots' }).evaluateAll((tags) =>
			tags.map((tag) => tag.getAttribute('content')),
		)
		expect(robotsContents.join(' '), 'nothing may ask a crawler to skip the page').not.toContain('noindex')
		expect(robotsContents.join(' '), 'nothing may ask a crawler to drop the links').not.toContain('nofollow')

		const robotsTxt = await (await request.get('/robots.txt')).text()
		expect(robotsTxt, 'robots.txt must not disallow the whole site').not.toMatch(/disallow:\s*\/\s*$/im)
		expect(robotsTxt, 'robots.txt should still point at the sitemap').toMatch(/sitemap:/i)
	})

	test('the social card images the head advertises are actually served', async ({ page, request }) => {
		await pwGotoHome(page)
		for (const tag of [
			{ key: 'property', value: 'og:image' },
			{ key: 'name', value: 'twitter:image' },
		] as const) {
			const content = await pwGetMetaTag({ page, key: tag.key, value: tag.value }).getAttribute('content')
			const path = content?.startsWith('http') ? new URL(content).pathname : (content ?? '')
			expect((await request.get(path)).status(), `${tag.value} points at ${content}, which is not served`).toBe(200)
		}
	})

	test('favicon links point at the theme assets', async ({ page }) => {
		await pwGotoHome(page)
		await expect(pwGetLinkTag({ page, rel: 'icon', hrefContains: '.svg' })).toHaveCount(1)
		await expect(pwGetLinkTag({ page, rel: 'apple-touch-icon' })).toHaveCount(1)
	})

	test('wp-sitemap.xml is well-formed with absolute, single-origin <loc>s', async ({ request }) => {
		const response = await request.get('/wp-sitemap.xml')
		const body = await response.text()
		const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
		expect(locs.length, 'sitemap should list at least one child sitemap').toBeGreaterThan(0)
		const origins = new Set(locs.map((url) => new URL(url ?? '').origin))
		expect(origins.size, `sitemap <loc>s span multiple origins: ${[...origins].join(', ')}`).toBe(1)
	})

	test('unknown routes return 404', async ({ page }) => {
		const response = await pwGotoUnroutedPath(page, '/this-route-should-not-exist-9f9f9f')
		expect(response?.status(), 'a missing route must 404, not 200').toBe(404)
	})
})

/*
pnpm e2e essentialWebPieces
*/
