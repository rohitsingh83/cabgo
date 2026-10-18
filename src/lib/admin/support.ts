import 'server-only';

import { loadUserBriefs, pageWindow, toPage, type UserBrief } from '@/lib/admin/common';
import { ApiError } from '@/lib/api';
import { TICKET_STATUS_LABEL } from '@/lib/feedback';
import { createNotification } from '@/lib/notifications';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Paginated, Ride, SupportTicket, TicketStatus, User } from '@/types';

export interface AdminTicketRow extends SupportTicket {
  user: UserBrief | null;
}

export interface AdminTicketsQuery {
  page: number;
  q?: string;
  status: 'all' | TicketStatus;
  category: 'all' | SupportTicket['category'];
}

export async function listAdminTickets(query: AdminTicketsQuery): Promise<Paginated<AdminTicketRow>> {
  const db = createSupabaseAdminClient();
  const { from, to } = pageWindow(query.page);

  let request = db
    .from('support_tickets')
    .select('*', { count: 'exact' })
    // Work the queue oldest-first while looking at unresolved tickets; history reads newest-first.
    .order('created_at', { ascending: query.status === 'open' || query.status === 'in_progress' })
    .range(from, to);
  if (query.status !== 'all') request = request.eq('status', query.status);
  if (query.category !== 'all') request = request.eq('category', query.category);
  if (query.q) request = request.or(`subject.ilike.%${query.q}%,description.ilike.%${query.q}%`);

  const { data, error, count } = await request;
  if (error) throw new Error(`Failed to load tickets: ${error.message}`);
  const briefs = await loadUserBriefs((data ?? []).map((ticket) => ticket.user_id));
  return toPage((data ?? []).map((ticket) => ({ ...ticket, user: briefs.get(ticket.user_id) ?? null })), query.page, count);
}

export interface AdminTicketDetail extends AdminTicketRow {
  ride: Pick<Ride, 'id' | 'pickup_address' | 'dropoff_address' | 'created_at' | 'status'> | null;
  resolver: UserBrief | null;
}

export async function getAdminTicket(ticketId: string): Promise<AdminTicketDetail | null> {
  const db = createSupabaseAdminClient();
  const { data: ticket, error } = await db.from('support_tickets').select('*').eq('id', ticketId).maybeSingle();
  if (error) throw new Error(`Failed to load ticket: ${error.message}`);
  if (!ticket) return null;

  const [briefs, ride] = await Promise.all([
    loadUserBriefs([ticket.user_id, ticket.resolved_by]),
    ticket.ride_id ? db.from('rides').select('id, pickup_address, dropoff_address, created_at, status').eq('id', ticket.ride_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (ride.error) throw new Error(`Failed to load ticket ride: ${ride.error.message}`);

  return { ...ticket, user: briefs.get(ticket.user_id) ?? null, resolver: ticket.resolved_by ? briefs.get(ticket.resolved_by) ?? null : null, ride: ride.data ?? null };
}

/**
 * Reply to / re-status a ticket.
 *  - Resolving needs a written reply (the customer must be told what happened).
 *  - `resolved_by` / `resolved_at` follow the status (the DB trigger sets `resolved_at`; moving the ticket
 *    out of "resolved" clears both).
 *  - The customer gets an in-app notification (live) that deep-links to the ticket.
 */
export async function updateTicket(admin: Pick<User, 'id'>, ticketId: string, input: { status: TicketStatus; response?: string }): Promise<SupportTicket> {
  const db = createSupabaseAdminClient();
  const { data: ticket, error } = await db.from('support_tickets').select('*').eq('id', ticketId).maybeSingle();
  if (error) throw new Error(`Failed to load ticket: ${error.message}`);
  if (!ticket) throw new ApiError(404, 'Ticket not found.');

  const response = input.response ?? ticket.admin_response ?? undefined;
  if (input.status === 'resolved' && !response) {
    throw new ApiError(400, 'Write a reply before resolving the ticket.', { response: ['A reply is required to resolve'] });
  }
  if (input.status === ticket.status && input.response === undefined) {
    throw new ApiError(400, 'Nothing to update — change the status or write a reply.');
  }

  const { data: updated, error: updateError } = await db
    .from('support_tickets')
    .update({
      status: input.status,
      admin_response: response ?? null,
      resolved_by: input.status === 'resolved' ? admin.id : null,
    })
    .eq('id', ticketId)
    .select('*')
    .single();
  if (updateError || !updated) throw new Error(`Failed to update ticket: ${updateError?.message ?? 'no row returned'}`);

  const replied = input.response !== undefined && input.response !== ticket.admin_response;
  const { data: owner } = await db.from('users').select('role').eq('id', ticket.user_id).maybeSingle();
  await createNotification({
    userId: ticket.user_id,
    type: 'ticket_update',
    title: replied ? 'Support replied to your ticket' : `Ticket ${TICKET_STATUS_LABEL[input.status].toLowerCase()}`,
    message: replied && response ? response.slice(0, 160) : `“${ticket.subject}” is now ${TICKET_STATUS_LABEL[input.status].toLowerCase()}.`,
    data: { ticketId, url: `/${owner?.role === 'driver' ? 'driver' : 'rider'}/support/${ticketId}` },
  });

  return updated;
}
