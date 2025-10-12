# Quickstart — Custom Light & Dark Mode Preferences

1. **Start the stack**
   ```bash
   pnpm install
   pnpm dev
   ```
2. **Seed a test user** (if none exists) via existing auth flow; sign in with GitHub or credentials.
3. **Open Account settings** (`/dashboard/account`).
4. **Verify first-load prompt**
   - Clear the new `theme_preferences` table (or use a new user).
   - Reload the page: confirm dark mode renders and a 10-second prompt appears offering light mode.
5. **Toggle theme**
   - Use the theme control to switch to light mode.
   - Confirm UI updates instantly and preference persists after refresh.
6. **High-contrast simulation**
   - Enable OS-level high-contrast (or emulate via browser dev tools).
   - Reload account page: verify system colors override palette while text remains readable.
7. **Run regression checks**
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm playwright test --grep "theme"
   ```
   (Playwright tag to be added in tasks.)
8. **Lighthouse sanity**
   - Run `pnpm lighthouse` against `/dashboard/account` in both themes and confirm ≥ 90 scores.

