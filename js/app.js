// ─── Amortly — App State & Controller ────────────────────────────────────────

// ── State ────────────────────────────────────────────────────────────────────
let state = {
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
  extraStartDate: '',
  loanStartDate: '',
  marketMode: 'historical',
  decade: 'historical',
  riskProfile: 'moderate'
};

// Derived
function getLoanAmount() {
  return Math.max(0, state.homePrice - state.homePrice * state.downPaymentPct / 100);
}

// ── Formatting ────────────────────────────────────────────────────────────────
function fmt(value, decimals = 0) {
  if (isNaN(value) || value === null) return '—';
  const sym = state.currency.symbol;
  const formatted = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return `${sym}${formatted}`;
}

function fmtPct(value, decimals = 1) {
  return `${value.toFixed(decimals)}%`;
}

// Keep global for charts.js formatCurrencyShort
function syncCurrencySymbol() {
  window._currencySymbol = state.currency.symbol;
}

// ── DOM Helpers ───────────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function setTextContent(id, text) {
  const node = el(id);
  if (node) node.textContent = text;
}

function toggleClass(id, cls, condition) {
  const node = el(id);
  if (node) node.classList.toggle(cls, condition);
}

function showEl(id)  { toggleClass(id, 'hidden', false); }
function hideEl(id)  { toggleClass(id, 'hidden', true); }

// ── Slider Fill Sync ──────────────────────────────────────────────────────────
function syncSliderFill(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const val = parseFloat(slider.value);
  const pct = ((val - min) / (max - min)) * 100;
  slider.style.setProperty('--percent', `${pct}%`);
}

// ── Populate Selects ──────────────────────────────────────────────────────────
function populateSelects() {
  // Currency
  const currSel = el('currency-select');
  currSel.innerHTML = '';
  CURRENCIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = c.label;
    if (c.code === 'USD') opt.selected = true;
    currSel.appendChild(opt);
  });

  // Compound period
  const compSel = el('compound-period');
  compSel.innerHTML = '';
  COMPOUND_PERIODS.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.value;
    opt.textContent = c.label;
    if (c.isDefault) opt.selected = true;
    compSel.appendChild(opt);
  });

  // Payment period
  const paySel = el('payment-period');
  paySel.innerHTML = '';
  PAYMENT_PERIODS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.value;
    opt.textContent = p.label;
    if (p.isDefault) opt.selected = true;
    paySel.appendChild(opt);
  });

  // Decade
  const decSel = el('decade-select');
  decSel.innerHTML = '';
  Object.entries(SP500_DECADES).forEach(([key, data]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = data.label;
    if (key === 'historical') opt.selected = true;
    decSel.appendChild(opt);
  });
}

// ── Down Payment Impact Cards ─────────────────────────────────────────────────
function updateDpImpactCards() {
  const container = el('dp-impact-cards');
  if (!container) return;

  const offsets = [-5, 0, 5];
  container.innerHTML = '';

  offsets.forEach(offset => {
    const dpPct = Math.max(0, Math.min(60, state.downPaymentPct + offset));
    const principal = Math.max(0, state.homePrice - state.homePrice * dpPct / 100);
    if (principal <= 0) return;

    const rate = effectivePeriodicRate(state.annualRate, state.compoundPeriods, state.paymentPeriods);
    const n = state.termYears * state.paymentPeriods;
    const pmt = calculatePMT(principal, rate, n);
    const totalInterest = (pmt * n) - principal;

    const div = document.createElement('div');
    div.className = `dp-impact-card${offset === 0 ? ' dp-impact-card--current' : ''}`;
    div.innerHTML = `
      <div class="dp-impact-card-label">${dpPct.toFixed(1)}% down</div>
      <div class="dp-impact-card-payment">${fmt(pmt)}<span class="dp-impact-freq">/${paymentLabel()}</span></div>
      <div class="dp-impact-card-interest">Total interest: ${fmt(totalInterest)}</div>
    `;
    container.appendChild(div);
  });
}

/**
 * Convert an extra payment date to a 1-based period number relative to the loan start.
 * Returns 1 if no date is set (defaults to loan start = period 1).
 */
function dateToPeriod(extraDateStr, loanStartDateStr, paymentPeriods) {
  if (!extraDateStr) return 1;
  const start = loanStartDateStr ? new Date(loanStartDateStr + 'T00:00:00') : new Date();
  const target = new Date(extraDateStr + 'T00:00:00');
  if (target <= start) return 1;
  const monthsDiff = (target.getFullYear() - start.getFullYear()) * 12
                   + (target.getMonth() - start.getMonth());
  const periods = Math.round(monthsDiff * paymentPeriods / 12);
  return Math.max(1, periods + 1);
}

function paymentLabel() {
  const pp = state.paymentPeriods;
  const map = { 52: 'wk', 26: 'biweek', 24: 'semi-mo', 12: 'mo', 1: 'yr' };
  return map[pp] || 'period';
}

// ── Rate Comparison Pills ─────────────────────────────────────────────────────
function updateRateComparisonPills() {
  const container = el('rate-comparison-pills');
  if (!container) return;

  const offsets = [-1, -0.5, 0.5, 1];
  container.innerHTML = '';
  const principal = getLoanAmount();

  offsets.forEach(offset => {
    const r = Math.max(0.1, state.annualRate + offset);
    const rate = effectivePeriodicRate(r, state.compoundPeriods, state.paymentPeriods);
    const n = state.termYears * state.paymentPeriods;
    const pmt = calculatePMT(principal, rate, n);
    const basePmt = calculatePMT(principal,
      effectivePeriodicRate(state.annualRate, state.compoundPeriods, state.paymentPeriods), n);
    const diff = pmt - basePmt;

    const pill = document.createElement('div');
    pill.className = `rate-pill ${offset > 0 ? 'rate-pill--up' : 'rate-pill--down'}`;
    pill.innerHTML = `
      <span class="rate-pill-rate">${r.toFixed(2)}%</span>
      <span class="rate-pill-diff">${diff > 0 ? '+' : ''}${fmt(diff)}/mo</span>
    `;
    container.appendChild(pill);
  });
}

// ── Decade Info Card ──────────────────────────────────────────────────────────
function updateDecadeInfo() {
  const container = el('decade-info');
  if (!container) return;

  const data = SP500_DECADES[state.decade];
  if (!data) return;

  const cagrColor = data.cagr >= 0 ? '#34c759' : '#ff3b30';
  container.innerHTML = `
    <div class="decade-card">
      <div class="decade-stat">
        <span class="decade-stat-label">Avg. CAGR</span>
        <span class="decade-stat-value" style="color:${cagrColor}">${data.cagr > 0 ? '+' : ''}${data.cagr}%</span>
      </div>
      <div class="decade-stat">
        <span class="decade-stat-label">Best Year</span>
        <span class="decade-stat-value" style="color:#34c759">+${data.bestYear}%</span>
      </div>
      <div class="decade-stat">
        <span class="decade-stat-label">Worst Year</span>
        <span class="decade-stat-value" style="color:#ff3b30">${data.worstYear}%</span>
      </div>
      <div class="decade-description">${data.description}</div>
    </div>
  `;
}

// ── Risk Profile Cards ────────────────────────────────────────────────────────
function renderRiskProfiles() {
  const container = el('risk-profiles');
  if (!container) return;

  container.innerHTML = '';
  Object.values(RISK_PROFILES).forEach(profile => {
    const div = document.createElement('div');
    div.className = `risk-card${state.riskProfile === profile.key ? ' risk-card--active' : ''}`;
    div.dataset.profile = profile.key;
    div.innerHTML = `
      <div class="risk-card-header">
        <span class="risk-card-label">${profile.label}</span>
        <span class="risk-card-rate" style="color:${profile.color}">${profile.rate}%</span>
      </div>
      <div class="risk-card-desc">${profile.description}</div>
    `;
    div.addEventListener('click', () => {
      state.riskProfile = profile.key;
      renderRiskProfiles();
      recalculate();
    });
    container.appendChild(div);
  });
}

// ── Market Comparison Stats ───────────────────────────────────────────────────
function updateMarketStats(marketData) {
  const container = el('market-comparison-stats');
  if (!container) return;

  if (!marketData) {
    container.innerHTML = `
      <div class="market-stats-placeholder">
        <p>Add extra payments above to see the <strong>pay-down vs. invest</strong> comparison.</p>
      </div>
    `;
    return;
  }

  const verdict = marketData.verdict;
  const verdictText = verdict === 'invest'
    ? `<span class="verdict-invest">Investing looks better</span> in the base scenario`
    : `<span class="verdict-paydown">Paying extra looks better</span> in the base scenario`;

  container.innerHTML = `
    <div class="market-stats-grid">
      <div class="market-stat">
        <div class="market-stat-label">Interest Saved</div>
        <div class="market-stat-value accent-blue">${fmt(marketData.interestSaved)}</div>
        <div class="market-stat-sub">guaranteed return</div>
      </div>
      <div class="market-stat">
        <div class="market-stat-label">Market Return — Bear</div>
        <div class="market-stat-value accent-red">${fmt(marketData.marketLow)}</div>
        <div class="market-stat-sub">${fmtPct(marketData.scenarios.low)} / yr</div>
      </div>
      <div class="market-stat">
        <div class="market-stat-label">Market Return — Base</div>
        <div class="market-stat-value accent-green">${fmt(marketData.marketBase)}</div>
        <div class="market-stat-sub">${fmtPct(marketData.scenarios.base)} / yr</div>
      </div>
      <div class="market-stat">
        <div class="market-stat-label">Market Return — Bull</div>
        <div class="market-stat-value accent-orange">${fmt(marketData.marketHigh)}</div>
        <div class="market-stat-sub">${fmtPct(marketData.scenarios.high)} / yr</div>
      </div>
    </div>
    <div class="market-verdict">
      ${verdictText} — but remember: paying off debt is a <em>guaranteed</em> return.
    </div>
  `;
}

// ── Rate Table ────────────────────────────────────────────────────────────────
function updateRateTable(scenarios) {
  const container = el('rate-table');
  if (!container) return;

  const rows = scenarios.map(s => {
    const isBase = s.offset === 0;
    return `
      <tr class="${isBase ? 'rate-row--base' : ''}">
        <td>${s.rate.toFixed(2)}%${isBase ? ' ●' : ''}</td>
        <td>${fmt(s.result.fixedPayment, 0)}</td>
        <td>${fmt(s.result.totalInterestPaid, 0)}</td>
        <td>${fmt(s.result.totalPaid, 0)}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="rate-table-el">
      <thead>
        <tr>
          <th>Rate</th>
          <th>Payment</th>
          <th>Total Interest</th>
          <th>Total Paid</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── Main Recalculate ──────────────────────────────────────────────────────────
function recalculate() {
  syncCurrencySymbol();
  const principal = getLoanAmount();
  if (principal <= 0 || state.annualRate <= 0 || state.termYears <= 0) return;

  const baseParams = {
    principal,
    annualRate: state.annualRate,
    compoundPeriods: state.compoundPeriods,
    paymentPeriods: state.paymentPeriods,
    termYears: state.termYears,
    extraType: 'none'
  };

  const extraStartPeriod = dateToPeriod(state.extraStartDate, state.loanStartDate, state.paymentPeriods);

  const extraParams = {
    ...baseParams,
    extraType: state.extraType,
    extraOneTimeAmount: state.extraOneTimeAmount,
    extraOneTimePeriod: state.extraOneTimePeriod,
    extraRegularAmount: state.extraRegularAmount,
    extraRegularFrequency: state.extraRegularFrequency,
    extraStartPeriod
  };

  const base  = buildAmortizationSchedule(baseParams);
  const extra = (state.extraType !== 'none') ? buildAmortizationSchedule(extraParams) : null;

  // Yearly aggregates for charts
  const baseYearly  = aggregateToYears(base.schedule,  state.paymentPeriods);
  const extraYearly = extra ? aggregateToYears(extra.schedule, state.paymentPeriods) : null;

  // Rate comparison
  const rateScenarios = buildRateComparisonScenarios(baseParams);

  // Market comparison
  const marketData = extra
    ? calculateMarketComparison(extra, base, state.marketMode, state.decade, state.riskProfile)
    : null;

  // ── Update Summary Cards ──
  const pmtLabel = paymentLabel();
  setTextContent('metric-monthly-payment', fmt(base.fixedPayment));
  setTextContent('metric-payment-freq', `per ${pmtLabel}`);
  setTextContent('metric-total-paid', fmt(base.totalPaid));
  setTextContent('metric-num-payments', `${base.actualPeriods} payments`);
  setTextContent('metric-total-interest', fmt(base.totalInterestPaid));

  const interestPct = principal > 0 ? (base.totalInterestPaid / principal * 100).toFixed(1) : 0;
  setTextContent('metric-interest-pct', `${interestPct}% of loan`);
  setTextContent('metric-payoff-date', payoffDate(base.actualPeriods, state.paymentPeriods, state.loanStartDate));
  setTextContent('metric-payoff-months', periodsToString(base.actualPeriods, state.paymentPeriods));

  // ── Extra Payment Impact Banner ──
  if (extra) {
    const saved = base.totalInterestPaid - extra.totalInterestPaid;
    const periodsSaved = base.actualPeriods - extra.actualPeriods;

    showEl('extra-impact-banner');
    setTextContent('impact-interest-saved', fmt(saved));
    setTextContent('impact-time-saved', periodsToString(periodsSaved, state.paymentPeriods));
    setTextContent('impact-new-payoff', payoffDate(extra.actualPeriods, state.paymentPeriods, state.loanStartDate));
    setTextContent('impact-new-payment', `${fmt(extra.fixedPayment + (state.extraType === 'regular'
      ? (state.extraRegularAmount * (EXTRA_FREQ_MAP[state.extraRegularFrequency] || 12) / state.paymentPeriods)
      : 0))} / ${pmtLabel}`);
  } else {
    hideEl('extra-impact-banner');
  }

  // ── Update dynamic UI helpers ──
  updateDpImpactCards();
  updateRateComparisonPills();
  updateDecadeInfo();
  updateRateTable(rateScenarios);
  updateMarketStats(marketData);

  // ── Update Charts ──
  updateAmortizationChart(baseYearly, extraYearly);
  updateBalanceChart(baseYearly, extraYearly);
  updateRateComparisonChart(rateScenarios, state.paymentPeriods);
  updateMarketChart(marketData, base, extra);

  // ── URL hash ──
  encodeStateToHash();
}

// ── URL State ─────────────────────────────────────────────────────────────────
function encodeStateToHash() {
  try {
    const encoded = btoa(JSON.stringify(state));
    history.replaceState(null, '', `#s=${encoded}`);
  } catch (e) { /* ignore */ }
}

function decodeStateFromHash() {
  try {
    const hash = window.location.hash;
    if (!hash.startsWith('#s=')) return false;
    const decoded = JSON.parse(atob(hash.slice(3)));
    Object.assign(state, decoded);
    return true;
  } catch (e) {
    return false;
  }
}

// ── Segment Controls ──────────────────────────────────────────────────────────
function bindSegmentControl(containerId, onChange) {
  const container = el(containerId);
  if (!container) return;
  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(btn.dataset.value);
    });
  });
}

function setActiveSegment(containerId, value) {
  const container = el(containerId);
  if (!container) return;
  container.querySelectorAll('button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === String(value));
  });
}

// ── Event Bindings ────────────────────────────────────────────────────────────
function bindEvents() {

  // Loan type
  bindSegmentControl('loan-type-toggle', val => {
    state.loanType = val;
    updateLoanTypeLabels();
    recalculate();
  });

  // Currency
  el('currency-select').addEventListener('change', e => {
    const selected = CURRENCIES.find(c => c.code === e.target.value);
    if (!selected) return;
    if (selected.code === 'CUSTOM') {
      showEl('custom-symbol');
      return;
    }
    hideEl('custom-symbol');
    state.currency = { code: selected.code, symbol: selected.symbol };
    updateCurrencySymbols();
    recalculate();
  });

  el('custom-symbol').addEventListener('input', e => {
    state.currency = { code: 'CUSTOM', symbol: e.target.value || '$' };
    updateCurrencySymbols();
    recalculate();
  });

  // Home price
  el('home-price').addEventListener('input', e => {
    state.homePrice = parseFloat(e.target.value) || 0;
    const dpAmount = state.homePrice * state.downPaymentPct / 100;
    el('down-payment').value = Math.round(dpAmount);
    updateLoanAmountDisplay();
    recalculate();
  });

  // Down payment amount
  el('down-payment').addEventListener('input', e => {
    const dpAmt = parseFloat(e.target.value) || 0;
    state.downPaymentPct = state.homePrice > 0 ? (dpAmt / state.homePrice) * 100 : 0;
    state.downPaymentPct = Math.min(100, Math.max(0, state.downPaymentPct));
    el('dp-slider').value = state.downPaymentPct.toFixed(1);
    syncSliderFill(el('dp-slider'));
    updateDpPercentDisplay();
    updateLoanAmountDisplay();
    updateDpBar();
    recalculate();
  });

  // Down payment slider
  el('dp-slider').addEventListener('input', e => {
    state.downPaymentPct = parseFloat(e.target.value);
    el('down-payment').value = Math.round(state.homePrice * state.downPaymentPct / 100);
    syncSliderFill(e.target);
    updateDpPercentDisplay();
    updateLoanAmountDisplay();
    updateDpBar();
    recalculate();
  });

  // Rate slider
  el('rate-slider').addEventListener('input', e => {
    state.annualRate = parseFloat(e.target.value);
    el('rate-value-display').value = state.annualRate.toFixed(2);
    syncSliderFill(e.target);
    recalculate();
  });
  el('rate-value-display').addEventListener('input', e => {
    const val = parseFloat(e.target.value);
    if (isNaN(val) || val <= 0) return;
    state.annualRate = Math.min(30, Math.max(0.1, val));
    el('rate-slider').value = Math.min(20, Math.max(0.5, state.annualRate));
    syncSliderFill(el('rate-slider'));
    recalculate();
  });

  // Term slider
  el('term-slider').addEventListener('input', e => {
    state.termYears = parseInt(e.target.value);
    el('term-value-display').value = state.termYears;
    syncSliderFill(e.target);
    updateTermPresets();
    recalculate();
  });
  el('term-value-display').addEventListener('input', e => {
    const val = parseInt(e.target.value);
    if (isNaN(val) || val <= 0) return;
    state.termYears = Math.min(50, Math.max(1, val));
    el('term-slider').value = Math.min(30, Math.max(1, state.termYears));
    syncSliderFill(el('term-slider'));
    updateTermPresets();
    recalculate();
  });

  // Term presets
  document.querySelectorAll('.preset-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.termYears = parseInt(btn.dataset.years);
      el('term-slider').value = state.termYears;
      syncSliderFill(el('term-slider'));
      el('term-value-display').value = state.termYears;
      updateTermPresets();
      recalculate();
    });
  });

  // Compound period
  el('compound-period').addEventListener('change', e => {
    state.compoundPeriods = parseInt(e.target.value);
    recalculate();
  });

  // Payment period
  el('payment-period').addEventListener('change', e => {
    state.paymentPeriods = parseInt(e.target.value);
    recalculate();
  });

  // Extra payment type
  bindSegmentControl('extra-type-toggle', val => {
    state.extraType = val;
    toggleClass('extra-start-date-section', 'hidden', val === 'none');
    toggleClass('extra-onetime-section', 'hidden', val !== 'onetime');
    toggleClass('extra-regular-section', 'hidden', val !== 'regular');
    recalculate();
  });

  el('extra-onetime-amount').addEventListener('input', e => {
    state.extraOneTimeAmount = parseFloat(e.target.value) || 0;
    recalculate();
  });
  el('extra-regular-amount').addEventListener('input', e => {
    state.extraRegularAmount = parseFloat(e.target.value) || 0;
    recalculate();
  });
  el('extra-regular-frequency').addEventListener('change', e => {
    state.extraRegularFrequency = e.target.value;
    recalculate();
  });
  el('extra-start-date').addEventListener('change', e => {
    state.extraStartDate = e.target.value;
    recalculate();
  });
  el('loan-start-date').addEventListener('change', e => {
    state.loanStartDate = e.target.value;
    el('extra-start-date').placeholder = e.target.value || 'Loan start date';
    recalculate();
  });

  // Market mode
  bindSegmentControl('market-mode-toggle', val => {
    state.marketMode = val;
    toggleClass('market-historical-section', 'hidden', val !== 'historical');
    toggleClass('market-simple-section', 'hidden', val !== 'simple');
    recalculate();
  });

  el('decade-select').addEventListener('change', e => {
    state.decade = e.target.value;
    updateDecadeInfo();
    recalculate();
  });

  // Share
  el('btn-share').addEventListener('click', openShareModal);
  el('modal-close').addEventListener('click', closeShareModal);
  el('share-modal').addEventListener('click', e => {
    if (e.target === el('share-modal')) closeShareModal();
  });
  el('btn-copy-url').addEventListener('click', () => {
    const input = el('share-url-input');
    input.select();
    navigator.clipboard.writeText(input.value).catch(() => {
      document.execCommand('copy');
    });
    showToast('Link copied to clipboard!');
    el('btn-copy-url').textContent = 'Copied!';
    setTimeout(() => { el('btn-copy-url').textContent = 'Copy'; }, 2000);
  });

  // Reset
  el('btn-reset').addEventListener('click', () => {
    if (!confirm('Reset all values to defaults?')) return;
    Object.assign(state, { ...DEFAULTS });
    populateFromState();
    recalculate();
  });

  // Keyboard: ESC closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeShareModal();
  });
}

// ── Share Modal ────────────────────────────────────────────────────────────────
function openShareModal() {
  encodeStateToHash();
  el('share-url-input').value = window.location.href;
  showEl('share-modal');
}

function closeShareModal() {
  hideEl('share-modal');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  setTextContent('toast-message', msg);
  const toast = el('toast');
  toast.classList.remove('hidden');
  toast.classList.add('toast--visible');
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.classList.add('hidden'), 400);
  }, 2500);
}

// ── UI Update Helpers ─────────────────────────────────────────────────────────
function updateDpPercentDisplay() {
  setTextContent('dp-percent-display', `${state.downPaymentPct.toFixed(1)}%`);
}

function updateLoanAmountDisplay() {
  const amt = getLoanAmount();
  setTextContent('loan-amount-display', fmt(amt));
}

function updateDpBar() {
  const fill = el('dp-bar-fill');
  if (fill) fill.style.width = `${Math.min(100, state.downPaymentPct)}%`;
}

function updateTermPresets() {
  document.querySelectorAll('.preset-pill').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.years) === state.termYears);
  });
}

function updateLoanTypeLabels() {
  const isMortgage = state.loanType === 'mortgage';
  el('home-price-label').textContent = isMortgage ? 'Home Price' : 'Total Cost';
  el('down-payment-label') && (el('down-payment-label').textContent = isMortgage ? 'Down Payment' : 'Initial Payment');
}

function updateCurrencySymbols() {
  document.querySelectorAll('.currency-symbol').forEach(el => {
    el.textContent = state.currency.symbol;
  });
  syncCurrencySymbol();
}

// ── Populate UI from State ────────────────────────────────────────────────────
function populateFromState() {
  el('home-price').value     = state.homePrice;
  el('down-payment').value   = Math.round(state.homePrice * state.downPaymentPct / 100);
  el('dp-slider').value      = state.downPaymentPct;
  el('rate-slider').value    = state.annualRate;
  el('term-slider').value    = state.termYears;
  el('compound-period').value = state.compoundPeriods;
  el('payment-period').value  = state.paymentPeriods;
  el('extra-onetime-amount').value  = state.extraOneTimeAmount;
  el('extra-regular-amount').value  = state.extraRegularAmount;
  el('extra-regular-frequency').value = state.extraRegularFrequency;
  el('extra-start-date').value = state.extraStartDate || '';
  el('extra-start-date').placeholder = state.loanStartDate || 'Loan start date';
  el('loan-start-date').value = state.loanStartDate || '';
  el('decade-select').value  = state.decade;
  el('currency-select').value = state.currency.code;

  el('rate-value-display').value = state.annualRate.toFixed(2);
  el('term-value-display').value = state.termYears;
  updateDpPercentDisplay();
  updateLoanAmountDisplay();
  updateDpBar();
  updateTermPresets();
  updateCurrencySymbols();
  updateLoanTypeLabels();

  // Sync slider fills
  [el('dp-slider'), el('rate-slider'), el('term-slider')].forEach(syncSliderFill);

  // Segment controls
  setActiveSegment('loan-type-toggle',  state.loanType);
  setActiveSegment('extra-type-toggle', state.extraType);
  setActiveSegment('market-mode-toggle', state.marketMode);

  // Extra sections visibility
  toggleClass('extra-start-date-section', 'hidden', state.extraType === 'none');
  toggleClass('extra-onetime-section', 'hidden', state.extraType !== 'onetime');
  toggleClass('extra-regular-section', 'hidden', state.extraType !== 'regular');
  toggleClass('market-historical-section', 'hidden', state.marketMode !== 'historical');
  toggleClass('market-simple-section', 'hidden', state.marketMode !== 'simple');

  renderRiskProfiles();
  updateDecadeInfo();
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  // Try to restore from URL hash
  const restored = decodeStateFromHash();
  if (!restored) {
    Object.assign(state, DEFAULTS);
  }

  populateSelects();
  populateFromState();
  renderRiskProfiles();
  initCharts();
  bindEvents();
  recalculate();

  // Sticky header shadow on scroll
  window.addEventListener('scroll', () => {
    el('header').classList.toggle('header--scrolled', window.scrollY > 10);
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', init);
