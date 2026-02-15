import { test, expect } from '@playwright/test'

test.describe('Settings & Targets', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('admin@thundergate.local')
    await page.getByLabel(/password/i).fill('admin123')
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('should load settings page', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Settings')).toBeVisible()
    await expect(page.getByText('Escalation Timeouts')).toBeVisible()
    await expect(page.getByText('Rate Limiting')).toBeVisible()
    await expect(page.getByText('System Health')).toBeVisible()
  })

  test('should show health check results', async ({ page }) => {
    await page.goto('/settings')
    // Wait for health check to complete
    await expect(page.getByText('Database')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('API Service')).toBeVisible()
    await expect(page.getByText('Queue Depth')).toBeVisible()
  })

  test('should load API targets page', async ({ page }) => {
    await page.goto('/targets')
    await expect(page.getByText('API Targets')).toBeVisible()
    await expect(
      page.getByText('Manage downstream APIs'),
    ).toBeVisible()
  })

  test('should open add target form', async ({ page }) => {
    await page.goto('/targets')
    await page.getByRole('button', { name: /add target/i }).click()
    await expect(page.getByText('New API Target')).toBeVisible()
  })
})
