import type { Repository } from '../deps';
import type { Logger } from '../lib/logger';
import type { RideLocationRow } from '../types';

/**
 * Batches breadcrumb rows so a busy fleet produces a handful of bulk INSERTs per interval
 * instead of one write per GPS sample. Rows that fail to save are re-queued (bounded), so a
 * short database outage does not lose the trail.
 */
export class LocationBuffer {
  private queue: RideLocationRow[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

  constructor(
    private readonly repository: Repository,
    private readonly logger: Logger,
    private readonly options = { flushMs: 5000, maxBatch: 200, maxQueue: 2000 },
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), this.options.flushMs);
    this.timer.unref();
  }

  push(row: RideLocationRow): void {
    this.queue.push(row);
    if (this.queue.length >= this.options.maxBatch) void this.flush();
  }

  get size(): number {
    return this.queue.length;
  }

  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    const batch = this.queue.splice(0, this.options.maxBatch);
    try {
      await this.repository.saveRideLocations(batch);
    } catch (error) {
      this.logger.error('failed to persist ride locations', { error: error instanceof Error ? error.message : String(error), rows: batch.length });
      // Put the batch back at the front, then trim the oldest rows if the queue is too long.
      this.queue = [...batch, ...this.queue].slice(-this.options.maxQueue);
    } finally {
      this.flushing = false;
    }
  }

  /** Flush everything that is left (used on shutdown). */
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    while (this.queue.length > 0) {
      const before = this.queue.length;
      await this.flush();
      if (this.queue.length >= before) break; // persistent failure — give up
    }
  }
}
