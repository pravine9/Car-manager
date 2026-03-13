/**
 * UK Vehicle Excise Duty (VED) lookup – current rates from 1 April 2025.
 * Use with DVLA VES API data: co2Emissions, monthOfFirstRegistration, engineCapacity.
 * Reference: docs/vehicle-tax-rates.md | GOV.UK vehicle-tax-rate-tables
 */

(function (global) {
  'use strict';

  /** Cars registered 1 March 2001 – 31 March 2017: CO2 band → { band, annual, sixMonth } */
  var BANDS_2001_TO_2017 = [
    { min: 0, max: 100, band: 'A', annual: 20, sixMonth: 11 },
    { min: 101, max: 110, band: 'B', annual: 20, sixMonth: 11 },
    { min: 111, max: 120, band: 'C', annual: 35, sixMonth: 19.25 },
    { min: 121, max: 130, band: 'D', annual: 165, sixMonth: 90.75 },
    { min: 131, max: 140, band: 'E', annual: 195, sixMonth: 107.25 },
    { min: 141, max: 150, band: 'F', annual: 215, sixMonth: 118.25 },
    { min: 151, max: 165, band: 'G', annual: 265, sixMonth: 145.75 },
    { min: 166, max: 175, band: 'H', annual: 315, sixMonth: 173.25 },
    { min: 176, max: 185, band: 'I', annual: 345, sixMonth: 189.75 },
    { min: 186, max: 200, band: 'J', annual: 395, sixMonth: 217.25 },
    { min: 201, max: 225, band: 'K', annual: 430, sixMonth: 236.50 },
    { min: 226, max: 255, band: 'L', annual: 735, sixMonth: 404.25 },
    { min: 256, max: 9999, band: 'M', annual: 760, sixMonth: 418 }
  ];

  /** Cars registered on or after 1 April 2017: standard rate (second licence onwards) */
  var STANDARD_RATE_2017_PLUS = { annual: 195, sixMonth: 107.25 };
  var EXPENSIVE_CAR_SUPPLEMENT_ANNUAL = 425; // list price > £40k when new, 5 years from 2nd licence
  var EXPENSIVE_CAR_TOTAL_ANNUAL = 620;

  /** Cars registered before 1 March 2001: by engine size (cc) */
  var ENGINE_BAND_UNDER_1549 = { annual: 220, sixMonth: 121 };
  var ENGINE_BAND_OVER_1549 = { annual: 360, sixMonth: 198 };

  /** First year rates for cars registered from 1 April 2017 (CO2 g/km → annual) */
  var FIRST_YEAR_2017_PLUS = [
    { min: 0, max: 0, annual: 10 },
    { min: 1, max: 50, annual: 110 },
    { min: 51, max: 75, annual: 130 },
    { min: 76, max: 90, annual: 270 },
    { min: 91, max: 100, annual: 350 },
    { min: 101, max: 110, annual: 390 },
    { min: 111, max: 130, annual: 440 },
    { min: 131, max: 150, annual: 540 },
    { min: 151, max: 170, annual: 1360 },
    { min: 171, max: 190, annual: 2190 },
    { min: 191, max: 225, annual: 3300 },
    { min: 226, max: 255, annual: 4680 },
    { min: 256, max: 9999, annual: 5490 }
  ];

  /**
   * Parse monthOfFirstRegistration from VES (e.g. "2015-03" or "2015") into { year, month }.
   * @param {string} monthOfFirstRegistration
   * @returns {{ year: number, month: number } | null}
   */
  function parseFirstRegistration(value) {
    if (!value || typeof value !== 'string') return null;
    var parts = value.trim().split('-');
    var year = parseInt(parts[0], 10);
    var month = parts.length >= 2 ? parseInt(parts[1], 10) : 1;
    if (isNaN(year) || year < 1900 || year > 2100) return null;
    return { year: year, month: month };
  }

  /**
   * True if date is before 1 March 2001.
   */
  function isBeforeMarch2001(parsed) {
    if (!parsed) return false;
    return parsed.year < 2001 || (parsed.year === 2001 && parsed.month < 3);
  }

  /**
   * True if date is before 1 April 2017.
   */
  function isBeforeApril2017(parsed) {
    if (!parsed) return false;
    return parsed.year < 2017 || (parsed.year === 2017 && parsed.month < 4);
  }

  /**
   * Find band and rate for 2001–2017 regime by CO2.
   */
  function getBand2001To2017(co2) {
    var c = parseInt(co2, 10);
    if (isNaN(c) || c < 0) return null;
    for (var i = 0; i < BANDS_2001_TO_2017.length; i++) {
      var b = BANDS_2001_TO_2017[i];
      if (c >= b.min && c <= b.max) return b;
    }
    return null;
  }

  /**
   * Find first-year rate for 2017+ regime by CO2.
   */
  function getFirstYear2017Plus(co2) {
    var c = parseInt(co2, 10);
    if (isNaN(c) || c < 0) return null;
    for (var i = 0; i < FIRST_YEAR_2017_PLUS.length; i++) {
      var r = FIRST_YEAR_2017_PLUS[i];
      if (c >= r.min && c <= r.max) return r.annual;
    }
    return null;
  }

  /**
   * Get current annual and 6-month VED rate for a car based on VES-style data.
   * Does not include expensive-car supplement (list price not in VES).
   *
   * @param {number} co2Emissions - CO2 g/km (from VES)
   * @param {string} monthOfFirstRegistration - e.g. "2015-03" (from VES)
   * @param {number} [engineCapacity] - cc, for cars registered before 1 March 2001
   * @returns {{ annual: number, sixMonth: number, band: string, regime: string } | null}
   */
  function getVehicleTaxRate(co2Emissions, monthOfFirstRegistration, engineCapacity) {
    var parsed = parseFirstRegistration(monthOfFirstRegistration);

    if (isBeforeMarch2001(parsed)) {
      var cc = engineCapacity != null ? parseInt(engineCapacity, 10) : 0;
      var eng = !isNaN(cc) && cc > 0 && cc <= 1549 ? ENGINE_BAND_UNDER_1549 : ENGINE_BAND_OVER_1549;
      return {
        annual: eng.annual,
        sixMonth: eng.sixMonth,
        band: cc <= 1549 ? 'Under 1549cc' : 'Over 1549cc',
        regime: 'pre-2001'
      };
    }

    if (isBeforeApril2017(parsed)) {
      var bandInfo = getBand2001To2017(co2Emissions);
      if (!bandInfo) return null;
      return {
        annual: bandInfo.annual,
        sixMonth: bandInfo.sixMonth,
        band: bandInfo.band,
        regime: '2001-2017'
      };
    }

    // April 2017 onwards: standard rate (renewal). First-year rate would need getFirstYear2017Plus(co2).
    return {
      annual: STANDARD_RATE_2017_PLUS.annual,
      sixMonth: STANDARD_RATE_2017_PLUS.sixMonth,
      band: 'Standard',
      regime: '2017-plus'
    };
  }

  var vehicleTaxRates = {
    getVehicleTaxRate: getVehicleTaxRate,
    getBand2001To2017: getBand2001To2017,
    getFirstYear2017Plus: getFirstYear2017Plus,
    parseFirstRegistration: parseFirstRegistration,
    BANDS_2001_TO_2017: BANDS_2001_TO_2017,
    STANDARD_RATE_2017_PLUS: STANDARD_RATE_2017_PLUS,
    EXPENSIVE_CAR_TOTAL_ANNUAL: EXPENSIVE_CAR_TOTAL_ANNUAL,
    FIRST_YEAR_2017_PLUS: FIRST_YEAR_2017_PLUS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = vehicleTaxRates;
  } else {
    global.vehicleTaxRates = vehicleTaxRates;
  }
})(typeof window !== 'undefined' ? window : this);
