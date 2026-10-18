import 'server-only';

import { ApiError } from '@/lib/api';
import { MAX_OPEN_TICKETS, TICKET_CATEGORY_LABEL } from '@/lib/feedback';
import { notifyAdmins } from '@/lib/notifications';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Paginated, SupportTicket, SupportTicketWithRide, TicketCategory, User } from '@/types';

export const TICKETS_PAGE_SIZE = 10;

export interface TicketRideOption {
  id: string;
  label: string;
  created_at: string;
}

interface CreateTicketInput {
  category: TicketCategory;
  subject: string;
  description: string;
  rideId?: string;
}

/** Attach the (small) ride summary each ticket refers to. */
async function withRides(tickets: SupportTicket[]): Promise<SupportTicketWithRide[]> {
  const rideIds = [...new Set(tickets.map((ticket) => ticket.ride_id).filter((id): id is string => Boolean(id)))];
  if (rideIds.length === 0) return tickets.map((ticket) => ({ ...ticket, ride: null }));

  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('rides').select('id, pickup_address, dropoff_address, created_at').in('id', rideIds);
  if (error) throw new Error(`Failed to load ticket rides: ${error.message}`);
  const byId = new Map((data ?? []).map((ride) => [ride.id, ride]));
  return tickets.map((ticket) => ({ ...ticket, ride: ticket.ride_id ? byId.get(ticket.ride_id) ?? null : null }));
}

export async function createTicket(user: Pick<User, 'id' | 'full_name' | 'role'>, input: CreateTicketInput): Promise<SupportTicket> {
  const db = createSupabaseAdminClient();

  // Anti-spam: cap unresolved tickets per user.
  const { count, error: countError } = await db
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['open', 'in_progress']);
  if (countError) throw new Error(`Failed to count tickets: ${countError.message}`);
  if ((count ?? 0) >= MAX_OPEN_TICKETS) {
    throw new ApiError(429, `You already have ${MAX_OPEN_TICKETS} open tickets. Please wait for a reply before opening more.`);
  }

  // A ticket may only reference a ride the user took part in (rider or driver).
  if (input.rideId) {
    const { data: ride, error } = await db.from('rides').select('id, rider_id, driver_id').eq('id', input.rideId).maybeSingle();
    if (error) throw new Error(`Failed to load ride: ${error.message}`);
    if (!ride || (ride.rider_id !== user.id && ride.driver_id !== user.id)) {
      throw new ApiError(400, 'Choose one of your own rides.', { rideId: ['Ride not found'] });
    }
  }

  const { data, error } = await db
    .from('support_tickets')
    .insert({
      user_id: user.id,
      ride_id: input.rideId ?? null,
      category: input.category,
      subject: input.subject,
      description: input.description,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Failed to create ticket: ${error?.message ?? 'no row returned'}`);

  await notifyAdmins({
    type: 'ticket_update',
    title: `New ticket · ${TICKET_CATEGORY_LABEL[input.category]}`,
    message: `${user.full_name} (${user.role}): ${input.subject}`.slice(0, 200),
    data: { ticketId: data.id, url: `/admin/support/${data.id}` },
  });

  return data;
}

export async function listTickets(
  user: Pick<User, 'id'>,
  query: { page: number; status: 'all' | SupportTicket['status'] },
): Promise<Paginated<SupportTicketWithRide>> {
  const db = createSupabaseAdminClient();
  const from = (query.page - 1) * TICKETS_PAGE_SIZE;

  let request = db
    .from('support_tickets')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, from + TICKETS_PAGE_SIZE - 1);
  if (query.status !== 'all') request = request.eq('status', query.status);

  const { data, error, count } = await request;
  if (error) throw new Error(`Failed to load tickets: ${error.message}`);

  const total = count ?? (data ?? []).length;
  return {
    items: await withRides(data ?? []),
    page: query.page,
    pageSize: TICKETS_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / TICKETS_PAGE_SIZE)),
  };
}

/** One of the caller's own tickets (null for someone else's — callers answer 404). */
export async function getTicket(user: Pick<User, 'id'>, ticketId: string): Promise<SupportTicketWithRide | null> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('support_tickets').select('*').eq('id', ticketId).eq('user_id', user.id).maybeSingle();
  if (error) throw new Error(`Failed to load ticket: ${error.message}`);
  if (!data) return null;
  const [ticket] = await withRides([data]);
  return ticket ?? null;
}

/** The user's most recent rides, to pick from when filing a ticket. */
export async function getRecentRidesForTicket(user: Pick<User, 'id' | 'role'>): Promise<TicketRideOption[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('rides')
    .select('id, pickup_address, dropoff_address, created_at')
    .eq(user.role === 'driver' ? 'driver_id' : 'rider_id', user.id)
    .in('status', ['completed', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(15);
  if (error) throw new Error(`Failed to load recent rides: ${error.message}`);
  return (data ?? []).map((ride) => ({ id: ride.id, label: `${ride.pickup_address} → ${ride.dropoff_address}`, created_at: ride.created_at }));
}
