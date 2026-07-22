const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Navigate to local dev server
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // 1440px screenshot
  await page.setViewport({ width: 1440, height: 900 });
  // wait a bit for re-render
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ 
    path: 'C:\\Users\\boudy\\.gemini\\antigravity-ide\\brain\\2e818031-9b92-468a-b8df-28f0e06dcfe6\\nav-1440px.png', 
    clip: { x: 0, y: 0, width: 1440, height: 100 } 
  });
  console.log('1440px screenshot saved.');

  // 375px screenshot
  await page.setViewport({ width: 375, height: 812 });
  // wait a bit for re-render
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ 
    path: 'C:\\Users\\boudy\\.gemini\\antigravity-ide\\brain\\2e818031-9b92-468a-b8df-28f0e06dcfe6\\nav-375px-newlogo.png', 
    clip: { x: 0, y: 0, width: 375, height: 100 } 
  });
  console.log('375px screenshot saved.');

  await browser.close();
})();
