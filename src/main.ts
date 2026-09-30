import "reflect-metadata";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { WsAdapter } from "@nestjs/platform-ws";
import { AppModule } from "./app.module";
import { winstonLogger } from "./common/logger";
import { AppConfig } from "./config/configuration";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
  });

  const config = app.get(ConfigService<AppConfig, true>);

  // Trust the configured number of proxy hops so throttling (and any other
  // client-IP logic) sees the real caller via X-Forwarded-For instead of the
  // load balancer's address. Configured deliberately rather than implicitly.
  const trustProxy = config.get("trustProxy", { infer: true });
  if (trustProxy) {
    app.getHttpAdapter().getInstance().set("trust proxy", trustProxy);
  }

  app.use(helmet());
  app.enableCors({ origin: config.get("frontendUrl", { infer: true }) });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );
  // Use the plain `ws` protocol adapter (not Nest's default socket.io) so
  // the WebSocket wire format stays identical to the old raw `ws` server —
  // any client already speaking to the oracle feed keeps working unchanged.
  app.useWebSocketAdapter(new WsAdapter(app));

  const port = config.get("port", { infer: true });
  await app.listen(port);
}

bootstrap();
