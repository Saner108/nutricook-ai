# Apple Sign-In Setup Guide

Apple sign-in is already wired in the app (v3.2.0). You just need to configure
the Apple provider in Supabase and register the app with Apple.

---

## Step 1 — Apple Developer Account

1. Go to [developer.apple.com](https://developer.apple.com) → Certificates, Identifiers & Profiles
2. **Create an App ID:**
   - Identifiers → + → App IDs → App
   - Bundle ID: `com.nutricook.app` (or your preference)
   - Enable **Sign In with Apple** capability → Save
3. **Create a Services ID** (this is what web apps use):
   - Identifiers → + → Services IDs
   - Description: `NutriCook AI`
   - Identifier: `com.nutricook.web` (must be different from App ID)
   - Enable **Sign In with Apple** → Configure:
     - Primary App ID: select the App ID from step 2
     - Domains: `<your-supabase-project>.supabase.co`
     - Return URLs: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
   - Save
4. **Create a Key:**
   - Keys → + → name it `NutriCook Sign In with Apple`
   - Enable **Sign In with Apple** → Configure → select your App ID
   - Download the `.p8` key file — **you can only download this once**
   - Note the **Key ID**

---

## Step 2 — Supabase Configuration

1. Supabase dashboard → your project → **Authentication → Providers → Apple**
2. Toggle **Enable Apple provider**
3. Fill in:
   - **Services ID:** `com.nutricook.web` (the Services ID from Step 1)
   - **Team ID:** found top-right in your Apple Developer account (10-char string)
   - **Key ID:** from the key you created in Step 1
   - **Private Key:** paste the full contents of the `.p8` file
4. Save

---

## Step 3 — Verify

1. Open the live app at `https://nutricook-ai-kappa.vercel.app`
2. Sign out if logged in
3. Tap **Continue with Apple** — you should see Apple's native sign-in sheet
4. Complete sign-in — you'll land on onboarding or Home

---

## Troubleshooting

| Error | Fix |
|---|---|
| "invalid_client" | Services ID doesn't match what's in Supabase, or domain isn't registered |
| Redirect loop | Return URL in Apple config must exactly match `https://<project>.supabase.co/auth/v1/callback` |
| Button does nothing | Apple provider not enabled in Supabase — check the toggle is on and saved |
| Works locally, fails in production | Supabase callback URL must use the production Supabase project URL, not localhost |

---

## Note on Email Confirmation

For the smoothest experience, also toggle off **"Confirm email"** in Supabase →
Authentication → Email → uncheck "Confirm email". This lets email/password signups
land directly in the app without a confirmation step.
