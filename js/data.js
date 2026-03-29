// ─── S&P 500 Historical Data by Decade ───────────────────────────────────────
// CAGR = compound annual growth rate for that decade
// bestYear / worstYear = actual single-year returns within the decade
const SP500_DECADES = {
  '1950s': {
    label: '1950s',
    cagr: 19.4,
    bestYear: 52.6,
    worstYear: -1.0,
    description: 'Post-war economic boom',
    color: '#34c759'
  },
  '1960s': {
    label: '1960s',
    cagr: 7.8,
    bestYear: 26.9,
    worstYear: -10.8,
    description: 'Moderate growth, Cold War era',
    color: '#5ac8fa'
  },
  '1970s': {
    label: '1970s',
    cagr: 5.9,
    bestYear: 37.2,
    worstYear: -26.5,
    description: 'Stagflation & oil shocks',
    color: '#ff9f0a'
  },
  '1980s': {
    label: '1980s',
    cagr: 17.5,
    bestYear: 32.4,
    worstYear: -4.9,
    description: 'Reagan-era bull market',
    color: '#30d158'
  },
  '1990s': {
    label: '1990s',
    cagr: 18.2,
    bestYear: 37.6,
    worstYear: -3.1,
    description: 'Dot-com boom, peak euphoria',
    color: '#32ade6'
  },
  '2000s': {
    label: '2000s',
    cagr: -0.9,
    bestYear: 28.7,
    worstYear: -38.5,
    description: 'Lost decade: dot-com bust & GFC',
    color: '#ff3b30'
  },
  '2010s': {
    label: '2010s',
    cagr: 13.6,
    bestYear: 32.4,
    worstYear: -4.4,
    description: 'QE-fueled recovery & growth',
    color: '#0071e3'
  },
  '2020s': {
    label: '2020s (partial)',
    cagr: 14.8,
    bestYear: 28.9,
    worstYear: -19.4,
    description: 'Post-COVID rally, rate volatility',
    color: '#5e5ce6'
  },
  'historical': {
    label: 'Historical Avg. (1950–2024)',
    cagr: 10.5,
    bestYear: 52.6,
    worstYear: -38.5,
    description: 'Long-run S&P 500 average since 1950',
    color: '#0071e3'
  }
};

// ─── Risk Profiles ────────────────────────────────────────────────────────────
const RISK_PROFILES = {
  conservative: {
    key: 'conservative',
    label: 'Conservative',
    rate: 6.0,
    description: 'Bonds & balanced funds',
    color: '#34c759',
    icon: '🛡'
  },
  moderate: {
    key: 'moderate',
    label: 'Moderate',
    rate: 8.0,
    description: 'Diversified equity portfolio',
    color: '#0071e3',
    icon: '⚖'
  },
  aggressive: {
    key: 'aggressive',
    label: 'Aggressive',
    rate: 10.5,
    description: 'Growth stocks & index funds',
    color: '#ff9f0a',
    icon: '🚀'
  }
};

// ─── Currencies ───────────────────────────────────────────────────────────────
const CURRENCIES = [
  { code: 'USD', symbol: '$',  label: 'USD — US Dollar' },
  { code: 'EUR', symbol: '€',  label: 'EUR — Euro' },
  { code: 'GBP', symbol: '£',  label: 'GBP — British Pound' },
  { code: 'JPY', symbol: '¥',  label: 'JPY — Japanese Yen' },
  { code: 'CAD', symbol: 'C$', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'AUD — Australian Dollar' },
  { code: 'CHF', symbol: 'Fr', label: 'CHF — Swiss Franc' },
  { code: 'MXN', symbol: '$',  label: 'MXN — Mexican Peso' },
  { code: 'CUSTOM', symbol: '', label: 'Custom symbol...' }
];

// ─── Compound & Payment Period Options ───────────────────────────────────────
const COMPOUND_PERIODS = [
  { value: 365, label: 'Daily' },
  { value: 12,  label: 'Monthly (standard US)', isDefault: true },
  { value: 4,   label: 'Quarterly' },
  { value: 2,   label: 'Semi-Annual (Canadian)' },
  { value: 1,   label: 'Annual' }
];

const PAYMENT_PERIODS = [
  { value: 52, label: 'Weekly' },
  { value: 26, label: 'Bi-Weekly' },
  { value: 24, label: 'Semi-Monthly' },
  { value: 12, label: 'Monthly', isDefault: true },
  { value: 1,  label: 'Annually' }
];

// ─── App Defaults ─────────────────────────────────────────────────────────────
const DEFAULTS = {
  loanType: 'mortgage',
  currency: { code: 'USD', symbol: '$' },
  homePrice: 500000,
  downPaymentPct: 20,
  annualRate: 6.5,
  termYears: 30,
  compoundPeriods: 12,
  paymentPeriods: 12,
  extraType: 'none',
  extraOneTimeAmount: 10000,
  extraOneTimePeriod: 1,
  extraRegularAmount: 500,
  extraRegularFrequency: 'monthly',
  loanStartDate: '',
  marketMode: 'historical',
  decade: 'historical',
  riskProfile: 'moderate'
};

// ─── Extra Payment Frequency Map ─────────────────────────────────────────────
const EXTRA_FREQ_MAP = {
  daily:   365,
  weekly:  52,
  monthly: 12,
  yearly:  1
};
