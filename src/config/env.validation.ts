import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),
  MONGODB_URI: Joi.string().required(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('3600s'),
  LOAN_PERIOD_DAYS: Joi.number().integer().min(1).default(14),
  DAMAGE_CLAIM_WINDOW_HOURS: Joi.number().integer().min(0).default(48),
  THROTTLE_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(10),
  CORS_ORIGINS: Joi.string().default('*'),
  SEED_LIBRARIAN_EMAIL: Joi.string().email().optional(),
  SEED_LIBRARIAN_PASSWORD: Joi.string().optional(),
  SEED_STUDENT_EMAIL: Joi.string().email().optional(),
  SEED_STUDENT_PASSWORD: Joi.string().optional(),
});
