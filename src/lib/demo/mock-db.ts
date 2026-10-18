import { createInitialDemoDatabase, type DemoDatabase } from './seed-data';

// Global singleton for in-memory demo state across server requests
const globalStateKey = Symbol.for('cabgo.demo.database');
const globalAny = globalThis as unknown as { [key: symbol]: DemoDatabase };

if (!globalAny[globalStateKey]) {
  globalAny[globalStateKey] = createInitialDemoDatabase();
}

export function getDemoDb(): DemoDatabase {
  return globalAny[globalStateKey];
}

export function resetDemoDb(): void {
  globalAny[globalStateKey] = createInitialDemoDatabase();
}

type FilterFn = (item: Record<string, unknown>) => boolean;

export class MockQueryBuilder {
  private table: string;
  private filters: FilterFn[] = [];
  private orderCol: string | null = null;
  private orderAscending = true;
  private limitCount: number | null = null;
  private offsetCount = 0;
  private isSingle = false;
  private isMaybeSingle = false;
  private isHeadCount = false;
  private insertData: unknown = null;
  private updateData: unknown = null;
  private isDelete = false;

  constructor(table: string) {
    this.table = table;
  }

  select(fields?: string, options?: { count?: 'exact'; head?: boolean }) {
    if (options?.head) {
      this.isHeadCount = true;
    }
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push((item) => item[col] === val);
    return this;
  }

  neq(col: string, val: unknown) {
    this.filters.push((item) => item[col] !== val);
    return this;
  }

  gte(col: string, val: unknown) {
    this.filters.push((item) => {
      const v = item[col];
      if (typeof v === 'string' || typeof v === 'number') {
        return v >= (val as string | number);
      }
      return false;
    });
    return this;
  }

  lte(col: string, val: unknown) {
    this.filters.push((item) => {
      const v = item[col];
      if (typeof v === 'string' || typeof v === 'number') {
        return v <= (val as string | number);
      }
      return false;
    });
    return this;
  }

  gt(col: string, val: unknown) {
    this.filters.push((item) => {
      const v = item[col];
      if (typeof v === 'string' || typeof v === 'number') {
        return v > (val as string | number);
      }
      return false;
    });
    return this;
  }

  lt(col: string, val: unknown) {
    this.filters.push((item) => {
      const v = item[col];
      if (typeof v === 'string' || typeof v === 'number') {
        return v < (val as string | number);
      }
      return false;
    });
    return this;
  }

  like(col: string, pattern: string) {
    const regex = new RegExp(`^${pattern.replace(/%/g, '.*')}$`, 'i');
    this.filters.push((item) => regex.test(String(item[col] ?? '')));
    return this;
  }

  ilike(col: string, pattern: string) {
    return this.like(col, pattern);
  }

  in(col: string, values: unknown[]) {
    const set = new Set(values);
    this.filters.push((item) => set.has(item[col]));
    return this;
  }

  is(col: string, val: unknown) {
    this.filters.push((item) => item[col] === val);
    return this;
  }

  not(col: string, operator: string, val: unknown) {
    if (operator === 'is' || operator === 'eq') {
      this.filters.push((item) => item[col] !== val);
    }
    return this;
  }

  order(col: string, { ascending = true } = {}) {
    this.orderCol = col;
    this.orderAscending = ascending;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.offsetCount = from;
    this.limitCount = to - from + 1;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(data: unknown) {
    this.insertData = data;
    return this;
  }

  update(data: unknown) {
    this.updateData = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  // Execute the query
  private execute(): { data: unknown; error: null; count?: number } {
    const db = getDemoDb();
    const rows = (db[this.table as keyof DemoDatabase] ?? []) as Record<string, unknown>[];

    // Handle INSERT
    if (this.insertData) {
      const toInsert = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      const insertedRows = toInsert.map((item) => {
        const row = {
          id: (item as { id?: string }).id ?? crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item,
        };
        rows.push(row);
        return row;
      });
      const data = this.isSingle || (!Array.isArray(this.insertData) && !this.isMaybeSingle)
        ? insertedRows[0]
        : insertedRows;
      return { data, error: null };
    }

    // Handle UPDATE
    if (this.updateData) {
      const updatedRows: Record<string, unknown>[] = [];
      for (const item of rows) {
        if (this.filters.every((f) => f(item))) {
          Object.assign(item, this.updateData, { updated_at: new Date().toISOString() });
          updatedRows.push(item);
        }
      }
      const data = this.isSingle || this.isMaybeSingle ? updatedRows[0] ?? null : updatedRows;
      return { data, error: null };
    }

    // Handle DELETE
    if (this.isDelete) {
      const remaining = rows.filter((item) => !this.filters.every((f) => f(item)));
      (db[this.table as keyof DemoDatabase] as unknown) = remaining;
      return { data: null, error: null };
    }

    // Handle SELECT
    let result = rows.filter((item) => this.filters.every((f) => f(item)));
    const totalCount = result.length;

    if (this.isHeadCount) {
      return { data: null, error: null, count: totalCount };
    }

    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.orderAscending ? 1 : -1;
      result.sort((a, b) => {
        const va = a[col] as string | number | undefined;
        const vb = b[col] as string | number | undefined;
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (va < vb) return -1 * asc;
        if (va > vb) return 1 * asc;
        return 0;
      });
    }

    if (this.offsetCount > 0) {
      result = result.slice(this.offsetCount);
    }
    if (this.limitCount != null) {
      result = result.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      return { data: result[0] ?? null, error: null, count: totalCount };
    }
    if (this.isMaybeSingle) {
      return { data: result[0] ?? null, error: null, count: totalCount };
    }

    return { data: result, error: null, count: totalCount };
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const res = this.execute();
    return Promise.resolve(res).then(onfulfilled, onrejected);
  }
}

export class MockSupabaseClient {
  from(table: string) {
    return new MockQueryBuilder(table);
  }

  get realtime() {
    return {
      setAuth: () => {},
    };
  }

  channel(_name: string) {
    const ch = {
      on: () => ch,
      subscribe: () => ch,
      unsubscribe: () => {},
    };
    return ch;
  }

  async rpc(name: string, params?: Record<string, unknown>) {
    const db = getDemoDb();

    if (name === 'admin_overview') {
      const totalRides = db.rides.length;
      const completedRides = db.rides.filter((r) => r.status === 'completed').length;
      const cancelledRides = db.rides.filter((r) => r.status === 'cancelled').length;
      const activeRides = db.rides.filter((r) => ['accepted', 'driver_arriving', 'in_progress'].includes(r.status)).length;
      const totalRevenue = db.payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0);
      const platformRevenue = db.payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + Number(p.platform_fee), 0);
      const onlineDrivers = db.driver_profiles.filter((d) => d.is_online).length;
      const pendingVerifications = db.driver_profiles.filter((d) => d.verification_status === 'pending').length;
      const openTickets = db.support_tickets.filter((t) => t.status === 'open').length;
      const activeSos = db.sos_alerts.filter((s) => s.status === 'active').length;

      return {
        data: {
          total_revenue: totalRevenue,
          platform_revenue: platformRevenue,
          total_rides: totalRides,
          completed_rides: completedRides,
          cancelled_rides: cancelledRides,
          active_rides: activeRides,
          rides_today: 1,
          total_users: db.users.length,
          total_riders: db.users.filter((u) => u.role === 'rider').length,
          total_drivers: db.driver_profiles.length,
          online_drivers: onlineDrivers,
          pending_verifications: pendingVerifications,
          open_tickets: openTickets,
          active_sos: activeSos,
        },
        error: null,
      };
    }

    if (name === 'admin_daily_stats') {
      const days = Number(params?.p_days ?? 7);
      const daily = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const dayStr = d.toISOString().split('T')[0] ?? '';
        daily.push({
          day: dayStr,
          rides_count: i === 0 ? 1 : Math.floor(Math.random() * 4) + 1,
          completed_count: i === 0 ? 1 : Math.floor(Math.random() * 3) + 1,
          cancelled_count: 0,
          revenue: i === 0 ? 650 : Math.floor(Math.random() * 1500) + 400,
        });
      }
      return { data: daily, error: null };
    }

    if (name === 'find_nearby_drivers') {
      const nearby = db.driver_profiles
        .filter((d) => d.is_online && d.is_verified)
        .map((dp) => {
          const u = db.users.find((u) => u.id === dp.user_id);
          return {
            driver_user_id: dp.user_id,
            driver_profile_id: dp.id,
            full_name: u?.full_name ?? 'Driver',
            avatar_url: u?.avatar_url ?? null,
            vehicle_type: dp.vehicle_type,
            vehicle_model: dp.vehicle_model,
            vehicle_color: dp.vehicle_color,
            vehicle_plate: dp.vehicle_plate,
            average_rating: dp.average_rating,
            total_rides: dp.total_rides,
            current_lat: dp.current_lat ?? 17.4435,
            current_lng: dp.current_lng ?? 78.3772,
            current_heading: dp.current_heading ?? 90,
            distance_km: 1.4,
          };
        });
      return { data: nearby, error: null };
    }

    if (name === 'accept_ride') {
      const rideId = params?.p_ride_id as string;
      const driverId = params?.p_driver_id as string;
      const ride = db.rides.find((r) => r.id === rideId);
      if (ride) {
        ride.driver_id = driverId;
        ride.status = 'accepted';
        ride.accepted_at = new Date().toISOString();
        return { data: ride, error: null };
      }
      return { data: null, error: { message: 'Ride not found' } };
    }

    if (name === 'validate_promo_code') {
      const code = params?.p_code as string;
      const fare = Number(params?.p_fare ?? 0);
      const promo = db.promo_codes.find((p) => p.code.toUpperCase() === code.toUpperCase() && p.is_active);
      if (!promo) {
        return { data: null, error: { message: 'Invalid or expired promo code' } };
      }
      let discount = promo.discount_type === 'percentage'
        ? (fare * Number(promo.discount_value)) / 100
        : Number(promo.discount_value);
      if (promo.max_discount && discount > Number(promo.max_discount)) {
        discount = Number(promo.max_discount);
      }
      return {
        data: {
          code: promo.code,
          discount_amount: Math.round(discount),
          final_fare: Math.max(0, fare - discount),
        },
        error: null,
      };
    }

    return { data: null, error: null };
  }
}
