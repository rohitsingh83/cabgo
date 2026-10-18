import { ApiError, ok, parseBody, requireApiUser, withApi } from '@/lib/api';
import { getActiveRideForDriver, getDriverProfile } from '@/lib/drivers/service';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { driverProfileCreateSchema, driverProfileUpdateSchema } from '@/lib/validations';
import type { DriverProfile } from '@/types';

export const dynamic = 'force-dynamic';

/** Document paths must live in the caller's own folder of the driver-documents bucket. */
function assertOwnDocument(path: string | null | undefined, userId: string) {
  if (path && !path.startsWith(`${userId}/`)) throw new ApiError(400, 'Invalid document reference');
}

/** GET /api/driver/profile — the signed-in driver's profile (or null before setup). */
export const GET = withApi(async () => {
  const user = await requireApiUser(['driver']);
  return ok(await getDriverProfile(user.id));
}, 'GET /api/driver/profile');

/** POST /api/driver/profile — first-time setup. The profile starts as `pending` until an admin approves it. */
export const POST = withApi(async (request) => {
  const user = await requireApiUser(['driver']);
  const input = await parseBody(request, driverProfileCreateSchema);
  assertOwnDocument(input.licenseDocumentPath, user.id);
  assertOwnDocument(input.vehicleDocumentPath, user.id);

  if (await getDriverProfile(user.id)) throw new ApiError(409, 'Your driver profile already exists. Edit it instead.');

  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('driver_profiles')
    .insert({
      user_id: user.id,
      license_number: input.licenseNumber,
      vehicle_type: input.vehicleType,
      vehicle_model: input.vehicleModel,
      vehicle_color: input.vehicleColor,
      vehicle_plate: input.vehiclePlate,
      vehicle_year: input.vehicleYear ?? null,
      license_document_url: input.licenseDocumentPath ?? null,
      vehicle_document_url: input.vehicleDocumentPath ?? null,
    })
    .select('*')
    .single();
  if (error || !data) {
    if (error?.code === '23505') throw new ApiError(409, 'Your driver profile already exists. Edit it instead.');
    throw new Error(`Failed to create driver profile: ${error?.message ?? 'no row returned'}`);
  }
  return ok<DriverProfile>(data, 201);
}, 'POST /api/driver/profile');

/**
 * PATCH /api/driver/profile — edit vehicle / licence details.
 * Changing the identity of the vehicle or licence on an approved account, or re-submitting after a
 * rejection, sends the profile back to `pending` (and offline) so an admin can re-verify it.
 */
export const PATCH = withApi(async (request) => {
  const user = await requireApiUser(['driver']);
  const input = await parseBody(request, driverProfileUpdateSchema);
  assertOwnDocument(input.licenseDocumentPath, user.id);
  assertOwnDocument(input.vehicleDocumentPath, user.id);

  const profile = await getDriverProfile(user.id);
  if (!profile) throw new ApiError(404, 'Complete your driver setup first.');

  const changes: Partial<
    Pick<
      DriverProfile,
      | 'license_number'
      | 'vehicle_type'
      | 'vehicle_model'
      | 'vehicle_color'
      | 'vehicle_plate'
      | 'vehicle_year'
      | 'license_document_url'
      | 'vehicle_document_url'
      | 'verification_status'
      | 'rejection_reason'
      | 'is_online'
    >
  > = {};
  if (input.licenseNumber !== undefined) changes.license_number = input.licenseNumber;
  if (input.vehicleType !== undefined) changes.vehicle_type = input.vehicleType;
  if (input.vehicleModel !== undefined) changes.vehicle_model = input.vehicleModel;
  if (input.vehicleColor !== undefined) changes.vehicle_color = input.vehicleColor;
  if (input.vehiclePlate !== undefined) changes.vehicle_plate = input.vehiclePlate;
  if (input.vehicleYear !== undefined) changes.vehicle_year = input.vehicleYear;
  if (input.licenseDocumentPath !== undefined) changes.license_document_url = input.licenseDocumentPath;
  if (input.vehicleDocumentPath !== undefined) changes.vehicle_document_url = input.vehicleDocumentPath;

  const identityChanged =
    (changes.vehicle_type !== undefined && changes.vehicle_type !== profile.vehicle_type) ||
    (changes.vehicle_plate !== undefined && changes.vehicle_plate !== profile.vehicle_plate) ||
    (changes.license_number !== undefined && changes.license_number !== profile.license_number);

  if (identityChanged && (await getActiveRideForDriver(user.id))) {
    throw new ApiError(409, 'Finish your current trip before changing vehicle or licence details.');
  }

  if (profile.verification_status === 'rejected') {
    changes.verification_status = 'pending';
    changes.rejection_reason = null;
  } else if (profile.verification_status === 'approved' && identityChanged) {
    changes.verification_status = 'pending';
    changes.is_online = false;
  }

  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('driver_profiles').update(changes).eq('user_id', user.id).select('*').single();
  if (error || !data) throw new Error(`Failed to update driver profile: ${error?.message ?? 'no row returned'}`);
  return ok<DriverProfile>(data);
}, 'PATCH /api/driver/profile');
