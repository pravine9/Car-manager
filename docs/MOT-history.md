# MOT history – public check and API

Yes. MOT history is available publicly, and there is also a developer API for programmatic access.

---

## 1. Public check (no API key)

Anyone can look up **MOT history** for a UK vehicle using the official service. You only need the registration number.

| What | Link |
|------|------|
| **MOT history** (past tests, failures, advisories, mileage) | **[check-mot.service.gov.uk](https://www.check-mot.service.gov.uk/)** |
| GOV.UK step-by-step | [Check the MOT history of a vehicle](https://www.gov.uk/check-mot-history) |

- **Free** – no sign-up or API key.
- **Shows:** Previous MOT test dates, pass/fail, mileage at each test, failure reasons, advisory notices, expiry dates.
- **Input:** Vehicle registration number (e.g. AB12CDE).

For **current MOT status only** (valid/expiry, no full history), you can also use [vehicleenquiry.service.gov.uk](https://vehicleenquiry.service.gov.uk/) or [Check MOT status (GOV.UK)](https://www.gov.uk/check-mot-status). The DVLA VES API also returns `motStatus` and `motExpiryDate` for the current certificate.

---

## 2. MOT history API (for developers)

For **bulk or automated** access (e.g. in an app), the **DVSA** (Driver and Vehicle Standards Agency) provides an **MOT history API**. This is separate from the DVLA Vehicle Enquiry Service (VES) and uses different registration and authentication.

| Item | Details |
|------|---------|
| **Provider** | DVSA (not DVLA) |
| **Docs** | [MOT history API – DVSA](https://documentation.history.mot.api.gov.uk/mot-history-api/api-specification/) |
| **Register** | [Register for MOT history API](https://documentation.history.mot.api.gov.uk/mot-history-api/register) |
| **Auth** | OAuth 2.0 (client credentials) + `X-API-Key` header (key issued after approval) |

**Example endpoint (single vehicle by registration):**

```
GET /trade/vehicles/mot-tests?registration={registration}
```

**Typical data:** Test dates and expiry, pass/fail, mileage, failure reasons, advisories, vehicle identifiers. High-volume users can use bulk/download options (see DVSA documentation).

**Registration:** Name, email, postal address; review can take around 5 working days. You can register as an individual or on behalf of an organisation. The older API was deprecated (e.g. from September 2025); the current one is documented at [documentation.history.mot.api.gov.uk](https://documentation.history.mot.api.gov.uk/).

---

## 3. Summary

| Need | Option |
|------|--------|
| One-off MOT history for a vehicle | Use [check-mot.service.gov.uk](https://www.check-mot.service.gov.uk/) (public, free). |
| Current MOT status only | DVLA VES API (`motStatus`, `motExpiryDate`) or [vehicleenquiry.service.gov.uk](https://vehicleenquiry.service.gov.uk/). |
| MOT history in your app / automation | Apply for the [DVSA MOT history API](https://documentation.history.mot.api.gov.uk/mot-history-api/register) and use the issued credentials. |

---

## 4. Links

- [Check MOT history (public)](https://www.check-mot.service.gov.uk/)
- [Check MOT history – GOV.UK](https://www.gov.uk/check-mot-history)
- [MOT history API – Register](https://documentation.history.mot.api.gov.uk/mot-history-api/register)
- [MOT history API – Specification](https://documentation.history.mot.api.gov.uk/mot-history-api/api-specification/)
- [MOT history API – Authentication](https://documentation.history.mot.api.gov.uk/mot-history-api/authentication/)
- [DVSA MOT history API (GitHub docs)](https://dvsa.github.io/mot-history-api-documentation/)
