// city.json 불러와서 자동완성 연결
let citiesData = []; // 전역에서 접근 가능하게 저장

// 오답 마커 선언
let wrongMarkers = []; // 오답 마커 리스트 선언

fetch("city.json")
  .then((res) => res.json())
  .then((cities) => {
    citiesData = cities; // 나중에 위치정보 활용 가능
    const input = document.getElementById("answerInput");

    const cityNames = cities.map(city => city.name);

    new Awesomplete(input, {
      list: cityNames,
      minChars: 1,
      maxItems: 10,
      autoFirst: true
    });

    // 선택된 도시명을 콘솔로 확인
    input.addEventListener("awesomplete-selectcomplete", (e) => {
      console.log("선택된 도시:", e.text.value);
    });
  })
  .catch(err => console.error("도시 데이터 불러오기 실패:", err));

// Haversine 함수
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

// 조사 체커
function attachJosa(word, josaPair) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const jong = code % 28;
  const hasBatchim = jong !== 0;
  return word + (hasBatchim ? josaPair[0] : josaPair[1]);
}

// CreateMarker 함수
function createLabeledMarker(cityObj, distanceKm) {
  const el = document.createElement('div');
  el.className = 'custom-marker';

  const color = distanceKm <= 50
    ? '#ffcc00'
    : distanceKm <= 100
    ? '#ff8d28'
    : '#ff383c';
    const currentTry = 7 - tries; // try 횟수 마킹용

  el.innerHTML = `
    <div class="marker-label">${cityObj.tag}</div>
    <div class="marker-dot" style="background-color: ${color};">
      <span class="try-number">${currentTry}</span>
    </div>
  `;

  const marker = new mapboxgl.Marker(el)
    .setLngLat([cityObj.longitude, cityObj.latitude])
    .addTo(map);

  return marker;
}

// ✅ 대한민국 중심 좌표와 줌 레벨 (당신이 직접 입력)
const koreaCenter = [127.76469909658498, 36.35893672161413]; // 남한 국토 중심 충청북도 옥천군 청성면 장연리 (대한민국 국토 중심 국토정중앙천문대 (128.0298, 38.0688))
const koreaZoom = 4.5; // 전국 보이게 줌아웃 레벨 설정

//let currentZoom = 15.5; // 문제 줌 레벨
//let centerCoords = [128.5780871349555, 35.87392573964598]; // 대구 달성공원
//let correctAnswer = "대구광역시 중구"; // 정답 대구 중구

let currentZoom = 14;
let centerCoords = [128.3642078, 36.9801706]; // 단양중학교
let correctAnswer = "충청북도 단양군"; // 정답 충북 단양

// 실패, 성공 시 한국 전체 레벨로 줌 레벨 확대, 지도 bound 함수
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

// 정답 마커 추가 함수
function addCorrectMarker(cityObj) {
  const el = document.createElement('div');
  el.className = 'custom-marker';
  el.innerHTML = `
    <div class="marker-label" style="color:#34c759; font-weight:700; font-size:13px;">
      ${cityObj.tag}
    </div>
    <div class="marker-dot" style="background-color:#34c759; border:2px solid white; width:14px; height:14px; border-radius:50%;"></div>
  `;
  new mapboxgl.Marker(el)
    .setLngLat([cityObj.longitude, cityObj.latitude])
    .addTo(map);
}

// 종료 메시지 함수
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

// 지도 초기 설정
console.log("mapboxgl:", mapboxgl);
mapboxgl.accessToken = 'pk.eyJ1IjoibXMtbWFwLTAxIiwiYSI6ImNtZXZmbGl1dzBoeHYybm91ODcwNGdndDIifQ.5wyNe1GvdcwUvcNVCYhqUw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/ms-map-01/cmgv8grh8003p01sm9uth6a7r',
  //style: 'mapbox://styles/mapbox/satellite-v9',
  //style: 'mapbox://styles/mapbox/satellite-streets-v12',
  center: centerCoords,
  zoom: currentZoom,
  maxZoom: 18,
});

const el = document.createElement('div');
el.className = 'main-marker';
el.innerHTML = `<div class="marker-dot">?</div>`;
new mapboxgl.Marker(el).setLngLat(centerCoords).addTo(map);

let tries = 6;

function normalize(str) {
  return str.toLowerCase().replace(/\s+/g, '').replace(/[^\p{L}\p{N}]/gu, '');
}

// 최초 지도 로드 후 bounds 설정
map.on('load', () => {
  map.setProjection('mercator');
  const bounds = map.getBounds();
  map.setMaxBounds(bounds);
});

// ✅ 자동완성과 도전 Enter 구분용 변수
let justSelected = false;

const inputEl = document.getElementById("answerInput");

// ✅ Awesomplete 선택 시 플래그 설정
inputEl.addEventListener("awesomplete-selectcomplete", () => {
  justSelected = true;
});

// ✅ Enter 키로 도전 실행 (자동완성 선택 직후는 제외)
inputEl.addEventListener("keyup", (event) => {
  if (event.key === "Enter") {
    if (justSelected) {
      // 🔹 자동완성 선택 후 첫 Enter는 checkAnswer 실행 안 함
      justSelected = false; // 플래그 초기화
    } else {
      // 🔹 다음 Enter부터 checkAnswer 실행
      checkAnswer();
    }
  }
});

// 🔸 정답 여부를 추적하는 전역 변수
let isAnsweredCorrectly = false;

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
  const currentTry = 7 - tries;
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

  // 입력칸 비우기
  inputEl.value = "";

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
  currentZoom = Math.max(currentZoom - 1.7, 3);
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
