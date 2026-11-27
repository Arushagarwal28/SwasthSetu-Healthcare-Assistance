# Vaccination & facility integration tests

Permanent, reproducible API-level tests for the facility registration code and
cross-facility child access work. They start the real Express app on an
ephemeral loopback port and talk to a dedicated test database through Prisma.

| File | Covers |
|---|---|
| `facility.codes.integration.test.ts` | Custom-code policy (short and predictable codes rejected), generated codes, HMAC-only storage, staff registration + automatic facility link, wrong-code rejection, rotation, revocation, admin overview metadata |
| `cross-facility.integration.test.ts` | Three-field verification, generic mismatch message, 8-hour grant, read-only scope of a grant, dose attribution to the grant facility, rejection of a different (even linked) facility, no standing access from a facility link, re-verification at another facility, postponed/not-given encounter attribution, reopen block, grant expiry |
| `central-registry.integration.test.ts` | Facility-neutral registration with an 8-hour grant, legacy `facilityId` rejection, guardian consent, historical doses that never fabricate a facility, registry-wide duplicate detection with redaction, cross-worker isolation, activity-based statistics, unchanged helper access |
| `helpers.ts` | Harness, synthetic data factories, cleanup |
| `test-env.ts` | Database safety checks and test-only configuration |

## Safety

`test-env.ts` refuses to run unless **`TEST_DATABASE_URL` is set explicitly** and
its database name ends in `_test_db`. There is no fallback URL and no override
flag, and `NODE_ENV=production` is rejected. The suite therefore cannot run
against `swasthsetu_db` (development) or a production database, even if
`DATABASE_URL` points there.

All data is synthetic and prefixed with a per-process marker
(`it-vax-<time>-<random>`). `cleanupAll()` deletes only rows created by that
process: children (cascading to doses, events and grants), then access audits,
facilities (cascading to registration codes, code audits and staff links), then
users. Existing records are never edited or deleted.

## Prerequisites

1. PostgreSQL reachable with the credentials used locally.
2. The test database exists and has the current schema:

   ```bash
   npx prisma migrate deploy   # with DATABASE_URL pointing at the test database
   npx prisma generate
   ```

3. No server needs to be running; the suite starts its own on an ephemeral port.

## Commands

```bash
# Windows (Git Bash) / Linux / macOS
TEST_DATABASE_URL="postgresql://swasthsetu:swasthsetu_dev@localhost:5432/swasthsetu_test_db" \
  npm run test:integration
```

The script runs `node --test` with `--test-concurrency=1` so the files never
overlap their synthetic data. It exits non-zero on the first failing file.

To run a single file:

```bash
TEST_DATABASE_URL="postgresql://swasthsetu:swasthsetu_dev@localhost:5432/swasthsetu_test_db" \
  node --require ts-node/register --test \
  "src/modules/vaccination/tests/integration/cross-facility.integration.test.ts"
```

`TEST_DATABASE_URL` belongs in your shell or an untracked `.env`; never commit
it with real credentials.

## Notes

- Test-only `JWT_ACCESS_SECRET` and `FACILITY_CODE_PEPPER` values are used when
  the environment does not provide them; they are not secrets and only apply to
  the throwaway test database.
- The verification and registration rate limits are raised for the run so a
  functional check cannot fail as a 429.
- No OTP, SMS, real patient data or third-party service is involved.
- Since the centralized-registry migration, children have no facility column.
  Every fixture is facility-neutral; access comes only from a temporary grant.
