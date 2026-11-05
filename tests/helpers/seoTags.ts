import { expect, type Locator, type Page, test } from '@playwright/test'

export type { Locator, Page }
export { expect, test }

export function pwGetMetaTag({ page, key, value }: { page: Page; key: 'name' | 'property' | 'charset'; value?: string }): Locator {
	return page.locator(value === undefined ? `meta[${key}]` : `meta[${key}="${value}"]`)
}

export function pwGetLinkTag({ page, rel, hrefContains }: { page: Page; rel: string; hrefContains?: string }): Locator {
	const href = hrefContains === undefined ? '' : `[href*="${hrefContains}"]`
	return page.locator(`link[rel="${rel}"]${href}`)
}

export function pwGetHtmlElement(page: Page): Locator {
	return page.locator('html')
}

export function pwGetPageHeading(page: Page): Locator {
	return page.locator('h1').first()
}

export function pwGetByTestId(page: Page, testId: string): Locator {
	return page.locator(`[data-test-id="${testId}"]`)
}

export function pwGotoHome(page: Page) {
	return page.goto('/', { waitUntil: 'domcontentloaded' })
}

export function pwGotoPath(page: Page, path: string) {
	return page.goto(path, { waitUntil: 'domcontentloaded' })
}

/* Fold this into pwGotoPath and it can no longer express its one case - a path that must NOT route. */
export function pwGotoUnroutedPath(page: Page, path: string) {
	return page.goto(path, { waitUntil: 'domcontentloaded' })
}
