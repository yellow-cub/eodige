// =====================================
// 🗺️ 전역 변수 선언
// =====================================
let citiesData = [];              // 도시 리스트
let wrongMarkers = [];            // 오답 마커 리스트
let tries = 6;                    // 남은 시도 횟수
let isAnsweredCorrectly = false;  // 정답 여부 추적
let justSelected = false;         // 자동완성 선택 직후 상태
let map;
let mainMarkerLngLat = null;  // 메인(?) 마커 좌표 저장
let wrongLineSeq = 0;         // 라인 id 구분용 증가 카운터
let mainLabelEl = null;
let mainLabelMarker = null;

// 문제 설정
//let currentZoom = 15.5; // 문제 줌 레벨
//let centerCoords = [128.5780871349555, 35.87392573964598]; // 대구 달성공원
//let correctAnswer = "대구광역시 중구"; // 정답 대구 중구
let currentZoom = 13;
let centerCoords = [128.3642078, 36.9801706]; // 단양중학교
let correctAnswer = "충청북도 단양군"; //
const koreaCenter = [127.76469909658498, 36.35893672161413]; // 남한 국토 중심 충청북도 옥천군 청성면 장연리 (대한민국 국토 중심 국토정중앙천문대 (128.0298, 38.0688))
const koreaZoom = 4.5; // 전국 보이게 줌아웃 레벨 설정

// =====================================
// 🧩 유틸 함수 (Utility Functions)
// =====================================

// 문자열 정규화 (공백/대소문자/기호 제거)
function normalize(str) {
  return str.toLowerCase().replace(/\s+/g, '').replace(/[^\p{L}\p{N}]/gu, '');
}

// 거리 계산 (Haversine 공식))
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = deg => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 조사 붙이기 (은/는 인식)
function attachJosa(word, josaPair) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const jong = code % 28;
  const hasBatchim = jong !== 0;
  return word + (hasBatchim ? josaPair[0] : josaPair[1]);
}


// =====================================
// 🧱 지도 관련 함수
// =====================================

// 게임 종료 시 지도 한국 전체로 확대
function flyToKorea(center, zoom) {
  map.setMinZoom(zoom);
  map.setMaxBounds(null);
  map.flyTo({
    center: center,
    zoom: zoom,
    duration: 2000,
    curve: 1.42,
    essential: true
  });
  map.once('moveend', () => {
    const newBounds = map.getBounds();
    map.setMaxBounds(newBounds);
  });
}

// 지도 오답 마커 생성
function addCorrectMarker(cityObj) {
  if (!mainLabelMarker || !mainMarkerLngLat) return;

  const el = mainLabelMarker.getElement();
  el.textContent = cityObj.tag;
  el.classList.add('correct-text');

  mainLabelMarker.setLngLat([mainMarkerLngLat.lng, mainMarkerLngLat.lat]);
  // ✅ 다시 한 번 보장
  mainLabelMarker.getElement().style.zIndex = '1001';
  mainDotMarker.getElement().style.zIndex = '1000';
}


function createLabeledMarker(cityObj, distanceKm) {
  const color = distanceKm <= 50 ? '#ffcc00'
    : distanceKm <= 100 ? '#ff8d28'
      : '#ff383c';
  const currentTry = 6 - tries;

  // 1) 점(원)
  const dotEl = document.createElement('div');
  dotEl.className = 'marker-dot';
  dotEl.style.backgroundColor = color;
  dotEl.innerHTML = `<span class="try-number">${currentTry}</span>`;

  const dotMarker = new mapboxgl.Marker({ element: dotEl, anchor: 'center', offset: [0, 0] })
    .setLngLat([cityObj.longitude, cityObj.latitude])
    .addTo(map);

  // 점은 아래쪽 z-index
  dotMarker.getElement().style.zIndex = '10';

  // 2) 라벨
  const labelEl = document.createElement('div');
  labelEl.className = 'marker-label';
  labelEl.textContent = cityObj.tag;

  const labelMarker = new mapboxgl.Marker({ element: labelEl, anchor: 'bottom', offset: [0, -12] })
    .setLngLat([cityObj.longitude, cityObj.latitude])
    .addTo(map);

  // 라벨도 아래쪽 z-index
  labelMarker.getElement().style.zIndex = '11';

  // 3) 점선(메인 점 ↔ 오답 점)
  if (mainMarkerLngLat) {
    const run = () => addDashedConnector(
      map,
      mainMarkerLngLat,
      [cityObj.longitude, cityObj.latitude],
      color
    );
    if (map.isStyleLoaded()) run(); else map.once('load', run);
  }

  // 필요하면 전역 배열에 보관
  // guessDotMarkers.push(dotMarker);
  // guessLabelMarkers.push(labelMarker);

  return dotMarker;
}

function flyToAllMarkers(correctCity) {
  if (!map) {
    console.warn("⚠️ map 객체가 아직 초기화되지 않았습니다.");
    return;
  }

  const allCoords = [];

  // 오답 마커 좌표 추출
  wrongMarkers.forEach(marker => {
    if (marker && marker.getLngLat) {
      const pos = marker.getLngLat();
      allCoords.push([pos.lng, pos.lat]);
    }
  });

  // 정답 좌표 추가
  if (correctCity && correctCity.longitude && correctCity.latitude) {
    allCoords.push([correctCity.longitude, correctCity.latitude]);
  }

  // 좌표가 하나도 없으면 기본 flyTo
  if (allCoords.length === 0) {
    console.warn("⚠️ 표시할 마커가 없습니다. 기본 이동으로 대체합니다.");
    map.flyTo({
      center: koreaCenter,
      zoom: 6,
      duration: 2000
    });
    return;
  }

  // bounds 계산
  const bounds = new mapboxgl.LngLatBounds();
  allCoords.forEach(coord => bounds.extend(coord));

  // fitBounds로 부드럽게 이동
  map.fitBounds(bounds, {
    padding: 80,
    duration: 2000,
    maxZoom: 8,
    curve: 1.42,
  });

  // 한국 전체 범위로 bound 고정
  const koreaBounds = new mapboxgl.LngLatBounds(
    [124.5, 33.0],   // 남서쪽
    [131.0, 38.6]    // 북동쪽
  );

  map.once("moveend", () => {
    map.setMaxBounds(koreaBounds);
  });

  console.log("📍fitBounds 실행됨:", allCoords);
}

function addDashedConnector(map, fromLngLat, toLngLat, color) {
  // 고유 id 발급
  const sourceId = `guess-line-src-${++wrongLineSeq}`;
  const layerId = `guess-line-${wrongLineSeq}`;

  // GeoJSON 소스 추가
  map.addSource(sourceId, {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [fromLngLat.lng, fromLngLat.lat],
          [toLngLat[0], toLngLat[1]],
        ],
      },
    },
  });

  // 점선 라인 레이어 추가
  map.addLayer({
    id: layerId,
    type: 'line',
    source: sourceId,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': color,
      'line-opacity': 0.95,
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        3, 1.5,   // 저배율
        8, 2.0,   // 중간
        12, 2.5   // 고배율
      ],
      'line-dasharray': [2, 2], // 점선 패턴
    },
  });

  return layerId;
}


// =====================================
// 🧠 게임 로직
// =====================================

// 종료 메시지
function endGameMessage(isSuccess) {
  // 입력창과 버튼 숨기기
  document.getElementById("answerInput").style.display = "none";
  const challengeBtn = document.querySelector("button");
  if (challengeBtn) challengeBtn.style.display = "none";

  // 메시지 내용 설정
  const retryMsg = document.createElement("div");
  retryMsg.innerHTML = isSuccess
    ? `<strong>내일 또 도전해보세요!</strong>`
    : `<strong>내일 다시 도전해보세요!</strong>`;

  retryMsg.style.marginTop = "12px";
  retryMsg.style.fontSize = "1.1rem";
  retryMsg.style.color = "black";
  retryMsg.style.fontWeight = "600";
  retryMsg.style.textAlign = "center";

  const inputContainer = document.getElementById("answerInput").parentElement;
  inputContainer.appendChild(retryMsg);
}

// =====================================
// 🔍 AutoComplete 초기화
// =====================================
fetch("data/city.json")
  .then((res) => res.json())
  .then((cities) => {
    citiesData = cities;

    // ✅ 랜덤 도시 하나 뽑기
    const randomCity = cities[Math.floor(Math.random() * cities.length)];
    centerCoords = [randomCity.longitude, randomCity.latitude];
    correctAnswer = randomCity.name;
    console.log("🎯 오늘의 문제:", correctAnswer);

    // ✅ 지도 초기화 (← 이 부분을 새로 추가)
    mapboxgl.accessToken = 'pk.eyJ1IjoibXMtbWFwLTAxIiwiYSI6ImNtZXZmbGl1dzBoeHYybm91ODcwNGdndDIifQ.5wyNe1GvdcwUvcNVCYhqUw';
    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/ms-map-01/cmgv8grh8003p01sm9uth6a7r',
      center: centerCoords,
      zoom: currentZoom,
      maxZoom: 18,
      // 👇 회전/피치 제스처 기본 차단
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.dragRotate.disable();             // 마우스로 지도 회전 막기
    map.touchZoomRotate.disableRotation(); // 모바일 두손가락 회전 막기
    map.touchPitch.disable();             // (선택) 두손가락 상하 기울이기 막기

    // 메인 점(원)
    const mainDotEl = document.createElement('div');
    mainDotEl.className = 'marker-dot';
    mainDotEl.textContent = '?';

    const mainDotMarker = new mapboxgl.Marker({ element: mainDotEl, anchor: 'center', offset: [0, 0] })
      .setLngLat(centerCoords)
      .addTo(map);

    // ✅ z-index (래퍼 DOM에 적용)
    mainDotMarker.getElement().style.zIndex = '1000';

    mainMarkerLngLat = mainDotMarker.getLngLat();

    // 메인 라벨 (초기엔 빈 텍스트)
    mainLabelEl = document.createElement('div');
    mainLabelEl.className = 'marker-label';
    mainLabelEl.textContent = '';

    mainLabelMarker = new mapboxgl.Marker({ element: mainLabelEl, anchor: 'bottom', offset: [0, -12] })
      .setLngLat(centerCoords)
      .addTo(map);

    // ✅ 라벨 더 위
    mainLabelMarker.getElement().style.zIndex = '1001';

    // 최초 로드 후 bounds 제한 설정
    map.on('load', () => {
      map.setProjection('mercator');
      const bounds = map.getBounds();
      map.setMaxBounds(bounds);
    });

    // ✅ AutoComplete 초기화
    const input = document.getElementById("answerInput");
    const cityNames = cities.map(city => city.name);

    const autoCompleteJS = new autoComplete({
      selector: "#answerInput",
      placeHolder: "정답을 입력하세요",
      data: { src: cityNames, cache: true },
      resultsList: { maxResults: 10, noResults: false, tabSelect: true },
      resultItem: { highlight: true },
      events: {
        input: {
          selection: (event) => {
            const value = event.detail.selection.value;
            input.value = value;
            justSelected = true;
          },
          results: () => {
            const firstItem = document.querySelector(".autoComplete_result");
            if (firstItem) {
              firstItem.classList.add("autoComplete_selected");
              firstItem.setAttribute("aria-selected", "true");
            }
          },
        },
      },
    });
  })
  .catch((err) => console.error("도시 데이터 불러오기 실패:", err));




















// ✅ 자동완성과 도전 Enter 구분용 변수
const inputEl = document.getElementById("answerInput");

// ✅ AutoComplete.js 선택 시 플래그 설정
document.addEventListener("selection", (event) => {
  // 자동완성에서 선택되면
  if (event.detail && event.detail.selection) {
    const value = event.detail.selection.value;
    inputEl.value = value; // 입력창에 선택값 채워넣기
    justSelected = true;

    // 짧은 시간 뒤 플래그를 자동으로 해제 (Enter 키 방지용)
    setTimeout(() => {
      justSelected = false;
    }, 150);
  }
});

// ✅ Enter 키로 도전 실행
inputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault(); // 기본 제출 동작 방지 (필수)
    if (!justSelected) {
      checkAnswer(); // 직접 입력 시 실행
    }
  }
});

function checkAnswer() {
  const inputEl = document.getElementById("answerInput");
  const userInput = inputEl.value.trim();
  const resultEl = document.getElementById("result");

  // 🔹 [0] 이미 정답을 맞췄으면 이후 동작하지 않음
  if (isAnsweredCorrectly) {
    return;
  }

  // 🔹 [1] 입력이 공백이면 — 아무 반응 없이 return
  if (userInput === "") {
    return;
  }

  // 🔹 [2] 자동완성 리스트에 없는 입력이면 — 입력칸만 비우고 return
  const match = citiesData.find(city => normalize(city.name) === normalize(userInput));
  if (!match) {
    inputEl.value = ""; // 입력칸 비우기
    return;
  }

  // 🔹 [4] 정답 입력 시
  if (normalize(userInput) === normalize(correctAnswer)) {
    const correctCity = citiesData.find(city => normalize(city.name) === normalize(correctAnswer));
    if (!correctCity) {
      console.warn("정답 도시를 찾지 못했습니다:", correctAnswer);
      return;
    }

    resultEl.innerText = "🎉 정답입니다!";
    isAnsweredCorrectly = true;

    // ✅ 초록색 try-circle 표시
    tries--;
    const currentTry = 6 - tries;
    const circle = document.querySelector(`.try-circle[data-index="${currentTry}"]`);
    if (circle) circle.classList.add("correct");

    // 한국 레벨 지도 축소
    flyToKorea(koreaCenter, koreaZoom);

    // ✅ 정답 마커 추가
    addCorrectMarker(correctCity);

    // ✅ 정답 메시지 출력
    endGameMessage(true);
  }

  // 🔹 [5] 오답 입력 시
  else {
    tries--; // 기회 차감

    const correctCity = citiesData.find(city => normalize(city.name) === normalize(correctAnswer));
    const guessedCity = match; // 오답 도시 객체

    const distance = haversine(
      guessedCity.latitude,
      guessedCity.longitude,
      correctCity.latitude,
      correctCity.longitude
    );

    // 시도 카운트 (1~6)
    const currentTry = 6 - tries;

    // 거리별 색상 분류
    let colorClass;
    if (distance <= 50) colorClass = "near";
    else if (distance <= 100) colorClass = "mid";
    else colorClass = "far";

    // 시도 원 색상 업데이트
    const circle = document.querySelector(`.try-circle[data-index="${currentTry}"]`);
    if (circle) circle.classList.add(colorClass);

    // 결과 문장 업데이트
    let formattedDistance;
    if (distance >= 100) {
      // 1의 자리 반올림 (136.5 → 140)
      formattedDistance = Math.round(distance / 10) * 10;
    } else if (distance >= 10) {
      // 10~99.9 사이: 소수점 제거 (24.2 → 24)
      formattedDistance = Math.floor(distance);
    } else {
      // 10 미만: 소수점 1자리 (9.37 → 9.4)
      formattedDistance = distance.toFixed(1).replace(/\.0$/, '');
    }
    resultEl.innerText = `${attachJosa(guessedCity.tag, "은는")} ${formattedDistance} km 떨어져 있습니다.`;

    // ✅ AutoComplete.js 강제 초기화
    requestAnimationFrame(() => {
      inputEl.value = "";
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      inputEl.blur();
      setTimeout(() => {
        inputEl.value = "";
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        inputEl.focus();
      }, 80);
    });

    // 오답 마커 표시
    const marker = createLabeledMarker(guessedCity, distance);
    wrongMarkers.push(marker);

    // ✅ 마지막 시도(tries == 0)이면 바로 종료 처리
    if (tries === 0) {
      // 한국 레벨 지도 축소
      flyToKorea(koreaCenter, koreaZoom);
      // 정답 마커 추가
      addCorrectMarker(correctCity);

      // 정답 메시지 출력
      endGameMessage(false);

      return; // 함수 즉시 종료
    }

    // 지도 애니메이션 (마지막 시도가 아닐 경우)
    currentZoom = Math.max(currentZoom - 1.2, 3);
    map.setMinZoom(currentZoom);
    map.setMaxBounds(null);

    map.flyTo({
      center: centerCoords,
      zoom: currentZoom,
      duration: 2000,
      curve: 1.42,
      essential: true
    });

    map.once('moveend', () => {
      const newBounds = map.getBounds();
      map.setMaxBounds(newBounds);
    });
  }
}

