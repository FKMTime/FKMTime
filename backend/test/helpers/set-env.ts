process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://root:password@localhost:5433/fkm_time_test';
process.env.SECRET = 'dev-only-secret-not-for-production-change-me';
process.env.WCA_ORIGIN = 'http://localhost:3000';
process.env.WCA_CLIENT_ID = 'example-application-id';
process.env.WCA_CLIENT_SECRET = 'example-secret';
process.env.WCA_LIVE_API_ORIGIN = 'http://localhost:4000/api';
