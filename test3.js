const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // 1. Mobile at 390px
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3000');
  await new Promise(r => setTimeout(r, 1000));
  
  await page.screenshot({ path: 'C:/Users/boudy/.gemini/antigravity-ide/brain/208a787d-4e41-4940-82e5-96a37f9b78c4/mobile-nav.png', clip: { x: 0, y: 0, width: 390, height: 100 } });
  await page.screenshot({ path: 'C:/Users/boudy/.gemini/antigravity-ide/brain/208a787d-4e41-4940-82e5-96a37f9b78c4/mobile-hero-final.png', clip: { x: 0, y: 0, width: 390, height: 600 } });
  
  const overflowCause = await page.evaluate(() => {
    let elements = document.querySelectorAll('*');
    let wide = [];
    elements.forEach(el => {
      if (el.scrollWidth > 390) wide.push({ tag: el.tagName, className: el.className, width: el.scrollWidth });
    });
    return wide;
  });
  console.log('Mobile Elements wider than 390px:', overflowCause);

  // 2. Desktop at 1440px
  await page.setViewport({ width: 1440, height: 900 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: 'C:/Users/boudy/.gemini/antigravity-ide/brain/208a787d-4e41-4940-82e5-96a37f9b78c4/desktop-nav-final.png', clip: { x: 0, y: 0, width: 1440, height: 100 } });
  
  const computedEyebrow = await page.evaluate(() => {
    const el = document.querySelector('.eyebrow');
    const style = window.getComputedStyle(el);
    const parent = el.parentElement;
    const parentWidth = window.getComputedStyle(parent).width;
    return {
      marginLeft: style.marginLeft,
      marginRight: style.marginRight,
      parentWidth: parentWidth
    };
  });
  console.log('Desktop Eyebrow Computed Styles:', computedEyebrow);

  await browser.close();
})();
