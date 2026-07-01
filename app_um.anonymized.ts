import { test, expect, Page, Locator, TestInfo } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'https://your-app-url';

const SessionSelectors = {
  usernameAvatar: '.app-username',
  signInButton: 'button:has-text("Sign in")',
  signOutButton: 'button:has-text("Sign out")',
};

const DomainAccessSelectors = {
  aboutLink: 'a[href="/about"]',
  userManagementLink: 'a[href="/settings/user"]',
};

const UserManagementSelectors = {
  createUserButton: '#UsersManagement-AddUser-button',
  addUserFormUsernameInput: '#UserDialog-Username-input',
  addUserFormRoleDropdown: '#UserDialog-Role-dropdown',
  addUserFormOkButton: '#UserDialog-Ok-button',
  resetPasswordFormOkButton: '#UserResetPasswordDialog-Ok-button',
  userSettingsButton: 'button:has(.k-svg-i-user)',
  changePasswordButton: '#UserInfoDialog-ChangePassword-button',
  keycloakNewPasswordField: '#password-new',
  keycloakConfirmPasswordField: '#password-confirm',
  keycloakSubmitButton: '#kc-form-buttons input[value="Submit"]',
  settingsButton: '#UsersManagement-Settings-button',
  settingsTabAd: '#UserSettingsDialog-TabStrip [role="tab"]:has-text("Active Directory")',
  settingsTabLocalUsers: '#UserSettingsDialog-TabStrip [role="tab"]:has-text("Local users")',
  okSettingsButton: '#UserSettingsDialog-Ok-button',
  activeDirectorySwitchButton: '#UserSettingsDialog-ActiveDirectory-switch',
  adUrlField: '#UserSettingsDialog-ADConnectionURL-input',
  adBindDnField: '#UserSettingsDialog-ADBindDN-input',
  adBindDnPasswordField: '#UserSettingsDialog-ADBindCredential-input',
  adUsersDnField: '#UserSettingsDialog-ADUsersDN-input',
  addRoleMappingButton: '#UsersManagement-AddADRoleMapping-button',
  addRoleMappingGroupField: '#UserGroupDialog-ADGroup-input',
  addRoleMappingLocalRoleField: '#UserGroupDialog-LocalRole-dropdown_selectId',
  RoleMappingOkButton: '#UserGroupDialog-Ok-button',
  groupActionsButton: '#UsersManagement-GroupActions-button',
  updateRoleMappingButton: '#UsersManagement-UpdateRoleMapping-button',
  deleteRoleMappingButton: '#UsersManagement-DeleteRoleMapping-button',
};

const ROLEDATASET = {
  roleA: 'RoleA',
  roleB: 'RoleB',
  adminRole: 'Admin',
  roleC: 'RoleC',
};

const ADGROUPDATASET = {
  adgroupname: process.env.AD_GROUP_NAME ?? 'YOUR_AD_GROUP_NAME',
};

const LANGUAGE = {
  EN: /^EN$/i,
  FR: /^FR$/i,
  CS: /^CS$/i,
  DE: /^DE$/i,
};

const CREDENTIALS = {
  username: process.env.ADMIN_USERNAME ?? 'admin',
  password: process.env.ADMIN_PASSWORD ?? 'your-password',
};

const PAGE_TITLES = {
  signIn: process.env.PAGE_TITLE_SIGNIN ?? 'Sign in to your app',
  localView: 'Local view',
  about: 'About',
  userManagement: 'User Management',
};

const defaultPassword = process.env.DEFAULT_USER_PASSWORD ?? 'your-default-password';
const PROTECTED_USERS = (process.env.PROTECTED_USERS ?? 'admin,superadmin').split(',');

// =============================================================================
// HELPERS
// =============================================================================

const fillKeycloakLoginForm = async (page: Page, username: string, password: string) => {
  await expect(page.locator('#username')).toBeVisible();
  await expect(page.locator('#username')).toBeEnabled();
  await page.locator('#username').fill(username);
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.locator('#password')).toBeEnabled();
  await page.locator('#password').fill(password);
  await expect(page.locator('#kc-login')).toBeEnabled();
  await page.click('#kc-login');
};

/**
 * Hover an element using real mouse movement.
 * Required for Telerik/Blazor components that rely on mousemove events
 * to trigger dropdowns and tooltips - standard .hover() is insufficient in headless mode.
 */
const hoverElement = async (page: Page, locator: Locator) => {
  await page.keyboard.press('Escape'); // close any open Telerik overlay
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  const box = await locator.boundingBox();
  if (box) {
    await page.mouse.move(0, 0);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
  }
};

/**
 * Click an element with visibility and enabled checks.
 * Prevents clicking on disabled or hidden Telerik components.
 */
const clickElement = async (locator: Locator) => {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await locator.click();
};

/**
 * Fill an element with visibility and enabled checks.
 */
const fillElement = async (locator: Locator, textToInsert: string) => {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await locator.click();
  await locator.fill(textToInsert);
};

const confirmChangesDialog = async (page: Page, testInfo: TestInfo, comment: string, screenshotLabel: string) => {
  const dialog = page.getByRole('dialog', { name: /Apply changes \| Users/i });
  await clickElement(dialog.locator('textarea'));
  await dialog.locator('textarea').fill('');
  await page.keyboard.type(comment);
  await testInfo.attach(screenshotLabel, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await clickElement(dialog.getByRole('button', { name: /^OK$/i }));
  await expect(dialog).not.toBeVisible();
};

// =============================================================================
// TEST SUITE - User Management
// =============================================================================

test.describe('User Management @CI', () => {

  test.describe.configure({ mode: 'serial' });

  // shared state between blocs
  let user = '';
  let generatedPassword = '';
  let resetPassword = '';

  test.afterEach(async ({ page }, testInfo) => {
    // TODO-1: Call the Keycloak Admin REST API to delete the user if testInfo.status === 'failed'
  });

  // ===========================================================================
  // BLOC 1 - Active Directory setup (steps 01-07)
  // ===========================================================================
  test('Bloc 1 - Active Directory setup (steps 01-07)', async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: 'Description',
      description:
        'Verify Active Directory configuration, role mapping CRUD, and AD deactivation. ' +
        'Part of the User Management smoke test suite.',
    });

    // ─── STEP 01 : Admin Sign In ─────────────────────────────────────────────
    await test.step('STEP 01: Admin User - Sign In', async () => {
      console.log('\n[STEP 01] Starting: Admin User - Sign In');

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));

      await testInfo.attach('STEP 01.1 - Display User Account (Before language selection)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.getByRole('button', { name: LANGUAGE.EN }));
      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));

      await testInfo.attach('STEP 01.2 - Display User Account (Before Sign In click)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(SessionSelectors.signInButton));
      await expect(page).toHaveTitle(PAGE_TITLES.signIn);
      await fillKeycloakLoginForm(page, CREDENTIALS.username, CREDENTIALS.password);

      console.log('Passed ✔\n');
    });

    // ─── STEP 02 : Navigate To User Management ───────────────────────────────
    await test.step('STEP 02: Admin User - Navigate To User Management', async () => {
      console.log('[STEP 02] Starting: Admin User - Navigate To User Management');

      await hoverElement(page, page.locator(DomainAccessSelectors.aboutLink));
      await clickElement(page.locator(DomainAccessSelectors.aboutLink));

      await testInfo.attach('STEP 02.1 - Display Settings Page (About Page)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(DomainAccessSelectors.userManagementLink));
      await expect(page).toHaveTitle(PAGE_TITLES.userManagement);

      await testInfo.attach('STEP 02.2 - Display User Management Page', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      console.log('Passed ✔\n');
    });

    // ─── STEP 03 : Check Active Directory Configuration And Activation ────────
    await test.step('STEP 03: Admin User - Check Active Directory Configuration And Activation', async () => {
      console.log('[STEP 03] Starting: Admin User - Check Active Directory Configuration And Activation');

      await clickElement(page.locator(UserManagementSelectors.settingsButton));
      await clickElement(page.locator(UserManagementSelectors.settingsTabAd));

      await expect(page.locator(UserManagementSelectors.adUrlField)).not.toBeEmpty();
      await expect(page.locator(UserManagementSelectors.adBindDnField)).not.toBeEmpty();
      await expect(page.locator(UserManagementSelectors.adBindDnPasswordField)).not.toBeEmpty();
      await expect(page.locator(UserManagementSelectors.adUsersDnField)).not.toBeEmpty();

      await testInfo.attach('STEP 03.1 - Active Directory Configuration State', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(UserManagementSelectors.activeDirectorySwitchButton));
      await clickElement(page.locator(UserManagementSelectors.okSettingsButton));
      await confirmChangesDialog(page, testInfo, 'Active Directory Activation', 'STEP 03.2 - Apply Changes Filled (Active Directory Activation)');

      console.log('Passed ✔\n');
    });

    // ─── STEP 04 : Role Mapping Creation ─────────────────────────────────────
    await test.step('STEP 04: Admin User - Role Mapping Creation', async () => {
      console.log('[STEP 04] Starting: Admin User - Role Mapping Creation');

      await clickElement(page.locator(UserManagementSelectors.addRoleMappingButton));
      await fillElement(page.locator(UserManagementSelectors.addRoleMappingGroupField), ADGROUPDATASET.adgroupname);
      await clickElement(page.getByRole('option', { name: ADGROUPDATASET.adgroupname }));
      await clickElement(page.locator(UserManagementSelectors.addRoleMappingLocalRoleField));
      await clickElement(page.getByRole('option', { name: ROLEDATASET.adminRole }));

      await testInfo.attach('STEP 04.1 - Role Mapping Creation Dialog Filled', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(UserManagementSelectors.RoleMappingOkButton));
      await confirmChangesDialog(page, testInfo, 'Role mapping creation.', 'STEP 04.2 - Apply Changes Filled (Role Mapping Creation)');

      await expect(page.getByRole('row', { name: new RegExp(ADGROUPDATASET.adgroupname, 'i') })).toBeVisible();

      console.log('Passed ✔\n');
    });

    // ─── STEP 05 : Role Mapping Edition ──────────────────────────────────────
    await test.step('STEP 05: Admin User - Role Mapping Edition', async () => {
      console.log('[STEP 05] Starting: Admin User - Role Mapping Edition');

      const row = page.getByRole('row', { name: new RegExp(ADGROUPDATASET.adgroupname, 'i') });
      await clickElement(row.locator(UserManagementSelectors.groupActionsButton));
      await clickElement(page.locator(UserManagementSelectors.updateRoleMappingButton));
      await expect(page.locator(UserManagementSelectors.addRoleMappingGroupField)).toHaveValue(ADGROUPDATASET.adgroupname);
      await expect(page.locator(`${UserManagementSelectors.addRoleMappingLocalRoleField} .k-input-value-text`)).toHaveText(ROLEDATASET.adminRole);
      await clickElement(page.locator(UserManagementSelectors.addRoleMappingLocalRoleField));
      await clickElement(page.getByRole('option', { name: ROLEDATASET.roleC }));

      await testInfo.attach('STEP 05.1 - Role Mapping Edition Dialog With Updated Role Value', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(UserManagementSelectors.RoleMappingOkButton));
      await confirmChangesDialog(page, testInfo, 'Change associated role to a defined role mapping.', 'STEP 05.2 - Apply Changes Filled (Role Mapping Edition)');

      await expect(page.getByRole('row', { name: new RegExp(ADGROUPDATASET.adgroupname, 'i') })).toBeVisible();

      console.log('Passed ✔\n');
    });

    // ─── STEP 06 : Role Mapping Deletion ─────────────────────────────────────
    await test.step('STEP 06: Admin User - Role Mapping Deletion', async () => {
      console.log('[STEP 06] Starting: Admin User - Role Mapping Deletion');

      const row = page.getByRole('row', { name: new RegExp(ADGROUPDATASET.adgroupname, 'i') });
      await clickElement(row.locator(UserManagementSelectors.groupActionsButton));
      await clickElement(page.locator(UserManagementSelectors.deleteRoleMappingButton));
      await confirmChangesDialog(page, testInfo, `Delete Role Mapping Associated To ${ADGROUPDATASET.adgroupname}`, 'STEP 06.1 - Apply Changes Filled (Role Mapping Deletion)');

      await expect(page.getByRole('row', { name: new RegExp(ADGROUPDATASET.adgroupname, 'i') })).not.toBeVisible();

      console.log('Passed ✔\n');
    });

    // ─── STEP 07 : Active Directory Deactivation ──────────────────────────────
    await test.step('STEP 07: Admin User - Active Directory Deactivation', async () => {
      console.log('[STEP 07] Starting: Admin User - Active Directory Deactivation');

      await clickElement(page.locator(UserManagementSelectors.settingsButton));
      await clickElement(page.locator(UserManagementSelectors.activeDirectorySwitchButton));
      await clickElement(page.locator(UserManagementSelectors.okSettingsButton));
      await confirmChangesDialog(page, testInfo, 'Active Directory Deactivation', 'STEP 07.1 - Apply Changes Filled (Active Directory Deactivation)');

      console.log('Passed ✔\n');
    });
  });

  // ===========================================================================
  // BLOC 2 - User creation (steps 08-09)
  // ===========================================================================
  test('Bloc 2 - User creation (steps 08-09)', async ({ page }, testInfo) => {

    // ─── STEP 08 : Admin Sign In ──────────────────────────────────────────────
    await test.step('STEP 08: Admin User - Sign In', async () => {
      console.log('[STEP 08] Starting: Admin User - Sign In');

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));
      await clickElement(page.locator(SessionSelectors.signInButton));
      await expect(page).toHaveTitle(PAGE_TITLES.signIn);
      await fillKeycloakLoginForm(page, CREDENTIALS.username, CREDENTIALS.password);

      console.log('Passed ✔\n');
    });

    // ─── STEP 08b : Navigate To User Management ───────────────────────────────
    await test.step('STEP 08b: Admin User - Navigate To User Management', async () => {
      console.log('[STEP 08b] Starting: Admin User - Navigate To User Management');

      await hoverElement(page, page.locator(DomainAccessSelectors.aboutLink));
      await clickElement(page.locator(DomainAccessSelectors.aboutLink));
      await clickElement(page.locator(DomainAccessSelectors.userManagementLink));
      await expect(page).toHaveTitle(PAGE_TITLES.userManagement);

      console.log('Passed ✔\n');
    });

    // ─── STEP 08c : User Creation ─────────────────────────────────────────────
    await test.step('STEP 08c: Admin User - User Creation', async () => {
      user = `SmokeUser${Date.now().toString().slice(-6)}`;
      console.log(`A user named: ${user} will be created, edited then deleted.`);

      await clickElement(page.locator(UserManagementSelectors.createUserButton));
      await fillElement(page.locator(UserManagementSelectors.addUserFormUsernameInput), user);
      await clickElement(page.locator(UserManagementSelectors.addUserFormRoleDropdown));
      await clickElement(page.getByRole('option', { name: ROLEDATASET.roleB }));

      await testInfo.attach('STEP 08.1 - User Creation Form Filled', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(UserManagementSelectors.addUserFormOkButton));
      await confirmChangesDialog(page, testInfo, `Create new user :${user}`, 'STEP 08.2 - Apply Changes Filled (User Creation)');

      const dialog = page.getByRole('dialog', { name: /Reset password/i });
      const passwordElement = dialog.locator('span.k-font-bold');
      const okButton = dialog.locator(UserManagementSelectors.resetPasswordFormOkButton);
      await expect(passwordElement).toBeVisible();

      generatedPassword = (await passwordElement.innerText()).trim();
      expect(generatedPassword).toBeTruthy();

      console.log('STEP 08 > Created user:', user);
      console.log('STEP 08 > Generated password:', generatedPassword);

      await testInfo.attach('STEP 08.3 - Generated Password Dialog (User Creation)', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });

      await clickElement(okButton);
      await expect(page.getByRole('row', { name: new RegExp(user, 'i') })).toBeVisible();

      console.log('Passed ✔\n');
    });

    // ─── STEP 09 : Admin Sign Out ─────────────────────────────────────────────
    await test.step('STEP 09: Admin User - Sign Out', async () => {
      console.log('[STEP 09] Starting: Admin User - Sign Out');

      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));
      await testInfo.attach('STEP 09.1 - Display Admin User Account (Before Sign Out click)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(SessionSelectors.signOutButton));
      await expect(page.getByText(/No user/i)).toBeVisible();

      console.log('Passed ✔\n');
    });
  });

  // ===========================================================================
  // BLOC 3 - First login & password change (steps 10-13)
  // ===========================================================================
  test('Bloc 3 - First login & password change (steps 10-13)', async ({ page }, testInfo) => {

    // ─── STEP 10 : Smoke User Sign In ─────────────────────────────────────────
    await test.step('STEP 10: Smoke User - Sign In', async () => {
      console.log('[STEP 10] Starting: Smoke User - Sign In');

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await expect(page.locator(SessionSelectors.usernameAvatar)).toBeVisible();
      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));

      await testInfo.attach('STEP 10.1 - Display User Account (Before Smoke User Sign In click)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(SessionSelectors.signInButton));
      await expect(page).toHaveTitle(PAGE_TITLES.signIn);
      await fillKeycloakLoginForm(page, user, generatedPassword);

      console.log('Passed ✔\n');
    });

    // ─── STEP 11 : Smoke User Changes Its Assigned Password ───────────────────
    await test.step('STEP 11: Smoke User - Changes Its Assigned Password', async () => {
      console.log('[STEP 11] Starting: Smoke User - Changes Its Assigned Password');

      await expect(page.getByRole('heading', { name: /update password/i })).toBeVisible();
      await expect(page.getByText('You need to change your password')).toBeVisible();
      await fillElement(page.getByLabel('New Password'), defaultPassword);
      await fillElement(page.getByLabel('Confirm password'), defaultPassword);

      await testInfo.attach('STEP 11.1 - Smoke User New Password Defined', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.getByRole('button', { name: /submit/i }));
      await page.waitForURL(/local-view/);

      console.log('Passed ✔\n');
    });

    // ─── STEP 12 : Smoke User Define Again Its Assigned Password ──────────────
    const newPassword = process.env.SMOKE_USER_NEW_PASSWORD ?? 'your-new-password';
    await test.step('STEP 12: Smoke User - Define Again Its Assigned Password', async () => {
      console.log('[STEP 12] Starting: Smoke User - Define Again Its Assigned Password');

      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));
      await clickElement(page.locator(UserManagementSelectors.userSettingsButton));

      await testInfo.attach('STEP 12.1 - Smoke User Account Settings', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(UserManagementSelectors.changePasswordButton));
      await expect(page.getByText('Please re-authenticate to continue')).toBeVisible();
      await fillElement(page.locator('#password'), defaultPassword);

      await testInfo.attach('STEP 12.2 - Keycloak Re-Authentication', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator('#kc-login'));
      await fillElement(page.locator(UserManagementSelectors.keycloakNewPasswordField), newPassword);
      await fillElement(page.locator(UserManagementSelectors.keycloakConfirmPasswordField), newPassword);

      await testInfo.attach('STEP 12.3 - New Password Defined', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(UserManagementSelectors.keycloakSubmitButton));
      await page.waitForURL(/local-view/);

      console.log('Passed ✔\n');
    });

    // ─── STEP 13 : Smoke User Sign Out ────────────────────────────────────────
    await test.step('STEP 13: Smoke User - Sign Out', async () => {
      console.log('[STEP 13] Starting: Smoke User - Sign Out');

      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));

      await testInfo.attach('STEP 13.1 - Display Smoke User Account (Before Sign Out click)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(SessionSelectors.signOutButton));
      await expect(page.getByText(/No user/i)).toBeVisible();

      console.log('Passed ✔\n');
    });
  });

  // ===========================================================================
  // BLOC 4 - Reset password cycle (steps 14-21)
  // ===========================================================================
  test('Bloc 4 - Reset password cycle (steps 14-21)', async ({ page }, testInfo) => {

    // ─── STEP 14 : Admin Sign In ──────────────────────────────────────────────
    await test.step('STEP 14: Admin User - Sign In', async () => {
      console.log('[STEP 14] Starting: Admin User - Sign In');

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await expect(page.locator(SessionSelectors.usernameAvatar)).toBeVisible();
      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));

      await testInfo.attach('STEP 14.1 - Display User Account (Before Admin Sign In click)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(SessionSelectors.signInButton));
      await expect(page).toHaveTitle(PAGE_TITLES.signIn);
      await fillKeycloakLoginForm(page, CREDENTIALS.username, CREDENTIALS.password);

      console.log('Passed ✔\n');
    });

    // ─── STEP 15 : Navigate To User Management (Reset Password) ───────────────
    await test.step('STEP 15: Admin User - Navigate To User Management (Reset Password)', async () => {
      console.log('[STEP 15] Starting: Admin User - Navigate To User Management (Reset Password)');

      await hoverElement(page, page.locator(DomainAccessSelectors.aboutLink));
      await clickElement(page.locator(DomainAccessSelectors.aboutLink));
      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));

      await testInfo.attach('STEP 15.1 - Display Settings Page (About Page)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await hoverElement(page, page.locator(DomainAccessSelectors.userManagementLink));
      await clickElement(page.locator(DomainAccessSelectors.userManagementLink));
      await expect(page).toHaveTitle(PAGE_TITLES.userManagement);

      await testInfo.attach('STEP 15.2 - Display User Management Page', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      console.log('Passed ✔\n');
    });

    // ─── STEP 16 : Reset Smoke User Password ──────────────────────────────────
    await test.step('STEP 16: Admin User - Reset Smoke User Password', async () => {
      console.log('[STEP 16] Starting: Admin User - Reset Smoke User Password');

      const row = page.getByRole('row', { name: new RegExp(user, 'i') });
      await clickElement(row.locator('#UsersManagement-UserActions-button'));
      await clickElement(page.getByRole('button', { name: /Reset password/i }));
      await confirmChangesDialog(page, testInfo, `Reset password for user :${user}`, 'STEP 16.1 - Apply Changes Filled (Reset Password)');

      const dialog = page.getByRole('dialog', { name: /Reset password/i });
      const passwordElement = dialog.locator('span.k-font-bold');
      const okButton = dialog.locator(UserManagementSelectors.resetPasswordFormOkButton);
      await expect(passwordElement).toBeVisible();

      resetPassword = (await passwordElement.innerText()).trim();
      expect(resetPassword).toBeTruthy();

      console.log('STEP 16 > Reset password:', resetPassword);

      await testInfo.attach('STEP 16.2 - Reset Password Dialog', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });

      await clickElement(okButton);

      console.log('Passed ✔\n');
    });

    // ─── STEP 17 : Admin Sign Out (before smoke user re-login) ────────────────
    await test.step('STEP 17: Admin User - Sign Out (Before Smoke User Re-Login)', async () => {
      console.log('[STEP 17] Starting: Admin User - Sign Out (Before Smoke User Re-Login)');

      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));

      await testInfo.attach('STEP 17.1 - Display Admin User Account (Before Sign Out click)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(SessionSelectors.signOutButton));
      await expect(page.getByText(/No user/i)).toBeVisible();

      console.log('Passed ✔\n');
    });

    // ─── STEP 18 : Smoke User Sign In With Reset Password ─────────────────────
    await test.step('STEP 18: Smoke User - Sign In With Reset Password', async () => {
      console.log('[STEP 18] Starting: Smoke User - Sign In With Reset Password');

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await expect(page.locator(SessionSelectors.usernameAvatar)).toBeVisible();
      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));

      await testInfo.attach('STEP 18.1 - Display User Account (Before Smoke User Re-Sign In click)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(SessionSelectors.signInButton));
      await expect(page).toHaveTitle(PAGE_TITLES.signIn);
      await fillKeycloakLoginForm(page, user, resetPassword);

      console.log('Passed ✔\n');
    });

    // ─── STEP 19 : Smoke User Changes Its Reset Password ──────────────────────
    await test.step('STEP 19: Smoke User - Changes Its Reset Password', async () => {
      console.log('[STEP 19] Starting: Smoke User - Changes Its Reset Password');

      await expect(page.getByRole('heading', { name: /update password/i })).toBeVisible();
      await expect(page.getByText('You need to change your password')).toBeVisible();

      await fillElement(page.getByLabel('New Password'), defaultPassword);
      await fillElement(page.getByLabel('Confirm password'), defaultPassword);

      await testInfo.attach('STEP 19.1 - New Reset Password Defined', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.getByRole('button', { name: /submit/i }));
      await page.waitForURL(/local-view/);

      console.log('Passed ✔\n');
    });

    // ─── STEP 20 : Smoke User Verify Active Session ───────────────────────────
    await test.step('STEP 20: Smoke User - Verify Active Session', async () => {
      console.log('[STEP 20] Starting: Smoke User - Verify Active Session');

      await expect(page.getByText(/No user/i)).not.toBeVisible();
      await expect(page).toHaveURL(/local-view/);

      await testInfo.attach('STEP 20.1 - Smoke User Active Session Verified', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      console.log('Passed ✔\n');
    });

    // ─── STEP 21 : Smoke User Final Sign Out ──────────────────────────────────
    await test.step('STEP 21: Smoke User - Final Sign Out', async () => {
      console.log('[STEP 21] Starting: Smoke User - Final Sign Out');

      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));

      await testInfo.attach('STEP 21.1 - Display Smoke User Account (Before Final Sign Out click)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(SessionSelectors.signOutButton));
      await expect(page.getByText(/No user/i)).toBeVisible();

      console.log('Passed ✔\n');
    });
  });

  // ===========================================================================
  // BLOC 5 - Edition & deletion (steps 22-26)
  // ===========================================================================
  test('Bloc 5 - Edition & deletion (steps 22-26)', async ({ page }, testInfo) => {

    // ─── STEP 22 : Admin Sign In (Edition & Deletion) ─────────────────────────
    await test.step('STEP 22: Admin User - Sign In (Edition & Deletion)', async () => {
      console.log('[STEP 22] Starting: Admin User - Sign In (Edition & Deletion)');

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await expect(page.locator(SessionSelectors.usernameAvatar)).toBeVisible();
      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));

      await testInfo.attach('STEP 22.1 - Display User Account (Before Admin Sign In click)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(SessionSelectors.signInButton));
      await expect(page).toHaveTitle(PAGE_TITLES.signIn);
      await fillKeycloakLoginForm(page, CREDENTIALS.username, CREDENTIALS.password);

      console.log('Passed ✔\n');
    });

    // ─── STEP 23 : Navigate To User Management (Edition & Deletion) ───────────
    await test.step('STEP 23: Admin User - Navigate To User Management (Edition & Deletion)', async () => {
      console.log('[STEP 23] Starting: Admin User - Navigate To User Management (Edition & Deletion)');

      await clickElement(page.locator(DomainAccessSelectors.aboutLink));

      await testInfo.attach('STEP 23.1 - Display Settings Page (About Page)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(DomainAccessSelectors.userManagementLink));
      await expect(page).toHaveTitle(PAGE_TITLES.userManagement);

      await testInfo.attach('STEP 23.2 - Display User Management Page', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      console.log('Passed ✔\n');
    });

    // ─── STEP 24 : User Edition ────────────────────────────────────────────────
    await test.step('STEP 24: Admin User - User Edition', async () => {
      console.log('[STEP 24] Starting: Admin User - User Edition');

      const row = page.getByRole('row', { name: new RegExp(user, 'i') });
      await clickElement(row.locator('#UsersManagement-UserActions-button'));
      await clickElement(page.getByRole('button', { name: /Update user/i }));

      const dialogEditionForm = page.getByRole('dialog', { name: /Update user/i });
      const roleDropdown = dialogEditionForm.locator(UserManagementSelectors.addUserFormRoleDropdown);

      await clickElement(dialogEditionForm.locator(UserManagementSelectors.addUserFormUsernameInput));
      await fillElement(page.locator(UserManagementSelectors.addUserFormUsernameInput), `${user}Updated`);
      await clickElement(roleDropdown);
      await clickElement(page.getByRole('option', { name: ROLEDATASET.roleA }));
      await clickElement(dialogEditionForm.locator(UserManagementSelectors.addUserFormOkButton));
      await confirmChangesDialog(page, testInfo, 'User updated', 'STEP 24.1 - Apply Changes Filled (User Edition)');

      await expect(page.getByRole('row', { name: new RegExp(`${user}Updated`, 'i') })).toBeVisible();

      console.log('Passed ✔\n');
    });

    // ─── STEP 25 : User Deletion ───────────────────────────────────────────────
    await test.step('STEP 25: Admin User - User Deletion', async () => {
      console.log('[STEP 25] Starting: Admin User - User Deletion');

      const row = page.getByRole('row', { name: new RegExp(`${user}Updated`, 'i') });
      await expect(row).toBeVisible();
      await clickElement(row.locator('#UsersManagement-UserActions-button'));
      await clickElement(page.getByRole('button', { name: /Delete user/i }));
      await confirmChangesDialog(page, testInfo, 'Delete updated user', 'STEP 25.1 - Apply Changes Filled (User Deletion)');

      await expect(page.getByRole('row', { name: new RegExp(`${user}Updated`, 'i') })).not.toBeVisible();

      console.log('Passed ✔\n');
    });

    // ─── STEP 26 : Admin Final Sign Out ───────────────────────────────────────
    await test.step('STEP 26: Admin User - Final Sign Out', async () => {
      console.log('[STEP 26] Starting: Admin User - Final Sign Out');

      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));

      await testInfo.attach('STEP 26.1 - Display Admin User Account', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await clickElement(page.locator(SessionSelectors.signOutButton));
      await expect(page.getByText(/No user/i)).toBeVisible();

      await testInfo.attach('STEP 26.2 - Display Final State', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      console.log('Passed ✔\n');
    });
  });

}); // End test.describe 'User Management @CI'


// =============================================================================
// CLEANUP SUITE
// =============================================================================

test.describe('Cleanup @CI', () => {

  test.describe.configure({ mode: 'serial' });

  test('Cleanup - Delete all non-protected users', async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: 'Description',
      description: 'Delete all users except protected accounts: ' + PROTECTED_USERS.join(', '),
    });

    // ─── STEP 01 : Admin Sign In ─────────────────────────────────────────────
    await test.step('STEP 01: Admin User - Sign In', async () => {
      console.log('\n[STEP 01] Starting: Admin User - Sign In');

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      const avatar = page.locator(SessionSelectors.usernameAvatar);
      await hoverElement(page, avatar);
      await clickElement(page.getByRole('button', { name: LANGUAGE.EN }));
      await hoverElement(page, avatar);
      await clickElement(page.locator(SessionSelectors.signInButton));
      await expect(page).toHaveTitle(PAGE_TITLES.signIn);
      await fillKeycloakLoginForm(page, CREDENTIALS.username, CREDENTIALS.password);

      console.log('Passed ✔\n');
    });

    // ─── STEP 02 : Navigate To User Management ───────────────────────────────
    await test.step('STEP 02: Admin User - Navigate To User Management', async () => {
      console.log('\n[STEP 02] Starting: Admin User - Navigate To User Management');

      await clickElement(page.locator(DomainAccessSelectors.aboutLink));
      await clickElement(page.locator(DomainAccessSelectors.userManagementLink));
      await expect(page).toHaveTitle(PAGE_TITLES.userManagement);

      console.log('Passed ✔\n');
    });

    // ─── STEP 03 : Delete All Non-Protected Users ─────────────────────────────
    await test.step('STEP 03: Admin User - Delete All Non-Protected Users', async () => {
      console.log('\n[STEP 03] Starting: Admin User - Delete All Non-Protected Users');

      let deletedCount = 0;
      const skippedUsers: string[] = [];
      const deletedUsers: string[] = [];

      while (true) {
        await page.locator('.k-loader-container').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

        const allRows = page.locator('tbody.k-table-tbody tr[role="row"]');
        const count = await allRows.count();

        if (count === 0) break;

        let foundDeletable = false;

        for (let i = 0; i < count; i++) {
          const currentCount = await allRows.count();
          if (i >= currentCount) break;

          const row = allRows.nth(i);
          const username = (await row.locator('[data-col-index="1"] .k-font-weight-bold').innerText({ timeout: 5000 })).trim();
          const isProtected = PROTECTED_USERS.some(u => u.toLowerCase() === username.toLowerCase());

          if (isProtected) {
            if (!skippedUsers.includes(username)) skippedUsers.push(username);
            continue;
          }

          await clickElement(row.locator('#UsersManagement-UserActions-button'));
          await clickElement(page.getByRole('button', { name: /Delete user/i }));
          await confirmChangesDialog(page, testInfo, 'Automated user deletion', 'Cleanup - User Deletion');
          await page.locator('.k-loader-container').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(500);

          deletedUsers.push(username);
          deletedCount++;
          foundDeletable = true;
          break;
        }

        if (!foundDeletable) break;
      }

      console.log('\n\t── Cleanup Summary ──────────────────────');
      console.log(`\t Protected (skipped) : ${skippedUsers.length > 0 ? skippedUsers.join(', ') : 'none'}`);
      console.log(`\t Deleted             : ${deletedUsers.length > 0 ? deletedUsers.join(', ') : 'none'}`);
      console.log(`\t Total deleted       : ${deletedCount}`);
      console.log('\t─────────────────────────────────────────\n');

      await testInfo.attach('STEP 03 - Final User List After Cleanup', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      console.log('Passed ✔\n');
    });

    // ─── STEP 04 : Admin Sign Out ─────────────────────────────────────────────
    await test.step('STEP 04: Admin User - Sign Out', async () => {
      console.log('\n[STEP 04] Starting: Admin User - Sign Out');

      await hoverElement(page, page.locator(SessionSelectors.usernameAvatar));
      await clickElement(page.locator(SessionSelectors.signOutButton));
      await expect(page.getByText(/No user/i)).toBeVisible();

      console.log('Passed ✔\n');
    });
  });
});
