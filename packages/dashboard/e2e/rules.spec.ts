import { test, expect } from '@playwright/test'

test.describe('Rule Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('admin@thundergate.local')
    await page.getByLabel(/password/i).fill('admin123')
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('should load rules page', async ({ page }) => {
    await page.goto('/rules')
    await expect(page.getByText('Rules')).toBeVisible()
  })

  test('should navigate to create new rule page', async ({ page }) => {
    await page.goto('/rules')
    await page.getByRole('link', { name: /new rule/i }).click()
    await expect(page).toHaveURL(/\/rules\/new/)
    await expect(page.getByText('Create Rule')).toBeVisible()
  })

  test('should navigate to rule dry-run page', async ({ page }) => {
    await page.goto('/rules')
    await page.getByRole('link', { name: /dry run/i }).click()
    await expect(page).toHaveURL(/\/rules\/test/)
    await expect(page.getByText('Rule Dry Run')).toBeVisible()
  })

  test('should load audit logs page', async ({ page }) => {
    await page.goto('/audit')
    await expect(page.getByText('Audit Logs')).toBeVisible()
  })

  test('should load HITL queue page', async ({ page }) => {
    await page.goto('/queue')
    await expect(page.getByText('HITL Queue')).toBeVisible()
  })
})
