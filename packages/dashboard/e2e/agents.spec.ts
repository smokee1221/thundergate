import { test, expect } from '@playwright/test'

test.describe('Agent Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('admin@thundergate.local')
    await page.getByLabel(/password/i).fill('admin123')
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('should load agents page', async ({ page }) => {
    await page.goto('/agents')
    await expect(page.getByText('Agents')).toBeVisible()
    await expect(
      page.getByText('Manage registered AI agents'),
    ).toBeVisible()
  })

  test('should navigate to register new agent page', async ({ page }) => {
    await page.goto('/agents')
    await page.getByRole('button', { name: /register agent/i }).click()
    await expect(page).toHaveURL(/\/agents\/new/)
    await expect(page.getByText('Register New Agent')).toBeVisible()
  })

  test('should register a new agent and show API key', async ({ page }) => {
    await page.goto('/agents/new')
    await page.getByLabel(/agent name/i).fill('Test E2E Agent')
    await page.getByLabel(/description/i).fill('Created by E2E test')
    await page.getByRole('button', { name: /register agent/i }).click()

    // Should show the API key
    await expect(page.getByText('Agent Registered')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('API Key Generated')).toBeVisible()
    await expect(page.getByText(/af_/)).toBeVisible()
  })

  test('should show agents in the list', async ({ page }) => {
    await page.goto('/agents')
    // Wait for the page to load (either shows agents or empty state)
    await page.waitForTimeout(2000)
    // Page should have loaded without errors
    const hasAgents = await page.getByText('Active').isVisible().catch(() => false)
    const hasEmpty = await page.getByText('No agents registered').isVisible().catch(() => false)
    expect(hasAgents || hasEmpty).toBeTruthy()
  })
})
