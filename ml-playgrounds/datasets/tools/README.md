# 데이터셋 자산 도구

이 폴더의 스크립트는 **릴리스에 올릴 zip을 만들고 검사한다.** 페이지 자체는
`../index.html` 하나로 끝나므로, 여기 있는 것은 자료를 다루는 쪽이다.

파이썬 3만 있으면 된다. 외부 패키지를 쓰지 않는다.

```
build_dataset.py          원본 CSV 한 개 → .ko.zip / .en.zip 한 쌍
audit_assets.py           자산 폴더 전수 검사
check_page.py             페이지가 가리키는 파일 ↔ 폴더 대조, 용량 확인
refresh_rain_tomorrow.py  날씨 자료를 Open-Meteo에서 다시 받아 만든다
recipes/                  자료마다의 번역 사전 (사람이 쓴다)
```

---

## 지켜야 할 규칙

새 자료를 더할 때 이 다섯 가지가 흔들리면 목록 전체가 어긋난다.

**하나. 파일 이름은 `<id>.ko.zip` / `<id>.en.zip`.** 로케일은 확장자 앞에
**점**으로 붙인다. 이름 안의 붙임표(`dry-bean`)와 섞이지 않아, 어디까지가
이름이고 어디부터가 언어인지 파일명만 보고 갈린다. 열 이름이 없는 이미지
자료는 접미사 없이 `<id>.zip` 하나다.

**둘. `id`는 내용으로 짓는다.** `iris`, `seoul-bike`, `rain-tomorrow`. 출처로
짓지 않는다 — `open-meteo`라고 하면 같은 곳에서 자료를 하나 더 만들 때 이름이
이미 쓰였고, 내려받은 사람의 폴더에서 무엇이 들었는지 알 수 없다.

**셋. 원본 열 이름은 영어, 다른 언어는 그 앞에 번역을 병기한다.**
`면적 (Area)` 꼴이다. 괄호 안이 원본이므로 어느 언어의 판이든 열이 서로
대응된다. 언어가 늘어도 이 규칙은 그대로다.

**넷. 뜻이 통하지 않는 값만 풀어 적는다.** `unacc` → `부적합 (unacc)`.
**숫자 코드는 두 언어 모두에서 푼다** — `1`은 어느 언어에서도 뜻이 없으므로
영어 판만 코드로 두면 영어로 읽는 사람만 아무것도 얻지 못한다.
`married`나 `high`처럼 이미 낱말인 값은 영어 판에서 건드리지 않는다.

**다섯. 값 자체는 고치지 않는다.** 표기를 풀어 적는 것과 값을 바꾸는 것은
다르다. 붓꽃의 `Iris-setosa`나 차 이름 같은 고유명사는 그대로 둔다.

`.ko` 판에는 BOM을 붙이고(엑셀에서 바로 열린다) `.en` 판에는 붙이지 않는다.
zip 하나에 CSV와 `README.md`가 들어가고, README에는 출처·라이선스·목표 열과
원본에서 손댄 것이 적힌다. 이 모두를 `build_dataset.py`가 처리한다.

---

## 새 자료를 더하는 절차

### 1. 원본을 받아 CSV로 만든다

배포처에서 받는다. UCI의 `*.data`는 헤더가 없는 경우가 많고, 열 이름은 함께
오는 `*.names` 문서에 적혀 있다. **열 이름을 붙였으면 반드시 검산한다** —
범주 분포를 세어 문서의 표와 맞는지 보면 열이 밀렸는지 알 수 있다.

인코딩도 확인한다. 서울 자전거 원본은 CP949였고, 그대로 두면 브라우저에서
열 이름이 깨져 나온다.

### 2. 레시피를 쓴다

`recipes/iris.json`을 본으로 삼는다. 번역은 사람이 정한다 — 스크립트는
그 판단을 받아 기계적인 일만 한다.

```json
{
  "id": "iris",
  "csv_name": "iris.csv",
  "source_url": "https://archive.ics.uci.edu/dataset/53/iris",
  "license": "CC BY 4.0",
  "title":  { "ko": "붓꽃 데이터", "en": "Iris" },
  "target": { "ko": "붓꽃 품종 (class)", "en": "class" },
  "headers": [
    { "en": "sepal length (cm)", "ko": "꽃받침 길이 (sepal length, cm)" }
  ],
  "values": {
    "class": {
      "ko": { "unacc": "부적합 (unacc)" },
      "en": { "unacc": "Unacceptable (unacc)" }
    }
  },
  "body":  { "ko": "…", "en": "…" },
  "notes": { "ko": ["원본에서 손댄 것"], "en": ["…"] }
}
```

`headers`는 원본의 열 **순서대로** 적는다. `values`는 없으면 생략한다.
어떤 값이 사전에 없으면 스크립트가 멈춘다 — 조용히 넘어가지 않는다.

### 3. zip을 만든다

```bash
python build_dataset.py recipes/iris.json \
    --csv ~/Downloads/iris.csv \
    --out ~/Desktop/ml-release-assets
```

원본에 헤더가 없으면 `--no-header`, 인코딩이 다르면 `--encoding cp949`.

### 4. 페이지에 항목을 더한다

`../index.html`의 `DATASETS` 배열에 항목 하나를 넣는다. 카드도 필터 칩도
개수도 따라온다. `assets`는 `{ ko, en }`이고, 이미지처럼 언어를 타지 않는
자료는 문자열 하나다.

### 5. 검사한다

```bash
python audit_assets.py ~/Desktop/ml-release-assets
python check_page.py   ~/Desktop/ml-release-assets
```

`audit_assets.py`는 값이 몇 가지뿐인 열을 전부 꺼내 보여 준다. **거기 숫자
코드가 남아 있으면 실습이 막힌다** — 학생이 "지역 3번은 어디예요"라고 물을 때
답할 수 없다. 다만 숫자로 보인다고 다 코드는 아니다. 실린더 개수나 조명
전력량은 진짜 수치이므로 사람이 보고 판단한다.

배포처가 코드의 뜻을 밝히지 않은 경우도 있다(온라인 쇼핑의 익명화된 네 열).
지어낼 수는 없으니 그대로 두되, 카드와 zip README에 그 사실을 적는다.

`check_page.py`는 페이지가 요구하는 파일이 폴더에 다 있는지, 카드에 적힌
용량이 실제와 맞는지 본다. **이 둘이 통과해야 올린다.**

### 6. 올리고 배포한다

`itmir913/ml-playgrounds` 저장소의 **`datasets` 태그 릴리스**에 zip을 올린다.
태그는 고정이므로 내려받기 주소가 유지된다.

```
https://github.com/itmir913/ml-playgrounds/releases/download/datasets/<파일명>
```

**릴리스를 먼저, 페이지 배포를 나중에.** 반대로 하면 그 사이에 내려받기
단추가 404를 낸다. 페이지 배포는 이 저장소 Actions 탭의
`Deploy to GitHub Pages`를 손으로 실행한다.

---

## 라이선스를 반드시 확인한다

**"Other"나 미표기는 쓸 수 없다는 뜻으로 읽는다.** 실제로 두 번 걸렀다.

- 캐글의 얼굴 표정 자료는 라이선스가 "Other(설명 참조)"인데 설명에 아무 조건도
  없었다. 게다가 웹에서 긁어모은 스톡 사진이라 초상권도 걸렸다.
- 호주 강수 자료는 캐글 표기가 "Other"였고, 원 저작권자인 기상청 고지의
  기본값이 **"다른 사람에게 제공하지 말 것"** 이었다. CC BY는 그렇게 명시된
  페이지에만 적용된다.

검색 요약을 믿지 말고 배포처의 고지를 직접 연다. 재배포가 허용되지 않으면
그 자료는 넣지 않는다 — 여기 있는 파일은 전부 다시 배포되는 것이다.

---

## 날씨 자료 갱신

`rain-tomorrow`는 해가 지나면 자료가 쌓인다.

```bash
python refresh_rain_tomorrow.py ~/Desktop/ml-release-assets
```

기간과 도시는 스크립트 상단 상수(`START`, `END`, `CITIES`)에서 고친다.
기간을 늘렸다면 페이지의 `stats.rows`와 `size`도 함께 고쳐야 하는데,
`check_page.py`가 용량 불일치를 잡아 준다.

이 자료는 기성품을 옮긴 것이 아니라 API에서 받아 조립한 것이다. **오늘의 값
옆에 내일의 강수량을 붙인다** — 같은 날의 강수량으로 같은 날 비를 맞히는 것은
예측이 아니다.
