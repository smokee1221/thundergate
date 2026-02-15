import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('admin@thundergate.local')
    await page.getByLabel(/password/i).fill('admin123')
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('should display dashboard overview with metrics', async ({ page }) => {
    await expect(page.getByText('Dashboard')).toBeVisible()
    await expect(page.getByText('Total Requests')).toBeVisible()
    await expect(page.getByText('Allowed')).toBeVisible()
    await expect(page.getByText('Blocked')).toBeVisible()
    await expect(page.getByText('Flagged for Review')).toBeVisible()
  })

  test('should display recent activity section', async ({ page }) => {
    await expect(page.getByText('Recent Activity')).toBeVisible()
  })

  test('should display top triggered rules section', async ({ page }) => {
    await expect(page.getByText('Top Triggered Rules')).toBeVisible()
  })

  test('should navigate to HITL Queue via sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /hitl queue/i }).click()
    await expect(page).toHaveURL(/\/queue/)
  })

  test('should navigate to Rules via sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /rules/i }).click()
    await expect(page).toHaveURL(/\/rules/)
  })

  test('should navigate to Audit Logs via sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /audit logs/i }).click()
    await expect(page).toHaveURL(/\/audit/)
  })

  test('should navigate to Agents via sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /agents/i }).click()
    await expect(page).toHaveURL(/\/agents/)
  })

  test('should navigate to API Targets via sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /api targets/i }).click()
    await expect(page).toHaveURL(/\/targets/)
  })

  test('should navigate to Settings via sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click()
    await expect(page).toHaveURL(/\/settings/)
  })

  test('should show user info in topbar', async ({ page }) => {
    await expect(page.getByText('ADMIN')).toBeVisible()
    await expect(page.getByText('Sign out')).toBeVisible()
  })

  test('should sign out successfully', async ({ page }) => {
    await page.getByText('Sign out').click()
    await page.waitForURL(/\/login/, { timeout: 10000 })
  })
})
