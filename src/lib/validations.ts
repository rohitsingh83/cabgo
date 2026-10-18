import { z } from 'zod';

import { MAX_STOPS, PAGE_SIZE } from '@/lib/constants';
import { haversineKm } from '@/lib/utils';

/**
 * Central Zod schemas. Each step of the build extends this file; schemas are shared by
 * React Hook Form (client) and the API routes (server) so validation can never drift.
 */

/* ---------------------------------------------------------------------- */
/* Primitives                                                              */
/* ---------------------------------------------------------------------- */

export const uuidSchema = z.string().uuid('Invalid id');

/** International phone number in E.164-ish form: optional +, 8–15 digits. Spaces/dashes are stripped. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\-()]/g, ''))
  .refine((value) => /^\+?[1-9]\d{7,14}$/.test(value), {
    message: 'Enter a valid phone number, e.g. +919876543210',
  });

export const optionalPhoneSchema = z
  .union([phoneSchema, z.literal('')])
  .optional()
  .transform((value) => (value ? value : undefined));

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

/* ---------------------------------------------------------------------- */
/* Auth & onboarding                                                       */
/* ---------------------------------------------------------------------- */

export const onboardingSchema = z.object({
  role: z.enum(['rider', 'driver'], {
    required_error: 'Choose how you want to use CabGo',
    invalid_type_error: 'Choose how you want to use CabGo',
  }),
  fullName: z
    .string()
    .trim()
    .min(2, 'Please enter your full name')
    .max(80, 'Name is too long'),
  phone: optionalPhoneSchema,
});

/** Shape used by the React Hook Form instance (before transforms). */
export type OnboardingFormValues = z.input<typeof onboardingSchema>;
export type OnboardingInput = z.output<typeof onboardingSchema>;

export const profileUpdateSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(80).optional(),
    phone: optionalPhoneSchema,
    avatarUrl: z.string().url('Invalid avatar URL').max(500).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });

export type ProfileUpdateInput = z.output<typeof profileUpdateSchema>;

/* ---------------------------------------------------------------------- */
/* Places, routes & fares                                                  */
/* ---------------------------------------------------------------------- */

export const vehicleTypeSchema = z.enum(['bike', 'auto', 'sedan', 'suv']);

/** A geocoded location (pickup, dropoff or stop). */
export const placeSchema = z.object({
  address: z.string().trim().min(3, 'Address is too short').max(300, 'Address is too long'),
  lat: latitudeSchema,
  lng: longitudeSchema,
  placeId: z.string().max(300).optional(),
  name: z.string().trim().max(200).optional(),
});

/** Pickup + dropoff + up to MAX_STOPS stops. Pickup and dropoff must be at least ~100 m apart. */
export const routeRequestSchema = z
  .object({
    pickup: placeSchema,
    dropoff: placeSchema,
    stops: z.array(placeSchema).max(MAX_STOPS, `You can add up to ${MAX_STOPS} stops`).default([]),
  })
  .refine((value) => haversineKm(value.pickup, value.dropoff) >= 0.1, {
    message: 'Pickup and drop-off must be different places',
    path: ['dropoff'],
  });

export const promoCodeSchema = z
  .string()
  .trim()
  .min(3, 'Promo codes have at least 3 characters')
  .max(32, 'Promo code is too long')
  .regex(/^[A-Za-z0-9_-]+$/, 'Promo codes only contain letters, numbers, - and _')
  .transform((value) => value.toUpperCase());

export const fareEstimateSchema = z
  .object({
    pickup: placeSchema,
    dropoff: placeSchema,
    stops: z.array(placeSchema).max(MAX_STOPS).default([]),
    promoCode: promoCodeSchema.optional(),
  })
  .refine((value) => haversineKm(value.pickup, value.dropoff) >= 0.1, {
    message: 'Pickup and drop-off must be different places',
    path: ['dropoff'],
  });

export const createRideSchema = z
  .object({
    pickup: placeSchema,
    dropoff: placeSchema,
    stops: z.array(placeSchema).max(MAX_STOPS).default([]),
    rideType: vehicleTypeSchema,
    promoCode: promoCodeSchema.optional(),
    /** Total the rider saw on screen. If the live price differs the server asks for re-confirmation. */
    expectedTotal: z.number().nonnegative().optional(),
  })
  .refine((value) => haversineKm(value.pickup, value.dropoff) >= 0.1, {
    message: 'Pickup and drop-off must be different places',
    path: ['dropoff'],
  });

export type PlaceInput = z.output<typeof placeSchema>;
export type FareEstimateInput = z.output<typeof fareEstimateSchema>;
export type CreateRideInput = z.output<typeof createRideSchema>;

export const promoValidateSchema = z.object({
  code: promoCodeSchema,
  fare: z.number().nonnegative('Fare must be positive'),
});

export const cancelRideSchema = z.object({
  reason: z.string().trim().max(200, 'Reason is too long').optional(),
});

export const ridesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(PAGE_SIZE),
  status: z.enum(['all', 'active', 'completed', 'cancelled']).default('all'),
});

export const nearbyDriversQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  rideType: vehicleTypeSchema.optional(),
  radiusKm: z.coerce.number().min(0.5).max(20).default(5),
});

/** `?q=` forward geocoding OR `?lat=&lng=` reverse geocoding. */
export const geocodeQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(200).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((value) => value.q !== undefined || (value.lat !== undefined && value.lng !== undefined), {
    message: 'Provide either q or lat & lng',
  });

/* ---------------------------------------------------------------------- */
/* Saved places                                                            */
/* ---------------------------------------------------------------------- */

export const savedPlaceSchema = z
  .object({
    label: z.enum(['home', 'work', 'custom']),
    name: z.string().trim().max(60, 'Name is too long').optional(),
    address: z.string().trim().min(3).max(300),
    lat: latitudeSchema,
    lng: longitudeSchema,
  })
  .refine((value) => value.label !== 'custom' || (value.name && value.name.length >= 2), {
    message: 'Give custom places a name',
    path: ['name'],
  });

export type SavedPlaceInput = z.output<typeof savedPlaceSchema>;

/* ---------------------------------------------------------------------- */
/* Uploads                                                                 */
/* ---------------------------------------------------------------------- */

export const uploadBucketSchema = z.enum(['avatars', 'driver-documents']);

/* ---------------------------------------------------------------------- */
/* Driver                                                                  */
/* ---------------------------------------------------------------------- */

/** Storage object path inside the driver-documents bucket: `<users.id>/<file>`. */
export const documentPathSchema = z
  .string()
  .max(300)
  .regex(/^[0-9a-fA-F-]{36}\/[\w.-]+$/, 'Invalid document reference');

const driverProfileBase = z.object({
  licenseNumber: z
    .string()
    .trim()
    .min(5, 'Enter your full licence number')
    .max(24, 'Licence number is too long')
    .regex(/^[A-Za-z0-9][A-Za-z0-9\- ]*$/, 'Use letters, numbers, spaces and dashes only')
    .transform((value) => value.toUpperCase()),
  vehicleType: vehicleTypeSchema,
  vehicleModel: z.string().trim().min(2, 'Enter the vehicle model').max(60, 'Model name is too long'),
  vehicleColor: z.string().trim().min(2, 'Enter the vehicle colour').max(30, 'Colour is too long'),
  vehiclePlate: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replace(/\s+/g, ' '))
    .refine((value) => /^[A-Z0-9][A-Z0-9 -]{3,14}$/.test(value), 'Enter a valid number plate, e.g. TS 09 AB 1234'),
  vehicleYear: z
    .number({ invalid_type_error: 'Enter a valid year' })
    .int()
    .min(1990, 'Vehicle is too old')
    .max(new Date().getFullYear() + 1, 'Year is in the future')
    .nullable()
    .optional(),
  licenseDocumentPath: documentPathSchema.nullable().optional(),
  vehicleDocumentPath: documentPathSchema.nullable().optional(),
});

export const driverProfileCreateSchema = driverProfileBase;
export const driverProfileUpdateSchema = driverProfileBase
  .partial()
  .refine((value) => Object.values(value).some((v) => v !== undefined), { message: 'Provide at least one field to update' });

export type DriverProfileCreateInput = z.output<typeof driverProfileCreateSchema>;
export type DriverProfileUpdateInput = z.output<typeof driverProfileUpdateSchema>;

export const driverStatusSchema = z
  .object({
    online: z.boolean(),
    lat: latitudeSchema.optional(),
    lng: longitudeSchema.optional(),
    heading: z.number().min(0).max(360).nullable().optional(),
  })
  .refine((value) => !value.online || (value.lat !== undefined && value.lng !== undefined), {
    message: 'Turn on location access so nearby riders can find you',
    path: ['lat'],
  });

export const driverLocationSchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
  heading: z.number().min(0).max(360).nullable().optional(),
});

/** Driver-side ride state changes. */
export const driverRideActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('arrived') }),
  z.object({ action: z.literal('start'), otp: z.string().trim().min(4, 'Enter the 4-digit ride OTP').max(4).optional() }),
  z.object({ action: z.literal('complete') }),
  z.object({ action: z.literal('cancel'), reason: z.string().trim().max(200, 'Reason is too long').optional() }),
]);

export const driverRidesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  status: z.enum(['all', 'completed', 'cancelled']).catch('all'),
});

export const earningsRangeSchema = z.object({
  days: z.coerce.number().int().refine((value) => [7, 30, 90].includes(value)).catch(30),
});

/* ---------------------------------------------------------------------- */
/* Notifications                                                           */
/* ---------------------------------------------------------------------- */

export const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** Cursor: only notifications older than this ISO timestamp. */
  before: z.string().datetime({ offset: true }).optional(),
  unreadOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

/** Mark specific notifications as read, or everything. */
export const notificationsMarkReadSchema = z.union([
  z.object({ ids: z.array(uuidSchema).min(1).max(100) }),
  z.object({ all: z.literal(true) }),
]);

/* ---------------------------------------------------------------------- */
/* Payments                                                                */
/* ---------------------------------------------------------------------- */

export const createPaymentIntentSchema = z.object({ rideId: uuidSchema });
export const createCheckoutSchema = z.object({ rideId: uuidSchema });

/** Stripe ids look like `pi_3Abc…` / `cs_test_a1b2…`; the prefix check blocks obvious garbage early. */
export const confirmPaymentSchema = z.union([
  z.object({ paymentIntentId: z.string().regex(/^pi_[A-Za-z0-9_]{8,}$/, 'Invalid payment intent id') }),
  z.object({ sessionId: z.string().regex(/^cs_(test|live)_[A-Za-z0-9_]{8,}$/, 'Invalid checkout session id') }),
]);

export const paymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  status: z.enum(['all', 'completed', 'pending', 'failed', 'refunded']).default('all'),
});

export const refundPaymentSchema = z.object({
  reason: z.enum(['requested_by_customer', 'duplicate', 'fraudulent']).default('requested_by_customer'),
});

/* ---------------------------------------------------------------------- */
/* Ratings, history, support, safety                                       */
/* ---------------------------------------------------------------------- */

export const createRatingSchema = z.object({
  rideId: uuidSchema,
  rating: z.number().int('Pick a whole number of stars').min(1, 'Pick a rating').max(5),
  reviewText: z
    .string()
    .trim()
    .max(1000, 'Reviews can be up to 1000 characters')
    .optional()
    .transform((value) => (value ? value : undefined)),
  tags: z.array(z.string().trim().min(1).max(40)).max(6, 'Pick up to 6 tags').default([]),
});

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  status: z.enum(['all', 'completed', 'cancelled']).default('all'),
  range: z.enum(['30d', '90d', '365d', 'all']).default('all'),
  q: z
    .string()
    .trim()
    .max(100)
    // PostgREST `or`/`ilike` filters use , ( ) * % as syntax — strip them so a search can never alter the filter.
    .transform((value) => value.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim())
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const ticketCategorySchema = z.enum(['payment_issue', 'driver_behavior', 'lost_item', 'app_bug', 'other']);

export const createTicketSchema = z.object({
  category: ticketCategorySchema,
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(200, 'Subject is too long'),
  description: z.string().trim().min(5, 'Please describe the problem (at least 5 characters)').max(4000, 'Description is too long'),
  rideId: uuidSchema.optional(),
});

export const ticketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  status: z.enum(['all', 'open', 'in_progress', 'resolved']).default('all'),
});

export const triggerSosSchema = z.object({
  rideId: uuidSchema,
  lat: latitudeSchema,
  lng: longitudeSchema,
  /** `gps` = the device reported it, `ride` = fell back to the last known ride position. */
  source: z.enum(['gps', 'ride']).default('gps'),
});

export const resolveSosSchema = z.object({ action: z.literal('resolve') });

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(100, 'Name is too long'),
  phone: phoneSchema,
  relationship: z.string().trim().min(2, 'Enter a relationship').max(40, 'Too long').default('Friend'),
});

/* ---------------------------------------------------------------------- */
/* Admin                                                                   */
/* ---------------------------------------------------------------------- */

/** Free-text search box: PostgREST `or`/`ilike` filters use , ( ) * % as syntax, so strip them. */
const searchTextSchema = z
  .string()
  .trim()
  .max(100)
  .transform((value) => value.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim())
  .optional()
  .transform((value) => (value ? value : undefined));

const pageSchema = z.coerce.number().int().min(1).max(1000).default(1);

export const adminRangeSchema = z.enum(['7d', '30d', '90d', 'all']).default('all');

export const adminOverviewQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((value) => [7, 30, 90].includes(value), 'days must be 7, 30 or 90')
    .default(30),
});

export const adminUsersQuerySchema = z.object({
  page: pageSchema,
  q: searchTextSchema,
  role: z.enum(['all', 'rider', 'driver', 'admin']).default('all'),
  status: z.enum(['all', 'active', 'suspended']).default('all'),
});

export const adminDriversQuerySchema = z.object({
  page: pageSchema,
  q: searchTextSchema,
  status: z.enum(['all', 'pending', 'approved', 'rejected']).default('pending'),
});

export const adminRidesQuerySchema = z.object({
  page: pageSchema,
  q: searchTextSchema,
  status: z.enum(['all', 'active', 'requested', 'searching', 'accepted', 'driver_arriving', 'in_progress', 'completed', 'cancelled']).default('all'),
  range: adminRangeSchema,
});

export const adminPaymentsQuerySchema = z.object({
  page: pageSchema,
  status: z.enum(['all', 'completed', 'pending', 'failed', 'refunded']).default('all'),
  range: adminRangeSchema,
});

export const adminTicketsQuerySchema = z.object({
  page: pageSchema,
  q: searchTextSchema,
  status: z.enum(['all', 'open', 'in_progress', 'resolved']).default('open'),
  category: z.enum(['all', 'payment_issue', 'driver_behavior', 'lost_item', 'app_bug', 'other']).default('all'),
});

export const adminSosQuerySchema = z.object({
  page: pageSchema,
  status: z.enum(['all', 'active', 'resolved']).default('active'),
});

export const adminPromoQuerySchema = z.object({
  status: z.enum(['all', 'active', 'scheduled', 'expired', 'inactive']).default('all'),
});

export const adminExportQuerySchema = z.object({
  type: z.enum(['rides', 'payments', 'users']),
  range: adminRangeSchema,
  status: z.string().trim().max(20).optional(),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(200, 'Reason is too long').optional(),
});

export const reviewDriverSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({
    action: z.literal('reject'),
    reason: z.string().trim().min(5, 'Tell the driver what to fix (at least 5 characters)').max(300, 'Reason is too long'),
  }),
]);

export const adminCancelRideSchema = z.object({
  reason: z.string().trim().min(3, 'Please give a reason (at least 3 characters)').max(200, 'Reason is too long'),
});

const isoDateTime = z.string().datetime({ offset: true, message: 'Enter a valid date and time' });

const promoFields = {
  code: promoCodeSchema,
  description: z
    .string()
    .trim()
    .max(200, 'Description is too long')
    .optional()
    .transform((value) => (value ? value : null)),
  discountType: z.enum(['percentage', 'flat']),
  discountValue: z.number().positive('Enter a discount greater than 0').max(100000),
  maxDiscount: z.number().positive('Cap must be greater than 0').max(100000).nullable().optional(),
  minFare: z.number().min(0, 'Cannot be negative').max(100000).default(0),
  maxUses: z.number().int('Whole numbers only').positive('Must be at least 1').max(10_000_000).nullable().optional(),
  validFrom: isoDateTime,
  validUntil: isoDateTime,
  isActive: z.boolean().default(true),
};

interface PromoRuleInput {
  discountType?: 'percentage' | 'flat';
  discountValue?: number;
  maxDiscount?: number | null;
  validFrom?: string;
  validUntil?: string;
}

/** Cross-field rules shared by create and update (mirrors the table's CHECK constraints). */
function checkPromoRules(value: PromoRuleInput, ctx: z.RefinementCtx): void {
  if (value.discountType === 'percentage' && value.discountValue !== undefined && value.discountValue > 100) {
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'A percentage discount cannot exceed 100' });
  }
  if (value.discountType === 'flat' && value.maxDiscount != null) {
    ctx.addIssue({ code: 'custom', path: ['maxDiscount'], message: 'A cap only applies to percentage codes' });
  }
  if (value.validFrom && value.validUntil && new Date(value.validUntil) <= new Date(value.validFrom)) {
    ctx.addIssue({ code: 'custom', path: ['validUntil'], message: 'Must be after the start date' });
  }
}

export const createPromoSchema = z.object(promoFields).superRefine(checkPromoRules);
export const updatePromoSchema = z
  .object(promoFields)
  .partial()
  .superRefine(checkPromoRules)
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export const adminTicketUpdateSchema = z
  .object({
    status: z.enum(['open', 'in_progress', 'resolved']),
    response: z
      .string()
      .trim()
      .max(4000, 'Reply is too long')
      .optional()
      .transform((value) => (value ? value : undefined)),
  });

export const resolveSosAdminSchema = z.object({
  note: z.string().trim().max(300).optional(),
});
