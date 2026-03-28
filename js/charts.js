// ─── Chart Management ─────────────────────────────────────────────────────────
// All Chart.js chart creation and update logic.
// Charts are created once and then their data is updated on recalculate().

const CHART_COLORS = {
  blue:       '#0071e3',
  blueLight:  'rgba(0, 113, 227, 0.15)',
  green:      '#34c759',
  greenLight: 'rgba(52, 199, 89, 0.15)',
  red:        '#ff3b30',
  redLight:   'rgba(255, 59, 48, 0.15)',
  orange:     '#ff9f0a',
  purple:     '#5e5ce6',
  gray:       '#8e8e93',
  grayLight:  'rgba(142,142,147,0.1)',
  // Rate comparison gradient: blue → teal → yellow → orange → red
  rateColors: ['#32ade6', '#34c759', '#0071e3', '#ff9f0a', '#ff3b30']
};

// Chart instances
const charts = {};

// Shared Chart.js defaults
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#6e6e73';
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyleWidth = 10;
Chart.defaults.plugins.legend.labels.padding = 20;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(29,29,31,0.92)';
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 10;
Chart.defaults.plugins.tooltip.titleFont = { weight: '600', size: 13 };
Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
Chart.defaults.plugins.tooltip.displayColors = true;
Chart.defaults.plugins.tooltip.boxPadding = 4;

/**
 * Create gradient fill for a chart canvas.
 */
function makeGradient(ctx, colorTop, colorBottom, height = 300) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, colorTop);
  grad.addColorStop(1, colorBottom);
  return grad;
}

/**
 * Initialize all four charts. Called once on page load.
 */
function initCharts() {
  initAmortizationChart();
  initBalanceChart();
  initRateComparisonChart();
  initMarketChart();
}

// ─── Chart 1: Amortization Schedule (Stacked Bar) ────────────────────────────
function initAmortizationChart() {
  const ctx = document.getElementById('chart-amortization').getContext('2d');
  charts.amortization = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Principal',
          data: [],
          backgroundColor: CHART_COLORS.blue,
          borderRadius: 3,
          borderSkipped: false,
          stack: 'base'
        },
        {
          label: 'Interest',
          data: [],
          backgroundColor: CHART_COLORS.red,
          borderRadius: 3,
          borderSkipped: false,
          stack: 'base'
        },
        {
          label: 'Extra Payment',
          data: [],
          backgroundColor: CHART_COLORS.green,
          borderRadius: 3,
          borderSkipped: false,
          stack: 'base'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrencyShort(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { maxTicksLimit: 10 }
        },
        y: {
          stacked: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            callback: (v) => formatCurrencyShort(v)
          }
        }
      }
    }
  });
}

function updateAmortizationChart(yearly, yearlyExtra) {
  const chart = charts.amortization;
  const labels = yearly.map(r => `Yr ${r.year}`);
  chart.data.labels = labels;
  chart.data.datasets[0].data = yearly.map(r => r.principal);
  chart.data.datasets[1].data = yearly.map(r => r.interest);
  chart.data.datasets[2].data = yearly.map(r => r.extra || 0);

  // Hide extra dataset if zero
  const hasExtra = yearly.some(r => (r.extra || 0) > 0);
  chart.data.datasets[2].hidden = !hasExtra;

  chart.update('active');
}

// ─── Chart 2: Loan Balance Over Time (Line) ───────────────────────────────────
function initBalanceChart() {
  const ctx = document.getElementById('chart-balance').getContext('2d');
  const gradBlue  = makeGradient(ctx, 'rgba(0,113,227,0.25)', 'rgba(0,113,227,0)');
  const gradGreen = makeGradient(ctx, 'rgba(52,199,89,0.20)', 'rgba(52,199,89,0)');

  charts.balance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Base Loan Balance',
          data: [],
          borderColor: CHART_COLORS.blue,
          backgroundColor: gradBlue,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.4
        },
        {
          label: 'With Extra Payments',
          data: [],
          borderColor: CHART_COLORS.green,
          backgroundColor: gradGreen,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          borderDash: [6, 3],
          fill: true,
          tension: 0.4,
          hidden: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrencyShort(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 10 }
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          min: 0,
          ticks: {
            callback: (v) => formatCurrencyShort(v)
          }
        }
      }
    }
  });
}

function updateBalanceChart(yearly, yearlyExtra) {
  const chart = charts.balance;
  const labels = yearly.map(r => `Yr ${r.year}`);
  chart.data.labels = labels;
  chart.data.datasets[0].data = yearly.map(r => r.balance);

  if (yearlyExtra && yearlyExtra.length > 0) {
    // Pad extra data with zeros after payoff to match base length
    const extraBalances = yearlyExtra.map(r => r.balance);
    while (extraBalances.length < yearly.length) extraBalances.push(0);
    chart.data.datasets[1].data = extraBalances;
    chart.data.datasets[1].hidden = false;
  } else {
    chart.data.datasets[1].data = [];
    chart.data.datasets[1].hidden = true;
  }

  chart.update('active');
}

// ─── Chart 3: Rate Comparison (Multi-Line) ────────────────────────────────────
function initRateComparisonChart() {
  const ctx = document.getElementById('chart-rates').getContext('2d');

  const datasets = [
    { label: '—', data: [], borderColor: CHART_COLORS.rateColors[0], pointRadius: 0, pointHoverRadius: 5, borderWidth: 1.5, tension: 0.4 },
    { label: '—', data: [], borderColor: CHART_COLORS.rateColors[1], pointRadius: 0, pointHoverRadius: 5, borderWidth: 1.5, tension: 0.4 },
    { label: '—', data: [], borderColor: CHART_COLORS.rateColors[2], pointRadius: 0, pointHoverRadius: 5, borderWidth: 3,   tension: 0.4 }, // base
    { label: '—', data: [], borderColor: CHART_COLORS.rateColors[3], pointRadius: 0, pointHoverRadius: 5, borderWidth: 1.5, tension: 0.4 },
    { label: '—', data: [], borderColor: CHART_COLORS.rateColors[4], pointRadius: 0, pointHoverRadius: 5, borderWidth: 1.5, tension: 0.4 }
  ];

  charts.rates = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrencyShort(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 10 }
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          min: 0,
          ticks: {
            callback: (v) => formatCurrencyShort(v)
          }
        }
      }
    }
  });
}

function updateRateComparisonChart(scenarios, periodsPerYear) {
  const chart = charts.rates;

  // Use the longest schedule for labels
  const maxYears = Math.max(...scenarios.map(s => Math.ceil(s.result.actualPeriods / periodsPerYear)));
  const labels = Array.from({ length: maxYears }, (_, i) => `Yr ${i + 1}`);
  chart.data.labels = labels;

  scenarios.forEach((scenario, idx) => {
    const yearly = aggregateToYears(scenario.result.schedule, periodsPerYear);
    // Pad to maxYears
    const data = yearly.map(r => r.cumulativeInterest);
    while (data.length < maxYears) data.push(data[data.length - 1] || 0);

    chart.data.datasets[idx].data = data;
    chart.data.datasets[idx].label = scenario.label;
  });

  chart.update('active');
}

// ─── Chart 4: Market vs Loan Comparison (Bar + Line) ─────────────────────────
function initMarketChart() {
  const ctx = document.getElementById('chart-market').getContext('2d');

  charts.market = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Interest Saved (pay extra)',
          data: [],
          borderColor: CHART_COLORS.blue,
          backgroundColor: 'rgba(0,113,227,0.1)',
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.4,
          type: 'line'
        },
        {
          label: 'Market Return — Bear',
          data: [],
          borderColor: CHART_COLORS.red,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          tension: 0.4
        },
        {
          label: 'Market Return — Base',
          data: [],
          borderColor: CHART_COLORS.green,
          backgroundColor: 'rgba(52,199,89,0.08)',
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.4
        },
        {
          label: 'Market Return — Bull',
          data: [],
          borderColor: CHART_COLORS.orange,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          tension: 0.4
        },
        {
          label: 'Amount Invested',
          data: [],
          borderColor: CHART_COLORS.gray,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderDash: [2, 4],
          pointRadius: 0,
          fill: false,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrencyShort(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 10 }
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            callback: (v) => formatCurrencyShort(v)
          }
        }
      }
    }
  });
}

function updateMarketChart(marketData, baseSchedule, extraSchedule) {
  const chart = charts.market;

  if (!marketData || !extraSchedule) {
    // No extra payments — clear chart and show placeholder
    chart.data.labels = [];
    chart.data.datasets.forEach(ds => { ds.data = []; });
    chart.update();
    return;
  }

  const labels = Array.from({ length: marketData.yearsCount }, (_, i) => `Yr ${i + 1}`);
  chart.data.labels = labels;

  // Dataset 0: Interest saved over time
  // Approximate as: cumulative interest savings per year
  const baseYearly  = aggregateToYears(baseSchedule.schedule,  baseSchedule.paymentPeriods);
  const extraYearly = aggregateToYears(extraSchedule.schedule, extraSchedule.paymentPeriods);

  const interestSavedSeries = labels.map((_, i) => {
    const baseCumInt  = baseYearly[i]  ? baseYearly[i].cumulativeInterest  : (baseYearly[baseYearly.length - 1]?.cumulativeInterest   || 0);
    const extraCumInt = extraYearly[i] ? extraYearly[i].cumulativeInterest : (extraYearly[extraYearly.length - 1]?.cumulativeInterest  || 0);
    return Math.max(0, baseCumInt - extraCumInt);
  });

  chart.data.datasets[0].data = interestSavedSeries;
  chart.data.datasets[1].data = marketData.yearlyLow;
  chart.data.datasets[2].data = marketData.yearlyBase;
  chart.data.datasets[3].data = marketData.yearlyHigh;
  chart.data.datasets[4].data = marketData.cumulativeContributions;

  chart.update('active');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrencyShort(value) {
  const sym = window._currencySymbol || '$';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sym}${(value / 1_000).toFixed(0)}K`;
  return `${sym}${Math.round(value).toLocaleString()}`;
}
