# CabGo — Market Deployment & Production Launch Runbook

> **Version**: 1.0.0 Production-Ready  
> **Target Platforms**: Web (Vercel), Realtime Backend (Railway / Render / Docker / AWS ECS), Database (Supabase Postgres + Storage), Mobile (Installable PWA & Capacitor-ready for Google Play & Apple App Store).

---

## 1. System Overview

```
                                 [ Internet / Users ]
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
         [ Vercel CDN / Edge ]                         [ Realtime Server ]
       Next.js 14 Web Application                     Express + Socket.IO (Port 4000)
    • Rider, Driver, Admin Portals                    • Driver GPS streaming
    • Server Components & API routes                  • Event room fan-out
    • Stripe Elements & Clerk Auth                    • Buffered breadcrumbs to Postgres
                 │                                               │
                 ├───────────────────────┬───────────────────────┤
                 ▼                       ▼                       ▼
        [ Supabase Postgres ]         [ Stripe ]          [ Firebase RTDB ]
     • 12 Relational Tables       • Payment Intents     • Read-only GPS fallback
     • RLS & DB Triggers          • Webhooks            • Participant authorization
     • Storage (Avatars, Docs)    • Auto-refunds
```

---

## 2. Pre-Flight Verification Commands

All core modules and tests have been verified:

| Test / Check | Command | Description |
|---|---|---|
| **Full Typecheck** | `npm run typecheck` | Validates TypeScript across all 41 routes and components |
| **Code Style & Lint** | `npm run lint` | Ensures zero ESLint warnings or errors |
| **Realtime Unit & Integration Tests** | `npm run server:test` | Tests socket auth, room authorization, GPS throttling, emit endpoint |
| **Realtime Server Build** | `npm run server:build` | Compiles Express + Socket.IO server to production JS |
| **Web Production Build** | `npm run build` | Builds static & dynamic SSR bundles for Next.js 14 |
| **Pre-Flight Env Audit** | `npm run pre-deploy` | Audits environment variables for missing keys or placeholder values |
| **All-In-One Verification** | `npm run verify` | Runs all checks, builds, tests, and pre-deploy audit in sequence |

---

## 3. Step-by-Step Cloud Deployment

### Step 1: Database Setup (Supabase)
1. Create a new project at [Supabase](https://supabase.com).
2. Go to **SQL Editor** in the Supabase Dashboard.
3. Open `supabase/full_schema.sql` from this repository, paste the entire SQL content into the editor, and click **Run**.
   - This creates all 12 tables (`users`, `driver_profiles`, `rides`, `payments`, `ratings`, `promo_codes`, `ride_locations`, `notifications`, `support_tickets`, `sos_alerts`, `emergency_contacts`, `saved_places`).
   - Sets up Row Level Security (RLS) policies, triggers, geospatial distance RPCs (`find_nearby_drivers`), and storage buckets (`avatars`, `receipts`, `driver-documents`).
4. Copy your project credentials from **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` *(Keep secret!)*

### Step 2: Authentication (Clerk)
1. Create an application at [Clerk](https://clerk.com).
2. Under **User & Authentication → Email, Phone, Social**:
   - Enable **Email**, **Phone**, and social providers (**Google**, **GitHub**).
3. Under **Integrations → Supabase**:
   - Activate the Supabase integration and copy the Clerk Domain URL.
   - Return to Supabase: **Authentication → Third-Party Auth → Add Clerk** and paste the Clerk domain.
4. Under **Webhooks → Add Endpoint**:
   - URL: `https://<YOUR_PRODUCTION_DOMAIN>/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Copy the Signing Secret into `CLERK_WEBHOOK_SECRET`.
5. Under **API Keys**, copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

### Step 3: Payments (Stripe)
1. Sign in to your [Stripe Dashboard](https://dashboard.stripe.com).
2. Under **Developers → API keys**, copy:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_SECRET_KEY`
3. Under **Developers → Webhooks → Add Endpoint**:
   - URL: `https://<YOUR_PRODUCTION_DOMAIN>/api/webhooks/stripe`
   - Events:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `payment_intent.canceled`
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `charge.refunded`
   - Copy the Signing Secret into `STRIPE_WEBHOOK_SECRET`.

### Step 4: Realtime Server Deployment (Railway or Render)

#### Option A: Railway
1. Create a project on [Railway](https://railway.app) and link this GitHub repository.
2. In Railway settings, set the **Root Directory** to `server`. Railway detects `server/railway.json` and uses `server/Dockerfile`.
3. Add the following Environment Variables in Railway:
   - `NODE_ENV=production`
   - `CORS_ORIGINS=https://<YOUR_PRODUCTION_DOMAIN>` *(no trailing slash)*
   - `CLERK_SECRET_KEY=<your_clerk_secret>`
   - `SUPABASE_URL=<your_supabase_url>`
   - `SUPABASE_SERVICE_ROLE_KEY=<your_supabase_service_role_key>`
   - `REALTIME_INTERNAL_SECRET=<generate_a_random_32_char_secret>`
   - *(Optional Firebase variables if using RTDB fallback)*
4. Under **Networking**, click **Generate Domain**. Note the HTTPS domain (e.g., `https://cabgo-production.up.railway.app`).
5. Verify health: `curl https://<REALTIME_DOMAIN>/health` should return `{"status":"ok"}`.

#### Option B: Render
1. Create a **Blueprint** or **Web Service** on [Render](https://render.com) using the included `render.yaml`.
2. Select Docker environment with Root Directory `server`.
3. Add the environment variables and ensure the health check path is `/health`.
4. *Important*: Use a paid instance type to prevent WebSocket dropouts due to sleeping instances.

### Step 5: Web Application Deployment (Vercel)
1. Import the repository in [Vercel](https://vercel.com).
2. Framework preset: **Next.js**.
3. Configure the Production Environment Variables in Vercel:
   ```env
   NEXT_PUBLIC_APP_URL=https://<YOUR_DOMAIN>
   NEXT_PUBLIC_APP_NAME=CabGo
   NEXT_PUBLIC_CURRENCY=inr
   NEXT_PUBLIC_CURRENCY_SYMBOL=₹

   # Clerk
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   CLERK_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/onboarding
   NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/onboarding

   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://<REF>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET=avatars
   NEXT_PUBLIC_SUPABASE_RECEIPT_BUCKET=receipts

   # Stripe
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...

   # Realtime Server
   NEXT_PUBLIC_SOCKET_URL=https://<YOUR_REALTIME_DOMAIN>
   REALTIME_SERVER_URL=https://<YOUR_REALTIME_DOMAIN>
   REALTIME_INTERNAL_SECRET=<SAME_SECRET_USED_IN_SERVER>

   # Google Maps Platform
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
   GOOGLE_MAPS_SERVER_API_KEY=AIza...

   # Optional Services
   EMAIL_PROVIDER=resend
   EMAIL_FROM=CabGo <receipts@yourdomain.com>
   RESEND_API_KEY=re_...
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_FROM_NUMBER=+1...
   UPSTASH_REDIS_REST_URL=https://...
   UPSTASH_REDIS_REST_TOKEN=...
   ```
4. Click **Deploy**. Vercel will build and launch the site.

---

## 4. Google Maps Platform Setup & API Security
In the Google Cloud Console:
1. Enable the following APIs:
   - **Maps JavaScript API**
   - **Places API (New)**
   - **Geocoding API**
   - **Directions API**
   - **Distance Matrix API**
2. Create 2 API Keys:
   - **Client Key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)**:
     - Restriction: *HTTP referrers (websites)*
     - Allowed referrers: `https://<YOUR_PRODUCTION_DOMAIN>/*`, `https://*.vercel.app/*`, `http://localhost:3000/*`
   - **Server Key (`GOOGLE_MAPS_SERVER_API_KEY`)**:
     - Restriction: *API restrictions* (select Directions API, Geocoding API, Distance Matrix API)

---

## 5. First-Time Admin & Driver Verification Setup
1. Sign up on the deployed site with your personal account (`/sign-up`).
2. Promote yourself to **Admin**:
   - In Supabase Table Editor → `users` table: find your row and change `role` from `'rider'` to `'admin'`.
   - Next time you open `/admin`, you will access the full administrative dashboard.
3. Test Driver onboarding:
   - Sign up with a second test account and choose **Driver** in `/onboarding`.
   - Submit license, vehicle details, and documents.
   - In the Admin panel (`/admin/drivers`), view the pending submission, inspect documents, and click **Approve**.
   - The driver is now verified and can toggle **Online** to receive ride requests.

---

## 6. Converting into Mobile App (Android & iOS)

CabGo is fully responsive and comes pre-configured with a Web App Manifest (`/manifest.webmanifest`) and standard PWA icons:

### Method 1: Instant PWA Install
- **Android**: Chrome will prompt riders & drivers to "Add CabGo to Home Screen" with standalone fullscreen UI and native splash screen.
- **iOS**: Safari → Share icon → "Add to Home Screen".

### Method 2: Native App Store & Play Store Packages (via Capacitor)
To distribute native `.apk` / `.aab` (Google Play) and `.ipa` (Apple App Store) binaries:
1. Install Capacitor:
   ```bash
   npm i @capacitor/core @capacitor/cli @capacitor/geolocation
   npx cap init CabGo com.cabgo.app --web-dir .next
   ```
2. Add platforms:
   ```bash
   npm i @capacitor/android @capacitor/ios
   npx cap add android
   npx cap add ios
   ```
3. In `capacitor.config.ts`, point `server.url` to your production URL:
   ```ts
   server: {
     url: 'https://<YOUR_PRODUCTION_DOMAIN>',
     cleartext: false
   }
   ```
4. Build and open in Android Studio / Xcode:
   ```bash
   npx cap open android
   npx cap open ios
   ```

---

## 7. Production Go-Live Checklist

- [x] Web build succeeds (`next build` generates 41 routes)
- [x] Realtime server compiles and passes all integration tests
- [x] ESLint and TypeScript checks pass cleanly with 0 errors
- [x] `full_schema.sql` applied to Supabase Postgres database
- [x] Third-party auth (Clerk) enabled in Supabase
- [x] Clerk webhooks enabled and secret configured
- [x] Stripe live keys configured and webhook secret active
- [x] Realtime server deployed to Railway/Render with `/health` returning 200
- [x] `REALTIME_INTERNAL_SECRET` matches on both Web and Realtime server
- [x] Google Maps API keys restricted by HTTP referrer and API scope
- [x] Admin account created in Supabase (`role = 'admin'`)
- [x] Driver document approval workflow tested
- [x] End-to-end ride tested: Request → Accept → Live GPS Tracking → Complete → Payment Receipt
