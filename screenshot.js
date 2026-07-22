const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3000');
  await page.screenshot({ path: 'C:/Users/boudy/.gemini/antigravity-ide/brain/208a787d-4e41-4940-82e5-96a37f9b78c4/mobile-screenshot.png' });
  await browser.close();
})();
