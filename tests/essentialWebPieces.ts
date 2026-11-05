type StaticAsset = { path: string; contentType: string }
type TextRoute = { path: string; contentType: string; mustContain: ReadonlyArray<string | RegExp> }

export type EssentialWebPieces = {
	siteName: string
	home: { titlePattern: RegExp; headingPattern: RegExp; ogImagePattern: RegExp }
	staticAssets: ReadonlyArray<StaticAsset>
	textRoutes: ReadonlyArray<TextRoute>
	navigation: ReadonlyArray<string>
}

const themeAssets = '/wp-content/themes/granite-bay/assets'

export const essentialWebPieces: EssentialWebPieces = {
	siteName: 'Granite Bay Energy',
	home: {
		titlePattern: /Granite Bay Energy/i,
		headingPattern: /.+/,
		ogImagePattern: /og\.png/,
	},
	staticAssets: [
		{ path: `${themeAssets}/favicon.svg`, contentType: 'image/svg' },
		{ path: `${themeAssets}/favicon.ico`, contentType: 'icon' },
		{ path: `${themeAssets}/apple-touch-icon.png`, contentType: 'image/png' },
		{ path: `${themeAssets}/og.png`, contentType: 'image/png' },
		{ path: '/healthz.php', contentType: 'text/plain' },
	],
	textRoutes: [
		{ path: '/robots.txt', contentType: 'text/plain', mustContain: [/user-agent:/i, /sitemap:/i] },
		{ path: '/humans.txt', contentType: 'text/plain', mustContain: [/Dan Edwards/, /Aberdeen/] },
		{ path: '/wp-sitemap.xml', contentType: 'xml', mustContain: ['<sitemap', '<loc>'] },
	],
	navigation: ['/', '/about/', '/products/', '/projects/', '/contact/'],
}
