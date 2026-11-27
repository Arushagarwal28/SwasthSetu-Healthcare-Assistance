/**
 * Bootstrap for the facility-code / cross-facility vaccination integration
 * suite. Imported first by every file in this directory, before anything opens
 * a Prisma client.
 *
 * Safety rules (deliberately no fallback and no bypass):
 *  - TEST_DATABASE_URL must be set explicitly by the caller.
 *  - Its database name must end in `_test_db`.
 *  - NODE_ENV=production is refused.
 * The suite creates and deletes rows, so it must never touch the development or
 * production database, even if DATABASE_URL is set to one.
 */
import 'dotenv/config';

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required. Point it at a dedicated test database whose ' +
      'name ends in _test_db (for example: swasthsetu_test_db).'
  );
}

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run integration tests with NODE_ENV=production.');
}

let databaseName: string;
try {
  databaseName = decodeURIComponent(new URL(testUrl).pathname.replace(/^\//, ''));
} catch {
  throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL connection URL.');
}

if (!/_test_db$/.test(databaseName)) {
  throw new Error(
    `Refusing to run against "${databaseName || 'unknown database'}": the test database ` +
      'name must end in _test_db. There is no override for this check.'
  );
}

process.env.DATABASE_URL = testUrl;
// The error handler must not attach stack traces, and services may branch on this.
process.env.NODE_ENV = 'test';

// The suite makes a handful of verification/registration calls per account.
// Keep the production throttles from turning a functional check into a 429.
process.env.CHILD_VERIFY_RATE_LIMIT = '1000';
process.env.REGISTER_RATE_LIMIT = '1000';

// Test-only values, used only inside the throwaway test database. They are not
// secrets and are never valid outside this run.
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'integration-test-access-secret';
process.env.FACILITY_CODE_PEPPER = process.env.FACILITY_CODE_PEPPER || 'integration-test-pepper';
