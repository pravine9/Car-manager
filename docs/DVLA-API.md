# DVLA Vehicle Enquiry Service (VES) API – Developer Guide

This document describes how to use the **DVLA open data API** (Vehicle Enquiry Service) with your project. It is based on official DVLA guidance and the API Developer Portal.

---

## 1. What is the DVLA VES API?

The **Vehicle Enquiry Service (VES)** is a RESTful API that returns UK vehicle details from a registration number. DVLA refers to this as their **open data** offering. You receive an API key after registering; the key you received is for this service.

- **Official developer portal:**  
  [developer-portal.driver-vehicle-licensing.api.gov.uk](https://developer-portal.driver-vehicle-licensing.api.gov.uk/)
- **Register / manage access:**  
  [register-for-ves.driver-vehicle-licensing.api.gov.uk](https://register-for-ves.driver-vehicle-licensing.api.gov.uk/)
- **API catalogue (GOV.UK):**  
  [api.gov.uk – DVLA Vehicle Enquiry Service](https://www.api.gov.uk/dvla/dvla-vehicle-enquiry-service/)
- **Support / queries:**  
  [DVLAAPIAccess@dvla.gov.uk](mailto:DVLAAPIAccess@dvla.gov.uk)

---

## 2. Authentication

All requests must include your API key in a header:

| Header     | Description                    |
|-----------|---------------------------------|
| `x-api-key` | Your DVLA open data API key   |

**Important:** Do not commit your API key to version control. Store it in environment variables or a local config file that is gitignored (e.g. `.env`).

Example (conceptual):

```bash
# .env (already in .gitignore – never commit this file)
DVLA_API_KEY=your_api_key_here
```

---

## 3. Endpoint and method

| Item     | Value |
|----------|--------|
| **URL**  | `https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles` |
| **Method** | `POST` |
| **Content-Type** | `application/json` |

---

## 4. Request format

Send a JSON body with the vehicle registration number only. The registration must be **alphanumeric only** (no spaces or special characters). DVLA request this to be in the body (not the URL) for data protection reasons.

**Request body:**

```json
{
  "registrationNumber": "AB12CDE"
}
```

- Normalise the registration in your code (e.g. strip spaces and convert to uppercase) before sending.

---

## 5. Response format

Responses are JSON. A successful response includes fields such as:

| Field | Description |
|-------|-------------|
| `registrationNumber` | Registration plate |
| `make` | Manufacturer |
| `colour` | Colour (e.g. "BLUE") |
| `fuelType` | e.g. "PETROL", "DIESEL" |
| `yearOfManufacture` | Year of manufacture |
| `monthOfFirstRegistration` | Month/year of first registration |
| `engineCapacity` | Engine capacity (cc) |
| `co2Emissions` | CO2 emissions value |
| `euroStatus` | Euro emissions standard (e.g. "EURO 6 AD") |
| `motStatus` | e.g. "Valid", "No details held by DVLA" |
| `motExpiryDate` | MOT expiry date |
| `taxStatus` | e.g. "Taxed", "Untaxed" |
| `taxDueDate` | Tax due date |
| `markedForExport` | Export flag |
| `revenueWeight` | Revenue weight (kg) |
| `typeApproval` | Type approval classification |
| `wheelplan` | Wheel configuration |
| `dateOfLastV5CIssued` | Last V5C issue date |

Exact fields may vary; refer to the [DVLA API Developer Portal](https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html) for the current schema.

---

## 6. HTTP status codes

| Code | Meaning |
|------|--------|
| 200 | Success – vehicle details returned |
| 400 | Bad Request – e.g. invalid or missing registration |
| 404 | Vehicle not found |
| 500 | Internal server error |
| 503 | Service unavailable |

---

## 7. Road tax (VED) – how to check the cost

The VES API returns **tax status** (e.g. "Taxed", "Untaxed") and **tax due date**, but **not** the actual road tax amount in pounds. To find how much road tax will cost you need the official rate tables, which depend on:

- **Date of first registration** (different rules before/after 1 April 2017)
- **CO₂ emissions** (and sometimes **fuel type**)
- For cars first registered from April 2017 with list price over £40,000: an **expensive car supplement** for five years

### How to check the cost

1. **Use the official rate tables (by vehicle type and registration date)**  
   [gov.uk/vehicle-tax-rate-tables](https://www.gov.uk/vehicle-tax-rate-tables)  
   Pick the table that matches your vehicle (e.g. cars, motorcycles) and the period. Then use your vehicle’s **CO₂ emissions** and **monthOfFirstRegistration** from the VES response to find the correct band and rate.

2. **Official VED rate publications (PDF)**  
   [Rates of vehicle tax (V149 and V149/1)](https://www.gov.uk/government/publications/rates-of-vehicle-tax-v149)  
   These PDFs list current bands and amounts (updated each financial year).

3. **Calculator for new, unregistered cars**  
   [gov.uk/calculate-vehicle-tax-rates](https://www.gov.uk/calculate-vehicle-tax-rates)  
   For cars not yet registered: enter list price, CO₂ and fuel type to get first-year and standard rates.

4. **Tax or renew an existing vehicle**  
   [gov.uk/vehicle-tax](https://www.gov.uk/vehicle-tax)  
   To pay or renew, you need the V5C reference number; the payment page will show the amount due.

### Using VES data to look up the rate

From the VES response use:

- `co2Emissions` – to find the CO₂ band in the table  
- `monthOfFirstRegistration` – to choose the right table (pre-/post-April 2017)  
- `fuelType` – some bands differ by fuel  

Then look up that band in the GOV.UK rate table or V149 PDF for the current year. Rates are updated annually (e.g. with RPI), so always use the latest table for the current cost.

**Project lookup reference:** See [Vehicle tax rates (lookup table)](vehicle-tax-rates.md) in this folder for current bands and amounts. The file `vehicleTaxRates.js` in the project root provides a programmatic lookup: pass `co2Emissions`, `monthOfFirstRegistration`, and optionally `engineCapacity` (for pre-2001 cars) to get the annual and 6‑month rate.

---

## 8. Example usage

### cURL

```bash
curl -X POST "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"registrationNumber":"AB12CDE"}'
```

### JavaScript (fetch)

```javascript
const registrationNumber = 'AB12CDE'; // normalise (uppercase, no spaces) first

const response = await fetch('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.DVLA_API_KEY || 'YOUR_API_KEY' // use env in production
  },
  body: JSON.stringify({ registrationNumber })
});

if (!response.ok) {
  if (response.status === 404) {
    console.log('Vehicle not found');
  } else {
    console.error('API error', response.status, await response.text());
  }
  throw new Error('VES request failed');
}

const vehicle = await response.json();
console.log(vehicle.make, vehicle.colour, vehicle.fuelType);
```

### Using in this project (Car Tools)

- Keep the API key in `.env` as `DVLA_API_KEY` (or similar) and load it only in the environment where the request runs.
- If you call the API from the browser, you must use a backend or serverless function to hold the key and proxy requests; **do not** put the key in frontend code or in the repo.

---

## 9. Terms and usage rules (from DVLA guidance)

- **One API key per customer/company** – do not share or create multiple keys for the same use.
- **Inactive accounts** – unused accounts may be disabled after 90 days and removed after 120 days.
- **Data protection** – if you combine VES data with other data, you are responsible for compliance with data protection law (e.g. UK GDPR).
- **Terms and conditions** – full terms: [register-for-ves.driver-vehicle-licensing.api.gov.uk/terms-and-conditions](https://register-for-ves.driver-vehicle-licensing.api.gov.uk/terms-and-conditions).

---

## 10. Storing your API key in this repo

1. Create a `.env` file in the project root (if you don’t have one).
2. Add a line:  
   `DVLA_API_KEY=<your_key_from_dvla_email>`  
   (use the key you received from DVLA – do not commit this file).
3. **Do not** commit `.env` – it is already listed in `.gitignore`.
4. In code, read the key from `process.env.DVLA_API_KEY` (Node) or your app’s config; never hardcode it in source.

---

## 11. References

- [DVLA API Developer Portal – Available APIs](https://developer-portal.driver-vehicle-licensing.api.gov.uk/availableapis.html)
- [VES API Description](https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html)
- [VES Code Examples](https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/code-examples.html)
- [VES Registration](https://register-for-ves.driver-vehicle-licensing.api.gov.uk/)
- [Vehicle tax rate tables (GOV.UK)](https://www.gov.uk/vehicle-tax-rate-tables)
- [Rates of vehicle tax – V149 (GOV.UK)](https://www.gov.uk/government/publications/rates-of-vehicle-tax-v149)
- [Calculate vehicle tax rates (new cars)](https://www.gov.uk/calculate-vehicle-tax-rates)
- [Tax your vehicle (pay/renew)](https://www.gov.uk/vehicle-tax)
- Contact: **DVLAAPIAccess@dvla.gov.uk**
