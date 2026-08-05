const Module = require('module');
const originalRequire = Module.prototype.require;
let mockEmail: string | null = null;

Module.prototype.require = function(request: string) {
  if (request === 'next-auth') {
    return {
      getServerSession: async () => mockEmail ? { user: { email: mockEmail } } : null
    };
  }
  return originalRequire.apply(this, arguments as any);
};

import prisma from "../src/lib/prisma";

async function runTest() {
  console.log("=== PHASE 1: MOCK AUTH VERIFICATION TEST ===\n");

  const org = await prisma.organization.create({
    data: { name: "Mock Test Org", slug: "mock-test-" + Date.now() }
  });

  const ts = Date.now();
  const memberUser = await prisma.user.create({
    data: { email: `member-${ts}@test.com`, password: "pwd" }
  });

  const nonMemberUser = await prisma.user.create({
    data: { email: `nonmember-${ts}@test.com`, password: "pwd" }
  });

  const superAdminEmail = `superadmin-${ts}@test.com`;
  process.env.SUPER_ADMIN_EMAIL = superAdminEmail;
  const superAdminUser = await prisma.user.create({
    data: { email: superAdminEmail, password: "pwd" }
  });

  await prisma.membership.create({
    data: { userId: memberUser.id, organizationId: org.id, role: "MEMBER" }
  });

  // Now require auth after the mock is in place
  const { verifyOrgAccess } = require("../src/lib/auth");

  // Helper to test assertions
  async function assertThrows(email: string | null, expectedError: string, testName: string) {
    mockEmail = email;
    console.log(`\n[${testName}]`);
    try {
      await verifyOrgAccess(org.id);
      console.log(`❌ FAILED: Expected error "${expectedError}" but succeeded`);
    } catch (e: any) {
      if (e.message.includes(expectedError)) {
        console.log(`✅ PASSED: Caught expected error -> ${e.message}`);
      } else {
        console.log(`❌ FAILED: Expected error "${expectedError}" but got "${e.message}"`);
      }
    }
  }

  async function assertSucceeds(email: string | null, testName: string) {
    mockEmail = email;
    console.log(`\n[${testName}]`);
    try {
      await verifyOrgAccess(org.id);
      console.log(`✅ PASSED: Successfully accessed org without error`);
    } catch (e: any) {
      console.log(`❌ FAILED: Expected success but got error -> ${e.message}`);
    }
  }

  await assertThrows(null, "Unauthorized: No session", "TEST 1: No Session");
  await assertThrows(nonMemberUser.email, "Forbidden: User does not belong to this organization", "TEST 2: Authenticated but NOT a member");
  await assertSucceeds(memberUser.email, "TEST 3: Authenticated legitimate member");
  await assertSucceeds(superAdminUser.email, "TEST 4: Super Admin (bypasses membership check)");

  // Clean up
  console.log("\nCleaning up...");
  await prisma.membership.deleteMany({ where: { organizationId: org.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  await prisma.user.deleteMany({ where: { id: { in: [memberUser.id, nonMemberUser.id, superAdminUser.id] } } });
  console.log("Done.");
}

runTest().catch(console.error);
