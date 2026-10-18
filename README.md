# CabGo

A production-grade, Uber/Ola/Rapido-style cab booking platform with three role-based apps — **Rider**, **Driver** and **Admin** — live tracking, Stripe payments, SOS, promo codes, support and a full analytics dashboard.

| Layer | Tech |
| --- | --- |
| Web app | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · shadcn/ui · Radix · Framer Motion · Zustand · React Hook Form + Zod · Recharts |
| Auth | Clerk (email, phone, Google, GitHub) |
| Database | Supabase Postgres (RLS, triggers, RPCs) + Supabase Storage |
| Live tracking | Express + Socket.IO (`/server`) with a Firebase Realtime Database fallback |
| Payments | Stripe (Payment Intents, Checkout, webhooks, refunds) |
| Maps | Google Maps JS, Places, Directions, Geocoding, Distance Matrix |
| Email / SMS | Resend or SMTP (Nodemailer) · Twilio (SOS, optional) |
| Hosting | Vercel (web) · Railway or Render (realtime server) |

---

## Contents

1. [Architecture](#architecture)
2. [Features](#features)
3. [Quick start](#quick-start)
4. [Service setup](#service-setup) — Clerk · Supabase · Firebase · Stripe · Google Maps · Email · Twilio · Upstash
5. [Environment variables](#environment-variables)
6. [Scripts and tests](#scripts-and-tests)
7. [Project structure](#project-structure)
8. [API reference](#api-reference)
9. [Business rules](#business-rules)
10. [Deployment](#deployment)
11. [Security model](#security-model)
12. [Scaling and known limitations](#scaling-and-known-limitations)
13. [Troubleshooting](#troubleshooting)

---

## Architecture

```
                      ┌────────────────────────────────────────────┐
   Browser            │  Next.js (Vercel)                          │
 ┌────────────┐ HTTPS │  • Server Components + route handlers      │
 │ Rider      │──────▶│  • Clerk middleware (role gating)          │
 │ Driver     │       │  • Zod-validated, rate-limited /api/*      │
 │ Admin      │       └───────┬───────────────┬───────────┬────────┘
 └─────┬──────┘               │ service role  │ webhooks  │ POST /realtime/emit
       │                      ▼               │           │ (shared secret)
       │ WebSocket     ┌─────────────┐  Stripe/Clerk       ▼
       │ (Clerk JWT)   │  Supabase   │               ┌───────────────────────┐
       └──────────────▶│  Postgres   │◀──────────────│  Express + Socket.IO  │
       │               │  + Storage  │  breadcrumbs  │  (Railway / Render)   │
       │               └─────────────┘               └──────────┬────────────┘
       │ read-only listeners                                    │ Admin SDK (only writer)
       │ (custom token from /auth/firebase-token)               ▼
       └────────────────────────────────────────────────▶ Firebase Realtime DB
```

* **Next.js is the source of truth.** Every mutation (book, accept, status change, pay, rate, SOS…) is a validated API route that talks to Postgres with the service-role key after authorising the Clerk user and loading their CabGo row. The browser never gets write access to money, ride state or roles.
* **Express + Socket.IO is the real-time fan-out.** Next.js pushes events (`ride:requested`, `ride:accepted`, `ride:status`, `payment:updated`, `sos:alert`, …) to `POST /realtime/emit`; the server delivers them to rooms (`user:<id>`, `ride:<id>`, `drivers:online`, `role:admin`). Drivers stream GPS over the socket; the server buffers breadcrumbs into `ride_locations` and mirrors positions to Firebase.
* **Firebase is a read-only fallback.** If a rider's socket is down for more than four seconds, the tracking map switches to Firebase listeners. Only the Express server (Admin SDK) writes there. Security rules let a ride's rider, its driver and admins read it.
* **Resilience.** Emits are best-effort — if the realtime server is down, clients poll (every 4 s without a socket, 15 s with one), so no flow depends on WebSockets.

## Features

| # | Feature | Where |
| --- | --- | --- |
| 1 | Auth with role selection (rider / driver), suspended-account screen | `src/middleware.ts`, `src/app/onboarding`, Clerk webhook |
| 2 | Booking with up to 3 stops, 4 vehicle classes and surge pricing | `/rider/book`, `src/lib/fare.ts`, `/api/fare-estimate` |
| 3 | Driver matching within 5 km (auto-expands to 10 km, 30 s timeout) | `find_nearby_drivers` RPC, `src/lib/rides` |
| 4 | Real-time tracking (Socket.IO → Firebase fallback) | `/rider/tracking/[rideId]`, `/server` |
| 5 | Stripe payments (Elements + Checkout), emailed receipts + printable receipt page, refunds | `/rider/payments`, `/api/payments/*` |
| 6 | Two-way ratings with tags (completed rides, 7-day window) | `/api/ratings` |
| 7 | Ride history with filters, receipts and re-book | `/rider/history`, `/driver/rides` |
| 8 | Cancellation with a 2-minute free window, then a flat fee | `/api/rides/[id]/cancel` |
| 9 | SOS button — stores an alert, notifies emergency contacts by SMS, alerts admins live | `/api/sos`, `/admin/sos` |
| 10 | Promo codes (flat / percentage, caps, usage limits, validity window) | `/api/promo/validate`, `/admin/promo` |
| 11 | Support tickets with admin responses | `/rider/support`, `/driver/support`, `/admin/support` |
| 12 | In-app + live notifications (bell, toasts, unread counts) | `/api/notifications`, `NotificationBell` |
| 13 | Admin dashboard — KPIs, charts, users, driver verification, rides, payments, promos, SOS, support, CSV export | `/admin/*` |
| 14 | Saved places (home / work / custom) | `/api/saved-places` |
| 15 | Dark mode (system / light / dark), persisted | `ThemeToggle`, `next-themes` |

Driver extras: online toggle, ride-request feed with accept / decline, earnings with charts, document upload, verification status.

## Quick start

Prerequisites: **Node 20+**, a Clerk app, a Supabase project, and (for the full experience) Stripe, Google Maps and Firebase accounts. Everything except Clerk and Supabase degrades gracefully when unset (demo places instead of Google search, no SMS, no Firebase fallback…).

```bash
# 1. Install
npm install
npm run server:install

# 2. Configure
cp .env.example .env.local          # web app
cp server/.env.example server/.env  # realtime server
# …fill in the values (see "Service setup")

# 3. Create the schema — Supabase dashboard → SQL editor → run, in order:
#    supabase/migrations/001_…sql  →  009_…sql
#    (or: supabase db push, if you use the Supabase CLI)

# 4. (optional) demo data around Hyderabad
npm run seed

# 5. Run both servers
npm run dev:all        # web on :3000, realtime on :4000
```

Open http://localhost:3000, sign up, choose a role. To get an **admin**, set your user's `role` to `admin` in Supabase (Table editor → `users`) — or run the seed with `SEED_ADMIN_CLERK_ID=<your Clerk user id>`.

## Service setup

### Clerk

1. Create an application and enable **Email**, **Phone**, **Google** and **GitHub** under *User & Authentication*.
2. Copy the publishable and secret keys into `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` (and `CLERK_SECRET_KEY` in `server/.env`).
3. **Webhook** — *Webhooks → Add endpoint* → `https://<your-domain>/api/webhooks/clerk`, events `user.created`, `user.updated`, `user.deleted`. Put the signing secret in `CLERK_WEBHOOK_SECRET`. This keeps the `users` table in sync (the app also self-heals on first request if a webhook was missed).
4. **Supabase integration** — in Clerk, *Integrations → Supabase → Activate*; copy the Clerk domain it shows. This makes Clerk session tokens carry the `role: authenticated` claim that Supabase RLS needs.

### Supabase

1. Create a project; copy the URL, anon key and **service-role key** (server-only).
2. **Third-party auth** — *Authentication → Sign In / Up → Third-Party Auth → Add → Clerk* and paste your Clerk domain. RLS policies identify the user through `auth.jwt() ->> 'sub'` (the Clerk user id), never through `auth.uid()`.
3. Apply `supabase/migrations/001…009` in order. They create the 12 tables (`users`, `driver_profiles`, `rides`, `payments`, `ratings`, `promo_codes`, `ride_locations`, `notifications`, `support_tickets`, `sos_alerts`, `emergency_contacts`, `saved_places`), enums, indexes, triggers, RPCs, RLS policies, Storage buckets (`avatars` public; `receipts` and `driver-documents` private) and Realtime publication entries.
4. Migrations are verified in CI against a vanilla Postgres with a small Supabase stand-in (`supabase/ci/supabase-stub.sql`).

> Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. It lives only in Vercel's server env and the realtime server.

### Firebase Realtime Database

1. Create a project and a Realtime Database; copy the web-app config into `NEXT_PUBLIC_FIREBASE_*`.
2. *Project settings → Service accounts → Generate new private key*. Put `project_id`, `client_email`, `private_key` into **`server/.env`** (`FIREBASE_ADMIN_*`, plus `FIREBASE_DATABASE_URL`). Only the Express server needs them.
3. **Deploy the security rules** (important — default rules are open or closed, not CabGo's):
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use <your-project-id>
   firebase deploy --only database
   ```
4. Data model (written exclusively by the server):
   ```
   driverLocations/{driverId}                  → readable by rider/admin roles
   rides/{rideId}/driverLocation | status | trail
   rideParticipants/{rideId}/{userId} = true   → who may read rides/{rideId}
   ```
   The browser signs in with a custom token from `POST /auth/firebase-token` (uid = CabGo user id, claim `role`). `rideParticipants` is derived from the same event that moves the ride (rider + assigned driver); drivers who merely *received* a request never become participants. A driver's "online" flag is cleared 20 s after their last socket drops.

### Stripe

1. Copy the test keys into `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY`.
2. Local webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` → copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
3. **Production**: *Developers → Webhooks → Add endpoint* → `https://<your-domain>/api/webhooks/stripe`, events:
   `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`. Use that endpoint's signing secret in Vercel.
4. Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (declined), `4000 0025 0000 3155` (3-D Secure).

Payment safety: one non-refunded payment row per ride (partial unique index), idempotency keys on every Stripe write, the amount is always recomputed on the server, and the webhook is the final authority (the confirm endpoint just fast-forwards it).

### Google Maps Platform

Enable **Maps JavaScript API**, **Places API (New)**, **Geocoding API**, **Directions API** and **Distance Matrix API**.

* `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — browser key, restrict by *HTTP referrer* (your domains + `localhost:3000`).
* `GOOGLE_MAPS_SERVER_API_KEY` — server key, restrict by API (and by IP if your host has static egress).

Without valid keys the app falls back to a built-in set of Hyderabad places and straight-line (haversine) route estimates, and the tracking map shows a "Map preview unavailable" card — handy for development.

### Email (receipts)

Set `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` (verify your sending domain), or `EMAIL_PROVIDER=smtp` + `SMTP_*`. `EMAIL_FROM` must be an address on a verified domain. Without a provider, receipts are generated but not emailed.

### Twilio (SOS SMS — optional)

`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. Numbers entered without `+` get `NEXT_PUBLIC_DEFAULT_COUNTRY_CODE` (default `+91`). Without Twilio the alert is still stored and shown to admins in real time; the SOS sheet tells the rider the contacts were not texted.

### Upstash Redis (rate limiting — recommended in production)

Create a free Redis database at Upstash and set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. Without them, counters live in each server instance's memory — fine for local use, but on Vercel every lambda has its own counter, so limits would be loose. If Redis is unreachable the limiter fails **open** (falls back to memory) instead of taking the API down.

## Environment variables

All variables are documented inline in [`.env.example`](.env.example) and [`server/.env.example`](server/.env.example). Summary:

| Variable | Where | Required | Purpose |
| --- | --- | :-: | --- |
| `NEXT_PUBLIC_APP_URL` | web | ✔ | Canonical URL (SEO, Stripe redirects, emails) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | web (+ secret on server) | ✔ | Auth |
| `CLERK_WEBHOOK_SECRET` | web | ✔ | Verify Clerk webhooks |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | ✔ | Browser Supabase client (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | web + server | ✔ | Trusted DB access — **secret** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | web | ✔ | Payments |
| `NEXT_PUBLIC_SOCKET_URL` | web | ✔ | Public URL of the realtime server (`https://…`) |
| `REALTIME_SERVER_URL` | web | ✔ | Same server, as called by Next.js route handlers |
| `REALTIME_INTERNAL_SECRET` | web + server | ✔ | Shared secret for `/realtime/emit` (≥ 16 chars) |
| `CORS_ORIGINS` | server | ✔ | Comma-separated allowed web origins |
| `NEXT_PUBLIC_FIREBASE_*` | web | optional | Firebase read-only fallback |
| `FIREBASE_DATABASE_URL`, `FIREBASE_ADMIN_*` | server | optional | Firebase writer + custom tokens |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_API_KEY` | web | optional | Maps (demo fallback otherwise) |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`, `NEXT_PUBLIC_MAPS_REGION` | web | optional | Map styling · geocoding region bias |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` / `SMTP_*` | web | optional | Receipt emails |
| `TWILIO_*`, `NEXT_PUBLIC_DEFAULT_COUNTRY_CODE` | web | optional | SOS SMS |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | web | optional | Shared rate-limit counters |
| `NEXT_PUBLIC_CURRENCY`, `NEXT_PUBLIC_CURRENCY_SYMBOL`, `NEXT_PUBLIC_TIMEZONE` | web | optional | Localisation (defaults: INR, ₹, Asia/Kolkata) |
| `MATCHING_RADIUS_KM`, `MATCHING_EXPANDED_RADIUS_KM`, `MATCHING_TIMEOUT_SECONDS` | web | optional | Driver matching (5 / 10 / 30) |
| `FREE_CANCELLATION_SECONDS`, `CANCELLATION_FEE`, `PLATFORM_COMMISSION_PERCENT` | web | optional | Cancellation + commission (120 / 50 / 20) |

`NEXT_PUBLIC_*` values are inlined at build time — redeploy after changing them.

## Scripts and tests

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run server:dev` / `npm run dev:all` | Web, realtime server, or both |
| `npm run typecheck` · `npm run lint` | `tsc --noEmit` · ESLint (`@typescript-eslint/no-explicit-any` is an **error**) |
| `npm run build` · `npm start` | Production build / serve |
| `npm run seed` | Idempotent demo data (admin, riders, drivers, ~45 rides, payments, ratings…) |
| `npm run server:test` | Realtime server tests (auth, rooms, emit security, Firebase participants, buffering) |
| `npm run server:typecheck` · `npm run server:build` | Type-check / compile the server |

CI (`.github/workflows/ci.yml`) runs web typecheck + lint + build, server typecheck + tests + build, and applies all migrations to a fresh Postgres.

## Project structure

```
cabgo/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/sign-in · sign-up        Clerk screens
│  │  ├─ onboarding/ · suspended/        Role selection · blocked accounts
│  │  ├─ (dashboard)/
│  │  │  ├─ rider/    book · tracking/[rideId] · history · payments · support · profile · settings
│  │  │  ├─ driver/   dashboard · rides · earnings · ratings · support · profile · settings
│  │  │  └─ admin/    overview · users · drivers · rides · payments · promo · sos · support · settings
│  │  ├─ api/                            Route handlers (see API reference)
│  │  └─ layout · page (landing) · loading · error · global-error · not-found · sitemap · robots · manifest
│  ├─ components/   ui (shadcn) · layout · landing · shared · maps · ride · driver · payment · rating
│  │                safety · support · promo · profile · notifications · admin · providers · auth
│  ├─ lib/          api · api-client · auth · rate-limit · validations · fare · constants · utils
│  │                supabase · firebase · stripe · google-maps · rides · drivers · payments · ratings
│  │                safety · support · admin · email · sms · notifications · feedback
│  ├─ hooks/        sockets, tracking, location, notifications, ride lifecycle…
│  ├─ store/        useBookingStore · useUserStore (Zustand)
│  ├─ types/        Database + domain types
│  └─ middleware.ts Clerk auth, onboarding and role gating
├─ server/          Express + Socket.IO (src/{app,config,routes,socket,services,middleware}) · Dockerfile · railway.json
├─ supabase/        migrations/001–009 · seed.ts · ci/supabase-stub.sql
├─ database.rules.json · firebase.json
├─ vercel.json · render.yaml · .github/workflows/ci.yml · .nvmrc
└─ .env.example
```

## API reference

All routes require a Clerk session (except webhooks), validate input with Zod and answer with `{ success: true, data }` or `{ success: false, error, details? }`. Mutations are rate limited (429 + `Retry-After`).

| Route | Methods | Roles | Notes |
| --- | --- | --- | --- |
| `/api/onboarding` | POST | any | Choose rider/driver (once) |
| `/api/users/me` | GET, PATCH | any | Profile |
| `/api/upload` | POST | any | Avatars, driver documents (signed, type + size checked) |
| `/api/fare-estimate` | POST | rider | Distance, ETA, surge, per-vehicle fares |
| `/api/geocode` | GET | any | Address search / reverse geocode |
| `/api/drivers/nearby` · `/api/drivers/[id]` | GET | rider | Online drivers within radius · driver card |
| `/api/rides` | GET, POST | rider (POST) | History · book (server-priced, 409 if the quoted fare drifted) |
| `/api/rides/[id]` | GET | participants, admin | Ride detail |
| `/api/rides/[id]/search` | POST | rider | Re-run matching with a wider radius |
| `/api/rides/[id]/accept` | POST | driver | Atomic accept (`accept_ride` RPC) |
| `/api/rides/[id]/status` | POST | driver | `arrived → in_progress → completed` |
| `/api/rides/[id]/cancel` | POST | rider, driver | Free ≤ 2 min after acceptance, fee afterwards |
| `/api/driver/{profile,status,location,feed}` | GET/POST/PATCH | driver | Registration, online toggle, GPS, request feed |
| `/api/payments/{create-intent,checkout,confirm}` | POST | rider | Payment Intent · Checkout session · confirm |
| `/api/payments/history` · `/[id]/receipt` | GET | rider, driver, admin | History · receipt data |
| `/api/payments/[id]/refund` | POST | admin | Full refund (idempotent) |
| `/api/promo/validate` | POST | rider | Validate a code against a fare |
| `/api/ratings` | POST, GET | rider, driver | Rate a completed ride · my ratings |
| `/api/sos` · `/api/sos/[id]` | POST, GET · PATCH | participants · admin | Raise (idempotent) · resolve |
| `/api/emergency-contacts` (+ `/[id]`) | GET, POST · DELETE | any | Up to 5 contacts |
| `/api/saved-places` (+ `/[id]`) | GET, POST · DELETE | any | Home / work / custom |
| `/api/support` (+ `/[id]`) | GET, POST · GET | any | Tickets (max 10 open) |
| `/api/notifications` | GET, PATCH | any | List · mark read |
| `/api/admin/users/[id]` | PATCH | admin | Suspend / reinstate |
| `/api/admin/drivers/[id]` | PATCH | admin | Approve / reject (reason required) |
| `/api/admin/rides/[id]/cancel` | POST | admin | Cancel any live ride (no fee) |
| `/api/admin/promo` (+ `/[id]`) | GET, POST · PATCH, DELETE | admin | Promo CRUD |
| `/api/admin/sos/[id]` · `/api/admin/support/[id]` | PATCH | admin | Resolve alert · answer ticket |
| `/api/admin/export` | GET | admin | CSV (`rides`, `payments`, `users`) |
| `/api/webhooks/clerk` · `/api/webhooks/stripe` | POST | signed | Svix / Stripe signatures |

Realtime server (`/server`): `GET /health`, `POST /auth/firebase-token` (Clerk bearer), `POST /realtime/emit` (shared secret), Socket.IO on the same port.

## Business rules

| Rule | Default | Env |
| --- | --- | --- |
| Matching radius, expanded radius | 5 km, 10 km | `MATCHING_RADIUS_KM`, `MATCHING_EXPANDED_RADIUS_KM` |
| Driver response window | 30 s | `MATCHING_TIMEOUT_SECONDS` |
| Free cancellation (after driver accepts) | 120 s | `FREE_CANCELLATION_SECONDS` |
| Cancellation fee afterwards | ₹50 | `CANCELLATION_FEE` |
| Platform commission | 20 % (driver keeps 80 %) | `PLATFORM_COMMISSION_PERCENT` |
| Surge multiplier | 1.0× – 3.0× from nearby supply / demand | `SURGE_MIN` / `SURGE_MAX` in `src/lib/constants.ts` |
| Stops per ride | 0–3 | schema check |
| Active rides per rider | 1 | enforced in `rides` service |
| Ratings | completed rides, within 7 days, final | `ratings` service |
| Open support tickets per user | 10 | `support` service |
| Promo codes | flat or %, `max_discount`, `min_fare`, `max_uses`, validity window; locked once used | `validate_promo_code` RPC |
| Rate limits (per user, IP fallback) | reads 180/min · writes 60/min · payments 12/min · SOS 10/min · uploads 15/min · promo 20/min · maps 60/min | `RATE_LIMITS` in `src/lib/rate-limit.ts` |

## Deployment

### 1. Realtime server → Railway **or** Render

**Railway**
1. *New project → Deploy from GitHub*, set the **root directory** to `server`. `server/railway.json` selects the Dockerfile and `/health` as the health check.
2. Add the variables from `server/.env.example` (`CORS_ORIGINS=https://<your-vercel-domain>`, `CLERK_SECRET_KEY`, `SUPABASE_*`, `REALTIME_INTERNAL_SECRET`, optional `FIREBASE_*`). Railway injects `PORT`.
3. *Settings → Networking → Generate domain*. Note the `https://…up.railway.app` URL.

**Render**
1. *New → Blueprint* and pick this repo; `render.yaml` defines the `cabgo-realtime` web service (Docker, root `server`, health `/health`, one instance).
2. Fill the `sync: false` variables in the dashboard. Use a paid plan: free instances sleep and drop WebSockets.

Run **one** instance (see [scaling](#scaling-and-known-limitations)). Locally you can test the image with `docker build -t cabgo-realtime ./server && docker run --env-file server/.env -p 4000:4000 cabgo-realtime`.

### 2. Web app → Vercel

1. *Import project*, framework **Next.js** (`vercel.json` pins the Mumbai region `bom1` and a 30 s function limit).
2. Add every variable from `.env.example` for *Production* (and *Preview* if you want previews to work). In particular:
   `NEXT_PUBLIC_APP_URL=https://<your-domain>`, `NEXT_PUBLIC_SOCKET_URL=https://<realtime-domain>`, `REALTIME_SERVER_URL=https://<realtime-domain>`, the same `REALTIME_INTERNAL_SECRET` as the server, live (not test) Clerk/Stripe keys when you go live.
3. Deploy.

### 3. Post-deploy checklist

- [ ] All nine migrations applied; third-party auth for Clerk enabled in Supabase.
- [ ] Clerk webhook → `https://<domain>/api/webhooks/clerk` returns 200 on *Send test*.
- [ ] Stripe webhook → `https://<domain>/api/webhooks/stripe` with the events listed above; secret set on Vercel.
- [ ] `firebase deploy --only database` run (rules deployed).
- [ ] `GET https://<realtime-domain>/health` returns `{ "status": "ok" }`; `CORS_ORIGINS` contains the exact web origin (scheme + host, no trailing slash).
- [ ] Browser Maps key restricted to your domain; server key restricted to the needed APIs.
- [ ] Email domain verified; Twilio sender approved for your destination country.
- [ ] Upstash Redis configured.
- [ ] Promoted one account to `role = 'admin'` and verified a driver (Admin → Drivers).
- [ ] Book a test ride end to end: request → accept → track → complete → pay → rate → receipt email.

## Security model

* **Authorisation in depth.** Clerk middleware gates pages and API paths by role; every route re-checks with `requireApiUser(roles)`; RLS policies protect any direct browser access to Supabase; triggers stop users from changing their own role, `is_active`, verification status or ratings.
* **Server-only writes.** Fare, discount, commission and ride-state transitions are computed server-side. The client sends `expectedTotal` so a stale price yields a 409, never a silent charge.
* **Signed webhooks** (Svix for Clerk, Stripe signature + raw body) and idempotent handlers.
* **Realtime.** Socket handshakes are verified with Clerk; clients may only join their own `user:` room and rides they participate in; drivers' location events are accepted from drivers only; at most 8 sockets per user; `/realtime/emit` requires the shared secret (constant-time comparison).
* **Firebase rules** deny all browser writes; reads are limited to ride participants/admins; driver locations are readable by riders/admins only.
* **Uploads** are type- and size-checked; driver documents live in a private bucket and are served through short-lived signed URLs.
* **Rate limiting** on every API route (see table), with `429` + `Retry-After`; webhooks are exempt (signature-verified).
* **Headers**: `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in production.
* **CSV export** neutralises spreadsheet formula injection.
* **Content-Security-Policy** is intentionally *not* enforced: Clerk, Stripe Elements, Google Maps and Firebase each inject scripts/frames/styles from several origins, and a wrong CSP breaks sign-in or payments silently. If you want one, start with `Content-Security-Policy-Report-Only` and allow at least: `clerk.accounts.dev`/your Clerk domain, `challenges.cloudflare.com`, `js.stripe.com`, `hooks.stripe.com`, `maps.googleapis.com`, `maps.gstatic.com`, `*.googleapis.com`, `*.firebaseio.com`, your Supabase project URL and the realtime server (`connect-src` for `https://` and `wss://`), plus `img.clerk.com`, `lh3.googleusercontent.com`.

## Scaling and known limitations

* **Socket.IO is single-instance.** Presence, rooms and breadcrumb buffers are in memory, so run exactly one instance (vertical scaling goes a long way: a 512 MB instance holds thousands of sockets). To scale horizontally, add `@socket.io/redis-adapter` (pub/sub for rooms) and move presence counters to Redis; the `POST /realtime/emit` path then works on any instance.
* **Realtime is best-effort by design.** If the server restarts, clients reconnect and re-sync via the polling endpoints; no state is lost because Postgres is authoritative.
* **Firebase "offline" cleanup** runs ~20 s after a driver's last socket disconnects.
* **A suspended user's already-open socket** keeps working until it reconnects; every API call is rejected immediately, and the next handshake is refused.
* **Without Upstash**, rate-limit counters are per server instance.
* **Google Maps**: legacy Places/Directions are unavailable on new GCP projects, so Places is used client-side via the new library and Directions is called server-side with a haversine fallback.
* **Payments** are card/UPI via Stripe only; cash rides and driver payouts (Stripe Connect) are out of scope — earnings are tracked in the database.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Redirect loop after sign-in | The user's `onboarding_completed` is false → complete `/onboarding`; check the Clerk webhook and `SUPABASE_SERVICE_ROLE_KEY`. |
| `401` from Supabase in the browser | Enable Clerk as third-party auth in Supabase and activate the Clerk → Supabase integration. |
| Map says "Map preview unavailable" | Set a valid `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (starts with `AIza`) and enable the Maps JavaScript API. |
| Live tracking never connects | `NEXT_PUBLIC_SOCKET_URL` must be `https://…`; add the web origin to `CORS_ORIGINS`; check `/health`. |
| Firebase `PERMISSION_DENIED` | Deploy `database.rules.json`; confirm the realtime server has the Firebase Admin variables (it writes `rideParticipants`). |
| Stripe `402` when booking | The rider has an unpaid completed ride — pay it first (by design). |
| `429 Too Many Requests` | You hit a rate limit; honour `Retry-After`. Tune `RATE_LIMITS` if needed. |
| `next build` fails on the Clerk key | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` must be a validly formatted `pk_test_…`/`pk_live_…` key at build time. |

---

Built with care for the road. Licensed for your own use — adapt freely.
