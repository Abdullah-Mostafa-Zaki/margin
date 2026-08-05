const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function runTest() {
  console.log("=== PHASE 1: REAL BROWSER VERIFICATION ===\n");
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  // 1. Setup DB
  const orgName = "Pup Test Org " + Date.now();
  const org = await prisma.organization.create({
    data: { name: orgName, slug: "pup-test-" + Date.now() }
  });

  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash("pwd", 10);

  const memberEmail = `member-${Date.now()}@pup.com`;
  const memberUser = await prisma.user.create({
    data: { email: memberEmail, password: hashedPassword, name: "Pup Member" }
  });

  const nonMemberEmail = `nonmember-${Date.now()}@pup.com`;
  const nonMemberUser = await prisma.user.create({
    data: { email: nonMemberEmail, password: hashedPassword, name: "Pup NonMember" }
  });

  await prisma.membership.create({
    data: { userId: memberUser.id, organizationId: org.id, role: "MEMBER" }
  });

  console.log(`Created Org: ${org.id}`);
  console.log(`Created Member: ${memberEmail}`);
  console.log(`Created Non-Member: ${nonMemberEmail}`);

  // We assume Next.js is running on port 3000 now.
  const PORT = 3000;
  
  console.log("Waiting for Next.js to be ready...");
  let ready = false;
  for(let i=0; i<30; i++) {
    try {
      await fetch(`http://localhost:${PORT}`);
      ready = true;
      break;
    } catch(e) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!ready) throw new Error("Next.js not ready");
  console.log("Next.js is ready!");

  // Helper to login and test
  async function testUser(email, description, expectedBoxId) {
    console.log(`\nTesting ${description} (${email})...`);
    
    // Find Chrome
    const execPath = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ].find(p => fs.existsSync(p));

    const browser = await puppeteer.launch({ 
      executablePath: execPath,
      headless: "new" 
    });
    const page = await browser.newPage();
    
    try {
      console.log("Navigating to login...");
      await page.goto(`http://localhost:${PORT}/login`, { timeout: 60000 });
      await page.waitForSelector('#email', { timeout: 10000 });
      await page.type('#email', email);
      await page.type('#password', "pwd");
      await page.click('button[type="submit"]');
      await new Promise(r => setTimeout(r, 2000));

      // Now go to our custom test page that bypasses layout.tsx
      const testUrl = `http://localhost:${PORT}/test-action?orgId=${org.id}`;
      console.log(`Navigating to test page: ${testUrl}`);
      await page.goto(testUrl);
      
      console.log("Clicking the 'Run getDashboardInsights' button...");
      await page.waitForSelector('#run-test', { timeout: 10000 });
      await page.click('#run-test');
      
      console.log("Waiting for result...");
      await page.waitForSelector(`#${expectedBoxId}, #error-output`, { timeout: 10000 });
      
      const resultBox = await page.$(`#${expectedBoxId}`);
      if (resultBox) {
        console.log(`✅ PASSED: Found expected box #${expectedBoxId}`);
      } else {
        const errorBox = await page.$('#error-output');
        const errText = errorBox ? await page.evaluate(el => el.textContent, errorBox) : 'Unknown error';
        console.log(`❌ FAILED: Did not find #${expectedBoxId}. Error text: ${errText}`);
      }
    } catch (err) {
      console.log("Failed at URL:", page.url());
      await page.screenshot({ path: `puppeteer-error-${Date.now()}.png` });
      throw err;
    } finally {
      await browser.close();
    }
  }

  // Run tests
  await testUser(nonMemberEmail, "Non-Member", "error-output");
  await testUser(memberEmail, "Member", "success-output");

  // Run Super Admin test
  const superAdminEmail = `superadmin-${Date.now()}@pup.com`;
  const superAdminUser = await prisma.user.create({
    data: { email: superAdminEmail, password: hashedPassword, name: "Pup SuperAdmin" }
  });
  process.env.SUPER_ADMIN_EMAIL = superAdminEmail;
  await testUser(superAdminEmail, "Super Admin", "success-output");

  // Clean up
  console.log("\nCleaning up...");
  await prisma.membership.deleteMany({ where: { organizationId: org.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  await prisma.user.deleteMany({ where: { id: { in: [memberUser.id, nonMemberUser.id, superAdminUser.id] } } });
  console.log("Done.");
}

runTest().catch(console.error);
