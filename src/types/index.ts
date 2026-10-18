/**
 * CabGo — central type definitions.
 *
 * 1. Primitive unions mirroring the Postgres enums
 * 2. Row types for all 12 tables
 * 3. The `Database` generic consumed by supabase-js (typed queries + RPCs)
 * 4. Domain / view-model types (fare, tracking, API envelopes, socket events …)
 */

/* ====================================================================== */
/* 1. Enum unions                                                          */
/* ====================================================================== */

export type UserRole = 'rider' | 'driver' | 'admin';
export type VehicleType = 'sedan' | 'suv' | 'auto' | 'bike';
export type RideStatus =
  | 'requested'
  | 'searching'
  | 'accepted'
  | 'driver_arriving'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'card' | 'upi' | 'wallet' | 'cash';
export type DiscountType = 'percentage' | 'flat';
export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export type TicketCategory =
  | 'payment_issue'
  | 'driver_behavior'
  | 'lost_item'
  | 'app_bug'
  | 'other';
export type SosStatus = 'active' | 'resolved';
export type SavedPlaceLabel = 'home' | 'work' | 'custom';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type NotificationType =
  | 'ride_requested'
  | 'ride_accepted'
  | 'driver_arriving'
  | 'ride_started'
  | 'ride_completed'
  | 'ride_cancelled'
  | 'payment_received'
  | 'payment_failed'
  | 'promo'
  | 'rating_received'
  | 'driver_verified'
  | 'driver_rejected'
  | 'ticket_update'
  | 'sos'
  | 'system';

/* ====================================================================== */
/* JSON helpers                                                            */
/* ====================================================================== */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface LatLng {
  lat: number;
  lng: number;
}

/** A geocoded place (pickup, dropoff or intermediate stop). */
export interface Place extends LatLng {
  address: string;
  placeId?: string;
  name?: string;
}

/** Stop stored in `rides.stops` (JSONB). */
export type RideStop = Place;

/* ====================================================================== */
/* 2. Table row types                                                      */
/* ====================================================================== */

export type User = {
  id: string;
  clerk_id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  onboarding_completed: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DriverProfile = {
  id: string;
  user_id: string;
  license_number: string;
  vehicle_type: VehicleType;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_plate: string;
  vehicle_year: number | null;
  license_document_url: string | null;
  vehicle_document_url: string | null;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  is_online: boolean;
  current_lat: number | null;
  current_lng: number | null;
  current_heading: number | null;
  last_location_at: string | null;
  average_rating: number;
  rating_count: number;
  total_rides: number;
  created_at: string;
  updated_at: string;
};

export type PromoCode = {
  id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_discount: number | null;
  min_fare: number;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
};

export interface FareBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  bookingFee: number;
  /** Extra amount added by surge pricing (0 when surge = 1.0). */
  surgeAmount: number;
  stopsFee: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
}

export type Ride = {
  id: string;
  rider_id: string;
  driver_id: string | null;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  stops: RideStop[];
  ride_type: VehicleType;
  status: RideStatus;
  estimated_fare: number;
  final_fare: number | null;
  discount_amount: number;
  cancellation_fee: number;
  fare_breakdown: FareBreakdown | null;
  distance_km: number;
  duration_minutes: number;
  surge_multiplier: number;
  promo_code_id: string | null;
  route_polyline: string | null;
  search_radius_km: number;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  otp?: string | null;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  ride_id: string;
  rider_id: string;
  driver_id: string | null;
  amount: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  status: PaymentStatus;
  payment_method: PaymentMethod | string;
  platform_fee: number;
  driver_earnings: number;
  failure_reason: string | null;
  receipt_url: string | null;
  receipt_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Rating = {
  id: string;
  ride_id: string;
  from_user_id: string;
  to_user_id: string;
  rating: number;
  review_text: string | null;
  tags: string[];
  created_at: string;
};

export type RideLocation = {
  id: number;
  ride_id: string;
  driver_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed_kmh: number | null;
  timestamp: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  data: NotificationData;
  read_at: string | null;
  created_at: string;
};

/** Payload attached to a notification (used for deep links). */
export interface NotificationData {
  rideId?: string;
  paymentId?: string;
  ticketId?: string;
  promoCode?: string;
  url?: string;
  [key: string]: Json | undefined;
}

export type SupportTicket = {
  id: string;
  user_id: string;
  ride_id: string | null;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  admin_response: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export interface NotifiedContact {
  name: string;
  phone: string;
  sent: boolean;
}

export type SosAlert = {
  id: string;
  ride_id: string;
  user_id: string;
  lat: number;
  lng: number;
  status: SosStatus;
  emergency_contacts_notified: boolean;
  notified_contacts: NotifiedContact[];
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type EmergencyContact = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  relationship: string;
  created_at: string;
};

export type SavedPlace = {
  id: string;
  user_id: string;
  label: SavedPlaceLabel;
  name: string | null;
  address: string;
  lat: number;
  lng: number;
  created_at: string;
};

/* ====================================================================== */
/* 3. Supabase Database generic                                            */
/* ====================================================================== */

type WithOptional<Row, Optional extends keyof Row> = Omit<Row, Optional> & Partial<Pick<Row, Optional>>;

type UserInsert = WithOptional<
  User,
  | 'id'
  | 'email'
  | 'phone'
  | 'full_name'
  | 'avatar_url'
  | 'role'
  | 'onboarding_completed'
  | 'is_active'
  | 'created_at'
  | 'updated_at'
>;

type DriverProfileInsert = WithOptional<
  DriverProfile,
  | 'id'
  | 'vehicle_year'
  | 'license_document_url'
  | 'vehicle_document_url'
  | 'verification_status'
  | 'rejection_reason'
  | 'is_verified'
  | 'verified_at'
  | 'verified_by'
  | 'is_online'
  | 'current_lat'
  | 'current_lng'
  | 'current_heading'
  | 'last_location_at'
  | 'average_rating'
  | 'rating_count'
  | 'total_rides'
  | 'created_at'
  | 'updated_at'
>;

type PromoCodeInsert = WithOptional<
  PromoCode,
  | 'id'
  | 'description'
  | 'max_discount'
  | 'min_fare'
  | 'max_uses'
  | 'current_uses'
  | 'valid_from'
  | 'is_active'
  | 'created_at'
>;

type RideInsert = WithOptional<
  Ride,
  | 'id'
  | 'driver_id'
  | 'stops'
  | 'status'
  | 'final_fare'
  | 'discount_amount'
  | 'cancellation_fee'
  | 'fare_breakdown'
  | 'surge_multiplier'
  | 'promo_code_id'
  | 'route_polyline'
  | 'search_radius_km'
  | 'accepted_at'
  | 'started_at'
  | 'completed_at'
  | 'cancelled_at'
  | 'cancelled_by'
  | 'cancellation_reason'
  | 'created_at'
  | 'updated_at'
>;

type PaymentInsert = WithOptional<
  Payment,
  | 'id'
  | 'driver_id'
  | 'currency'
  | 'stripe_payment_intent_id'
  | 'stripe_charge_id'
  | 'status'
  | 'payment_method'
  | 'platform_fee'
  | 'driver_earnings'
  | 'failure_reason'
  | 'receipt_url'
  | 'receipt_sent_at'
  | 'created_at'
  | 'updated_at'
>;

type RatingInsert = WithOptional<Rating, 'id' | 'review_text' | 'tags' | 'created_at'>;

type RideLocationInsert = WithOptional<RideLocation, 'id' | 'heading' | 'speed_kmh' | 'timestamp'>;

type NotificationInsert = WithOptional<
  AppNotification,
  'id' | 'type' | 'is_read' | 'data' | 'read_at' | 'created_at'
>;

type SupportTicketInsert = WithOptional<
  SupportTicket,
  | 'id'
  | 'ride_id'
  | 'category'
  | 'status'
  | 'admin_response'
  | 'resolved_by'
  | 'resolved_at'
  | 'created_at'
  | 'updated_at'
>;

type SosAlertInsert = WithOptional<
  SosAlert,
  | 'id'
  | 'status'
  | 'emergency_contacts_notified'
  | 'notified_contacts'
  | 'resolved_by'
  | 'resolved_at'
  | 'created_at'
>;

type EmergencyContactInsert = WithOptional<EmergencyContact, 'id' | 'relationship' | 'created_at'>;

type SavedPlaceInsert = WithOptional<SavedPlace, 'id' | 'label' | 'name' | 'created_at'>;

/** Builds the `Relationships` tuple entry used by supabase-js for embedded selects. */
interface Relationship<Name extends string, Col extends string, Ref extends string> {
  foreignKeyName: Name;
  columns: [Col];
  isOneToOne: boolean;
  referencedRelation: Ref;
  referencedColumns: ['id'];
}

type TableDef<Row, Insert, Rels extends readonly unknown[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: Rels;
};

/* ---- RPC argument / return shapes ------------------------------------- */

export interface NearbyDriver {
  driver_user_id: string;
  driver_profile_id: string;
  full_name: string;
  avatar_url: string | null;
  vehicle_type: VehicleType;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_plate: string;
  average_rating: number;
  total_rides: number;
  current_lat: number;
  current_lng: number;
  current_heading: number | null;
  distance_km: number;
}

export interface PromoValidationRow {
  valid: boolean;
  message: string;
  promo_id: string | null;
  discount_type: DiscountType | null;
  discount_value: number | null;
  discount_amount: number;
}

export interface AdminOverview {
  total_users: number;
  total_riders: number;
  total_drivers: number;
  total_rides: number;
  completed_rides: number;
  cancelled_rides: number;
  active_rides: number;
  rides_today: number;
  total_revenue: number;
  platform_revenue: number;
  revenue_30d: number;
  online_drivers: number;
  pending_verifications: number;
  open_tickets: number;
  active_sos: number;
}

export interface AdminDailyStat {
  day: string;
  rides_count: number;
  completed_count: number;
  cancelled_count: number;
  revenue: number;
}

export interface DriverEarningsDay {
  day: string;
  rides_count: number;
  earnings: number;
}

export interface Database {
  public: {
    Tables: {
      users: TableDef<User, UserInsert>;
      driver_profiles: TableDef<
        DriverProfile,
        DriverProfileInsert,
        [
          Relationship<'driver_profiles_user_id_fkey', 'user_id', 'users'> & { isOneToOne: true },
          Relationship<'driver_profiles_verified_by_fkey', 'verified_by', 'users'>,
        ]
      >;
      promo_codes: TableDef<PromoCode, PromoCodeInsert>;
      rides: TableDef<
        Ride,
        RideInsert,
        [
          Relationship<'rides_rider_id_fkey', 'rider_id', 'users'>,
          Relationship<'rides_driver_id_fkey', 'driver_id', 'users'>,
          Relationship<'rides_promo_code_id_fkey', 'promo_code_id', 'promo_codes'>,
          Relationship<'rides_cancelled_by_fkey', 'cancelled_by', 'users'>,
        ]
      >;
      payments: TableDef<
        Payment,
        PaymentInsert,
        [
          Relationship<'payments_ride_id_fkey', 'ride_id', 'rides'>,
          Relationship<'payments_rider_id_fkey', 'rider_id', 'users'>,
          Relationship<'payments_driver_id_fkey', 'driver_id', 'users'>,
        ]
      >;
      ratings: TableDef<
        Rating,
        RatingInsert,
        [
          Relationship<'ratings_ride_id_fkey', 'ride_id', 'rides'>,
          Relationship<'ratings_from_user_id_fkey', 'from_user_id', 'users'>,
          Relationship<'ratings_to_user_id_fkey', 'to_user_id', 'users'>,
        ]
      >;
      ride_locations: TableDef<
        RideLocation,
        RideLocationInsert,
        [
          Relationship<'ride_locations_ride_id_fkey', 'ride_id', 'rides'>,
          Relationship<'ride_locations_driver_id_fkey', 'driver_id', 'users'>,
        ]
      >;
      notifications: TableDef<
        AppNotification,
        NotificationInsert,
        [Relationship<'notifications_user_id_fkey', 'user_id', 'users'>]
      >;
      support_tickets: TableDef<
        SupportTicket,
        SupportTicketInsert,
        [
          Relationship<'support_tickets_user_id_fkey', 'user_id', 'users'>,
          Relationship<'support_tickets_ride_id_fkey', 'ride_id', 'rides'>,
          Relationship<'support_tickets_resolved_by_fkey', 'resolved_by', 'users'>,
        ]
      >;
      sos_alerts: TableDef<
        SosAlert,
        SosAlertInsert,
        [
          Relationship<'sos_alerts_ride_id_fkey', 'ride_id', 'rides'>,
          Relationship<'sos_alerts_user_id_fkey', 'user_id', 'users'>,
          Relationship<'sos_alerts_resolved_by_fkey', 'resolved_by', 'users'>,
        ]
      >;
      emergency_contacts: TableDef<
        EmergencyContact,
        EmergencyContactInsert,
        [Relationship<'emergency_contacts_user_id_fkey', 'user_id', 'users'>]
      >;
      saved_places: TableDef<
        SavedPlace,
        SavedPlaceInsert,
        [Relationship<'saved_places_user_id_fkey', 'user_id', 'users'>]
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      find_nearby_drivers: {
        Args: {
          p_lat: number;
          p_lng: number;
          p_radius_km?: number;
          p_ride_type?: VehicleType | null;
          p_limit?: number;
        };
        Returns: NearbyDriver[];
      };
      accept_ride: {
        Args: { p_ride_id: string; p_driver_id: string };
        Returns: Ride;
      };
      update_driver_location: {
        Args: { p_lat: number; p_lng: number; p_heading?: number | null };
        Returns: undefined;
      };
      validate_promo_code: {
        Args: { p_code: string; p_fare?: number };
        Returns: PromoValidationRow[];
      };
      admin_overview: {
        Args: Record<PropertyKey, never>;
        Returns: AdminOverview;
      };
      admin_daily_stats: {
        Args: { p_days?: number; p_tz?: string };
        Returns: AdminDailyStat[];
      };
      driver_earnings_summary: {
        Args: { p_driver_id: string; p_days?: number; p_tz?: string };
        Returns: DriverEarningsDay[];
      };
    };
    Enums: {
      user_role: UserRole;
      vehicle_type: VehicleType;
      ride_status: RideStatus;
      payment_status: PaymentStatus;
      discount_type: DiscountType;
      ticket_status: TicketStatus;
      ticket_category: TicketCategory;
      sos_status: SosStatus;
      saved_place_label: SavedPlaceLabel;
      verification_status: VerificationStatus;
      notification_type: NotificationType;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

/* ====================================================================== */
/* 4. Domain / view-model types                                            */
/* ====================================================================== */

export interface UserSummary {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone?: string | null;
}

export interface DriverWithProfile extends UserSummary {
  driver_profile: DriverProfile | null;
}

/** Ride joined with rider + driver (+ driver vehicle) — used by cards & detail pages. */
export interface RideWithRelations extends Ride {
  rider: UserSummary | null;
  driver: UserSummary | null;
  driver_profile: Pick<
    DriverProfile,
    | 'vehicle_type'
    | 'vehicle_model'
    | 'vehicle_color'
    | 'vehicle_plate'
    | 'average_rating'
    | 'total_rides'
    | 'current_lat'
    | 'current_lng'
    | 'current_heading'
  > | null;
  payment?: Payment | null;
  rating?: Rating | null;
}

export interface RatingWithUser extends Rating {
  from_user: UserSummary | null;
}

export interface TicketWithUser extends SupportTicket {
  user: (UserSummary & { email: string | null; role: UserRole }) | null;
}

export interface SosAlertWithRelations extends SosAlert {
  user: UserSummary | null;
  ride: Pick<Ride, 'id' | 'pickup_address' | 'dropoff_address' | 'driver_id' | 'status'> | null;
}

export interface DriverVerificationItem extends DriverProfile {
  user: UserSummary & { email: string | null };
}

/** Result of /api/fare-estimate for one vehicle type. */
export interface FareEstimate {
  rideType: VehicleType;
  distanceKm: number;
  durationMinutes: number;
  surgeMultiplier: number;
  breakdown: FareBreakdown;
  etaMinutes: number | null;
  promo?: {
    code: string;
    promoId: string;
    discountAmount: number;
  } | null;
}

export interface RouteInfo {
  distanceKm: number;
  durationMinutes: number;
  polyline: string | null;
}

/** Live driver telemetry sent over Socket.IO / stored in Firebase. */
export interface DriverLocationUpdate extends LatLng {
  rideId?: string;
  driverId: string;
  heading: number;
  speedKmh: number;
  timestamp: number;
}

export interface RideRequestPayload {
  ride: Ride;
  rider: UserSummary;
  distanceToPickupKm: number;
  /** Seconds the driver has to accept before the offer expires. */
  expiresInSeconds: number;
}

export interface RideStatusPayload {
  rideId: string;
  status: RideStatus;
  driverId?: string | null;
  at: string;
  reason?: string | null;
}

/* ---- Socket.IO event contracts (shared by client hook & Express server) -- */

export interface ServerToClientEvents {
  /** A freshly stored notification for the signed-in user. */
  notification: (payload: AppNotification) => void;
  /** Another device marked notifications as read — keeps every open tab in sync. */
  'notification:read': (payload: { ids: string[]; all?: boolean }) => void;
  'ride:request': (payload: RideRequestPayload) => void;
  'ride:request:expired': (payload: { rideId: string }) => void;
  'ride:taken': (payload: { rideId: string }) => void;
  'ride:accepted': (payload: RideStatusPayload) => void;
  'ride:status': (payload: RideStatusPayload) => void;
  'ride:cancelled': (payload: RideStatusPayload) => void;
  'ride:no-drivers': (payload: { rideId: string }) => void;
  'driver:location': (payload: DriverLocationUpdate) => void;
  'sos:alert': (payload: { alertId: string; rideId: string; lat: number; lng: number }) => void;
  'socket:error': (payload: { message: string }) => void;
}

/** Driver GPS sample as sent by the browser (identity + timestamp are stamped by the server). */
export interface DriverLocationInput extends LatLng {
  rideId?: string;
  heading: number;
  speedKmh: number;
}

export interface ClientToServerEvents {
  'ride:join': (payload: { rideId: string }, ack?: (ok: boolean) => void) => void;
  'ride:leave': (payload: { rideId: string }) => void;
  'driver:online': (payload: LatLng & { vehicleType?: VehicleType }) => void;
  'driver:offline': () => void;
  'driver:location:update': (payload: DriverLocationInput) => void;
}

/* ---- API envelopes ------------------------------------------------------ */

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: string;
  details?: Record<string, string[] | undefined>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/* ---- Config shapes (see lib/constants.ts) -------------------------------- */

export interface VehicleConfig {
  type: VehicleType;
  label: string;
  description: string;
  capacity: number;
  baseFare: number;
  perKm: number;
  perMinute: number;
  minimumFare: number;
  /** Multiplier applied to the driver ETA to account for vehicle speed. */
  etaFactor: number;
  /** Tailwind gradient used on the selector card. */
  gradient: string;
}

export interface RideStatusConfig {
  status: RideStatus;
  label: string;
  description: string;
  variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'purple' | 'outline';
}

/** Response of POST /api/fare-estimate — one quote per vehicle type for the same route. */
export interface FareEstimateResponse {
  route: RouteInfo & { approximate: boolean };
  surge: { multiplier: number; demand: number; supply: number };
  estimates: FareEstimate[];
  /** Present when a promo code was submitted. `valid` is true if it applies to ≥ 1 vehicle. */
  promo: { code: string; valid: boolean; message: string } | null;
  /** Online, idle drivers within the matching radius of the pickup (all vehicle types). */
  nearbyDrivers: number;
}

/** Public (privacy-safe) view of a nearby driver, used for map markers. */
export interface NearbyDriverMarker {
  id: string;
  lat: number;
  lng: number;
  heading: number | null;
  vehicleType: VehicleType;
  distanceKm: number;
}

/** Result of POST /api/rides. */
export interface CreateRideResult {
  ride: Ride;
  driversNotified: number;
  searchRadiusKm: number;
}

/** Result of POST /api/rides/[id]/cancel. */
export interface CancelRideResult {
  ride: Ride;
  cancellationFee: number;
  wasFree: boolean;
}

/** Row in ride lists (history, driver rides): the ride plus the counterpart's basic profile. */
export interface RideListItem extends Ride {
  rider: UserSummary | null;
  driver: UserSummary | null;
}

/* ---- Driver dashboard ---------------------------------------------------- */

/** An open ride request as shown to a nearby driver. */
export interface DriverRideRequest {
  ride: Ride;
  rider: UserSummary | null;
  /** Straight-line distance from the driver's last position to the pickup. */
  pickupDistanceKm: number;
  /** What the driver keeps after the platform commission. */
  estimatedEarnings: number;
}

/** Polled by the driver dashboard: fresh profile + current trip + open requests. */
export interface DriverFeed {
  profile: DriverProfile;
  activeRide: RideWithRelations | null;
  requests: DriverRideRequest[];
  /** Platform commission (%) — lets the UI show "you earn" without duplicating server config. */
  commissionPercent: number;
  /** How far from the driver requests are shown. */
  requestRadiusKm: number;
}

export interface DriverDayStats {
  rides: number;
  /** Paid out (completed payments). */
  earnings: number;
  /** Completed trips whose payment hasn't settled yet. */
  pending: number;
}

export interface DriverPayoutItem {
  id: string;
  rideId: string;
  amount: number;
  createdAt: string;
  pickupAddress: string | null;
  dropoffAddress: string | null;
}

export interface DriverEarningsReport {
  days: number;
  daily: DriverEarningsDay[];
  paid: number;
  paidRides: number;
  pending: number;
  pendingRides: number;
  recent: DriverPayoutItem[];
}

/** Response of GET /api/notifications. */
export interface NotificationsPage {
  items: AppNotification[];
  unreadCount: number;
  /** True when older notifications exist (pass the last item's `created_at` as `before`). */
  hasMore: boolean;
}

/* ---- Payments ------------------------------------------------------------ */

/** What a rider owes for a ride: the fare of a completed trip, or a late-cancellation fee. */
export type PaymentKind = 'fare' | 'cancellation_fee';

/** Response of POST /api/payments/create-intent (feeds Stripe's Payment Element). */
export interface PaymentIntentResult {
  clientSecret: string;
  paymentId: string;
  amount: number;
  currency: string;
  kind: PaymentKind;
}

/** Response of POST /api/payments/checkout (redirect to Stripe-hosted Checkout). */
export interface CheckoutSessionResult {
  url: string;
}

/** Response of POST /api/payments/confirm. */
export interface ConfirmPaymentResult {
  /** `processing` = the bank/UPI app has not confirmed yet; the webhook will finish the job. */
  state: 'completed' | 'processing' | 'failed' | 'pending';
  payment: Payment | null;
  message?: string;
}

/** A payment plus the ride it belongs to (history lists). */
export interface PaymentListItem extends Payment {
  ride: Pick<Ride, 'id' | 'pickup_address' | 'dropoff_address' | 'created_at' | 'ride_type' | 'status'> | null;
}

/** A ride the rider still has to pay for. */
export interface PaymentDue {
  rideId: string;
  amount: number;
  kind: PaymentKind;
  dropoffAddress: string;
  createdAt: string;
}

export interface PaymentSummary {
  totalPaid: number;
  paidThisMonth: number;
  paymentCount: number;
  dueTotal: number;
}

/** Everything shown on a receipt (page, download and email). */
export interface ReceiptData {
  number: string;
  issuedAt: string;
  status: PaymentStatus;
  method: string;
  kind: PaymentKind;
  currency: string;
  total: number;
  rider: { name: string; email: string | null };
  driver: { name: string; vehicle: string | null } | null;
  ride: {
    id: string;
    date: string;
    pickup: string;
    dropoff: string;
    stops: string[];
    distanceKm: number;
    durationMinutes: number;
    vehicleLabel: string;
  };
  breakdown: FareBreakdown | null;
  /** Stripe-hosted receipt (card network details), when available. */
  stripeReceiptUrl: string | null;
}

/* ---- Ratings, history, support, safety ------------------------------------ */

/** A review as shown on profiles (author name only — never contact details). */
export interface ReviewItem {
  id: string;
  rating: number;
  review_text: string | null;
  tags: string[];
  created_at: string;
  author: { full_name: string; avatar_url: string | null } | null;
}

export interface RatingSummary {
  average: number;
  count: number;
  /** Index 0 = 5 stars … index 4 = 1 star. */
  distribution: number[];
  topTags: { tag: string; count: number }[];
}

/** GET /api/drivers/[id] */
export interface DriverPublicProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  vehicle_type: VehicleType;
  vehicle_model: string;
  vehicle_color: string;
  total_rides: number;
  member_since: string;
  summary: RatingSummary;
  reviews: ReviewItem[];
}

/** A ride in the history list plus what the rider did about it afterwards. */
export interface RideHistoryItem extends Ride {
  payment_status: PaymentStatus | null;
  my_rating: number | null;
}

export interface SupportTicketWithRide extends SupportTicket {
  ride: Pick<Ride, 'id' | 'pickup_address' | 'dropoff_address' | 'created_at'> | null;
}

/** Response of POST /api/sos. */
export interface SosTriggerResult {
  alert: SosAlert;
  contacts: NotifiedContact[];
  /** How many contacts actually received an SMS. */
  contactsReached: number;
  /** False when no SMS provider is configured — the UI then asks the user to share the link manually. */
  smsConfigured: boolean;
  /** Pre-written message + map link for manual sharing (Web Share / WhatsApp / SMS). */
  shareText: string;
  mapUrl: string;
  /** True when an active alert for this ride already existed (double tap). */
  duplicate: boolean;
}
