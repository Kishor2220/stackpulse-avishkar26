export type ActiveMonitor = {
  id: string;
  name: string;
  url: string;
  expected_http_status: number;
  check_interval_seconds: 30 | 60 | 120;
};

type SchedulerDependencies = {
  loadActiveMonitors: () => Promise<ActiveMonitor[]>;
  checkMonitor: (monitor: ActiveMonitor) => Promise<void>;
  refreshMs?: number;
  onMissedSchedule?: (monitor: ActiveMonitor, delayMs: number) => void;
};

export class MonitorScheduler {
  private readonly lastStartedAt = new Map<string, number>();
  private readonly inFlight = new Set<string>();
  private monitors: ActiveMonitor[] = [];
  private lastRefreshAt = Number.NEGATIVE_INFINITY;
  private readonly refreshMs: number;
  private idleResolvers: Array<() => void> = [];

  constructor(private readonly dependencies: SchedulerDependencies) {
    this.refreshMs = dependencies.refreshMs ?? 15_000;
  }

  async tick(now = Date.now()) {
    if (now - this.lastRefreshAt >= this.refreshMs) {
      this.monitors = await this.dependencies.loadActiveMonitors();
      this.lastRefreshAt = now;
      const activeIds = new Set(this.monitors.map((monitor) => monitor.id));
      for (const id of this.lastStartedAt.keys()) if (!activeIds.has(id)) this.lastStartedAt.delete(id);
    }

    const due = this.monitors.filter((monitor) => {
      const lastStarted = this.lastStartedAt.get(monitor.id);
      if (lastStarted !== undefined && !this.inFlight.has(monitor.id)) {
        const elapsed = now - lastStarted;
        const intervalMs = monitor.check_interval_seconds * 1_000;
        // A delay longer than 1.5 intervals means at least one scheduled slot
        // was missed. We report it but never synthesize a successful check.
        if (elapsed > intervalMs * 1.5) this.dependencies.onMissedSchedule?.(monitor, elapsed - intervalMs);
      }
      return !this.inFlight.has(monitor.id) && (lastStarted === undefined || now - lastStarted >= monitor.check_interval_seconds * 1_000);
    });

    await Promise.all(due.map(async (monitor) => {
      this.inFlight.add(monitor.id);
      this.lastStartedAt.set(monitor.id, now);
      try {
        await this.dependencies.checkMonitor(monitor);
      } finally {
        this.inFlight.delete(monitor.id);
        if (this.inFlight.size === 0) {
          const resolvers = this.idleResolvers;
          this.idleResolvers = [];
          resolvers.forEach((resolve) => resolve());
        }
      }
    }));
  }

  /** Resolves once checks already started by this process have finished. */
  async waitForIdle() {
    if (this.inFlight.size === 0) return;
    await new Promise<void>((resolve) => this.idleResolvers.push(resolve));
  }
}
