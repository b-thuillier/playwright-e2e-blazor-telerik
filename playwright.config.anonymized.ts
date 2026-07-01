import { defineConfig } from '@playwright/test';
const isHeaded = process.env.HEADED === 'true';
//npx playwright test --grep="NRT" client-project.um.login.spec.ts --project="ClientProject - POC - Playwright" --headed
//
// $env:HEADED="true"; npx playwright test --grep="NRT" client-project.um.login.spec.ts --project="ClientProject - POC - Playwright" --headed
//ou
// set HEADED=true && npx playwright test --grep="NRT" client-project.um.login.spec.ts --project="ClientProject - POC - Playwright" --headed
export default defineConfig({
  testDir: './tests',
  // Chaque fichier de test s'exécute en parallèle
  fullyParallel: true,
  // Empêche de commiter un test.only par accident en CI
  forbidOnly: !!process.env.CI,
  // 1 retry en local pour absorber les instabilités réseau (WiFi),
  // 2 en CI où le réseau peut être encore plus imprévisible
  retries: process.env.CI ? 2 : 0,
  // En CI on force 1 seul worker pour éviter les conflits sur les données
  // (ex: deux tests qui créent le même SmokeUser en même temps)
  //workers: process.env.CI ? 1 : undefined,
  workers: 1,
  reporter: 'html',
  // Durée maximale d'un test entier.
  // Ce test fait 19 steps avec plusieurs login/logout Keycloak,
  // 120s est la marge minimale viable sur WiFi
  timeout: 120_000,
  // Timeout appliqué à tous les expect() : toBeVisible(), toHaveTitle(), etc.
  // Par défaut Playwright utilise 5s — trop court sur WiFi.
  // C'était la cause principale des échecs sur réseau lent.
  expect: {
    timeout: 20_000,
  },
  use: {
    viewport: isHeaded ? null : { width: 1920, height: 1080 },
    deviceScaleFactor: isHeaded ? undefined : 1,
    launchOptions: {
      args: isHeaded
        ? ['--start-maximized']
        : [
            '--force-device-scale-factor=1',
            '--high-dpi-support=1',
            '--disable-lcd-text',
            '--disable-gpu',
            '--window-size=1920,1080', // ← ajouter
          ],
    },
    // Garde la trace uniquement sur échec, pour ne pas surcharger le disque
    trace: 'retain-on-failure-and-retries',
    video: {
      mode: 'on',
      size: { width: 1920, height: 1080 },
    },
    // Pas de viewport fixe : le browser prend toute la fenêtre (voir --start-maximized)
    // Timeout pour les page.goto() et les navigations déclenchées par des clics.
    // Keycloak peut prendre plusieurs secondes à rediriger sur WiFi
    // navigationTimeout: 60_000,
    navigationTimeout: 20_000,
    // Timeout pour les actions : click(), fill(), hover(), etc.
    // Distinct du expect.timeout — s'applique à l'interaction elle-même
    actionTimeout: 20_000,
  },
  projects: [
    {
      name: 'ClientProject - POC - Playwright',
      use: {
        // Ignore les erreurs de certificat SSL (environnement dev avec certificat auto-signé)
        ignoreHTTPSErrors: true,
        channel: 'msedge',
      },
    },
  ],
});
