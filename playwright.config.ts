import { defineConfig, devices } from '@playwright/test'

const port = 22000
const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? `http://localhost:${port}`
const isRemote = baseURL !== `http://localhost:${port}`

export default defineConfig({
	testDir: './tests',
	testMatch: '**/*.e2e.ts',
	outputDir: 'test-results/playwright/',
	fullyParallel: true,
	forbidOnly: Boolean(process.env['CI']),
	retries: 0,
	use: {
		baseURL,
		trace: 'on-first-retry',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	...(isRemote
		? {}
		: {
				webServer: {
					command: 'docker compose up --build --wait',
					url: `${baseURL}/healthz.php`,
					reuseExistingServer: true,
					timeout: 300_000,
				},
			}),
})
