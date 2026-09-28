import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";

// DatabaseModule is @Global(), so DatabaseService is available here
// without a local import — the controller receives it via DI automatically.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
