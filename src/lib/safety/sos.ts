import 'server-only';

import { ApiError } from '@/lib/api';
import { SOS_RIDE_STATUSES } from '@/lib/feedback';
import { notifyAdmins } from '@/lib/notifications';
import { emitRealtime, room } from '@/lib/realtime';
import { isSmsConfigured, sendSms } from '@/lib/sms';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { EmergencyContact, NotifiedContact, SosAlert, SosTriggerResult, User } from '@/types';

interface TriggerInput {
  rideId: string;
  lat: number;
  lng: number;
  source: 'gps' | 'ride';
}

const mapLink = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

/** Everything a contact needs to find the person: who, where, which car. */
async function buildShareText(user: Pick<User, 'id' | 'full_name'>, rideId: string, lat: number, lng: number): Promise<string> {
  const db = createSupabaseAdminClient();
  const { data: ride } = await db.from('rides').select('driver_id, rider_id, pickup_address, dropoff_address').eq('id', rideId).maybeSingle();

  let vehicle = '';
  if (ride?.driver_id) {
    const { data: profile } = await db.from('driver_profiles').select('vehicle_color, vehicle_model, vehicle_plate').eq('user_id', ride.driver_id).maybeSingle();
    if (profile) vehicle = ` Vehicle: ${profile.vehicle_color} ${profile.vehicle_model}, plate ${profile.vehicle_plate}.`;
  }
  const trip = ride ? ` Trip: ${ride.pickup_address} to ${ride.dropoff_address}.` : '';
  return `SOS from ${user.full_name} on a CabGo ride — they may need help.${trip}${vehicle} Live location: ${mapLink(lat, lng)}`;
}

function toResult(alert: SosAlert, shareText: string, duplicate: boolean): SosTriggerResult {
  return {
    alert,
    contacts: alert.notified_contacts,
    contactsReached: alert.notified_contacts.filter((contact) => contact.sent).length,
    smsConfigured: isSmsConfigured(),
    shareText,
    mapUrl: mapLink(alert.lat, alert.lng),
    duplicate,
  };
}

/**
 * Raise an SOS during a live trip.
 *
 *  1. The caller must be the rider or the driver of a ride that is currently active.
 *  2. Idempotent: an active alert for the same user + ride is returned instead of creating another
 *     (the partial unique index in migration 009 enforces this even for simultaneous requests).
 *  3. Stored first (so the alert exists even if every notification channel fails), then:
 *       - SMS to each emergency contact (when Twilio is configured),
 *       - in-app notification + live `sos:alert` event for admins.
 */
export async function triggerSos(user: Pick<User, 'id' | 'full_name'>, input: TriggerInput): Promise<SosTriggerResult> {
  const db = createSupabaseAdminClient();

  const { data: ride, error } = await db.from('rides').select('id, rider_id, driver_id, status').eq('id', input.rideId).maybeSingle();
  if (error) throw new Error(`Failed to load ride: ${error.message}`);
  if (!ride || (ride.rider_id !== user.id && ride.driver_id !== user.id)) throw new ApiError(404, 'Ride not found.');
  if (!(SOS_RIDE_STATUSES as readonly string[]).includes(ride.status)) {
    throw new ApiError(409, 'SOS is only available during an active ride. In an emergency, call 112.');
  }

  const existing = await getActiveAlert(user.id, ride.id);
  if (existing) return toResult(existing, await buildShareText(user, ride.id, existing.lat, existing.lng), true);

  const { data: created, error: insertError } = await db
    .from('sos_alerts')
    .insert({ ride_id: ride.id, user_id: user.id, lat: input.lat, lng: input.lng })
    .select('*')
    .single();

  if (insertError || !created) {
    // 23505 = another request created the alert a moment ago → return that one.
    if (insertError?.code === '23505') {
      const raced = await getActiveAlert(user.id, ride.id);
      if (raced) return toResult(raced, await buildShareText(user, ride.id, raced.lat, raced.lng), true);
    }
    throw new Error(`Failed to store SOS alert: ${insertError?.message ?? 'no row returned'}`);
  }

  const shareText = await buildShareText(user, ride.id, input.lat, input.lng);

  // --- contacts -------------------------------------------------------------------------------
  const { data: contacts, error: contactsError } = await db.from('emergency_contacts').select('name, phone').eq('user_id', user.id).limit(5);
  if (contactsError) console.error('[sos] could not load contacts:', contactsError.message);

  const notified: NotifiedContact[] = await Promise.all(
    (contacts ?? []).map(async (contact) => ({
      name: contact.name,
      phone: contact.phone,
      sent: await sendSms(contact.phone, shareText),
    })),
  );

  const { data: updated, error: updateError } = await db
    .from('sos_alerts')
    .update({ notified_contacts: notified, emergency_contacts_notified: notified.some((contact) => contact.sent) })
    .eq('id', created.id)
    .select('*')
    .single();
  if (updateError) console.error('[sos] could not store notified contacts:', updateError.message);
  const alert = updated ?? { ...created, notified_contacts: notified };

  // --- admins ---------------------------------------------------------------------------------
  await notifyAdmins({
    type: 'sos',
    title: '🚨 SOS alert',
    message: `${user.full_name} triggered SOS during a ride. ${notified.filter((c) => c.sent).length}/${notified.length} contacts reached.`,
    data: { rideId: ride.id, sosId: alert.id, url: '/admin/sos' },
  });
  await emitRealtime({
    rooms: [room.role('admin')],
    event: 'sos:alert',
    payload: { alertId: alert.id, rideId: ride.id, userId: user.id, name: user.full_name, lat: alert.lat, lng: alert.lng, at: alert.created_at },
  });

  return toResult(alert, shareText, false);
}

export async function getActiveAlert(userId: string, rideId: string): Promise<SosAlert | null> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('sos_alerts').select('*').eq('user_id', userId).eq('ride_id', rideId).eq('status', 'active').maybeSingle();
  if (error) throw new Error(`Failed to load SOS alert: ${error.message}`);
  return data;
}

/** The current active alert in the shape the UI needs after a page reload. */
export async function getActiveSosResult(user: Pick<User, 'id' | 'full_name'>, rideId: string): Promise<SosTriggerResult | null> {
  const alert = await getActiveAlert(user.id, rideId);
  return alert ? toResult(alert, await buildShareText(user, rideId, alert.lat, alert.lng), true) : null;
}

/** "I'm safe" — the owner closes their own alert and admins are told. */
export async function resolveOwnSos(user: Pick<User, 'id' | 'full_name'>, alertId: string): Promise<SosAlert> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('sos_alerts')
    .update({ status: 'resolved', resolved_by: user.id })
    .eq('id', alertId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`Failed to resolve SOS alert: ${error.message}`);
  if (!data) throw new ApiError(404, 'No active SOS alert found.');

  await notifyAdmins({
    type: 'sos',
    title: 'SOS cleared by user',
    message: `${user.full_name} marked themselves safe.`,
    data: { rideId: data.ride_id, sosId: data.id, url: '/admin/sos' },
  });
  return data;
}

/** The user's emergency contacts, oldest first (used by the profile pages and GET /api/emergency-contacts). */
export async function listEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('emergency_contacts').select('*').eq('user_id', userId).order('created_at', { ascending: true });
  if (error) throw new Error(`Failed to load emergency contacts: ${error.message}`);
  return data ?? [];
}
