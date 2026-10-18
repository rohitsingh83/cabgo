/**
 * CabGo — database seed.
 *
 *   npm run seed
 *
 * Creates realistic demo data around Hyderabad: 1 admin, 4 riders, 7 drivers (5 verified &
 * online, 1 pending, 1 rejected), promo codes, ~45 completed rides spread over the last 30
 * days (with payments, ratings and GPS breadcrumbs), an open ride request, a cancelled ride,
 * notifications, support tickets, an SOS alert, saved places and emergency contacts.
 *
 * The script is IDEMPOTENT: it first deletes rows belonging to previously seeded users
 * (clerk_id starting with `seed_`) and the seeded promo codes, then re-inserts everything.
 *
 * Seeded users are NOT real Clerk accounts. To log in as the seeded admin, set
 * SEED_ADMIN_CLERK_ID in .env.local to your own Clerk user id before running the seed.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

import type {
  Database,
  FareBreakdown,
  NotificationData,
  RideStop,
  VehicleType,
} from '../src/types';

config({ path: '.env.local' });
config({ path: '.env' });

/* ---------------------------------------------------------------------- */
/* Setup                                                                   */
/* ---------------------------------------------------------------------- */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || SUPABASE_URL.includes('your-project-ref')) {
  console.error(
    '✖ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local before seeding.',
  );
  process.exit(1);
}

const db = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Tables = Database['public']['Tables'];
type UserInsert = Tables['users']['Insert'];
type RideInsert = Tables['rides']['Insert'];
type PaymentInsert = Tables['payments']['Insert'];
type RatingInsert = Tables['ratings']['Insert'];
type NotificationInsert = Tables['notifications']['Insert'];
type RideLocationInsert = Tables['ride_locations']['Insert'];

/** Throws a readable error if a Supabase call failed, otherwise returns the data. */
function must<T>(result: { data: T | null; error: { message: string } | null }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${label}: no data returned`);
  return result.data;
}

function log(message: string): void {
  console.log(`  ✔ ${message}`);
}

/* ---------------------------------------------------------------------- */
/* Deterministic randomness (same data on every run)                       */
/* ---------------------------------------------------------------------- */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261018);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T;
const between = (min: number, max: number): number => min + rand() * (max - min);
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Date `daysBack` days ago at a given local-ish hour. */
function daysAgo(daysBack: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysBack);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

/* ---------------------------------------------------------------------- */
/* Reference data                                                          */
/* ---------------------------------------------------------------------- */

interface Spot {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const SPOTS: Spot[] = [
  { name: 'HITEC City', address: 'HITEC City, Madhapur, Hyderabad, Telangana', lat: 17.4435, lng: 78.3772 },
  { name: 'Banjara Hills', address: 'Road No. 12, Banjara Hills, Hyderabad, Telangana', lat: 17.4126, lng: 78.4482 },
  { name: 'Charminar', address: 'Charminar, Char Kaman, Ghansi Bazaar, Hyderabad', lat: 17.3616, lng: 78.4747 },
  { name: 'Secunderabad Station', address: 'Secunderabad Junction, Secunderabad, Telangana', lat: 17.4344, lng: 78.5013 },
  { name: 'Gachibowli', address: 'DLF Cyber City, Gachibowli, Hyderabad, Telangana', lat: 17.4401, lng: 78.3489 },
  { name: 'Jubilee Hills', address: 'Jubilee Hills Check Post, Hyderabad, Telangana', lat: 17.4326, lng: 78.4071 },
  { name: 'Begumpet', address: 'Begumpet Airport Road, Hyderabad, Telangana', lat: 17.4531, lng: 78.4676 },
  { name: 'Madhapur', address: 'Madhapur Main Road, Hyderabad, Telangana', lat: 17.4486, lng: 78.3908 },
  { name: 'Kondapur', address: 'Kondapur, Hyderabad, Telangana', lat: 17.46, lng: 78.357 },
  { name: 'Necklace Road', address: 'Necklace Road, Hyderabad, Telangana', lat: 17.4239, lng: 78.4738 },
  { name: 'KPHB Colony', address: 'KPHB Colony, Kukatpally, Hyderabad, Telangana', lat: 17.4948, lng: 78.3996 },
  { name: 'Ameerpet', address: 'Ameerpet Metro Station, Hyderabad, Telangana', lat: 17.4375, lng: 78.4483 },
  { name: 'Mehdipatnam', address: 'Mehdipatnam, Hyderabad, Telangana', lat: 17.395, lng: 78.44 },
  { name: 'LB Nagar', address: 'LB Nagar Circle, Hyderabad, Telangana', lat: 17.3457, lng: 78.5522 },
  { name: 'Rajiv Gandhi Airport', address: 'Rajiv Gandhi International Airport, Shamshabad, Telangana', lat: 17.2403, lng: 78.4294 },
];

const FARE_RATES: Record<VehicleType, { base: number; perKm: number; perMin: number; min: number }> = {
  bike: { base: 20, perKm: 7, perMin: 0.75, min: 30 },
  auto: { base: 30, perKm: 10, perMin: 1, min: 50 },
  sedan: { base: 50, perKm: 14, perMin: 1.5, min: 100 },
  suv: { base: 70, perKm: 18, perMin: 2, min: 150 },
};
const BOOKING_FEE = 5;
const TAX_RATE = 0.05;
const COMMISSION = 0.2;

const REVIEWS: Record<number, string[]> = {
  5: ['Super smooth ride, very polite driver!', 'Clean car and on time. Perfect.', 'Best ride I have had this month.', 'Great driving and good music 👌'],
  4: ['Good ride overall.', 'Driver knew the shortcuts, saved time.', 'Comfortable trip, slightly late pickup.'],
  3: ['Okay ride, nothing special.', 'Car could have been cleaner.'],
  2: ['Driver took a longer route.'],
  1: ['Driver was rude and late.'],
};

/* ---------------------------------------------------------------------- */
/* Seed                                                                    */
/* ---------------------------------------------------------------------- */

async function reset(): Promise<void> {
  console.log('\n→ Cleaning previous seed data');
  const adminClerkId = process.env.SEED_ADMIN_CLERK_ID?.trim();

  // Cascades remove rides, payments, ratings, notifications, tickets, sos, contacts, places.
  must(await db.from('users').delete().like('clerk_id', 'seed\\_%').select('id'), 'delete seeded users');
  if (adminClerkId) {
    must(await db.from('users').delete().eq('clerk_id', adminClerkId).select('id'), 'delete linked admin');
  }
  must(
    await db
      .from('promo_codes')
      .delete()
      .in('code', ['WELCOME50', 'FLAT100', 'RIDE20', 'WEEKEND15', 'EXPIRED10'])
      .select('id'),
    'delete seeded promos',
  );
  log('removed previous seed rows');
}

async function seed(): Promise<void> {
  await reset();

  /* ------------------------------ users ------------------------------ */
  console.log('\n→ Users');
  const adminClerkId = process.env.SEED_ADMIN_CLERK_ID?.trim() || 'seed_admin';

  const userRows: UserInsert[] = [
    { clerk_id: adminClerkId, email: 'admin@cabgo.app', phone: '+919900000001', full_name: 'Aarav Admin', role: 'admin', onboarding_completed: true },
    { clerk_id: 'seed_rider_1', email: 'priya.sharma@example.com', phone: '+919811100001', full_name: 'Priya Sharma', role: 'rider', onboarding_completed: true },
    { clerk_id: 'seed_rider_2', email: 'rahul.verma@example.com', phone: '+919811100002', full_name: 'Rahul Verma', role: 'rider', onboarding_completed: true },
    { clerk_id: 'seed_rider_3', email: 'ananya.reddy@example.com', phone: '+919811100003', full_name: 'Ananya Reddy', role: 'rider', onboarding_completed: true },
    { clerk_id: 'seed_rider_4', email: 'karthik.rao@example.com', phone: '+919811100004', full_name: 'Karthik Rao', role: 'rider', onboarding_completed: true },
    { clerk_id: 'seed_driver_1', email: 'ravi.kumar@example.com', phone: '+919822200001', full_name: 'Ravi Kumar', role: 'driver', onboarding_completed: true },
    { clerk_id: 'seed_driver_2', email: 'suresh.babu@example.com', phone: '+919822200002', full_name: 'Suresh Babu', role: 'driver', onboarding_completed: true },
    { clerk_id: 'seed_driver_3', email: 'imran.khan@example.com', phone: '+919822200003', full_name: 'Imran Khan', role: 'driver', onboarding_completed: true },
    { clerk_id: 'seed_driver_4', email: 'venkat.rao@example.com', phone: '+919822200004', full_name: 'Venkat Rao', role: 'driver', onboarding_completed: true },
    { clerk_id: 'seed_driver_5', email: 'manoj.yadav@example.com', phone: '+919822200005', full_name: 'Manoj Yadav', role: 'driver', onboarding_completed: true },
    { clerk_id: 'seed_driver_6', email: 'pending.driver@example.com', phone: '+919822200006', full_name: 'Naveen Goud', role: 'driver', onboarding_completed: true },
    { clerk_id: 'seed_driver_7', email: 'rejected.driver@example.com', phone: '+919822200007', full_name: 'Sameer Ali', role: 'driver', onboarding_completed: true },
  ];

  const users = must(await db.from('users').insert(userRows).select('*'), 'insert users');
  const byClerk = new Map(users.map((u) => [u.clerk_id, u]));
  const getUser = (clerkId: string) => {
    const user = byClerk.get(clerkId);
    if (!user) throw new Error(`Seed user ${clerkId} missing`);
    return user;
  };
  const admin = getUser(adminClerkId);
  const riders = ['seed_rider_1', 'seed_rider_2', 'seed_rider_3', 'seed_rider_4'].map(getUser);
  log(`${users.length} users`);

  /* --------------------------- driver profiles ----------------------- */
  console.log('\n→ Driver profiles');
  const driverDefs = [
    { clerk: 'seed_driver_1', type: 'sedan' as const, model: 'Maruti Dzire', color: 'White', plate: 'TS09EA1234', year: 2022, lat: 17.4239, lng: 78.4105, status: 'approved' as const, online: true },
    { clerk: 'seed_driver_2', type: 'sedan' as const, model: 'Honda Amaze', color: 'Silver', plate: 'TS08FB5678', year: 2021, lat: 17.4351, lng: 78.4412, status: 'approved' as const, online: true },
    { clerk: 'seed_driver_3', type: 'suv' as const, model: 'Toyota Innova Crysta', color: 'Grey', plate: 'TS07GC4321', year: 2023, lat: 17.4012, lng: 78.4301, status: 'approved' as const, online: true },
    { clerk: 'seed_driver_4', type: 'auto' as const, model: 'Bajaj RE Compact', color: 'Yellow', plate: 'TS10HD8765', year: 2020, lat: 17.4189, lng: 78.4566, status: 'approved' as const, online: true },
    { clerk: 'seed_driver_5', type: 'bike' as const, model: 'Honda Activa 6G', color: 'Black', plate: 'TS11JE2468', year: 2022, lat: 17.4275, lng: 78.4233, status: 'approved' as const, online: true },
    { clerk: 'seed_driver_6', type: 'sedan' as const, model: 'Hyundai Aura', color: 'Blue', plate: 'TS12KF1357', year: 2023, lat: null, lng: null, status: 'pending' as const, online: false },
    { clerk: 'seed_driver_7', type: 'bike' as const, model: 'TVS Jupiter', color: 'Red', plate: 'TS13LG9753', year: 2019, lat: null, lng: null, status: 'rejected' as const, online: false },
  ];

  const profiles = must(
    await db
      .from('driver_profiles')
      .insert(
        driverDefs.map((d, index) => ({
          user_id: getUser(d.clerk).id,
          license_number: `TS${String(index + 1).padStart(2, '0')}2019${String(100000 + index * 7919).slice(0, 6)}`,
          vehicle_type: d.type,
          vehicle_model: d.model,
          vehicle_color: d.color,
          vehicle_plate: d.plate,
          vehicle_year: d.year,
          license_document_url: `${getUser(d.clerk).id}/license.jpg`,
          vehicle_document_url: `${getUser(d.clerk).id}/rc.jpg`,
          verification_status: d.status,
          rejection_reason: d.status === 'rejected' ? 'Driving licence photo is blurry. Please re-upload a clear copy.' : null,
          verified_by: d.status === 'approved' ? admin.id : null,
          is_online: d.online,
          current_lat: d.lat,
          current_lng: d.lng,
          current_heading: d.lat ? Math.round(between(0, 359)) : null,
        })),
      )
      .select('*'),
    'insert driver profiles',
  );
  log(`${profiles.length} driver profiles (5 verified & online, 1 pending, 1 rejected)`);

  const verifiedDrivers = driverDefs
    .filter((d) => d.status === 'approved')
    .map((d) => ({ user: getUser(d.clerk), type: d.type }));
  const driversByType = (type: VehicleType) => verifiedDrivers.filter((d) => d.type === type);

  /* ------------------------------ promos ----------------------------- */
  console.log('\n→ Promo codes');
  const now = new Date();
  const plusDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
  const minusDays = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

  const promos = must(
    await db
      .from('promo_codes')
      .insert([
        { code: 'WELCOME50', description: '50% off your first ride (up to ₹100)', discount_type: 'percentage', discount_value: 50, max_discount: 100, min_fare: 80, max_uses: 1000, valid_from: minusDays(30), valid_until: plusDays(90) },
        { code: 'FLAT100', description: 'Flat ₹100 off on rides above ₹300', discount_type: 'flat', discount_value: 100, min_fare: 300, max_uses: 500, valid_from: minusDays(15), valid_until: plusDays(60) },
        { code: 'RIDE20', description: '20% off any ride (up to ₹60)', discount_type: 'percentage', discount_value: 20, max_discount: 60, min_fare: 0, max_uses: null, valid_from: minusDays(10), valid_until: plusDays(120) },
        { code: 'WEEKEND15', description: '15% weekend special', discount_type: 'percentage', discount_value: 15, max_discount: 50, min_fare: 100, max_uses: 200, valid_from: minusDays(5), valid_until: plusDays(30) },
        { code: 'EXPIRED10', description: 'Expired demo code', discount_type: 'flat', discount_value: 10, min_fare: 0, max_uses: 50, valid_from: minusDays(60), valid_until: minusDays(1) },
      ])
      .select('*'),
    'insert promos',
  );
  const promo = (code: string) => {
    const found = promos.find((p) => p.code === code);
    if (!found) throw new Error(`Promo ${code} missing`);
    return found;
  };
  log(`${promos.length} promo codes`);

  /* ------------------- saved places & emergency contacts ------------- */
  console.log('\n→ Saved places & emergency contacts');
  const savedPlaces = riders.flatMap((rider, index) => {
    const home = SPOTS[(index * 3 + 1) % SPOTS.length] as Spot;
    const work = SPOTS[(index * 3 + 4) % SPOTS.length] as Spot;
    const custom = SPOTS[(index * 3 + 7) % SPOTS.length] as Spot;
    return [
      { user_id: rider.id, label: 'home' as const, name: 'Home', address: home.address, lat: home.lat, lng: home.lng },
      { user_id: rider.id, label: 'work' as const, name: 'Work', address: work.address, lat: work.lat, lng: work.lng },
      { user_id: rider.id, label: 'custom' as const, name: index % 2 === 0 ? 'Gym' : "Mom's place", address: custom.address, lat: custom.lat, lng: custom.lng },
    ];
  });
  must(await db.from('saved_places').insert(savedPlaces).select('id'), 'insert saved places');

  const contacts = riders.flatMap((rider, index) => [
    { user_id: rider.id, name: ['Meera Sharma', 'Anil Verma', 'Lakshmi Reddy', 'Sunita Rao'][index] ?? 'Family', phone: `+91987650${1000 + index}`, relationship: 'Family' },
    { user_id: rider.id, name: ['Arjun Nair', 'Neha Gupta', 'Vikram Singh', 'Pooja Iyer'][index] ?? 'Friend', phone: `+91987651${1000 + index}`, relationship: 'Friend' },
  ]);
  must(await db.from('emergency_contacts').insert(contacts).select('id'), 'insert emergency contacts');
  log(`${savedPlaces.length} saved places, ${contacts.length} emergency contacts`);

  /* ------------------------ completed ride history ------------------- */
  console.log('\n→ Rides, payments, ratings');
  const rideRows: RideInsert[] = [];
  const meta: { paymentMethod: string; rating: number | null; reviewer: string; driverId: string; riderId: string }[] = [];
  const RIDE_COUNT = 45;
  const rideTypes: VehicleType[] = ['sedan', 'sedan', 'sedan', 'bike', 'bike', 'auto', 'auto', 'suv'];

  for (let i = 0; i < RIDE_COUNT; i += 1) {
    const rideType = pick(rideTypes);
    const driver = pick(driversByType(rideType));
    const rider = riders[i % riders.length] as (typeof riders)[number];
    let pickup = pick(SPOTS);
    let dropoff = pick(SPOTS);
    while (dropoff.name === pickup.name) dropoff = pick(SPOTS);
    if (rideType === 'bike' || rideType === 'auto') {
      // keep two/three-wheeler trips short
      const pool = SPOTS.filter((s) => s.name !== 'Rajiv Gandhi Airport' && s.name !== 'LB Nagar');
      pickup = pick(pool);
      dropoff = pick(pool.filter((s) => s.name !== pickup.name));
    }

    const stops: RideStop[] = [];
    if (rand() < 0.2) {
      const stop = pick(SPOTS.filter((s) => s.name !== pickup.name && s.name !== dropoff.name));
      stops.push({ address: stop.address, lat: stop.lat, lng: stop.lng, name: stop.name });
    }

    const distanceKm = round2(Math.max(1.2, haversineKm(pickup, dropoff) * 1.3));
    const durationMinutes = round2((distanceKm / between(18, 30)) * 60);
    const surge = rand() < 0.25 ? round2(between(1.2, 1.8)) : 1;

    const rate = FARE_RATES[rideType];
    const raw = rate.base + distanceKm * rate.perKm + durationMinutes * rate.perMin;
    const baseSubtotal = Math.max(rate.min, raw);
    const stopsFee = stops.length * 15;
    const surgeAmount = round2(baseSubtotal * (surge - 1));
    const subtotalBeforeDiscount = round2(baseSubtotal + surgeAmount + stopsFee + BOOKING_FEE);

    let promoRow: (typeof promos)[number] | null = null;
    let discount = 0;
    if (rand() < 0.2) {
      promoRow = promo(pick(['WELCOME50', 'RIDE20', 'WEEKEND15'] as const));
      discount =
        promoRow.discount_type === 'percentage'
          ? Math.min(round2((subtotalBeforeDiscount * promoRow.discount_value) / 100), promoRow.max_discount ?? Infinity)
          : promoRow.discount_value;
      discount = round2(Math.min(discount, subtotalBeforeDiscount));
    }
    const taxable = round2(subtotalBeforeDiscount - discount);
    const tax = round2(taxable * TAX_RATE);
    const total = round2(taxable + tax);

    const breakdown: FareBreakdown = {
      baseFare: rate.base,
      distanceFare: round2(distanceKm * rate.perKm),
      timeFare: round2(durationMinutes * rate.perMin),
      bookingFee: BOOKING_FEE,
      surgeAmount,
      stopsFee,
      subtotal: subtotalBeforeDiscount,
      discount,
      tax,
      total,
      currency: 'INR',
    };

    // Spread over the last 30 days with a mild weekday/evening bias
    const dayBack = Math.min(29, Math.floor(Math.pow(rand(), 0.85) * 30));
    const created = daysAgo(dayBack, Math.floor(between(2, 17)), Math.floor(between(0, 59))); // UTC hours ≈ 7:30–22:30 IST
    const accepted = new Date(created.getTime() + 60_000 * between(0.5, 2));
    const started = new Date(accepted.getTime() + 60_000 * between(4, 9));
    const completed = new Date(started.getTime() + 60_000 * durationMinutes);

    rideRows.push({
      rider_id: rider.id,
      driver_id: driver.user.id,
      pickup_address: pickup.address,
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_address: dropoff.address,
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
      stops,
      ride_type: rideType,
      status: 'completed',
      estimated_fare: total,
      final_fare: total,
      discount_amount: discount,
      fare_breakdown: breakdown,
      distance_km: distanceKm,
      duration_minutes: durationMinutes,
      surge_multiplier: surge,
      promo_code_id: promoRow?.id ?? null,
      created_at: created.toISOString(),
      accepted_at: accepted.toISOString(),
      started_at: started.toISOString(),
      completed_at: completed.toISOString(),
    });

    const ratingRoll = rand();
    meta.push({
      paymentMethod: pick(['card', 'upi', 'card', 'wallet'] as const),
      rating: ratingRoll < 0.78 ? (rand() < 0.65 ? 5 : 4) : ratingRoll < 0.9 ? 3 : ratingRoll < 0.96 ? 2 : ratingRoll < 0.985 ? 1 : null,
      reviewer: rider.id,
      driverId: driver.user.id,
      riderId: rider.id,
    });
  }

  const insertedRides = must(await db.from('rides').insert(rideRows).select('*'), 'insert completed rides');
  // `insert().select()` preserves input order, so meta[index] lines up with insertedRides[index].
  log(`${insertedRides.length} completed rides`);

  const payments: PaymentInsert[] = insertedRides.map((ride, index) => {
    const total = ride.final_fare ?? ride.estimated_fare;
    const platformFee = round2(total * COMMISSION);
    return {
      ride_id: ride.id,
      rider_id: ride.rider_id,
      driver_id: ride.driver_id,
      amount: total,
      currency: 'inr',
      stripe_payment_intent_id: `pi_seed_${String(index + 1).padStart(4, '0')}`,
      stripe_charge_id: `ch_seed_${String(index + 1).padStart(4, '0')}`,
      status: 'completed',
      payment_method: meta[index]?.paymentMethod ?? 'card',
      platform_fee: platformFee,
      driver_earnings: round2(total - platformFee),
      created_at: ride.completed_at ?? ride.created_at,
    };
  });
  must(await db.from('payments').insert(payments).select('id'), 'insert payments');
  log(`${payments.length} payments`);

  const ratings: RatingInsert[] = [];
  insertedRides.forEach((ride, index) => {
    const m = meta[index];
    if (!m || m.rating === null || !ride.driver_id) return;
    const reviews = REVIEWS[m.rating] ?? [];
    ratings.push({
      ride_id: ride.id,
      from_user_id: m.reviewer,
      to_user_id: ride.driver_id,
      rating: m.rating,
      review_text: reviews.length > 0 && rand() < 0.7 ? pick(reviews) : null,
      tags: m.rating >= 4 ? [pick(['Clean car', 'Safe driving', 'On time', 'Polite', 'Knows the route'] as const)] : [],
      created_at: new Date(new Date(ride.completed_at ?? ride.created_at).getTime() + 120_000).toISOString(),
    });
  });
  must(await db.from('ratings').insert(ratings).select('id'), 'insert ratings');
  log(`${ratings.length} ratings (driver averages recalculated by trigger)`);

  /* ------------------------- GPS breadcrumbs ------------------------- */
  const crumbs: RideLocationInsert[] = [];
  insertedRides.slice(0, 4).forEach((ride) => {
    if (!ride.driver_id || !ride.started_at) return;
    const steps = 12;
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      crumbs.push({
        ride_id: ride.id,
        driver_id: ride.driver_id,
        lat: ride.pickup_lat + (ride.dropoff_lat - ride.pickup_lat) * t,
        lng: ride.pickup_lng + (ride.dropoff_lng - ride.pickup_lng) * t,
        heading: Math.round(between(0, 359)),
        speed_kmh: round2(between(15, 45)),
        timestamp: new Date(new Date(ride.started_at).getTime() + t * ride.duration_minutes * 60_000).toISOString(),
      });
    }
  });
  must(await db.from('ride_locations').insert(crumbs).select('id'), 'insert ride locations');
  log(`${crumbs.length} GPS breadcrumbs`);

  /* ---------- cancelled ride + open request (visible to drivers) ------ */
  const cancelledPickup = SPOTS[5] as Spot;
  const cancelledDrop = SPOTS[0] as Spot;
  must(
    await db
      .from('rides')
      .insert({
        rider_id: (riders[1] as (typeof riders)[number]).id,
        pickup_address: cancelledPickup.address,
        pickup_lat: cancelledPickup.lat,
        pickup_lng: cancelledPickup.lng,
        dropoff_address: cancelledDrop.address,
        dropoff_lat: cancelledDrop.lat,
        dropoff_lng: cancelledDrop.lng,
        ride_type: 'sedan',
        status: 'cancelled',
        estimated_fare: 214.2,
        distance_km: 9.4,
        duration_minutes: 28,
        cancelled_by: (riders[1] as (typeof riders)[number]).id,
        cancellation_reason: 'Changed my plans',
        created_at: daysAgo(2, 9).toISOString(),
        cancelled_at: daysAgo(2, 9, 3).toISOString(),
      })
      .select('*')
      .single(),
    'insert cancelled ride',
  );

  const openPickup = SPOTS[1] as Spot;
  const openDrop = SPOTS[7] as Spot;
  must(
    await db
      .from('rides')
      .insert({
        rider_id: (riders[0] as (typeof riders)[number]).id,
        pickup_address: openPickup.address,
        pickup_lat: openPickup.lat,
        pickup_lng: openPickup.lng,
        dropoff_address: openDrop.address,
        dropoff_lat: openDrop.lat,
        dropoff_lng: openDrop.lng,
        ride_type: 'sedan',
        status: 'searching',
        estimated_fare: 262.5,
        distance_km: 8.1,
        duration_minutes: 24,
        surge_multiplier: 1.2,
      })
      .select('id')
      .single(),
    'insert open ride request',
  );
  log('1 cancelled ride, 1 open ride request (status: searching)');

  /* ----------------------------- SOS alert --------------------------- */
  const sosRide = insertedRides[3];
  if (sosRide) {
    must(
      await db
        .from('sos_alerts')
        .insert({
          ride_id: sosRide.id,
          user_id: sosRide.rider_id,
          lat: (sosRide.pickup_lat + sosRide.dropoff_lat) / 2,
          lng: (sosRide.pickup_lng + sosRide.dropoff_lng) / 2,
          status: 'resolved',
          emergency_contacts_notified: true,
          notified_contacts: [{ name: 'Meera Sharma', phone: '+919876501000', sent: true }],
          resolved_by: admin.id,
        })
        .select('id'),
      'insert sos alert',
    );
    log('1 resolved SOS alert');
  }

  /* --------------------------- support tickets ----------------------- */
  const lastRide = insertedRides[insertedRides.length - 1];
  must(
    await db
      .from('support_tickets')
      .insert([
        {
          user_id: (riders[0] as (typeof riders)[number]).id,
          ride_id: lastRide?.id ?? null,
          category: 'payment_issue',
          subject: 'Charged twice for the same ride',
          description: 'I can see two debits from my card for yesterday\'s ride to HITEC City. Please check and refund the duplicate.',
          status: 'open',
        },
        {
          user_id: (riders[2] as (typeof riders)[number]).id,
          category: 'lost_item',
          subject: 'Left my umbrella in the cab',
          description: 'I think I left a black umbrella on the back seat of a white Dzire this morning. Can you connect me with the driver?',
          status: 'in_progress',
          admin_response: 'We have reached out to the driver and will update you shortly.',
        },
        {
          user_id: getUser('seed_driver_1').id,
          category: 'app_bug',
          subject: 'Online toggle resets after app restart',
          description: 'Every time I reopen the dashboard I appear offline even though I was online. Please look into it.',
          status: 'resolved',
          admin_response: 'Fixed in the latest release. Thanks for reporting!',
          resolved_by: admin.id,
        },
      ])
      .select('id'),
    'insert support tickets',
  );
  log('3 support tickets (open / in progress / resolved)');

  /* ---------------------------- notifications ------------------------ */
  const notifications: NotificationInsert[] = [];
  const addNotification = (
    userId: string,
    type: NotificationInsert['type'],
    title: string,
    message: string,
    data: NotificationData = {},
    isRead = false,
  ) => notifications.push({ user_id: userId, type, title, message, data, is_read: isRead });

  riders.forEach((rider) => {
    addNotification(rider.id, 'promo', 'Welcome to CabGo 🎉', 'Use code WELCOME50 for 50% off your first ride.', { promoCode: 'WELCOME50' });
    addNotification(rider.id, 'ride_completed', 'Ride completed', 'Hope you enjoyed your trip! Rate your driver.', {}, true);
  });
  const firstRide = insertedRides[0];
  if (firstRide) {
    addNotification(firstRide.rider_id, 'payment_received', 'Payment successful', 'Your payment was received. Receipt sent to your email.', { rideId: firstRide.id });
  }
  verifiedDrivers.forEach(({ user }) => {
    addNotification(user.id, 'driver_verified', 'You are verified ✅', 'Your documents were approved. Go online to start earning.', {}, true);
    addNotification(user.id, 'rating_received', 'New 5★ rating', 'A rider just gave you 5 stars. Keep it up!');
  });
  addNotification(getUser('seed_driver_7').id, 'driver_rejected', 'Verification needs attention', 'Driving licence photo is blurry. Please re-upload a clear copy.');
  addNotification(admin.id, 'system', 'Seed data loaded', 'Demo data has been generated for your CabGo workspace.');
  addNotification(admin.id, 'ticket_update', 'New support ticket', 'Priya Sharma: Charged twice for the same ride', {}, false);
  must(await db.from('notifications').insert(notifications).select('id'), 'insert notifications');
  log(`${notifications.length} notifications`);

  /* ------------------------------ summary ---------------------------- */
  const { data: overview } = await db.rpc('admin_overview');
  console.log('\n✔ Seed complete.');
  if (overview) {
    console.log(
      `  Users: ${overview.total_users} · Rides: ${overview.total_rides} · Revenue: ₹${Math.round(overview.total_revenue)} · Online drivers: ${overview.online_drivers}`,
    );
  }
  if (adminClerkId === 'seed_admin') {
    console.log('\n  Tip: set SEED_ADMIN_CLERK_ID=<your Clerk user id> and re-run to log in as the seeded admin.');
  }
}

seed().catch((error: unknown) => {
  console.error('\n✖ Seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
