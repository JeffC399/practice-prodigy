# Supabase Setup — Step-by-Step

> This walkthrough sets up the cloud database + user accounts that My Practice needs. You'll create two Supabase projects (dev + prod), get a handful of environment variables, and add them to Vercel. Takes about 30–45 minutes.

**Who this is for**: Jeff (or anyone unblocking My Practice Slice A). Zero technical background assumed. Every step spells out exactly what to click.

**When to do this**: before starting Slice A of the My Practice build. Ideally with about an hour of uninterrupted time.

**What you'll need**:
- A web browser
- Your GitHub account credentials (Supabase uses GitHub for sign-in)
- Access to the Practice Prodigy Vercel project

---

## What is Supabase?

Supabase is a hosted database + authentication service. It gives us:
- **Postgres** — the database where we'll store user profiles, routines, songs, and practice sessions.
- **Auth** — sign-in with email magic link, Google, or Apple, all handled for us.
- **Row-Level Security** — a built-in way to ensure users can only see their own data.

It's the same job Firebase does at Google or Amplify does at AWS — a "backend as a service" so we don't have to run our own database + auth server.

**Cost**: free up to ~50,000 monthly active users. We'll be well under that for the foreseeable future.

---

## Part 1 — Create your Supabase account

**Step 1.1**. Open your browser and go to [https://supabase.com](https://supabase.com).

**Step 1.2**. Click the **"Start your project"** button (usually top-right, big and green).

**Step 1.3**. On the sign-in screen, click **"Continue with GitHub"**. This opens GitHub in a new window/tab.

**Step 1.4**. GitHub will ask if you want to authorize Supabase. Click **"Authorize supabase"** (green button at the bottom).

**Step 1.5**. You'll be redirected back to Supabase. You're now signed in.

---

## Part 2 — Create the two projects (dev + prod)

We create TWO Supabase projects: one for development (where we can freely delete/reset data while building) and one for production (real users' data). They're the same shape; just different environments.

### Part 2A — Create the DEV project

**Step 2A.1**. On the Supabase dashboard, click the **"New project"** button.

**Step 2A.2**. You may be asked to pick an **Organization** — if you have a personal one already, use it. If not, create one called **"Practice Prodigy"**.

**Step 2A.3**. Fill in the project form:
- **Name**: `practice-prodigy-dev`
- **Database Password**: click the "Generate a password" link. **Copy this password to a safe place (password manager, encrypted notes, etc.)** — you'll rarely need it, but if you lose it there's no way to recover it, only to reset it.
- **Region**: pick the region closest to you geographically. If unsure, use `us-east-1` (US East — Virginia).
- **Pricing Plan**: Free.

**Step 2A.4**. Click **"Create new project"**. Supabase spends about 2 minutes provisioning the database. Grab water. Come back.

**Step 2A.5**. When the project is ready, you'll land on its dashboard. Bookmark this page — you'll come back often.

### Part 2B — Grab the DEV environment variables

While you're on the dev project dashboard:

**Step 2B.1**. In the left sidebar, click the **gear/settings icon** (near the bottom).

**Step 2B.2**. Click **"API"** in the settings sub-menu.

**Step 2B.3**. You'll see a page with several key pieces. Copy these into a notes file — you'll need them in Part 4:

- **Project URL** — looks like `https://abcdefghij.supabase.co`. Copy the whole URL.
- **`anon public` API key** — a long string starting with `eyJ...`. This is safe to expose in the browser. Copy the whole thing.
- **`service_role secret` API key** — another long `eyJ...` string. **This one is SECRET and gives full admin access to your database.** Copy it, but treat it like a password — never paste it anywhere public.

Label these in your notes:

```
SUPABASE_DEV_URL: https://abcdefghij.supabase.co
SUPABASE_DEV_ANON: eyJ...
SUPABASE_DEV_SERVICE_ROLE: eyJ...   <-- SECRET
```

### Part 2C — Create the PROD project

**Step 2C.1**. Go back to the Supabase dashboard (click the Supabase logo, top-left).

**Step 2C.2**. Click **"New project"** again.

**Step 2C.3**. Same form as before, but this time:
- **Name**: `practice-prodigy-prod`
- **Database Password**: generate a NEW one. Copy to your safe place. **Do not reuse the dev password.**
- **Region**: same region as dev (keeps latency consistent).
- **Pricing Plan**: Free.

**Step 2C.4**. Click **"Create new project"**. Another ~2-minute wait.

### Part 2D — Grab the PROD environment variables

Same drill as Part 2B, on the prod project:

**Step 2D.1**. Settings icon → API.

**Step 2D.2**. Copy the three values into your notes:

```
SUPABASE_PROD_URL: https://klmnopqrst.supabase.co
SUPABASE_PROD_ANON: eyJ...
SUPABASE_PROD_SERVICE_ROLE: eyJ...   <-- SECRET
```

You now have 6 pieces of information total (3 per project × 2 projects). Save these in a password manager if you have one.

---

## Part 3 — Configure authentication providers

Users will sign in with email magic link, Google, or Apple. Email works out of the box; Google + Apple need a bit of setup.

**For v1 Alpha (Slice B ships)**, we only strictly need email magic-link auth. Google + Apple can wait until closer to public beta (Slice F–G). If you want to keep this walkthrough short, **skip to Part 4 and come back to Part 3 later.**

### Part 3A — Enable email magic link (both projects)

**Step 3A.1**. On the DEV project dashboard, in the left sidebar, click the **shield icon** ("Authentication").

**Step 3A.2**. Click **"Providers"** in the sub-menu.

**Step 3A.3**. Scroll to find **"Email"** in the list. It should be **enabled by default** — you'll see a green toggle.

**Step 3A.4**. Click Email to expand it. Under "Confirm email", make sure the setting is **enabled** (so users must click the magic link before their account is created).

**Step 3A.5**. Save any changes.

**Step 3A.6**. Repeat 3A.1–3A.5 for the PROD project.

### Part 3B — Google sign-in (optional; needed by Slice G)

Requires a Google Cloud Console project + OAuth client. Google's process is well-documented. Skipping the walkthrough here since we don't need it until Slice G — I'll add it to this doc when we get there.

### Part 3C — Apple sign-in (optional; needed by Slice G)

Requires an Apple Developer account ($99/year). Same story — deferred until Slice G. I'll add walkthrough steps at that time.

---

## Part 4 — Add the environment variables to Vercel

The Practice Prodigy app runs on Vercel. To use Supabase, Vercel needs to know the URLs + keys. We'll add them via the Vercel dashboard.

**Step 4.1**. Open a browser tab to [https://vercel.com/dashboard](https://vercel.com/dashboard).

**Step 4.2**. Sign in if you're not already.

**Step 4.3**. Find and click the **practice-prodigy** project.

**Step 4.4**. In the top navigation, click **"Settings"**.

**Step 4.5**. In the left sidebar of Settings, click **"Environment Variables"**.

**Step 4.6**. You'll see a form to add a new env var. We'll add 6 variables. For each:
- Type the **Key** (name).
- Paste the **Value**.
- Under **Environments**, check which environments this var applies to (Development / Preview / Production).
- Click **Save**.

Add these six:

| Key | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your DEV project URL from Part 2B | Development, Preview |
| `NEXT_PUBLIC_SUPABASE_URL` | your PROD project URL from Part 2D | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your DEV `anon` key | Development, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your PROD `anon` key | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | your DEV `service_role` key | Development, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | your PROD `service_role` key | Production |

Notice: same variable name, different value per environment. Vercel supports this — when Vercel builds a Production deploy, it'll use the Production value; when it builds a Preview deploy (like a preview URL from a git push), it'll use the Preview value.

**Step 4.7**. While you're on this page, also add the feature flag:

| Key | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_MY_PRACTICE_ENABLED` | `true` | Development, Preview |
| `NEXT_PUBLIC_MY_PRACTICE_ENABLED` | `false` | Production |

This means: the My Practice module is visible on your dev environment + on preview URLs (so you can dogfood), but hidden in production until we're ready to launch. You'll flip the Production value to `true` at Slice H.

---

## Part 5 — Verify it worked

**Step 5.1**. Back in Vercel, go to the **Deployments** tab.

**Step 5.2**. Click **"Redeploy"** on the latest production deployment (or push a small commit — either way triggers a fresh build with the new env vars).

**Step 5.3**. When the deploy finishes, open the site.

**Step 5.4**. Try to navigate to `/my-practice`. In production, this should show a Next.js 404 page (because `NEXT_PUBLIC_MY_PRACTICE_ENABLED=false`). ✓

**Step 5.5**. Now open a preview URL (from a recent PR or from the Deployments tab — any URL ending in `.vercel.app` that isn't the main domain). Navigate to `/my-practice`. This should show the "Coming soon" card. ✓

**Step 5.6**. Check the module switcher (the dropdown in the top-right of any page):
- In production: My Practice appears as **"Designed"** (grayed out, not clickable).
- In preview: My Practice appears as **"Live"** (clickable, links to `/my-practice`).

If both behaviors work, you're done.

---

## Troubleshooting

### The 404 shows on the preview URL too

The env var didn't take effect. Common causes:
- The var was added AFTER the last deploy — click Redeploy in the Deployments tab.
- Typo in the variable name — must be **exactly** `NEXT_PUBLIC_MY_PRACTICE_ENABLED`. Case-sensitive, hyphen-vs-underscore matters.
- The value is `"true"` (with quotes) instead of `true`. Vercel stores env var values as plain strings; don't wrap in quotes.

### The "Coming soon" card shows in production

The Production value is `true` when it should be `false`. Go to Vercel → Settings → Environment Variables, click the `NEXT_PUBLIC_MY_PRACTICE_ENABLED` row for Production, edit to `false`, redeploy.

### I lost my database password

Go to Supabase → project → Settings → Database → "Reset database password". Generate a new one, save to your password manager.

### I lost my `service_role` key

Go to Supabase → project → Settings → API → click "Reset service_role key". Generate a new one. Update the Vercel env var. **Important**: this invalidates the old key immediately, so any live functions using the old key will break until you redeploy Vercel.

---

## What's next

Once this walkthrough is complete, Slice A of the My Practice build can start. The first code change (Slice A Phase A.1) wires the Supabase client using these env vars.

Come back to this doc when Slice G is close and I'll add Google + Apple sign-in walkthroughs then.
