import { Module } from "@nestjs/common";
import { OracleController } from "./oracle.controller";
import { OracleGateway } from "./oracle.gateway";
import { OracleRetentionService } from "./oracle-retention.service";
import { OracleScheduler } from "./oracle.scheduler";
import { OracleService } from "./oracle.service";

@Module({
  controllers: [OracleController],
  providers: [OracleService, OracleGateway, OracleScheduler, OracleRetentionService],
  exports: [OracleService, OracleGateway],
})
export class OracleModule {}
