import { Controller, Get, Param, Query } from "@nestjs/common";
import { ListClaimsDto } from "./dto/list-claims.dto";
import { ClaimService } from "./claim.service";

/**
 * New in the NestJS migration — the pre-migration ClaimProcessor tracked
 * these stats internally but never exposed them over HTTP. Useful for
 * ops/observability, so it's kept as a small honest addition rather than
 * a pure like-for-like port.
 */
@Controller("api/v1/claims")
export class ClaimController {
  constructor(private readonly claimService: ClaimService) {}

  @Get("stats")
  getStats() {
    return this.claimService.getStats();
  }

  /**
   * Paginated claim history for a holder.
   *
   * Query params (all optional):
   *   page     – 1-based page number (default 1)
   *   limit    – results per page, 1–100 (default 20)
   *   sortDir  – asc | desc (default desc)
   */
  @Get("holder/:address")
  getHistoryForHolder(@Param("address") address: string, @Query() query: ListClaimsDto) {
    return this.claimService.getHistoryForHolder(address, query);
  }

  /**
   * Most recent settled claims across all holders.
   *
   * Query params (all optional):
   *   page     – 1-based page number (default 1)
   *   limit    – results per page, 1–100 (default 10)
   *   sortDir  – asc | desc (default desc)
   */
  @Get("recent")
  getRecent(@Query() query: ListClaimsDto) {
    return this.claimService.getRecentSettlements(query);
  }
}
