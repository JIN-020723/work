/**
 * chart-manager.js
 * 브랜드 점유율 도넛 차트 및 도보 거리대 분포 차트 (Chart.js)
 */

const BRAND_COLORS = {
  GS25:     '#007BC4',
  CU:       '#82239e',
  '7ELEVEN':'#EE2724',
  EMART24:  '#e09b00',
  MINISTOP: '#004F9F',
  OTHER:    '#475569',
};

const BRAND_LABELS = {
  GS25:     'GS25',
  CU:       'CU',
  '7ELEVEN':'세븐일레븐',
  EMART24:  '이마트24',
  MINISTOP: '미니스톱',
  OTHER:    '기타',
};

let donutChart = null;

export function initDonutChart(canvasId) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [],
        borderColor: 'rgba(11,17,32,0.5)',
        borderWidth: 2,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: false,
      cutout: '68%',
      animation: { duration: 400, easing: 'easeInOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed}개 (${Math.round(ctx.parsed / ctx.dataset.data.reduce((a, b) => a + b, 0) * 100)}%)`,
          },
          backgroundColor: 'rgba(11,17,40,0.95)',
          titleColor: '#f0f4ff',
          bodyColor: '#8fa3c8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
        },
      },
    },
  });
}

export function updateDonutChart(stores) {
  if (!donutChart) return;

  // 브랜드별 집계
  const counts = {};
  for (const s of stores) {
    counts[s.brand.key] = (counts[s.brand.key] || 0) + 1;
  }

  // 데이터 없으면 숨김
  if (Object.keys(counts).length === 0) {
    donutChart.data.labels = [];
    donutChart.data.datasets[0].data = [];
    donutChart.data.datasets[0].backgroundColor = [];
    donutChart.update('none');
    return;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([k]) => BRAND_LABELS[k] || k);
  const data   = sorted.map(([, v]) => v);
  const colors = sorted.map(([k]) => BRAND_COLORS[k] || '#64748b');

  donutChart.data.labels = labels;
  donutChart.data.datasets[0].data = data;
  donutChart.data.datasets[0].backgroundColor = colors;
  donutChart.update();

  // 범례 업데이트
  _updateLegend(sorted, stores.length);
}

function _updateLegend(sorted, total) {
  const legendEl = document.getElementById('chart-legend');
  if (!legendEl) return;

  const topBrands = sorted.slice(0, 5);
  legendEl.innerHTML = topBrands.map(([k, v]) => {
    const pct = total > 0 ? Math.round(v / total * 100) : 0;
    const color = BRAND_COLORS[k] || '#64748b';
    const label = BRAND_LABELS[k] || k;
    return `
      <div class="legend-item">
        <div class="legend-dot" style="background:${color}"></div>
        <span class="legend-name">${label}</span>
        <span class="legend-pct">${pct}%</span>
      </div>
    `;
  }).join('');
}

// ── KPI 통계 카드 업데이트
export function updateStats(stores, filterState) {
  const totalEl   = document.getElementById('stat-total');
  const nearestEl = document.getElementById('stat-nearest');
  const top1El    = document.getElementById('stat-top-brand');

  if (totalEl) totalEl.textContent = stores.length.toLocaleString();

  if (nearestEl) {
    if (stores.length > 0) {
      const nearest = stores.reduce((a, b) => a.distM < b.distM ? a : b);
      nearestEl.textContent = `${nearest.walkMin}분`;
      nearestEl.title = nearest.fullName;
    } else {
      nearestEl.textContent = '-';
    }
  }

  if (top1El) {
    if (stores.length > 0) {
      const counts = {};
      for (const s of stores) counts[s.brand.key] = (counts[s.brand.key] || 0) + 1;
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      top1El.textContent = BRAND_LABELS[top[0]] || top[0];
    } else {
      top1El.textContent = '-';
    }
  }
}
