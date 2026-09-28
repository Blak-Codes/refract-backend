import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Res } from "@nestjs/common";
import { Response } from "express";
import { DepositDto } from "./dto/deposit.dto";
import { WithdrawDto } from "./dto/withdraw.dto";
import { PoolService } from "./pool.service";
import { IdempotencyService } from "../common/idempotency.service";

const PROVIDE_ENDPOINT = "POST /api/v1/pool/provide";
const WITHDRAW_ENDPOINT = "POST /api/v1/pool/withdraw";

@Controller("api/v1/pool")
export class PoolController {
  constructor(
    private readonly poolService: PoolService,
    private readonly idempotency: IdempotencyService
  ) {}

  @Get("stats")
  getStats() {
    return this.poolService.getStats();
  }

  @Get("user/:address")
  getUserPosition(@Param("address") address: string) {
    return this.poolService.getUserPosition(address);
  }

  /**
   * Real on-chain read (unlike stats/user, still mocked pending the
   * Postgres wiring) — lets the frontend show a withdrawal lockup
   * countdown before the caller ever attempts to submit one.
   */
  @Get("lockup/:address")
  async getLockupStatus(@Param("address") address: string) {
    const lockupExpiresAt = await this.poolService.lockupExpiresAt(address);
    return { lockupExpiresAt: lockupExpiresAt !== null ? lockupExpiresAt.toString() : null };
  }

  /**
   * Idempotent capital deposit.
   *
   * Pass `Idempotency-Key` to make this safe to retry — the same key
   * returns the original unsigned XDR and share calculation without firing
   * a second Soroban simulation or creating a duplicate LP position.
   */
  @Post("provide")
  @HttpCode(HttpStatus.CREATED)
  async provide(
    @Body() dto: DepositDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    if (!idempotencyKey) {
      return this.poolService.provide(dto);
    }

    const check = await this.idempotency.acquire(idempotencyKey, PROVIDE_ENDPOINT);
    if (check.hit) {
      res.status(check.record.statusCode);
      return check.record.responseBody;
    }

    try {
      const result = await this.poolService.provide(dto);
      await this.idempotency.commit(idempotencyKey, PROVIDE_ENDPOINT, result, HttpStatus.CREATED);
      return result;
    } catch (err) {
      await this.idempotency.release(idempotencyKey, PROVIDE_ENDPOINT);
      throw err;
    }
  }

  /**
   * Idempotent capital withdrawal.
   *
   * Pass `Idempotency-Key` to make this safe to retry — the same key
   * replays the original unsigned XDR without a second lockup check or
   * Soroban simulation.
   */
  @Post("withdraw")
  @HttpCode(HttpStatus.CREATED)
  async withdraw(
    @Body() dto: WithdrawDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    if (!idempotencyKey) {
      return this.poolService.withdraw(dto);
    }

    const check = await this.idempotency.acquire(idempotencyKey, WITHDRAW_ENDPOINT);
    if (check.hit) {
      res.status(check.record.statusCode);
      return check.record.responseBody;
    }

    try {
      const result = await this.poolService.withdraw(dto);
      await this.idempotency.commit(idempotencyKey, WITHDRAW_ENDPOINT, result, HttpStatus.CREATED);
      return result;
    } catch (err) {
      await this.idempotency.release(idempotencyKey, WITHDRAW_ENDPOINT);
      throw err;
    }
  }

  @Get("premium-history")
  getPremiumHistory() {
    return { history: this.poolService.getPremiumHistory() };
  }
}
