const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:3000');
  
  const heroGridStyle = await page.evaluate(() => {
    const el = document.querySelector('.hero-grid');
    return window.getComputedStyle(el).gridTemplateColumns;
  });
  
  console.log('DEVTOOLS FINDING:');
  console.log('Computed grid-template-columns for .hero-grid at 390px:', heroGridStyle);

  const overflowCause = await page.evaluate(() => {
    let elements = document.querySelectorAll('*');
    let wide = [];
    elements.forEach(el => {
      if (el.scrollWidth > 390) wide.push({ tag: el.tagName, className: el.className, width: el.scrollWidth });
    });
    return wide;
  });
  console.log('Elements wider than 390px:', overflowCause);

  await browser.close();
})();
