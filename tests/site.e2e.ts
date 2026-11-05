import { essentialWebPieces } from './essentialWebPieces'
import { expect, pwGetByTestId, pwGotoHome, pwGotoPath, test } from './helpers/seoTags'

const { navigation } = essentialWebPieces

test.describe('Granite Bay Energy', () => {
	test('the footer credits Dan Edwards and links to his site', async ({ page }) => {
		await pwGotoHome(page)
		const credit = pwGetByTestId(page, 'site-credit')
		await expect(credit).toBeVisible()
		await expect(credit.locator('a')).toHaveAttribute('href', 'https://danedwardsdeveloper.com')
	})

	for (const path of navigation) {
		test(`${path} responds 200`, async ({ request }) => {
			const response = await request.get(path)
			expect(response.status(), `${path} should be served`).toBe(200)
		})
	}

	test('every link in the primary navigation resolves', async ({ page, request }) => {
		await pwGotoHome(page)
		const hrefs = await page
			.locator('nav a[href]')
			.evaluateAll((anchors) =>
				anchors.map((anchor) => anchor.getAttribute('href') ?? '').filter((href) => href.startsWith('http') || href.startsWith('/')),
			)
		expect(hrefs.length, 'the home page should carry a navigation').toBeGreaterThan(0)
		for (const href of new Set(hrefs)) {
			const path = href.startsWith('http') ? new URL(href).pathname : href
			expect((await request.get(path)).status(), `navigation link ${href} is broken`).toBeLessThan(400)
		}
	})

	test('security headers are set', async ({ request }) => {
		const headers = (await request.get('/')).headers()
		expect(headers['x-content-type-options'], 'X-Content-Type-Options').toBe('nosniff')
		expect(headers['referrer-policy'], 'Referrer-Policy').toBe('strict-origin-when-cross-origin')
		expect(headers['x-frame-options'], 'X-Frame-Options').toBe('SAMEORIGIN')
		expect(headers['permissions-policy'], 'Permissions-Policy').toContain('geolocation=()')
	})

	test('the admin is reachable but exposes nothing without a login', async ({ request }) => {
		const admin = await request.get('/wp-admin/', { maxRedirects: 0 })
		expect(admin.status(), '/wp-admin must redirect to the login form').toBeGreaterThanOrEqual(300)
		expect(admin.headers()['location'] ?? '', '/wp-admin redirect target').toContain('wp-login.php')

		const login = await request.get('/wp-login.php')
		expect(login.status(), 'the login form itself should render').toBe(200)
	})

	test('xmlrpc and user enumeration are closed', async ({ request }) => {
		expect((await request.get('/xmlrpc.php')).status(), 'xmlrpc.php should not serve').toBeGreaterThanOrEqual(400)
		expect((await request.get('/wp-json/wp/v2/users')).status(), 'the users route should be gone').toBeGreaterThanOrEqual(400)
	})

	test('the generator tag is not advertised', async ({ page }) => {
		await pwGotoHome(page)
		await expect(page.locator('meta[name="generator"]')).toHaveCount(0)
	})

	for (const path of navigation) {
		test(`${path} carries no starter template placeholder copy`, async ({ request }) => {
			const body = await (await request.get(path)).text()
			for (const leftover of [/lorem ipsum/i, /click edit button/i, /\bsierra\b/i, /consectetur/i]) {
				expect(body, `${path} still contains ${leftover}`).not.toMatch(leftover)
			}
		})
	}

	test('every page has its own title, description and canonical', async ({ request }) => {
		const seen = { title: new Set<string>(), description: new Set<string>(), canonical: new Set<string>() }

		for (const path of navigation) {
			const body = await (await request.get(path)).text()
			const title = /<title>([^<]+)<\/title>/.exec(body)?.[1] ?? ''
			const description = /<meta name="description" content="([^"]+)"/.exec(body)?.[1] ?? ''
			const canonical = /<link rel="canonical" href="([^"]+)"/.exec(body)?.[1] ?? ''

			expect(title.length, `${path} title length`).toBeGreaterThanOrEqual(40)
			expect(title.length, `${path} title length`).toBeLessThanOrEqual(65)
			expect(description.length, `${path} description length`).toBeGreaterThanOrEqual(70)
			expect(description.length, `${path} description length`).toBeLessThanOrEqual(155)
			expect(canonical, `${path} canonical`).toMatch(/^https?:\/\//)

			seen.title.add(title)
			seen.description.add(description)
			seen.canonical.add(canonical)
		}

		expect(seen.title.size, 'every page needs its own title').toBe(navigation.length)
		expect(seen.description.size, 'every page needs its own description').toBe(navigation.length)
		expect(seen.canonical.size, 'every page needs its own canonical').toBe(navigation.length)
	})

	test('no page logs a console error', async ({ page }) => {
		const errors: Array<string> = []
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(`${page.url()}: ${message.text()}`)
		})
		page.on('pageerror', (error) => errors.push(`${page.url()}: ${error.message}`))

		for (const path of navigation) {
			await pwGotoPath(page, path)
		}

		expect(errors, 'pages should load without console errors').toEqual([])
	})
})

/*
pnpm e2e site
*/
