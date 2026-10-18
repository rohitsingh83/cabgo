import assert from 'node:assert/strict';
import { after, afterEach, before, describe, test } from 'node:test';

import { io as connect, type Socket } from 'socket.io-client';

import { createRealtimeServer, type RealtimeServer } from '../src/app';
import type { Deps, LiveStore, Repository } from '../src/deps';
import { silentLogger } from '../src/lib/logger';
import type {
  ClientToServerEvents,
  DriverLocationUpdate,
  RideLocationRow,
  RideParticipants,
  ServerToClientEvents,
  SocketUser,
} from '../src/types';

/* ---------------------------------------------------------------- fixtures */

const SECRET = 'test-secret-0123456789';
const RIDER: SocketUser = { id: '11111111-1111-4111-8111-111111111111', clerkId: 'clerk_rider', role: 'rider', fullName: 'Rita Rider' };
const OTHER_RIDER: SocketUser = { id: '22222222-2222-4222-8222-222222222222', clerkId: 'clerk_other', role: 'rider', fullName: 'Omar Other' };
const DRIVER: SocketUser = { id: '33333333-3333-4333-8333-333333333333', clerkId: 'clerk_driver', role: 'driver', fullName: 'Dev Driver' };
const RIDE_ID = '44444444-4444-4444-8444-444444444444';

const TOKENS: Record<string, SocketUser> = {
  'token-rider-xxxxxxxxxxxxxxxxxxxx': RIDER,
  'token-other-xxxxxxxxxxxxxxxxxxxx': OTHER_RIDER,
  'token-driver-xxxxxxxxxxxxxxxxxxx': DRIVER,
};

const ride: RideParticipants = { rideId: RIDE_ID, riderId: RIDER.id, driverId: DRIVER.id, status: 'accepted' };

const savedRows: RideLocationRow[] = [];
const savedPositions: string[] = [];
const firebaseCalls: string[] = [];

const repository: Repository = {
  getDriverPresence: async (userId) => (userId === DRIVER.id ? { verified: true, vehicleType: 'sedan' } : null),
  getRideParticipants: async (rideId) => (rideId === RIDE_ID ? ride : null),
  saveRideLocations: async (rows) => {
    savedRows.push(...rows);
  },
  saveDriverPosition: async (userId) => {
    savedPositions.push(userId);
  },
};

const liveStore: LiveStore = {
  enabled: true,
  setDriverLocation: async (update) => void firebaseCalls.push(`driver:${update.driverId}`),
  removeDriver: async (id) => void firebaseCalls.push(`remove:${id}`),
  setRideLocation: async (update) => void firebaseCalls.push(`ride:${update.rideId}`),
  appendTrail: async (id) => void firebaseCalls.push(`trail:${id}`),
  setRideStatus: async (id, status, participants) => void firebaseCalls.push(`status:${id}:${status}:${participants.length}`),
  clearRide: async () => undefined,
  issueToken: async (userId) => `firebase-token-for-${userId}`,
};

const deps: Deps = {
  config: { nodeEnv: 'test', corsOrigins: ['http://localhost:3000'], internalSecret: SECRET },
  authenticator: { authenticate: async (token) => TOKENS[token] ?? null },
  repository,
  liveStore,
  logger: silentLogger,
};

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: RealtimeServer;
let baseUrl = '';
const open: TestSocket[] = [];

/** Connects and resolves once the handshake finished (or rejects with the server's error). */
function connectAs(token: string | null): Promise<TestSocket> {
  return new Promise((resolve, reject) => {
    const socket: TestSocket = connect(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
      auth: token ? { token } : {},
    });
    open.push(socket);
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (error) => reject(error));
  });
}

const nextEvent = <E extends keyof ServerToClientEvents>(socket: TestSocket, event: E, timeoutMs = 1500) =>
  new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${String(event)}`)), timeoutMs);
    (socket as Socket).once(event as string, (payload: Parameters<ServerToClientEvents[E]>[0]) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const joinRide = (socket: TestSocket, rideId: string) => new Promise<boolean>((resolve) => socket.emit('ride:join', { rideId }, resolve));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

/* ------------------------------------------------------------------- tests */

before(async () => {
  server = createRealtimeServer(deps);
  const port = await server.listen(0);
  baseUrl = `http://127.0.0.1:${port}`;
});

// Close every socket a test opened (the server caps concurrent sockets per user).
afterEach(async () => {
  open.splice(0).forEach((socket) => socket.close());
  await sleep(60);
});

after(async () => {
  open.forEach((socket) => socket.close());
  await server.close();
});

describe('authentication', () => {
  test('rejects sockets without a token', async () => {
    await assert.rejects(connectAs(null), /UNAUTHORIZED/);
  });

  test('rejects sockets with an unknown token', async () => {
    await assert.rejects(connectAs('token-unknown-xxxxxxxxxxxxxxxxx'), /UNAUTHORIZED/);
  });

  test('accepts a valid token', async () => {
    const socket = await connectAs('token-rider-xxxxxxxxxxxxxxxxxxxx');
    assert.equal(socket.connected, true);
  });
});

describe('ride rooms', () => {
  test('participants can join, strangers and unknown rides cannot', async () => {
    const rider = await connectAs('token-rider-xxxxxxxxxxxxxxxxxxxx');
    const stranger = await connectAs('token-other-xxxxxxxxxxxxxxxxxxxx');
    assert.equal(await joinRide(rider, RIDE_ID), true);
    assert.equal(await joinRide(stranger, RIDE_ID), false);
    assert.equal(await joinRide(rider, '55555555-5555-4555-8555-555555555555'), false);
    assert.equal(await joinRide(rider, 'not-a-uuid'), false);
  });

  test('driver GPS reaches the rider in real time and is persisted', async () => {
    const rider = await connectAs('token-rider-xxxxxxxxxxxxxxxxxxxx');
    const stranger = await connectAs('token-other-xxxxxxxxxxxxxxxxxxxx');
    const driver = await connectAs('token-driver-xxxxxxxxxxxxxxxxxxx');
    await joinRide(rider, RIDE_ID);
    await joinRide(driver, RIDE_ID);

    let strangerHeard = false;
    stranger.on('driver:location', () => {
      strangerHeard = true;
    });

    const heard = nextEvent(rider, 'driver:location');
    driver.emit('driver:location:update', { lat: 17.385, lng: 78.4867, heading: 90, speedKmh: 32, rideId: RIDE_ID });
    const update: DriverLocationUpdate = await heard;

    assert.equal(update.driverId, DRIVER.id); // identity comes from the token, not the payload
    assert.equal(update.lat, 17.385);
    assert.equal(update.heading, 90);
    assert.equal(update.rideId, RIDE_ID);

    await sleep(100);
    assert.equal(strangerHeard, false);
    assert.ok(firebaseCalls.includes(`ride:${RIDE_ID}`), 'mirrored to Firebase');
    assert.ok(savedPositions.includes(DRIVER.id), 'last position saved');

    await server.layer.ctx.buffer.flush();
    assert.equal(savedRows.length >= 1, true, 'breadcrumb persisted');
    assert.equal(savedRows[0]?.rideId, RIDE_ID);
  });

  test('late joiners get the latest location replayed', async () => {
    const rider = await connectAs('token-rider-xxxxxxxxxxxxxxxxxxxx');
    const replay = nextEvent(rider, 'driver:location');
    await joinRide(rider, RIDE_ID);
    const update = await replay;
    assert.equal(update.lat, 17.385);
  });

  test('riders cannot spoof driver locations', async () => {
    const rider = await connectAs('token-rider-xxxxxxxxxxxxxxxxxxxx');
    const watcher = await connectAs('token-driver-xxxxxxxxxxxxxxxxxxx');
    await joinRide(watcher, RIDE_ID);
    watcher.on('driver:location', () => undefined);

    let spoofed = false;
    watcher.on('driver:location', (payload) => {
      if (payload.lat === 1) spoofed = true;
    });
    (rider as Socket).emit('driver:location:update', { lat: 1, lng: 1, heading: 0, speedKmh: 0, rideId: RIDE_ID });
    await sleep(200);
    assert.equal(spoofed, false);
  });

  test('a driver cannot publish to a ride that is not theirs', async () => {
    const driver = await connectAs('token-driver-xxxxxxxxxxxxxxxxxxx');
    const original = ride.driverId;
    ride.driverId = '66666666-6666-4666-8666-666666666666';
    server.layer.ctx.rideCache.delete(RIDE_ID);
    try {
      await sleep(900); // clear the per-driver sample gate
      const error = nextEvent(driver, 'socket:error');
      driver.emit('driver:location:update', { lat: 17.4, lng: 78.5, heading: 0, speedKmh: 0, rideId: RIDE_ID });
      assert.match((await error).message, /not the driver/);
    } finally {
      ride.driverId = original;
      server.layer.ctx.rideCache.delete(RIDE_ID);
    }
  });

  test('GPS floods are throttled', async () => {
    const rider = await connectAs('token-rider-xxxxxxxxxxxxxxxxxxxx');
    const driver = await connectAs('token-driver-xxxxxxxxxxxxxxxxxxx');
    await joinRide(rider, RIDE_ID);
    await sleep(900);

    let received = 0;
    rider.on('driver:location', () => {
      received += 1;
    });
    for (let i = 0; i < 20; i += 1) {
      driver.emit('driver:location:update', { lat: 17.5 + i / 10_000, lng: 78.5, heading: 0, speedKmh: 10, rideId: RIDE_ID });
    }
    await sleep(400);
    assert.ok(received >= 1 && received <= 2, `expected throttling, got ${received}`);
  });

  test('invalid coordinates are dropped', async () => {
    const rider = await connectAs('token-rider-xxxxxxxxxxxxxxxxxxxx');
    const driver = await connectAs('token-driver-xxxxxxxxxxxxxxxxxxx');
    await joinRide(rider, RIDE_ID);
    await sleep(900);
    let received = 0;
    rider.on('driver:location', () => {
      received += 1;
    });
    (driver as Socket).emit('driver:location:update', { lat: 999, lng: 78.5, heading: 0, speedKmh: 0, rideId: RIDE_ID });
    await sleep(200);
    assert.equal(received, 0);
  });
});

describe('internal emit endpoint', () => {
  test('requires the shared secret', async () => {
    const body = { events: [{ rooms: [`user:${RIDER.id}`], event: 'notification', payload: { title: 'x' } }] };
    assert.equal((await post('/realtime/emit', body)).status, 401);
    assert.equal((await post('/realtime/emit', body, { 'x-internal-secret': 'wrong-secret-value-123' })).status, 401);
  });

  test('delivers events to the addressed user only', async () => {
    const rider = await connectAs('token-rider-xxxxxxxxxxxxxxxxxxxx');
    const other = await connectAs('token-other-xxxxxxxxxxxxxxxxxxxx');
    let otherHeard = false;
    other.on('notification', () => {
      otherHeard = true;
    });

    const heard = nextEvent(rider, 'notification');
    const res = await post(
      '/realtime/emit',
      { events: [{ rooms: [`user:${RIDER.id}`], event: 'notification', payload: { title: 'Driver found!' } }] },
      { 'x-internal-secret': SECRET },
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await heard, { title: 'Driver found!' });
    await sleep(100);
    assert.equal(otherHeard, false);
  });

  test('rejects unknown events and malformed rooms', async () => {
    const headers = { 'x-internal-secret': SECRET };
    const badEvent = { events: [{ rooms: [`user:${RIDER.id}`], event: 'disconnect', payload: {} }] };
    const badRoom = { events: [{ rooms: ['user:*'], event: 'notification', payload: {} }] };
    assert.equal((await post('/realtime/emit', badEvent, headers)).status, 400);
    assert.equal((await post('/realtime/emit', badRoom, headers)).status, 400);
  });

  test('ride lifecycle events reach every participant once and mirror to Firebase', async () => {
    const rider = await connectAs('token-rider-xxxxxxxxxxxxxxxxxxxx');
    const driver = await connectAs('token-driver-xxxxxxxxxxxxxxxxxxx');
    await joinRide(rider, RIDE_ID); // in BOTH the ride room and its user room

    let count = 0;
    rider.on('ride:status', () => {
      count += 1;
    });
    const driverHeard = nextEvent(driver, 'ride:status');

    const payload = { rideId: RIDE_ID, status: 'in_progress', driverId: DRIVER.id, at: new Date().toISOString() };
    await post(
      '/realtime/emit',
      { events: [{ rooms: [`ride:${RIDE_ID}`, `user:${RIDER.id}`, `user:${DRIVER.id}`], event: 'ride:status', payload }] },
      { 'x-internal-secret': SECRET },
    );
    assert.equal((await driverHeard).status, 'in_progress');
    await sleep(150);
    assert.equal(count, 1, 'a socket in two addressed rooms still receives the event once');
    // Rider + driver (the two personal rooms) become the Firebase read-access list; the ride room does not.
    assert.ok(firebaseCalls.includes(`status:${RIDE_ID}:in_progress:2`));
  });
});

describe('firebase token + health', () => {
  test('issues a custom token for valid sessions only', async () => {
    const denied = await post('/auth/firebase-token', {});
    assert.equal(denied.status, 401);
    const granted = await post('/auth/firebase-token', {}, { authorization: 'Bearer token-driver-xxxxxxxxxxxxxxxxxxx' });
    assert.equal(granted.status, 200);
    const json = (await granted.json()) as { data: { token: string } };
    assert.equal(json.data.token, `firebase-token-for-${DRIVER.id}`);
  });

  test('health endpoint reports status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const json = (await res.json()) as { status: string };
    assert.equal(json.status, 'ok');
  });
});
