// ─── Amortization Calculation Engine ─────────────────────────────────────────

/**
 * Effective interest rate per payment period.
 * Handles any combination of compound and payment frequencies.
 * @param {number} annualRate  Annual rate as a percentage, e.g. 6.5
 * @param {number} compoundPeriods  Times compounded per year (e.g. 12)
 * @param {number} paymentPeriods   Payments per year (e.g. 12)
 * @returns {number} Decimal rate per payment period
 */
function effectivePeriodicRate(annualRate, compoundPeriods, paymentPeriods) {
  const r = annualRate / 100;
  if (r === 0) return 0;
  return Math.pow(1 + r / compoundPeriods, compoundPeriods / paymentPeriods) - 1;
}

/**
 * Fixed payment amount (PMT formula).
 * @param {number} principal
 * @param {number} rate  Periodic rate (decimal)
 * @param {number} n     Total payment periods
 * @returns {number}
 */
function calculatePMT(principal, rate, n) {
  if (rate === 0) return principal / n;
  const factor = Math.pow(1 + rate, n);
  return (principal * rate * factor) / (factor - 1);
}

/**
 * Normalize an extra payment amount to per-period based on payment frequency.
 * E.g. "$100/week" with monthly payment schedule → $433.33/month extra.
 * @param {number} amount
 * @param {string} extraFreq  'daily'|'weekly'|'monthly'|'yearly'
 * @param {number} paymentPeriodsPerYear
 * @returns {number} Extra amount per payment period
 */
function normalizeExtraPayment(amount, extraFreq, paymentPeriodsPerYear) {
  const freqMap = EXTRA_FREQ_MAP || { daily: 365, weekly: 52, monthly: 12, yearly: 1 };
  const extraPeriodsPerYear = freqMap[extraFreq] || 12;
  return (amount * extraPeriodsPerYear) / paymentPeriodsPerYear;
}

/**
 * Build a full amortization schedule.
 * Returns period-by-period data plus summary stats.
 *
 * @param {Object} p
 * @param {number}  p.principal
 * @param {number}  p.annualRate
 * @param {number}  p.compoundPeriods
 * @param {number}  p.paymentPeriods
 * @param {number}  p.termYears
 * @param {string}  p.extraType        'none'|'onetime'|'regular'
 * @param {number}  p.extraOneTimeAmount
 * @param {number}  p.extraOneTimePeriod  1-based period number
 * @param {number}  p.extraRegularAmount
 * @param {string}  p.extraRegularFrequency
 * @returns {Object} { schedule[], fixedPayment, rate, totalPeriods, totalInterestPaid,
 *                     totalPaid, actualPeriods, paymentPeriods }
 */
function buildAmortizationSchedule(p) {
  const {
    principal, annualRate, compoundPeriods, paymentPeriods, termYears,
    extraType, extraOneTimeAmount, extraOneTimePeriod,
    extraRegularAmount, extraRegularFrequency
  } = p;

  const rate = effectivePeriodicRate(annualRate, compoundPeriods, paymentPeriods);
  const totalPeriods = Math.round(termYears * paymentPeriods);
  const fixedPayment = calculatePMT(principal, rate, totalPeriods);

  // Pre-compute extra per period
  let regularExtraPerPeriod = 0;
  if (extraType === 'regular') {
    regularExtraPerPeriod = normalizeExtraPayment(
      extraRegularAmount,
      extraRegularFrequency,
      paymentPeriods
    );
  }

  const oneTimeExtra = {};
  if (extraType === 'onetime' && extraOneTimeAmount > 0) {
    const period = Math.max(1, Math.round(extraOneTimePeriod));
    oneTimeExtra[period] = extraOneTimeAmount;
  }

  const schedule = [];
  let balance = principal;
  let totalInterestPaid = 0;
  let totalPrincipalPaid = 0;
  let totalPaid = 0;
  let cumulativeExtra = 0;

  for (let i = 1; i <= totalPeriods && balance > 0.005; i++) {
    const interestPayment = balance * rate;
    let principalPayment = fixedPayment - interestPayment;

    // Extra principal this period
    const extra = (oneTimeExtra[i] || 0) + regularExtraPerPeriod;

    // Cap so we don't overpay (final period)
    const totalPrincipalThisPeriod = Math.min(balance, principalPayment + extra);
    const actualExtra = Math.max(0, totalPrincipalThisPeriod - principalPayment);
    principalPayment = totalPrincipalThisPeriod - actualExtra;

    const actualPayment = interestPayment + totalPrincipalThisPeriod;

    balance = Math.max(0, balance - totalPrincipalThisPeriod);
    totalInterestPaid += interestPayment;
    totalPrincipalPaid += totalPrincipalThisPeriod;
    totalPaid += actualPayment;
    cumulativeExtra += actualExtra;

    schedule.push({
      period: i,
      payment: actualPayment,
      principal: principalPayment,
      extra: actualExtra,
      interest: interestPayment,
      balance: balance,
      cumulativeInterest: totalInterestPaid,
      cumulativePrincipal: totalPrincipalPaid
    });

    if (balance <= 0.005) break;
  }

  return {
    schedule,
    fixedPayment,
    rate,
    totalPeriods,
    totalInterestPaid,
    totalPaid,
    actualPeriods: schedule.length,
    paymentPeriods,
    totalExtraContributed: cumulativeExtra
  };
}

/**
 * Convert total periods to human-readable duration.
 * @param {number} periods   Number of payment periods
 * @param {number} periodsPerYear
 * @returns {string}  e.g. "27 years, 4 months"
 */
function periodsToString(periods, periodsPerYear) {
  const totalMonths = Math.round((periods / periodsPerYear) * 12);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} yr${years !== 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} mo`);
  return parts.join(', ') || '< 1 month';
}

/**
 * Calculate payoff date given starting today and number of months.
 * @param {number} totalMonths
 * @returns {string}  Formatted date string
 */
function payoffDate(periods, periodsPerYear) {
  const months = Math.round((periods / periodsPerYear) * 12);
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Aggregate schedule to yearly buckets for charting.
 * @param {Array}  schedule
 * @param {number} periodsPerYear
 * @returns {Array} Yearly aggregated rows { year, principal, interest, extra, balance, cumulativeInterest }
 */
function aggregateToYears(schedule, periodsPerYear) {
  const yearly = [];
  let yearPrincipal = 0;
  let yearInterest = 0;
  let yearExtra = 0;

  for (let i = 0; i < schedule.length; i++) {
    const row = schedule[i];
    yearPrincipal += row.principal;
    yearInterest += row.interest;
    yearExtra += row.extra;

    const isLastPeriodOfYear = ((i + 1) % periodsPerYear === 0) || i === schedule.length - 1;
    if (isLastPeriodOfYear) {
      const year = Math.ceil((i + 1) / periodsPerYear);
      yearly.push({
        year,
        principal: yearPrincipal,
        interest: yearInterest,
        extra: yearExtra,
        balance: row.balance,
        cumulativeInterest: row.cumulativeInterest
      });
      yearPrincipal = 0;
      yearInterest = 0;
      yearExtra = 0;
    }
  }
  return yearly;
}

/**
 * Build amortization for rate comparison (5 curves: base ±0.5%, ±1%).
 * @param {Object} baseParams  Same shape as buildAmortizationSchedule params
 * @returns {Array} Array of { rate, label, result }
 */
function buildRateComparisonScenarios(baseParams) {
  const offsets = [-1, -0.5, 0, 0.5, 1];
  return offsets.map(offset => {
    const r = Math.max(0.1, baseParams.annualRate + offset);
    const result = buildAmortizationSchedule({ ...baseParams, annualRate: r, extraType: 'none' });
    return {
      rate: r,
      offset,
      label: offset === 0
        ? `${r.toFixed(2)}% (current)`
        : `${r.toFixed(2)}% (${offset > 0 ? '+' : ''}${offset}%)`,
      result
    };
  });
}
