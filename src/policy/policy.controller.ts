import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Body,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { BuyPolicyDto } from "./dto/buy-policy.dto";
import { PolicyService } from "./policy.service";
import { IdempotencyService } from "../common/idempotency.service";

const ENDPOINT = "POST /api/v1/policies/buy";

@Controller("api/v1/policies")
export class PolicyController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly idempotency: IdempotencyService
  ) {}

  @Get("types")
  listTypes() {
    return { coverageTypes: this.policyService.listTypes() };
  }

  /**
   * Real on-chain read (unlike listTypes()'s per-type catalog, which is
   * this service's own static product policy) — the pool enforces a
   * single global min/max coverage across every type, so the frontend
   * needs this to validate a coverageAmount before ever building a tx.
   * Registered ahead of the :id route below so "coverage-bounds" isn't
   * swallowed as a policy id.
   */
  @Get("coverage-bounds")
  async getCoverageBounds() {
    const bounds = await this.policyService.onChainCoverageBounds();
    return {
      minCoverage: bounds ? bounds.minCoverage.toString() : null,
      maxCoverage: bounds ? bounds.maxCoverage.toString() : null,
    };
  }

  @Get("holder/:address")
  findByHolder(@Param("address") address: string) {
    return { policies: this.policyService.findByHolder(address) };
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    const policy = this.policyService.findById(id);
    if (!policy) throw new NotFoundException({ error: "Policy not found" });
    return { policy };
  }

  /**
   * Idempotent policy purchase.
   *
   * Pass an `Idempotency-Key` header (e.g. a UUID generated client-side)
   * to make the endpoint safe to retry.  Retries with the same key return
   * the original response without creating a second policy or firing a
   * second Soroban simulation.
   *
   * If no key is supplied the request is processed once without any
   * deduplication guarantee (existing behaviour, preserved for backward
   * compatibility).
   */
  @Post("buy")
  @HttpCode(HttpStatus.CREATED)
  async buy(
    @Body() dto: BuyPolicyDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    if (!idempotencyKey) {
      return this.policyService.buy(dto);
    }

    const check = await this.idempotency.acquire(idempotencyKey, ENDPOINT);
    if (check.hit) {
      res.status(check.record.statusCode);
      return check.record.responseBody;
    }

    try {
      const result = await this.policyService.buy(dto);
      await this.idempotency.commit(idempotencyKey, ENDPOINT, result, HttpStatus.CREATED);
      return result;
    } catch (err) {
      // Don't cache errors that are client-fixable (bad request, etc.) —
      // release the lock so the client can retry with the corrected payload.
      await this.idempotency.release(idempotencyKey, ENDPOINT);
      throw err;
    }
  }
}
