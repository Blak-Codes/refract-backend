import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Res } from "@nestjs/common";
import { Response } from "express";
import { SubmitTxDto } from "./dto/submit-tx.dto";
import { TxService } from "./tx.service";
import { IdempotencyService } from "../common/idempotency.service";

const ENDPOINT = "POST /api/v1/tx/submit";

@Controller("api/v1/tx")
export class TxController {
  constructor(
    private readonly txService: TxService,
    private readonly idempotency: IdempotencyService
  ) {}

  /**
   * Idempotent transaction submission.
   *
   * Pass `Idempotency-Key` (e.g. the transaction hash, or a client UUID)
   * to prevent double-submission on retry.  A repeated key returns the
   * original confirmation result without re-submitting to Soroban RPC.
   *
   * Note: an already-submitted-and-confirmed Soroban tx would fail with a
   * "tx_bad_seq" error from the RPC anyway, but caching the response here
   * surfaces a clean confirmation replay instead of an opaque RPC error.
   */
  @Post("submit")
  @HttpCode(HttpStatus.OK)
  async submit(
    @Body() dto: SubmitTxDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    if (!idempotencyKey) {
      return this.txService.submit(dto.signedXdr);
    }

    const check = await this.idempotency.acquire(idempotencyKey, ENDPOINT);
    if (check.hit) {
      res.status(check.record.statusCode);
      return check.record.responseBody;
    }

    try {
      const result = await this.txService.submit(dto.signedXdr);
      await this.idempotency.commit(idempotencyKey, ENDPOINT, result, HttpStatus.OK);
      return result;
    } catch (err) {
      await this.idempotency.release(idempotencyKey, ENDPOINT);
      throw err;
    }
  }
}
