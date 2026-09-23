/**
 * map-manager.js
 * Leaflet 지도 초기화, 센텀시티역 마커, 반경 오버레이, 점포 마커 클러스터 관리
 */

import { CENTUM_LAT, CENTUM_LNG } from './data-loader.js';

let map = null;
let clusterGroup = null;
let centumMarker = null;
let walkRings = {};         // { '5min': circle, '10min': circle, '15min': circle }
let markerMap = new Map();  // storeId → marker
let activeMarkerId = null;

// ── 반경 설정
const WALK_RINGS = {
  '5min':  { distM: 400,  color: '#06d6a0', label: '도보 5분' },
  '10min': { distM: 800,  color: '#4f8ef7', label: '도보 10분' },
  '15min': { distM: 1200, color: '#a855f7', label: '도보 15분' },
};

// ── 브랜드 클래스명 매핑
const BRAND_CLASS = {
  GS25:     'brand-gs25',
  CU:       'brand-cu',
  '7ELEVEN':'brand-seven',
  EMART24:  'brand-emart',
  MINISTOP: 'brand-ministop',
  OTHER:    'brand-other',
};

// ── 브랜드 약칭 (핀 내부 표시)
const BRAND_SHORT = {
  GS25:     'GS',
  CU:       'CU',
  '7ELEVEN':'7E',
  EMART24:  'E24',
  MINISTOP: 'MS',
  OTHER:    '편',
};

export function initMap(containerId, onMarkerClick) {
  map = L.map(containerId, {
    center: [CENTUM_LAT, CENTUM_LNG],
    zoom: 15,
    zoomControl: false,
    attributionControl: true,
  });
  window.__leafletMap = map;  // 사이드바 토글 시 invalidateSize() 호출용

  // CartoDB Positron 타일 (클린 모던, 다크 오버레이 효과)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // 마커 클러스터 그룹 초기화
  clusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 50,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    iconCreateFunction: (cluster) => {
      const count = cluster.getChildCount();
      const size = count < 10 ? 'small' : count < 50 ? 'medium' : 'large';
      return L.divIcon({
        html: `<div>${count}</div>`,
        className: `marker-cluster marker-cluster-${size}`,
        iconSize: [40, 40],
      });
    },
  });

  map.addLayer(clusterGroup);

  // 센텀시티역 마커 추가
  _addCentumMarker();

  // 기본 도보 10분 반경 표시
  _addWalkRings(['10min']);

  return map;
}

// ── 센텀시티역 기준 마커 (펄스 애니메이션)
function _addCentumMarker() {
  const iconHtml = `
    <div class="centum-marker-wrapper">
      <div style="position:relative;display:flex;align-items:center;justify-content:center;">
        <div class="centum-pulse-ring"></div>
        <div class="centum-pulse-ring"></div>
        <div class="centum-pulse-ring"></div>
        <div class="centum-icon">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
        </div>
      </div>
      <div class="centum-label">🚇 센텀시티역</div>
    </div>
  `;

  const icon = L.divIcon({
    html: iconHtml,
    className: '',
    iconSize: [100, 70],
    iconAnchor: [50, 36],
  });

  centumMarker = L.marker([CENTUM_LAT, CENTUM_LNG], { icon, interactive: false, zIndexOffset: 1000 });
  centumMarker.addTo(map);
}

// ── 도보 반경 원 추가
function _addWalkRings(activeKeys) {
  // 기존 원 제거
  Object.values(walkRings).forEach(r => { if (map.hasLayer(r)) r.remove(); });
  walkRings = {};

  for (const key of activeKeys) {
    const cfg = WALK_RINGS[key];
    if (!cfg) continue;
    const ring = L.circle([CENTUM_LAT, CENTUM_LNG], {
      radius: cfg.distM,
      color: cfg.color,
      weight: 2,
      opacity: 0.7,
      dashArray: '6 4',
      fill: true,
      fillColor: cfg.color,
      fillOpacity: 0.04,
      interactive: false,
      className: 'walk-ring',
    });
    ring.addTo(map);
    walkRings[key] = ring;
  }
}

// ── 반경 원 업데이트 (도보 시간 필터 변경 시)
export function updateWalkRings(selectedRadius) {
  // selectedRadius: 400, 800, 1200 혹은 null(전체)
  Object.values(walkRings).forEach(r => { if (map.hasLayer(r)) r.remove(); });
  walkRings = {};

  for (const [key, cfg] of Object.entries(WALK_RINGS)) {
    if (selectedRadius === null || cfg.distM === selectedRadius) {
      const ring = L.circle([CENTUM_LAT, CENTUM_LNG], {
        radius: cfg.distM,
        color: cfg.color,
        weight: selectedRadius === null ? 1.5 : 2,
        opacity: selectedRadius === null ? 0.4 : 0.75,
        dashArray: '6 4',
        fill: true,
        fillColor: cfg.color,
        fillOpacity: selectedRadius === null ? 0.02 : 0.05,
        interactive: false,
        className: 'walk-ring',
      });
      ring.addTo(map);
      walkRings[key] = ring;
    }
  }
}

// ── 커스텀 마커 아이콘 생성
function _createMarkerIcon(store) {
  const brandClass = BRAND_CLASS[store.brand.key] || 'brand-other';
  const short = BRAND_SHORT[store.brand.key] || '편';
  const html = `
    <div class="marker-pin-wrapper ${brandClass}">
      <div class="marker-pin-icon"><span>${short}</span></div>
      <div class="marker-pin-stem"></div>
    </div>
  `;
  return L.divIcon({
    html,
    className: '',
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -44],
  });
}

// ── 팝업 HTML 생성
function _buildPopupHtml(store) {
  const addrDisplay = store.roadAddr || store.jibnAddr || '주소 정보 없음';
  const walkLabel   = store.walkMin <= 1 ? '도보 1분 이내' : `도보 약 ${store.walkMin}분`;
  const distLabel   = `${store.distM.toLocaleString()}m`;
  const branchLabel = store.branch ? ` <span class="branch">(${store.branch})</span>` : '';
  const buildingLabel = store.building ? `<div class="popup-row"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg><span>${store.building}</span></div>` : '';
  const naverUrl = `https://map.naver.com/v5/search/${encodeURIComponent(store.fullName)}`;
  const kakaoUrl = `https://map.kakao.com/?q=${encodeURIComponent(addrDisplay)}`;

  return `
    <div class="popup-card">
      <div class="popup-header">
        <div class="popup-brand-badge" style="background:${store.brand.color}">${store.brand.label}</div>
        <div class="popup-name">
          <h3>${_esc(store.name)}${branchLabel}</h3>
        </div>
      </div>
      <div class="popup-divider"></div>
      <div class="popup-walk-info">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><path d="M9 17l1.5-5.5L13 13.5 15 9"/><path d="M8.5 10.5C10 8.5 14 8 15.5 10"/></svg>
        <span class="popup-walk-time">${walkLabel}</span>
        <span class="popup-walk-dist">${distLabel}</span>
      </div>
      <div class="popup-row">
        <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span>${_esc(addrDisplay)}</span>
      </div>
      ${buildingLabel}
      <div class="popup-actions">
        <button class="popup-action-btn copy-btn" onclick="copyToClipboard('${_esc(addrDisplay).replace(/'/g, "\\'")}')">
          <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          주소 복사
        </button>
        <a class="popup-action-btn" href="${kakaoUrl}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          카카오맵
        </a>
        <a class="popup-action-btn" href="${naverUrl}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/></svg>
          네이버맵
        </a>
      </div>
    </div>
  `;
}

function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 마커 전체 교체
export function renderMarkers(stores, onMarkerClick) {
  clusterGroup.clearLayers();
  markerMap.clear();
  activeMarkerId = null;

  for (const store of stores) {
    const marker = L.marker([store.lat, store.lng], {
      icon: _createMarkerIcon(store),
      title: store.fullName,
    });

    marker.bindPopup(_buildPopupHtml(store), {
      maxWidth: 320,
      closeButton: true,
      autoPanPadding: [30, 30],
    });

    marker.on('click', () => {
      setActiveMarker(store.id);
      if (typeof onMarkerClick === 'function') onMarkerClick(store.id);
    });

    clusterGroup.addLayer(marker);
    markerMap.set(store.id, { marker, store });
  }
}

// ── 특정 마커 활성화 (flyTo + 팝업 열기)
export function focusMarker(storeId, flyTo = true) {
  const entry = markerMap.get(storeId);
  if (!entry) return;
  const { marker, store } = entry;

  setActiveMarker(storeId);

  if (flyTo) {
    map.flyTo([store.lat, store.lng], Math.max(map.getZoom(), 17), { duration: 0.8 });
  }

  // 클러스터 내 마커 스파이더파이 후 팝업 열기
  clusterGroup.zoomToShowLayer(marker, () => {
    marker.openPopup();
  });
}

export function setActiveMarker(storeId) {
  activeMarkerId = storeId;
}

export function getActiveMarkerId() { return activeMarkerId; }

// ── 지도 뷰 초기화
export function resetView() {
  map.flyTo([CENTUM_LAT, CENTUM_LNG], 15, { duration: 0.8 });
}

// ── 현재 위치 표시
export function showUserLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      L.circleMarker([lat, lng], {
        radius: 9,
        fillColor: '#4f8ef7',
        fillOpacity: 0.9,
        color: 'white',
        weight: 3,
      }).addTo(map).bindPopup('현재 위치').openPopup();
      map.flyTo([lat, lng], 15, { duration: 1 });
    },
    () => {}
  );
}

export function getMap() { return map; }
