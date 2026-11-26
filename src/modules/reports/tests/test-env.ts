/**
 * Test bootstrap. Imported first by every report test file.
 *
 * It must run before anything imports the Prisma client, so it points
 * DATABASE_URL at the dedicated test database and refuses to run anywhere else.
 */
import 'dotenv/config';

const fallbackTestUrl =
  'postgresql://swasthsetu:swasthsetu_dev@localhost:5432/swasthsetu_test_db';

const testUrl = process.env.TEST_DATABASE_URL || fallbackTestUrl;

if (!/_test_db(\?|$)/.test(testUrl) && process.env.ALLOW_NON_TEST_DB !== '1') {
  throw new Error(
    'Refusing to run medical report tests against a non-test database. ' +
      'Set TEST_DATABASE_URL to a database whose name ends in _test_db.'
  );
}

process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
process.env.REPORT_UPLOAD_RATE_LIMIT = '10000';
process.env.MEDICAL_REPORT_MAX_UPLOAD_MB = '2';
process.env.MEDICAL_REPORT_TIMEOUT_MS = '800';

if (!process.env.JWT_ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET is required to mint test tokens (.env).');
}
