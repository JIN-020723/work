/**
 * data-loader.js
 * CSV 파싱, 브랜드 분류, Haversine 도보 거리/시간 계산
 */

// ── 센텀시티역 좌표 (부산 지하철 2호선)
export const CENTUM_LAT = 35.169188;
export const CENTUM_LNG = 129.132047;

// ── 도보 기준 (분당 75m)
const WALK_SPEED_M_PER_MIN = 75;

// ── 브랜드 판별 정규식
const BRAND_RULES = [
  { key: 'GS25',   label: 'GS25',    regex: /GS|지에스/i,           color: '#007BC4' },
  { key: 'CU',     label: 'CU',      regex: /CU|씨유/i,             color: '#82239e' },
  { key: '7ELEVEN',label: '세븐일레븐', regex: /세븐|7.?ELEVEN|7.?일레븐/i, color: '#EE2724' },
  { key: 'EMART24',label: '이마트24', regex: /이마트24|emart24/i,    color: '#e09b00' },
  { key: 'MINISTOP',label:'미니스톱', regex: /미니스톱|미니스탑/i,   color: '#004F9F' },
];

const BRAND_OTHER = { key: 'OTHER', label: '기타/개인', color: '#475569' };

export function detectBrand(name) {
  for (const rule of BRAND_RULES) {
    if (rule.regex.test(name)) return rule;
  }
  return BRAND_OTHER;
}

// ── Haversine 공식 (두 좌표 간 직선거리, 단위: m)
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ── 거리(m) → 예상 도보 시간(분) 문자열
export function walkingMinutes(distM) {
  const mins = Math.ceil(distM / WALK_SPEED_M_PER_MIN);
  return mins;
}

// ── CSV 파일 로드 및 파싱 (PapaParse)
export async function loadStoreData(csvPath) {
  const response = await fetch(csvPath);
  if (!response.ok) throw new Error(`CSV 파일을 불러올 수 없습니다: ${csvPath}`);
  const text = await response.text();

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const stores = [];
        let rejected = 0;

        for (const row of results.data) {
          const lat = parseFloat(row['위도']);
          const lng = parseFloat(row['경도']);

          // 유효한 부산 좌표 검증
          if (
            isNaN(lat) || isNaN(lng) ||
            lat < 34.8 || lat > 35.5 ||
            lng < 128.5 || lng > 129.4
          ) {
            rejected++;
            continue;
          }

          const name   = (row['상호명'] || '').trim();
          const branch = (row['지점명'] || '').trim();
          const brand  = detectBrand(name);
          const dist   = haversineDistance(CENTUM_LAT, CENTUM_LNG, lat, lng);
          const walkMin = walkingMinutes(dist);

          stores.push({
            id:          row['상가업소번호'] || '',
            name,
            branch,
            fullName:    branch ? `${name} ${branch}` : name,
            brand,
            lat,
            lng,
            district:    (row['시군구명']   || '').trim(),
            dong:        (row['행정동명']   || '').trim(),
            roadAddr:    (row['도로명주소'] || '').trim(),
            jibnAddr:    (row['지번주소']  || '').trim(),
            building:    (row['건물명']    || '').trim(),
            industry:    (row['표준산업분류명'] || '').trim(),
            distM:       Math.round(dist),
            walkMin,
          });
        }

        console.log(`[DataLoader] Loaded: ${stores.length} stores, Rejected: ${rejected}`);
        resolve(stores);
      },
      error: reject,
    });
  });
}

// ── 브랜드 상수 목록 (필터 UI 렌더링 용)
export const BRAND_CONFIGS = [...BRAND_RULES, BRAND_OTHER];
