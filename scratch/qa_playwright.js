const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('--- Phase 1: Authentication & Security ---');
  console.log('Navigating to login...');
  await page.goto('https://www.marginegy.com/login');
  
  await page.fill('input[type="email"]', 'margin.qa.testing@gmail.com');
  await page.fill('input[type="password"]', 'Password@123');
  
  console.log('Submitting login...');
  await page.click('button[type="submit"]');
  
  // Wait for the redirect to happen which means successful login
  try {
    await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 });
  } catch (e) {
    console.log('Login failed or did not redirect in time. Current URL:', page.url());
    // Take a screenshot to debug
    await page.screenshot({ path: 'login_error.png' });
    await browser.close();
    process.exit(1);
  }
  
  const currentUrl = page.url();
  console.log('Logged in successfully, URL:', currentUrl);
  
  // Get orgSlug
  const urlObj = new URL(currentUrl);
  const pathParts = urlObj.pathname.split('/');
  const orgSlug = pathParts[1];
  console.log('Detected Org Slug:', orgSlug);
  
  console.log('Navigating to transactions page...');
  await page.goto(`https://www.marginegy.com/${orgSlug}/transactions`);
  await page.waitForTimeout(2000);
  
  console.log('\n--- Phase 2: Transaction Modals & Form State ---');
  
  let actionHeaders = null;
  let actionBody = null;
  let actionUrl = null;

  page.on('request', req => {
    if (req.method() === 'POST' && req.headers()['next-action']) {
      actionHeaders = req.headers();
      actionBody = req.postDataBuffer();
      actionUrl = req.url();
    }
  });

  // Open modal using desktop button
  console.log('Clicking Add Transaction...');
  await page.click('button:has-text("Add Transaction")');
  await page.waitForTimeout(2000); // Wait for modal to animate in
  
  console.log('Filling amount with -5000...');
  // Fill invalid amount (negative)
  await page.fill('input[name="amount"]', '-5000');
  
  console.log('Submitting form...');
  
  // Need to wait for the request
  const responsePromise = page.waitForResponse(res => res.request().method() === 'POST' && res.request().headers()['next-action'], { timeout: 10000 }).catch(() => null);
  
  // Submit the form
  await page.click('form button[type="submit"]');
  
  await responsePromise;
  console.log('Form submitted.');
  
  if (actionHeaders && actionBody && actionUrl) {
    console.log(`Captured Next-Action: ${actionHeaders['next-action']}`);
    console.log('Proceeding with chaos bombardment (10 concurrent requests)...');
    
    // We will fire 10 simultaneous POST requests using the captured Action ID and cookies
    const cookies = await context.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    // Use the native fetch in node to send the concurrent requests
    const fetchPromises = [];
    for(let i=0; i<10; i++) {
      const headers = { ...actionHeaders };
      headers['cookie'] = cookieString;
      // Fetch does not allow some pseudo headers
      delete headers[':authority'];
      delete headers[':method'];
      delete headers[':path'];
      delete headers[':scheme'];
      
      fetchPromises.push(
        fetch(actionUrl, {
          method: 'POST',
          headers: headers,
          body: actionBody
        }).then(res => res.status())
          .catch(e => e.message)
      );
    }
    
    const results = await Promise.all(fetchPromises);
    console.log('Concurrent bombardment results:', results);
  } else {
    console.log('Could not perform bombardment - action not captured.');
  }

  await browser.close();
})();
