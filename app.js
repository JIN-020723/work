/**
 * app.js
 * 메인 앱 진입점 - 모든 모듈을 통합하고 이벤트를 오케스트레이션
 */

import { loadStoreData, BRAND_CONFIGS } from './data-loader.js';
import { initMap, renderMarkers, focusMarker, setActiveMarker, updateWalkRings, resetView, showUserLocation } from './map-manager.js';
import { initFilters, setWalkFilter, toggleBrand, setKeyword, resetFilters, getFilterState, getFilteredStores } from './filter-manager.js';
import { initListRenderer, renderList, scrollToCard } from './list-renderer.js';
import { initDonutChart, updateDonutChart, updateStats } from './chart-manager.js';

// ── CSV 경로 설정 (data/ 폴더 내)
const CSV_PATH = 'data/부산상가_편의점.csv';

// ── 도보 필터 버튼 설정
const WALK_BTNS = [
  { id: 'walk-5min',  distM: 400,  label: '5분', ringKey: '5min' },
  { id: 'walk-10min', distM: 800,  label: '10분', ringKey: '10min' },
  { id: 'walk-15min', distM: 1200, label: '15분', ringKey: '15min' },
  { id: 'walk-all',   distM: null, label: '전체', ringKey: null },
];

let allStores = [];

// ─────────────────────────────────────────────
async function main() {
  // 1) 지도 초기화
  initMap('map', onMarkerClickedFromMap);

  // 2) 리스트 렌더러 초기화
  initListRenderer('store-list', 'store-list-count', 'empty-state', onStoreSelectedFromSidebar);

  // 3) 도넛 차트 초기화
  initDonutChart('donut-canvas');

  // 4) UI 이벤트 바인딩
  bindWalkFilterBtns();
  bindBrandChips();
  bindSearchInput();
  bindSidebarToggle();
  bindMapControls();
  bindHeaderActions();

  // 5) CSV 데이터 로드
  try {
    showLoading(true);
    allStores = await loadStoreData(CSV_PATH);

    // 6) 필터 엔진 초기화 (기본: 도보 10분)
    initFilters(allStores, onFilterChanged);

    // 7) 초기 렌더링
    const initialFiltered = getFilteredStores();
    renderAll(initialFiltered);

    // 8) 브랜드 칩에 전체 도수 뱃지 업데이트
    updateBrandCounts(allStores);

    showLoading(false);
  } catch (err) {
    console.error('[App] 데이터 로드 실패:', err);
    showLoadingError(err.message);
  }
}

// ── 필터 변경 시 전체 업데이트
function onFilterChanged(filtered, state) {
  renderAll(filtered);
  updateWalkRingFromState(state);
  updateBrandChipActive(state);
  updateWalkBtnActive(state);
}

function renderAll(stores) {
  renderMarkers(stores, onMarkerClickedFromMap);
  renderList(stores);
  updateDonutChart(stores);
  updateStats(stores, getFilterState());
  updateBrandCounts(stores);
}

// ─── 이벤트 핸들러 ───

function onMarkerClickedFromMap(storeId) {
  scrollToCard(storeId);
}

function onStoreSelectedFromSidebar(store) {
  // 사이드바에서 상점 선택 시 지도 동기화는 list-renderer에서 처리
}

// ── 도보 필터 버튼
function bindWalkFilterBtns() {
  WALK_BTNS.forEach(({ id, distM }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      setWalkFilter(distM);
    });
  });
  // 기본 10분 활성화
  document.getElementById('walk-10min')?.classList.add('active');
}

function updateWalkBtnActive(state) {
  WALK_BTNS.forEach(({ id, distM }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const isActive = state.walkDistM === distM;
    btn.classList.toggle('active', isActive);
  });
}

function updateWalkRingFromState(state) {
  const ringMap = { 400: '5min', 800: '10min', 1200: '15min' };
  const key = state.walkDistM !== null ? ringMap[state.walkDistM] : null;
  const activeKeys = key ? [key] : ['5min', '10min', '15min'];
  updateWalkRings(state.walkDistM);
}

// ── 브랜드 칩 (HTML id: brand-7eleven, brand-gs25, etc.)
function _brandHtmlId(key) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function bindBrandChips() {
  BRAND_CONFIGS.forEach(({ key }) => {
    const chip = document.getElementById(`brand-${_brandHtmlId(key)}`);
    if (!chip) return;
    chip.addEventListener('click', () => toggleBrand(key));
  });
}

function updateBrandChipActive(state) {
  BRAND_CONFIGS.forEach(({ key }) => {
    const chip = document.getElementById(`brand-${_brandHtmlId(key)}`);
    if (!chip) return;
    chip.classList.toggle('active', state.brands.has(key));
  });
}

function updateBrandCounts(stores) {
  const counts = {};
  for (const s of stores) counts[s.brand.key] = (counts[s.brand.key] || 0) + 1;

  BRAND_CONFIGS.forEach(({ key }) => {
    const badge = document.getElementById(`brand-count-${_brandHtmlId(key)}`);
    if (badge) badge.textContent = (counts[key] || 0);
  });

  // 헤더 배지 동기화
  const headerCount = document.getElementById('header-store-count');
  if (headerCount) headerCount.textContent = stores.length.toLocaleString();
}

// ── 키워드 검색
function bindSearchInput() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  if (!input) return;

  input.addEventListener('input', () => {
    const val = input.value;
    setKeyword(val);
    if (clearBtn) clearBtn.classList.toggle('visible', val.length > 0);
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    setKeyword('');
    clearBtn.classList.remove('visible');
    input.focus();
  });
}

// ── 사이드바 토글
function bindSidebarToggle() {
  const btn = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (!btn || !sidebar) return;

  btn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const icon = btn.querySelector('svg');
    if (icon) {
      const isCollapsed = sidebar.classList.contains('collapsed');
      icon.innerHTML = isCollapsed
        ? '<polyline points="9 18 15 12 9 6"/>'
        : '<polyline points="15 18 9 12 15 6"/>';
    }
    // 지도 재조정
    setTimeout(() => window.__leafletMap?.invalidateSize?.(), 320);
  });
}

// ── 지도 컨트롤 버튼
function bindMapControls() {
  document.getElementById('ctrl-reset')?.addEventListener('click', resetView);
  document.getElementById('ctrl-location')?.addEventListener('click', showUserLocation);
  document.getElementById('ctrl-filter-reset')?.addEventListener('click', () => {
    resetFilters();
    document.getElementById('search-input').value = '';
    document.getElementById('search-clear')?.classList.remove('visible');
  });
}

// ── 헤더 액션 (CSV 내보내기)
function bindHeaderActions() {
  document.getElementById('btn-export')?.addEventListener('click', exportCSV);
}

function exportCSV() {
  const filtered = getFilteredStores();
  const BOM = '\uFEFF';
  const header = '상호명,지점명,브랜드,직선거리(m),예상도보(분),도로명주소,시군구';
  const rows = filtered
    .sort((a, b) => a.distM - b.distM)
    .map(s => [s.name, s.branch, s.brand.label, s.distM, s.walkMin, s.roadAddr, s.district].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
  const csv = BOM + [header, ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `센텀시티역_편의점_${getFilterState().walkDistM || '전체'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${filtered.length}개 상점 데이터를 내보냈습니다.`);
}

// ─── 유틸리티 ───

function showLoading(visible) {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  if (visible) {
    overlay.classList.remove('fade-out');
  } else {
    overlay.classList.add('fade-out');
    setTimeout(() => { overlay.style.display = 'none'; }, 500);
  }
}

function showLoadingError(msg) {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div style="text-align:center;color:#f87171;max-width:340px;padding:20px">
      <svg viewBox="0 0 24 24" width="48" height="48" style="stroke:#f87171;fill:none;stroke-width:2;stroke-linecap:round;margin-bottom:12px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <div style="font-size:1rem;font-weight:700;margin-bottom:8px">데이터 로드 실패</div>
      <div style="font-size:0.78rem;color:#94a3b8;line-height:1.5">${msg}<br>CSV 파일 경로를 확인하고 페이지를 새로고침 해주세요.</div>
    </div>
  `;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

// ── 전역 함수 (팝업 내 인라인 클릭 핸들러)
window.copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).then(() => showToast('주소가 복사되었습니다!'));
};

// ── 앱 시작
main();
