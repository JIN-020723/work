/**
 * filter-manager.js
 * 도보 시간대, 브랜드, 키워드 실시간 다차원 필터 엔진
 */

// ── 필터 상태
let filterState = {
  walkDistM: 800,      // null = 전체, 400 = 5분, 800 = 10분, 1200 = 15분
  brands: new Set(),   // 빈 Set = 전체 허용
  keyword: '',
};

let allStores = [];
let onChangeCallback = null;
let debounceTimer = null;

export function initFilters(stores, onChange) {
  allStores = stores;
  onChangeCallback = onChange;
  // 초기 브랜드 필터 = 전체 허용 (아무것도 선택 안 한 것 = 전체)
  filterState.brands.clear();
}

// ── 도보 거리 필터 설정 (m 단위, null = 전체)
export function setWalkFilter(distM) {
  filterState.walkDistM = distM;
  _emit();
}

// ── 브랜드 토글
export function toggleBrand(brandKey) {
  if (filterState.brands.has(brandKey)) {
    filterState.brands.delete(brandKey);
  } else {
    filterState.brands.add(brandKey);
  }
  _emit();
}

export function clearBrands() {
  filterState.brands.clear();
  _emit();
}

// ── 키워드 필터 (디바운스 200ms)
export function setKeyword(keyword) {
  filterState.keyword = keyword.trim().toLowerCase();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(_emit, 200);
}

// ── 필터 전체 초기화
export function resetFilters() {
  filterState.walkDistM = 800;
  filterState.brands.clear();
  filterState.keyword = '';
  _emit();
}

// ── 현재 필터 상태 반환
export function getFilterState() {
  return { ...filterState, brands: new Set(filterState.brands) };
}

// ── 필터 적용 및 결과 반환
export function getFilteredStores() {
  const { walkDistM, brands, keyword } = filterState;

  return allStores.filter(store => {
    // 도보 거리 필터
    if (walkDistM !== null && store.distM > walkDistM) return false;

    // 브랜드 필터 (선택된 브랜드가 있으면 해당 브랜드만)
    if (brands.size > 0 && !brands.has(store.brand.key)) return false;

    // 키워드 검색
    if (keyword) {
      const searchTarget = `${store.name} ${store.branch} ${store.roadAddr} ${store.building} ${store.dong}`.toLowerCase();
      if (!searchTarget.includes(keyword)) return false;
    }

    return true;
  });
}

// ── 변경 이벤트 발생
function _emit() {
  if (typeof onChangeCallback === 'function') {
    const filtered = getFilteredStores();
    onChangeCallback(filtered, filterState);
  }
}
