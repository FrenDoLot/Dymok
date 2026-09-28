import { expect, test } from '@playwright/test'

test('chat streams and persists an assistant response', async ({ page }) => {
  const prompt = `Проверка из браузера ${Date.now()}`

  await page.goto('/')

  await expect(page.getByText('Backend: connected')).toBeVisible()
  const initialParagraphCount = await page.getByRole('paragraph').count()
  await page.getByPlaceholder('Напиши Дымку...').fill(prompt)
  await page.getByTitle('Send').click()

  await expect(page.getByRole('paragraph').filter({ hasText: new RegExp(`^${prompt}$`) })).toBeVisible()
  await expect.poll(() => page.getByRole('paragraph').count(), { timeout: 180_000 }).toBeGreaterThanOrEqual(initialParagraphCount + 2)

  await page.reload()

  await expect(page.getByRole('paragraph').filter({ hasText: new RegExp(`^${prompt}$`) })).toBeVisible()
  await expect(page.getByRole('paragraph')).toHaveCount(initialParagraphCount + 2)
})

test('mobile menu opens the sidebar drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await page.getByRole('button').first().click()
  const drawer = page.getByRole('complementary')

  await expect(drawer.getByRole('button', { name: /Новый чат/ })).toBeVisible()
  await expect(drawer.getByText('Tasks')).toBeVisible()
  await expect(drawer.getByText('Settings')).toBeVisible()
})

test('tasks and settings views are reachable', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('complementary').getByText('Tasks').click()
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()
  const taskTitle = `E2E task ${Date.now()}`
  await page.getByPlaceholder('Новая задача').fill(taskTitle)
  await page.getByTitle('Создать задачу').click()
  await expect(page.getByText(taskTitle)).toBeVisible()

  await page.getByRole('complementary').getByText('Settings').click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByText('Permissions')).toBeVisible()
  await expect(page.getByText('Agent Runs')).toBeVisible()
  await expect(page.getByText('Activity')).toBeVisible()

  await page.getByRole('complementary').getByText('Files').click()
  await expect(page.getByRole('heading', { name: 'Files' })).toBeVisible()
})

test('ask-before-actions shows approval card for external actions', async ({ page }) => {
  await page.goto('/')

  await page.locator('select').first().selectOption('ask_before_actions')
  await page.getByPlaceholder('Напиши Дымку...').fill(`Создай файл проверки ${Date.now()}`)
  await page.getByTitle('Send').click()

  const cards = page.getByText(/Дымок хочет выполнить: write_files/)
  await expect(cards.last()).toBeVisible({ timeout: 15_000 })
  const countBefore = await cards.count()
  await page.getByRole('button', { name: /Отклонить/ }).last().click()
  await expect(cards).toHaveCount(countBefore - 1)
})
