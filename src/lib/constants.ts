import type {
  NotificationType,
  RideStatus,
  RideStatusConfig,
  TicketCategory,
  VehicleConfig,
  VehicleType,
} from '@/types';

/* ---------------------------------------------------------------------- */
/* App                                                                     */
/* ---------------------------------------------------------------------- */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'CabGo';
export const APP_TAGLINE = 'Book a ride in seconds. Arrive in style.';
export const APP_DESCRIPTION =
  'CabGo is a modern ride-hailing platform — book sedans, SUVs, autos and bikes with live tracking, transparent fares and 24×7 safety.';
export const CURRENCY = (process.env.NEXT_PUBLIC_CURRENCY ?? 'inr').toLowerCase();
export const CURRENCY_SYMBOL = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL ?? '₹';

/** Default map centre (Hyderabad, India) used until geolocation resolves. */
export const DEFAULT_MAP_CENTER = { lat: 17.385, lng: 78.4867 } as const;
export const DEFAULT_MAP_ZOOM = 13;

/* ---------------------------------------------------------------------- */
/* Vehicles & fares (₹)                                                    */
/* ---------------------------------------------------------------------- */

export const VEHICLE_TYPES: readonly VehicleType[] = ['bike', 'auto', 'sedan', 'suv'] as const;

export const VEHICLES: Record<VehicleType, VehicleConfig> = {
  bike: {
    type: 'bike',
    label: 'Bike',
    description: 'Beat the traffic',
    capacity: 1,
    baseFare: 20,
    perKm: 7,
    perMinute: 0.75,
    minimumFare: 30,
    etaFactor: 0.8,
    gradient: 'from-emerald-500 to-teal-500',
  },
  auto: {
    type: 'auto',
    label: 'Auto',
    description: 'Affordable three-wheeler',
    capacity: 3,
    baseFare: 30,
    perKm: 10,
    perMinute: 1,
    minimumFare: 50,
    etaFactor: 0.9,
    gradient: 'from-amber-500 to-orange-500',
  },
  sedan: {
    type: 'sedan',
    label: 'Sedan',
    description: 'Comfortable AC cab',
    capacity: 4,
    baseFare: 50,
    perKm: 14,
    perMinute: 1.5,
    minimumFare: 100,
    etaFactor: 1,
    gradient: 'from-blue-500 to-indigo-500',
  },
  suv: {
    type: 'suv',
    label: 'SUV',
    description: 'Spacious for groups',
    capacity: 6,
    baseFare: 70,
    perKm: 18,
    perMinute: 2,
    minimumFare: 150,
    etaFactor: 1.05,
    gradient: 'from-violet-500 to-purple-600',
  },
};

/** Flat fee added per intermediate stop. */
export const STOP_FEE = 15;
/** Platform booking fee added to every ride. */
export const BOOKING_FEE = 5;
/** GST applied to the fare subtotal. */
export const TAX_RATE = 0.05;
/** Maximum number of intermediate stops a rider can add. */
export const MAX_STOPS = 3;

/* ---------------------------------------------------------------------- */
/* Surge pricing                                                           */
/* ---------------------------------------------------------------------- */

export const SURGE_MIN = 1.0;
export const SURGE_MAX = 3.0;
/** Demand/supply ratio at which surge starts. Ratio ≥ SURGE_SATURATION → SURGE_MAX. */
export const SURGE_THRESHOLD_RATIO = 1.0;
export const SURGE_SATURATION_RATIO = 4.0;

/* ---------------------------------------------------------------------- */
/* Business rules (server values come from env, clients fall back to defaults) */
/* ---------------------------------------------------------------------- */

const num = (value: string | undefined, fallback: number): number => {
  const parsed = value === undefined ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const BUSINESS_RULES = {
  /** First search radius for driver matching. */
  matchingRadiusKm: num(process.env.MATCHING_RADIUS_KM, 5),
  /** Radius used when nobody accepts within the timeout. */
  matchingExpandedRadiusKm: num(process.env.MATCHING_EXPANDED_RADIUS_KM, 10),
  /** Seconds a driver has to accept a request. */
  matchingTimeoutSeconds: num(process.env.MATCHING_TIMEOUT_SECONDS, 30),
  /** Free cancellation window after the ride is accepted. */
  freeCancellationSeconds: num(process.env.FREE_CANCELLATION_SECONDS, 120),
  /** Fee charged for late cancellations. */
  cancellationFee: num(process.env.CANCELLATION_FEE, 50),
  /** Share of each fare retained by the platform (%). */
  platformCommissionPercent: num(process.env.PLATFORM_COMMISSION_PERCENT, 20),
  /** Driver GPS broadcast interval. */
  locationIntervalMs: 5000,
} as const;

/* ---------------------------------------------------------------------- */
/* Ride statuses                                                           */
/* ---------------------------------------------------------------------- */

export const RIDE_STATUS_CONFIG: Record<RideStatus, RideStatusConfig> = {
  requested: {
    status: 'requested',
    label: 'Requested',
    description: 'Your ride request has been created.',
    variant: 'secondary',
  },
  searching: {
    status: 'searching',
    label: 'Finding driver',
    description: 'Looking for a driver near you…',
    variant: 'info',
  },
  accepted: {
    status: 'accepted',
    label: 'Driver assigned',
    description: 'A driver accepted your ride.',
    variant: 'purple',
  },
  driver_arriving: {
    status: 'driver_arriving',
    label: 'Driver arriving',
    description: 'Your driver is on the way to pickup.',
    variant: 'warning',
  },
  in_progress: {
    status: 'in_progress',
    label: 'On trip',
    description: 'Enjoy your ride!',
    variant: 'info',
  },
  completed: {
    status: 'completed',
    label: 'Completed',
    description: 'You have reached your destination.',
    variant: 'success',
  },
  cancelled: {
    status: 'cancelled',
    label: 'Cancelled',
    description: 'This ride was cancelled.',
    variant: 'destructive',
  },
};

/** Ordered steps rendered by <RideTimeline />. */
export const RIDE_TIMELINE_STEPS: readonly RideStatus[] = [
  'requested',
  'accepted',
  'driver_arriving',
  'in_progress',
  'completed',
] as const;

/** Statuses during which a ride is live (tracking, SOS and cancel are available). */
export const ACTIVE_RIDE_STATUSES: readonly RideStatus[] = [
  'requested',
  'searching',
  'accepted',
  'driver_arriving',
  'in_progress',
] as const;

/** Statuses where a driver is assigned and busy. */
export const DRIVER_BUSY_STATUSES: readonly RideStatus[] = [
  'accepted',
  'driver_arriving',
  'in_progress',
] as const;

/** Allowed forward transitions a DRIVER may request through the status API. */
export const DRIVER_STATUS_FLOW: Partial<Record<RideStatus, RideStatus>> = {
  accepted: 'driver_arriving',
  driver_arriving: 'in_progress',
  in_progress: 'completed',
};

/* ---------------------------------------------------------------------- */
/* Cancellation, ratings, support, notifications                           */
/* ---------------------------------------------------------------------- */

export const RIDER_CANCEL_REASONS = [
  'Driver is taking too long',
  'Changed my plans',
  'Booked by mistake',
  'Found another ride',
  'Wrong pickup location',
  'Driver asked me to cancel',
  'Other',
] as const;

export const DRIVER_CANCEL_REASONS = [
  'Rider is not at pickup',
  'Rider is unreachable',
  'Vehicle issue',
  'Too far from pickup',
  'Other',
] as const;

export const RATING_LABELS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '😡', label: 'Terrible' },
  2: { emoji: '😕', label: 'Poor' },
  3: { emoji: '😐', label: 'Okay' },
  4: { emoji: '😊', label: 'Good' },
  5: { emoji: '🤩', label: 'Excellent' },
};

export const RATING_TAGS = [
  'Clean car',
  'Safe driving',
  'Great conversation',
  'On time',
  'Knows the route',
  'Polite',
] as const;

export const TICKET_CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'payment_issue', label: 'Payment issue' },
  { value: 'driver_behavior', label: 'Driver behavior' },
  { value: 'lost_item', label: 'Lost item' },
  { value: 'app_bug', label: 'App bug' },
  { value: 'other', label: 'Other' },
];

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  ride_requested: 'car',
  ride_accepted: 'check-circle',
  driver_arriving: 'navigation',
  ride_started: 'play-circle',
  ride_completed: 'flag',
  ride_cancelled: 'x-circle',
  payment_received: 'wallet',
  payment_failed: 'alert-triangle',
  promo: 'ticket-percent',
  rating_received: 'star',
  driver_verified: 'badge-check',
  driver_rejected: 'shield-x',
  ticket_update: 'life-buoy',
  sos: 'siren',
  system: 'bell',
};

/* ---------------------------------------------------------------------- */
/* Storage & misc                                                          */
/* ---------------------------------------------------------------------- */

export const STORAGE_BUCKETS = {
  avatars: process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET ?? 'avatars',
  receipts: process.env.NEXT_PUBLIC_SUPABASE_RECEIPT_BUCKET ?? 'receipts',
  driverDocuments: 'driver-documents',
} as const;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const PAGE_SIZE = 10;

export const FIREBASE_PATHS = {
  driverLocations: 'driverLocations',
  rides: 'rides',
} as const;

export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';
