import { createClient, type RedisClientType } from "redis";
import type { IStorageAdapter } from "@server/adapters/storage-adapter.interface";
import type { EmailService } from "@server/services/email-service";
import type { ServerConfig } from "@server/config";

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MAX_THRESHOLD_EMAILS = 3;
const MAX_EVENT_EMAILS = 1;

interface ThresholdCheck {
  key: string;
  label: string;
  threshold: number;
  getCount: () => Promise<number>;
}

export class WatchdogService {
  private redis: RedisClientType | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private storage: IStorageAdapter,
    private emailService: EmailService,
    private config: ServerConfig,
  ) {}

  async start(): Promise<void> {
    if (this.config.nodeEnv !== "production") {
      return;
    }

    if (!this.config.adminEmails.length) {
      console.warn("ADMIN_EMAILS not set. Watchdog disabled.");
      return;
    }

    if (!this.emailService.isConfigured) {
      console.warn("Email service not configured. Watchdog disabled.");
      return;
    }

    try {
      this.redis = createClient({
        url: this.config.notificationDatabaseUrl,
      }) as RedisClientType;
      this.redis.on("error", (err) =>
        console.error("Watchdog Redis error:", err),
      );
      await this.redis.connect();
      console.debug("✓ Watchdog service started (1h interval)");
    } catch (e) {
      console.error("Failed to start watchdog service:", e);
      return;
    }

    this.scheduleNext();
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.redis?.disconnect();
  }

  private scheduleNext(): void {
    this.timer = setTimeout(async () => {
      try {
        await this.run();
      } catch (e) {
        console.error("Watchdog check failed:", e);
      }
      this.scheduleNext();
    }, INTERVAL_MS);
  }

  private async run(): Promise<void> {
    if (!this.redis) return;

    console.debug("Running watchdog checks...");

    const checks: ThresholdCheck[] = [
      // User milestones
      ...[100, 1_000, 10_000].map((n) => ({
        key: `notification:usersCreated:${n}`,
        label: `${n.toLocaleString()} users`,
        threshold: n,
        getCount: () => this.storage.countUsers(),
      })),
      // Stack milestones
      ...[100, 1_000, 10_000].map((n) => ({
        key: `notification:stacksCreated:${n}`,
        label: `${n.toLocaleString()} prompts`,
        threshold: n,
        getCount: () => this.storage.countStacks(),
      })),
      // Block milestones
      ...[100, 1_000, 10_000].map((n) => ({
        key: `notification:blocksCreated:${n}`,
        label: `${n.toLocaleString()} blocks`,
        threshold: n,
        getCount: () => this.storage.countBlocks(),
      })),
      // Wildcard milestones
      ...[100, 1_000, 10_000].map((n) => ({
        key: `notification:wildcardsCreated:${n}`,
        label: `${n.toLocaleString()} wildcards`,
        threshold: n,
        getCount: () => this.storage.countWildcards(),
      })),
    ];

    // De-dupe count calls — multiple thresholds share the same counter
    const countCache = new Map<string, number>();
    const getCachedCount = async (check: ThresholdCheck): Promise<number> => {
      const cacheKey = check.getCount.toString();
      if (!countCache.has(cacheKey)) {
        countCache.set(cacheKey, await check.getCount());
      }
      return countCache.get(cacheKey)!;
    };

    for (const check of checks) {
      const count = await getCachedCount(check);
      if (count >= check.threshold) {
        await this.sendIfUnder(check.key, MAX_THRESHOLD_EMAILS, {
          subject: `Milestone: ${check.label} created`,
          text: `Prompt Manager has reached ${check.label} (current count: ${count.toLocaleString()}).`,
        });
      }
    }
  }

  /**
   * Fire a one-time notification for a specific event (e.g. new user).
   * Called externally (not by the hourly loop).
   */
  async notify(
    key: string,
    opts: { subject: string; text?: string; html?: string },
  ): Promise<void> {
    await this.sendIfUnder(`notification:${key}`, MAX_EVENT_EMAILS, opts);
  }

  private async sendIfUnder(
    redisKey: string,
    maxSends: number,
    opts: { subject: string; text?: string; html?: string },
  ): Promise<void> {
    if (!this.redis) return;

    const sent = parseInt((await this.redis.get(redisKey)) ?? "0", 10);
    if (sent >= maxSends) return;

    await this.emailService.send({
      to: this.config.adminEmails,
      ...opts,
    });

    await this.redis.set(redisKey, String(sent + 1));
  }
}
