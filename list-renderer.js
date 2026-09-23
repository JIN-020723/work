/**
 * list-renderer.js
 * 사이드바 점포 카드 목록 렌더링 (거리순 정렬, 청크 기반 렌더링)
 */

import { focusMarker, getActiveMarkerId } from './map-manager.js';

const BRAND_COLOR = {
  GS25:     '#007BC4',
  CU:       '#82239e',
  '7ELEVEN':'#EE2724',
  EMART24:  '#e09b00',
  MINISTOP: '#004F9F',
  OTHER:    '#475569',
};

const BRAND_SHORT = {
  GS25:     'GS',
  CU:       'CU',
  '7ELEVEN':'7E',
  EMART24:  'E24',
  MINISTOP: 'MS',
  OTHER:    '편',
};

let listEl = null;
let countEl = null;
let emptyEl = null;
let currentStores = [];
let renderedCount = 0;
const CHUNK_SIZE = 40;
let onStoreSelectCallback = null;
let activeCardId = null;

export function initListRenderer(listElId, countElId, emptyElId, onStoreSelect) {
  listEl = document.getElementById(listElId);
  countEl = document.getElementById(countElId);
  emptyEl = document.getElementById(emptyElId);
  onStoreSelectCallback = onStoreSelect;

  // 스크롤 하단 무한 로드
  listEl.addEventListener('scroll', _onScroll);
}

export function renderList(stores) {
  currentStores = [...stores].sort((a, b) => a.distM - b.distM);
  renderedCount = 0;
  listEl.innerHTML = '';

  if (currentStores.length === 0) {
    emptyEl.style.display = 'block';
    if (countEl) countEl.textContent = '0개';
    return;
  }

  emptyEl.style.display = 'none';
  if (countEl) countEl.textContent = `${currentStores.length.toLocaleString()}개`;

  _renderChunk();
}

function _renderChunk() {
  const fragment = document.createDocumentFragment();
  const end = Math.min(renderedCount + CHUNK_SIZE, currentStores.length);

  for (let i = renderedCount; i < end; i++) {
    fragment.appendChild(_createCard(currentStores[i]));
  }

  listEl.appendChild(fragment);
  renderedCount = end;
}

function _onScroll() {
  if (renderedCount >= currentStores.length) return;
  const { scrollTop, scrollHeight, clientHeight } = listEl;
  if (scrollTop + clientHeight >= scrollHeight - 80) {
    _renderChunk();
  }
}

function _createCard(store) {
  const color = BRAND_COLOR[store.brand.key] || '#475569';
  const short = BRAND_SHORT[store.brand.key] || '편';
  const walkLabel = store.walkMin <= 1 ? '1분 이내' : `${store.walkMin}분`;

  const card = document.createElement('div');
  card.className = 'store-card';
  card.dataset.id = store.id;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `${store.fullName}, ${store.roadAddr}`);

  if (store.id === getActiveMarkerId()) {
    card.classList.add('active');
    activeCardId = store.id;
  }

  card.innerHTML = `
    <div class="store-card-icon" style="background:linear-gradient(135deg,${color},${color}aa)">${short}</div>
    <div class="store-card-info">
      <div class="store-card-name">${_esc(store.name)}${store.branch ? ` <span style="color:var(--text-muted);font-weight:400">${_esc(store.branch)}</span>` : ''}</div>
      <div class="store-card-addr">${_esc(store.roadAddr || store.jibnAddr || store.dong)}</div>
      <div class="store-card-meta">
        <span class="walk-badge">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><path d="M9 17l1.5-5.5L13 13.5 15 9"/></svg>
          ${walkLabel}
        </span>
        <span class="dist-text">${store.distM}m</span>
        <span class="brand-tag" style="background:${color}22;color:${color}">${store.brand.label}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => _selectStore(store));
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') _selectStore(store); });

  return card;
}

function _selectStore(store) {
  // 이전 active 제거
  const prev = listEl.querySelector('.store-card.active');
  if (prev) prev.classList.remove('active');

  const card = listEl.querySelector(`[data-id="${store.id}"]`);
  if (card) card.classList.add('active');
  activeCardId = store.id;

  focusMarker(store.id, true);
  if (typeof onStoreSelectCallback === 'function') onStoreSelectCallback(store);
}

// ── 외부에서 특정 카드로 스크롤 (지도 마커 클릭 시)
export function scrollToCard(storeId) {
  // 해당 카드가 아직 렌더링되지 않았으면 해당 위치까지 렌더링
  const idx = currentStores.findIndex(s => s.id === storeId);
  while (idx >= renderedCount && renderedCount < currentStores.length) {
    _renderChunk();
  }

  const prev = listEl.querySelector('.store-card.active');
  if (prev) prev.classList.remove('active');

  const card = listEl.querySelector(`[data-id="${storeId}"]`);
  if (card) {
    card.classList.add('active');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  activeCardId = storeId;
}

function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
