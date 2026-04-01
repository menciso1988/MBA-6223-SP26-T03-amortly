// ─── Market Return Calculations ───────────────────────────────────────────────

/**
 * Future value of a regular annuity (investing same amount each period).
 * FV = PMT × ((1+r)^n − 1) / r
 * @param {number} periodicPayment  Amount invested each period
 * @param {number} annualRate       Annual return rate as percentage (e.g. 8.0)
 * @param {number} periods          Number of payment periods
 * @param {number} periodsPerYear   Payment periods per year (e.g. 12)
 * @returns {number} Future value
 */
function futureValueAnnuity(periodicPayment, annualRate, periods, periodsPerYear) {
  if (periodicPayment <= 0) return 0;
  const r = annualRate / 100 / periodsPerYear;
  if (r === 0) return periodicPayment * periods;
  return periodicPayment * (Math.pow(1 + r, periods) - 1) / r;
}

/**
 * Future value of a one-time lump sum investment.
 * FV = PV × (1+r)^n
 * @param {number} lumpSum      Initial investment
 * @param {number} annualRate   Annual return rate as percentage
 * @param {number} years        Investment horizon in years
 * @returns {number} Future value
 */
function futureValueLumpSum(lumpSum, annualRate, years) {
  if (lumpSum <= 0) return 0;
  const r = annualRate / 100;
  return lumpSum * Math.pow(1 + r, years);
}

/**
 * Build cumulative FV time series for a regular investment (for charting).
 * @param {number} periodicPayment
 * @param {number} annualRate
 * @param {number} maxPeriods
 * @param {number} periodsPerYear
 * @returns {number[]} Array of cumulative FV at each period
 */
function buildMarketTimeSeries(periodicPayment, annualRate, maxPeriods, periodsPerYear) {
  const r = annualRate / 100 / periodsPerYear;
  const series = [];
  let fv = 0;
  for (let i = 1; i <= maxPeriods; i++) {
    fv = fv * (1 + r) + periodicPayment;
    series.push(fv);
  }
  return series;
}

/**
 * Get the annualized return rates to use for low/base/high scenarios
 * given a market mode + decade/risk selection.
 *
 * Returns { low, base, high } as percentage annual rates.
 */
function getMarketScenarios(marketMode, decade, riskProfile) {
  if (marketMode === 'simple') {
    const profile = RISK_PROFILES[riskProfile] || RISK_PROFILES.moderate;
    return {
      low:  profile.rate * 0.6,
      base: profile.rate,
      high: profile.rate * 1.4
    };
  }

  // Historical mode
  const data = SP500_DECADES[decade] || SP500_DECADES['historical'];

  // "low" scenario: worst year in decade as a sustained CAGR proxy (floored at -15% annualized)
  // "high" scenario: best year as a CAGR proxy (capped at +35%)
  // For multi-year investment the best/worst single year is too extreme;
  // use blended: (cagr ± stdDev-like spread)
  const spread = Math.abs(data.cagr - data.worstYear) * 0.3;
  const lowRate  = Math.max(-5, data.cagr - spread);
  const highRate = data.cagr + spread;

  return {
    low:  lowRate,
    base: data.cagr,
    high: highRate
  };
}

/**
 * Full market comparison calculation.
 * Answers: "If instead of paying extra toward the loan, you invested those dollars,
 *           what would you have at the original loan maturity?"
 *
 * @param {Object}  extraSchedule   Result of buildAmortizationSchedule (with extras)
 * @param {Object}  baseSchedule    Result of buildAmortizationSchedule (no extras)
 * @param {string}  marketMode      'historical'|'simple'
 * @param {string}  decade
 * @param {string}  riskProfile
 * @returns {Object|null}
 */
function calculateMarketComparison(extraSchedule, baseSchedule, marketMode, decade, riskProfile) {
  if (!extraSchedule || !baseSchedule) return null;

  const interestSaved = baseSchedule.totalInterestPaid - extraSchedule.totalInterestPaid;
  if (interestSaved <= 0 && extraSchedule.totalExtraContributed <= 0) return null;

  const scenarios = getMarketScenarios(marketMode, decade, riskProfile);
  const periodsPerYear = baseSchedule.paymentPeriods;

  // Horizon = original loan term (base schedule length)
  const basePeriods = baseSchedule.actualPeriods;

  // Build the actual extra-payment stream for the full base loan horizon.
  // Periods beyond the (shorter) extra schedule are zero — no more payments once the loan is paid off.
  // This preserves the exact timing of one-time lump sums and the start-date delay for regular payments.
  const extraStream = new Array(basePeriods).fill(0);
  for (let i = 0; i < Math.min(extraSchedule.schedule.length, basePeriods); i++) {
    extraStream[i] = extraSchedule.schedule[i].extra;
  }

  // Period-by-period FV simulation: fv[i] = fv[i-1] * (1+r) + extraStream[i]
  // This correctly compounds a lump sum from its payment period and delays regular
  // investments until their start date.
  function simulateFV(annualRate) {
    const r = annualRate / 100 / periodsPerYear;
    const series = [];
    let fv = 0;
    for (let i = 0; i < basePeriods; i++) {
      fv = fv * (1 + r) + extraStream[i];
      series.push(fv);
    }
    return series;
  }

  const seriesLow  = simulateFV(scenarios.low);
  const seriesBase = simulateFV(scenarios.base);
  const seriesHigh = simulateFV(scenarios.high);

  // Time series for charting (yearly snapshots)
  const yearsCount = Math.ceil(basePeriods / periodsPerYear);
  const yearlyLow = [], yearlyBase = [], yearlyHigh = [];
  const cumulativeContributions = [];
  let cumExtra = 0;

  for (let yr = 1; yr <= yearsCount; yr++) {
    const idx = Math.min(yr * periodsPerYear - 1, basePeriods - 1);
    yearlyLow.push(seriesLow[idx]);
    yearlyBase.push(seriesBase[idx]);
    yearlyHigh.push(seriesHigh[idx]);

    // Accumulate cost basis up to this year-end index
    const prevIdx = (yr - 1) * periodsPerYear;
    for (let i = prevIdx; i <= idx; i++) cumExtra += extraStream[i];
    cumulativeContributions.push(cumExtra);
  }

  const marketLow  = yearlyLow[yearlyLow.length - 1]   || 0;
  const marketBase = yearlyBase[yearlyBase.length - 1] || 0;
  const marketHigh = yearlyHigh[yearlyHigh.length - 1] || 0;

  return {
    interestSaved,
    totalExtraContributed: extraSchedule.totalExtraContributed,
    scenarios,
    marketLow,
    marketBase,
    marketHigh,
    yearlyLow,
    yearlyBase,
    yearlyHigh,
    cumulativeContributions,
    yearsCount,
    verdict: marketBase > interestSaved ? 'invest' : 'paydown'
  };
}
