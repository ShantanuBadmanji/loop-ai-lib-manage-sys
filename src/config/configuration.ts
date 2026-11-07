export interface AppConfig {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  loan: {
    periodDays: number;
    damageClaimWindowHours: number;
  };
  throttle: {
    ttlSeconds: number;
    limit: number;
  };
  corsOrigins: string[];
  seed: {
    librarianEmail: string;
    librarianPassword: string;
    studentEmail: string;
    studentPassword: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongodbUri:
    process.env.MONGODB_URI ?? 'mongodb://localhost:27017/library?replicaSet=rs0',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '3600s',
  },
  loan: {
    periodDays: parseInt(process.env.LOAN_PERIOD_DAYS ?? '14', 10),
    damageClaimWindowHours: parseInt(
      process.env.DAMAGE_CLAIM_WINDOW_HOURS ?? '48',
      10,
    ),
  },
  throttle: {
    ttlSeconds: parseInt(process.env.THROTTLE_TTL_SECONDS ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '10', 10),
  },
  corsOrigins: (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  seed: {
    librarianEmail: process.env.SEED_LIBRARIAN_EMAIL ?? 'librarian@university.edu',
    librarianPassword: process.env.SEED_LIBRARIAN_PASSWORD ?? 'Librarian@123',
    studentEmail: process.env.SEED_STUDENT_EMAIL ?? 'student@university.edu',
    studentPassword: process.env.SEED_STUDENT_PASSWORD ?? 'Student@123',
  },
});
