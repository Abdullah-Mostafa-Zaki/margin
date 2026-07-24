const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // Wait a bit
  await new Promise(r => setTimeout(r, 1000));

  // Take screenshot of the new product diagram
  const element = await page.$('.feat-visual');
  if (element) {
    await element.screenshot({ 
      path: 'C:\\Users\\boudy\\.gemini\\antigravity-ide\\brain\\2e818031-9b92-468a-b8df-28f0e06dcfe6\\product-diagram.png' 
    });
    console.log('Diagram screenshot saved.');
  } else {
    console.log('.feat-visual not found');
  }

  await browser.close();
})();
