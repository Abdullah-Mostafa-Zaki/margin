const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3000');
  
  const children = await page.evaluate(() => {
    let list = [];
    document.querySelectorAll('.hero-grid *').forEach(el => {
      if (el.scrollWidth > 350) list.push({ tag: el.tagName, class: el.className, text: el.innerText?.substring(0, 20), scrollW: el.scrollWidth, clientW: el.clientWidth });
    });
    return list;
  });
  console.log(children);
  await browser.close();
})();
