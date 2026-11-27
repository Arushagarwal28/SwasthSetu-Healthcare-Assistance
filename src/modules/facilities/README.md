# Facility registration codes

A facility registration code is an invitation credential. A new
`HOSPITAL_STAFF` account submits it at registration and is linked to exactly one
facility. Only `HMAC-SHA256(FACILITY_CODE_PEPPER, normalizedCode)` is stored, in
`facility_registration_codes.codeLookup`; the plaintext is returned once at
creation/rotation and never persisted or logged.

## Custom-code policy

Custom codes are chosen by an administrator and pass `assertCustomCodePolicy`
in `facility.code.service.ts`:

| Rule | Value |
|---|---|
| Length after normalisation (upper case, spaces/dashes removed) | 12–32 characters |
| Characters | `A–Z` and `0–9` only |
| Composition | at least one letter and at least one digit |
| Variety | at least 6 different characters |
| Repetition | no character repeated more than 3 times in a row |
| Patterns | not a short block repeated to fill the code |

Short, guessable examples such as `HOSP123`, `PHC123` and `CHC123` are therefore
rejected in every environment. There is no test-only bypass: integration tests
use codes that satisfy the production policy (`PHC2026NORTH1`,
`HOSP2026WEST12`, …).

Generated codes are unaffected: 12 random characters from
`ABCDEFGHJKMNPQRSTVWXYZ23456789` (no I, L, O, U, 0 or 1), shown as
`XXXX-XXXX-XXXX`.

## Compatibility

Codes issued under the earlier 6-character policy remain valid **at
registration**: `resolveFacilityCodeForRegistration` keeps a floor of
`CODE_MIN_LENGTH = 6`, so existing staff links and facility associations are
never silently invalidated. Only the creation policy uses
`CUSTOM_CODE_MIN_LENGTH = 12`. Rotating a facility's code replaces it; staff
links are not affected.

## Lifecycle

`POST /api/v1/facilities/:id/registration-code` creates the first active code,
`.../rotate` revokes the current one and issues a new one, `.../revoke` disables
it, and `PATCH .../registration-code` changes the expiry. Every action writes a
`FacilityCodeAudit` row; the admin overview exposes status/expiry metadata but
never the code value.

## Tests

- Unit (no database): `node --require ts-node/register --test "src/modules/facilities/tests/*.test.ts"`
- API integration: see `src/modules/vaccination/tests/integration/README.md`.
