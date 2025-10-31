// Simple Node.js script to simulate clicking Quick Settings
const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting Quick Settings test simulation...\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Listen for all console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.error(`❌ CONSOLE ERROR: ${text}`);
    } else if (type === 'warning') {
      console.warn(`⚠️ CONSOLE WARNING: ${text}`);
    } else {
      console.log(`📝 CONSOLE [${type}]: ${text}`);
    }
  });
  
  // Listen for page errors
  page.on('pageerror', error => {
    console.error(`💥 PAGE ERROR: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
  });
  
  // Listen for failed requests
  page.on('requestfailed', request => {
    console.error(`🔴 REQUEST FAILED: ${request.url()}`);
    console.error(`   Error: ${request.failure()?.errorText}`);
  });
  
  try {
    console.log('📡 Navigating to chat page...');
    await page.goto('http://localhost:3000/en/chat', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(3000);
    
    console.log('🔍 Looking for Quick Settings button...');
    
    // Try multiple selectors
    const selectors = [
      'button:has-text("Quick Settings")',
      'button:has-text("Quick")',
      '[role="button"]:has-text("Quick Settings")',
      'button >> text=Quick Settings'
    ];
    
    let button = null;
    for (const selector of selectors) {
      try {
        button = page.locator(selector).first();
        const isVisible = await button.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) {
          console.log(`✅ Found button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!button) {
      console.error('❌ Could not find Quick Settings button!');
      console.log('📸 Taking screenshot...');
      await page.screenshot({ path: 'quick-settings-not-found.png' });
      await browser.close();
      return;
    }
    
    console.log('🖱️ Clicking Quick Settings button...');
    await button.click();
    
    console.log('⏳ Waiting for dropdown...');
    await page.waitForTimeout(1000);
    
    // Check for dropdown
    const dropdown = page.locator('[role="menu"]').first();
    const isDropdownVisible = await dropdown.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (isDropdownVisible) {
      console.log('✅ Dropdown appeared successfully!');
    } else {
      console.warn('⚠️ Dropdown did not appear, but checking for errors...');
    }
    
    // Wait a bit more to catch any delayed errors
    await page.waitForTimeout(2000);
    
    console.log('\n✅ Test completed! Check errors above if any.\n');
    
  } catch (error) {
    console.error(`\n💥 TEST FAILED: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    
    console.log('\n📸 Taking screenshot...');
    await page.screenshot({ path: 'quick-settings-error.png' });
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
})();

