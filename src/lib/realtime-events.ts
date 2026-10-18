/** Events the Next.js backend may ask the realtime server to deliver. Keep in sync with /server/src/types.ts. */
export const RELAYED_EVENTS = [
  'notification',
  'notification:read',
  'ride:request',
  'ride:request:expired',
  'ride:taken',
  'ride:accepted',
  'ride:status',
  'ride:cancelled',
  'ride:no-drivers',
  'sos:alert',
] as const;

export type RelayedEvent = (typeof RELAYED_EVENTS)[number];
