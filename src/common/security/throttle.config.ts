/**
 * Auth-endpoint rate limits, read from the environment at module load so they
 * can be relaxed in tests and tuned per environment. Defaults are conservative
 * for production use.
 */
export const authThrottle = {
  register: {
    default: {
      limit: Number(process.env.THROTTLE_AUTH_REGISTER_LIMIT ?? 5),
      ttl: 60_000,
    },
  },
  login: {
    default: {
      limit: Number(process.env.THROTTLE_AUTH_LOGIN_LIMIT ?? 10),
      ttl: 60_000,
    },
  },
};
