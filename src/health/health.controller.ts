import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { DatabaseService } from "../db/database.service";

/**
 * Health endpoint consumed by load-balancers, Kubernetes liveness/readiness
 * probes, and on-call dashboards.
 *
 * GET /health returns 200 when the database pool has at least one live
 * connection and no saturation, 503 otherwise — so an orchestrator can
 * distinguish "process is up but the DB is gone" from a true liveness
 * failure and restart accordingly.
 */
@Controller()
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get("health")
  @HttpCode(HttpStatus.OK)
  check(): Record<string, unknown> {
    const pool = this.db.getPoolStats();
    const dbOk = this.db.isReady;

    return {
      status: dbOk ? "ok" : "degraded",
      protocol: "Refract",
      db: {
        ready: dbOk,
        pool: {
          total: pool.total,
          idle: pool.idle,
          waiting: pool.waiting,
        },
      },
    };
  }
}
