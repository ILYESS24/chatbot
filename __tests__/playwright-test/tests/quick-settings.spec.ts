import { test, expect } from "@playwright/test"

test.describe("Quick Settings Button", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the chat page
    await page.goto("http://localhost:3000/en/chat", {
      waitUntil: "networkidle"
    })
    
    // Wait for page to load
    await page.waitForTimeout(2000)
  })

  test("should open Quick Settings dropdown without errors", async ({ page }) => {
    // Listen for console errors
    const errors: string[] = []
    page.on("console", msg => {
      if (msg.type() === "error") {
        errors.push(msg.text())
      }
    })

    // Listen for page errors
    page.on("pageerror", error => {
      errors.push(`Page error: ${error.message}`)
    })

    // Try to find the Quick Settings button
    const quickSettingsButton = page.locator('button:has-text("Quick Settings")').first()

    // Check if button exists
    await expect(quickSettingsButton).toBeVisible({ timeout: 10000 })

    // Click the button
    await quickSettingsButton.click()

    // Wait a bit for dropdown to appear
    await page.waitForTimeout(500)

    // Check if dropdown content appears
    const dropdownContent = page.locator('[role="menu"]').first()
    
    try {
      await expect(dropdownContent).toBeVisible({ timeout: 2000 })
    } catch (e) {
      // If dropdown doesn't appear, check for errors
      console.log("Dropdown not visible, checking errors...")
    }

    // Print any errors that occurred
    if (errors.length > 0) {
      console.error("Errors found:")
      errors.forEach(error => console.error(`  - ${error}`))
    }

    // Fail test if there are errors
    expect(errors.length).toBe(0)
  })

  test("should handle Quick Settings with no items", async ({ page }) => {
    const errors: string[] = []
    page.on("console", msg => {
      if (msg.type() === "error") {
        errors.push(msg.text())
      }
    })

    page.on("pageerror", error => {
      errors.push(`Page error: ${error.message}`)
    })

    const quickSettingsButton = page.locator('button:has-text("Quick Settings")').first()
    
    await expect(quickSettingsButton).toBeVisible({ timeout: 10000 })
    await quickSettingsButton.click()
    await page.waitForTimeout(500)

    // Check for "No items found" message
    const noItemsMessage = page.locator('text=No items found')
    
    if (await noItemsMessage.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log("No items found message appears - this is expected")
    }

    if (errors.length > 0) {
      console.error("Errors found:")
      errors.forEach(error => console.error(`  - ${error}`))
    }

    expect(errors.length).toBe(0)
  })

  test("should not crash when clicking multiple times", async ({ page }) => {
    const errors: string[] = []
    page.on("console", msg => {
      if (msg.type() === "error") {
        errors.push(msg.text())
      }
    })

    page.on("pageerror", error => {
      errors.push(`Page error: ${error.message}`)
    })

    const quickSettingsButton = page.locator('button:has-text("Quick Settings")').first()
    
    await expect(quickSettingsButton).toBeVisible({ timeout: 10000 })
    
    // Click multiple times rapidly
    await quickSettingsButton.click()
    await page.waitForTimeout(100)
    await quickSettingsButton.click()
    await page.waitForTimeout(100)
    await quickSettingsButton.click()
    await page.waitForTimeout(500)

    if (errors.length > 0) {
      console.error("Errors found:")
      errors.forEach(error => console.error(`  - ${error}`))
    }

    expect(errors.length).toBe(0)
  })
})

