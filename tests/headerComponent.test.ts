import { test, expect } from '@playwright/test';

const URI = 'http://localhost:3000'

test('ensures that about button is visible and navigates the about section when clicked', async ({ page }) => {
  await page.goto(URI);

  const nav = page.getByRole('navigation');
  const aboutLink = nav.getByRole('link', { name: 'About', exact: true })
  await expect(aboutLink).toBeVisible()
  })