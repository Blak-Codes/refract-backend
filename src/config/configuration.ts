/**
 * Typed application configuration, loaded once by Nest's ConfigModule.
 *
 * Kept as a single factory function (rather than scattered `process.env`
 * reads) so every consumer gets the same parsed/defaulted values and the
 * shape is documented in one place. See `.env.example` for the full list
 * of variables this reads.
 */
export interface AppConfig {
  port: number;
  frontendUrl: string;
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  stellar: {
    network: string;
    sorobanRpcUrl: string;
    networkPassphrase: string;
    poolContractId: string;
    policyContractId: string;
    oracleContractId: string;
    relayerSecret: string;
  };
  oracles: {
    coingeckoBaseUrl: string;
    horizonUrl: string;
    defiLlamaBaseUrl: string;
    defiLlamaProtocolSlug: string;
    httpTimeoutMs: number;
  };
  throttle: {
    /**
     * Named throttling tiers, each expressed as `{ limit, ttl }` where
     * `limit` is the max number of requests allowed per `ttl` window
     * (milliseconds). Consumed by `ThrottlerModule.forRootAsync` and
     * referenced by name from `@Throttle({ ... })` route overrides.
     */
    tiers: {
      /** Upstream-proxying reads (e.g. GET /oracle/status). */
      strict: { limit: number; ttl: number };
      /** Chain-writing posts (e.g. /tx/submit, /policies/buy). */
      chainWrite: { limit: number; ttl: number };
      /** Ordinary database-backed reads. */
      moderate: { limit: number; ttl: number };
      /** Static catalog routes (e.g. /quotes/coverage-types). */
      generous: { limit: number; ttl: number };
    };
    /**
     * Whether to trust `X-Forwarded-For` from a fronting proxy. Must be
     * set deliberately (never implicitly) so IP-based limiting does not
     * collapse every caller onto the load balancer's address.
     */
    trustProxy: boolean;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT || "4001", 10),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  database: {
    url: process.env.DATABASE_URL || "postgres://refract:refract@localhost:5432/refract",
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  stellar: {
    network: process.env.STELLAR_NETWORK || "testnet",
    sorobanRpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
    networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
    poolContractId: process.env.REFRACT_POOL_CONTRACT_ID || "",
    policyContractId: process.env.REFRACT_POLICY_CONTRACT_ID || "",
    oracleContractId: process.env.REFRACT_ORACLE_CONTRACT_ID || "",
    relayerSecret: process.env.ORACLE_RELAYER_SECRET || "",
  },
  oracles: {
    coingeckoBaseUrl: process.env.COINGECKO_BASE_URL || "https://api.coingecko.com/api/v3",
    horizonUrl: process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org",
    defiLlamaBaseUrl: process.env.DEFILLAMA_BASE_URL || "https://api.llama.fi",
    // Placeholder "covered protocol" for the SmartContractRisk TVL-drop
    // check until Refract defines a real list of covered Soroban
    // protocols. Defaults to a large, consistently-tracked protocol so
    // the drop-detection logic has real data to run against.
    defiLlamaProtocolSlug: process.env.DEFILLAMA_PROTOCOL_SLUG || "aave",
    httpTimeoutMs: parseInt(process.env.ORACLE_HTTP_TIMEOUT_MS || "5000", 10),
  },
  throttle: {
    // Defaults are derived from the frontend's refresh cadence so
    // legitimate polling is never throttled, while still capping the
    // upstream-proxying endpoints well below CoinGecko's keyless tier
    // (~10-30 req/min) to protect the shared egress IP.
    tiers: {
      // GET /oracle/status fans out to CoinGecko, Horizon and DeFiLlama
      // on every call, so keep it tight: 10 requests per minute.
      strict: {
        limit: parseInt(process.env.THROTTLE_STRICT_LIMIT || "10", 10),
        ttl: parseInt(process.env.THROTTLE_STRICT_TTL_MS || "60000", 10),
      },
      // Chain-writing posts relay to Soroban RPC; 20 per minute is
      // generous for a human-driven UI but caps runaway loops.
      chainWrite: {
        limit: parseInt(process.env.THROTTLE_CHAIN_WRITE_LIMIT || "20", 10),
        ttl: parseInt(process.env.THROTTLE_CHAIN_WRITE_TTL_MS || "60000", 10),
      },
      // Ordinary database reads: 120 per minute comfortably covers the
      // frontend's polling without hammering Postgres.
      moderate: {
        limit: parseInt(process.env.THROTTLE_MODERATE_LIMIT || "120", 10),
        ttl: parseInt(process.env.THROTTLE_MODERATE_TTL_MS || "60000", 10),
      },
      // Static catalog routes are cheap and cacheable: 300 per minute.
      generous: {
        limit: parseInt(process.env.THROTTLE_GENEROUS_LIMIT || "300", 10),
        ttl: parseInt(process.env.THROTTLE_GENEROUS_TTL_MS || "60000", 10),
      },
    },
    // Opt-in only: set THROTTLE_TRUST_PROXY=true when running behind a
    // load balancer that sets X-Forwarded-For. Left off by default so a
    // direct deployment cannot be spoofed via a forged header.
    trustProxy: process.env.THROTTLE_TRUST_PROXY === "true",
  },
});
