# Playwright QA Automation - Portfolio

> **Demonstration repository.** The files here come from a real E2E test automation engagement, **anonymized** (client/project name, URLs, credentials, screenshots and videos) before publication. They are shared as a code and methodology sample - **not intended to be run as-is, reused, or adapted**.

## Purpose

This repository showcases a Playwright test suite built to validate a **user management** module (creation, edition, deletion, password reset, Active Directory integration) on an internal application, authenticated via **Keycloak**.

It's meant to demonstrate:
- how to structure a long, multi-step E2E suite into independent, readable blocks;
- handling edge cases specific to **Telerik/Blazor** components (hover, dropdowns, confirmation dialogs);
- an execution-proof strategy (screenshots attached at every key step);
- a pipeline to anonymize HTML reports before external sharing.

## Repository contents

| File | Role |
|---|---|
| `app_um.anonymized.ts` | Main test suite (26 steps across 5 blocks + a cleanup suite) |
| `playwright.config.anonymized.ts` | Playwright configuration (network-tuned timeouts, video, trace, forced resolution) |
| `package.anonymized.json` | npm scripts to run the tests in CI (headless / headed) |
| `zip-report.anonymized.js` | Timestamped archiving script for the HTML report after each run |
| `playwright-report.anonymized.html` | Sample generated HTML report, with screenshots and videos anonymized for publication |

## Functional coverage of the main test (`app_um.anonymized.ts`)

The `User Management @CI` suite runs in **serial** mode (state is shared across blocks: the user created in block 2 is reused through block 5):

| Block | Steps | Content |
|---|---|---|
| **1 - Active Directory setup** | 01–07 | Admin sign-in, AD configuration check, activation, role mapping create/edit/delete, deactivation |
| **2 - User creation** | 08–09 | Creates a "smoke test" user with an assigned role, retrieves the generated password |
| **3 - First login & password change** | 10–13 | Signs in with the generated password, forced password change enforced by Keycloak |
| **4 - Password reset cycle** | 14–21 | Admin-triggered reset, user re-signs in with the new password |
| **5 - Edition & deletion** | 22–26 | Edits the user profile, deletes it, final sign-out |
| **Cleanup** (separate suite) | 01–04 | Automatically purges every test user created, except protected accounts (`admin`, `superadmin`) |

Every critical step attaches a **full-page screenshot** to the report (`testInfo.attach`), allowing the scenario to be replayed visually after the fact without re-running the tests.

## Technical highlights

- **Reusable helpers** (`hoverElement`, `clickElement`, `fillElement`) that systematically wrap `toBeVisible()` / `toBeEnabled()` checks before any interaction, to make tests reliable on an unstable network (Wi-Fi).
- **Telerik/Blazor workaround**: Playwright's standard `.hover()` isn't enough to trigger these components' tooltips/dropdowns; a real multi-step mouse movement (`mouse.move` with `steps`) was required.
- **Environment-driven configuration** (`BASE_URL`, `ADMIN_USERNAME`, `AD_GROUP_NAME`, `PROTECTED_USERS`, etc.) so no value is ever hardcoded - every variable falls back to a generic placeholder in this public repo.
- **Empirically tuned timeouts** (`navigationTimeout`, `actionTimeout`, `expect.timeout` at 20s) following instabilities observed on a Wi-Fi test environment, documented inline in `playwright.config.anonymized.ts`.
- **Automatic report archiving** (`zip-report.anonymized.js`): every CI run copies the HTML report into a timestamped folder (`archived-reports/YYYY-MM-DD_HH-mm-ss/`), preserving history without overwriting previous runs.

## HTML report anonymization

The `playwright-report.anonymized.html` file included here was post-processed so it can be shared publicly without exposing real data:

- every **screenshot** and **video** is blurred on load, labeled *"Screenshot/Video data has been intentionally left inaccessible"*;
- a click temporarily reveals them (`click` mode), so the report's structure can be inspected without disclosing real content by default;
- the report's underlying metadata (base64-embedded zip) is left **structurally untouched** - only a CSS/JS block is injected before `</body>`, without altering the underlying data.

## Tech stack

- [Playwright](https://playwright.dev/) `^1.60.0` (TypeScript)
- **Keycloak** authentication
- Headless CI via Microsoft Edge (`channel: 'msedge'`)
---

*This repository is a demonstration excerpt. Client name, URLs, credentials, and real test data have been systematically replaced with generic placeholders before publication. No license is granted - this code is shown for illustration purposes only and is not intended for reuse, adaptation, or redistribution.*
