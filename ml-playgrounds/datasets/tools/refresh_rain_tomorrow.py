"""rain-tomorrow 자산을 Open-Meteo에서 다시 받아 만든다.

    python refresh_rain_tomorrow.py ~/Desktop/ml-release-assets

기간(START, END)이나 도시(CITIES)를 바꾸려면 아래 상수를 고친다.
Open-Meteo 과거 자료 API는 열쇠가 필요 없고, 자료는 CC BY 4.0이다.

기간을 늘렸다면 페이지의 stats.rows와 size도 함께 고쳐야 한다 -
check_page.py가 용량 불일치를 잡아 준다.
"""

import csv, io, json, os, sys, time, urllib.parse, urllib.request, zipfile

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
START, END = "2015-01-01", "2024-12-31"
RAIN_MM = 1.0          # 이 이상이면 '비 옴'. 호주 자료가 쓰는 기준과 같다.

CITIES = [
    ("seoul",    "서울",   "Seoul",    37.5665, 126.9780, "Asia/Seoul"),
    ("tokyo",    "도쿄",   "Tokyo",    35.6895, 139.6917, "Asia/Tokyo"),
    ("new_york", "뉴욕",   "New York", 40.7128, -74.0060, "America/New_York"),
]

DAILY = ["temperature_2m_mean", "temperature_2m_max", "temperature_2m_min",
         "relative_humidity_2m_mean", "cloud_cover_mean", "surface_pressure_mean",
         "wind_speed_10m_max", "precipitation_sum"]

HEADER_EN = ["date", "temp_mean_c", "temp_max_c", "temp_min_c", "humidity_mean_pct",
             "cloud_cover_mean_pct", "pressure_mean_hpa", "wind_speed_max_kmh",
             "precipitation_mm", "precipitation_next_day_mm", "rain_next_day"]
HEADER_KO = ["날짜 (date)", "평균기온 (temp_mean_c)", "최고기온 (temp_max_c)",
             "최저기온 (temp_min_c)", "평균 상대습도 (humidity_mean_pct)",
             "평균 운량 (cloud_cover_mean_pct)", "평균 기압 (pressure_mean_hpa)",
             "최대 풍속 (wind_speed_max_kmh)", "강수량 (precipitation_mm)",
             "내일 강수량 (precipitation_next_day_mm)", "내일 비 여부 (rain_next_day)"]
RAIN_KO = {"yes": "비 옴 (yes)", "no": "비 안 옴 (no)"}


def fetch(lat, lon, tz):
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon, "start_date": START, "end_date": END,
        "daily": ",".join(DAILY), "timezone": tz})
    url = "https://archive-api.open-meteo.com/v1/archive?" + q
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.load(r)["daily"]


def build(d):
    """오늘 한 줄 + 내일의 강수량. 마지막 날은 내일이 없으니 뺀다."""
    n = len(d["time"])
    rows, dropped = [], 0
    for i in range(n - 1):
        nxt = d["precipitation_sum"][i + 1]
        if nxt is None:          # 목표를 모르는 날은 쓸 수 없다
            dropped += 1
            continue
        cells = [d["time"][i]] + [
            "" if d[k][i] is None else d[k][i] for k in DAILY]
        cells.append(nxt)
        cells.append("yes" if nxt >= RAIN_MM else "no")
        rows.append([str(c) for c in cells])
    return rows, dropped


def readme(lang):
    lines = []
    for _, ko, en, lat, lon, tz in CITIES:
        name = ko if lang == "ko" else en
        lines.append(f"| `{_}.csv` | {name} | {lat}, {lon} | {tz} |")
    table = "\n".join(lines)

    if lang == "ko":
        return f"""# 내일 비 올까 — 세 도시

출처: https://open-meteo.com/  (Open-Meteo)
라이선스: CC BY 4.0

오늘의 기온·습도·운량·기압·풍속으로 **내일**의 강수를 예측합니다.
{START}부터 {END}까지의 일별 자료입니다.

| 파일 | 도시 | 좌표 | 시간대 |
|---|---|---|---|
{table}

## 목표 열이 둘입니다 — 하나를 고르고 나머지는 빼십시오

- `내일 강수량 (precipitation_next_day_mm)` — 회귀
- `내일 비 여부 (rain_next_day)` — 분류. 내일 강수량이 {RAIN_MM}mm 이상이면 `비 옴`입니다.

**둘 다 넣으면 답을 보고 답을 맞히는 셈이 됩니다.** 분류를 할 때 강수량 열을
그대로 두면 정확도가 100%에 가깝게 나오는데, 그 모델은 아무것도 배우지
않았습니다.

`날짜 (date)`도 학습에서 빼십시오. 하루에 한 줄뿐이라 모든 값이 다릅니다.
학습·테스트를 시간 순서로 나눌 때에는 쓸모가 있습니다.

## 이렇게 만들었습니다

Open-Meteo 과거 기상 API에서 도시별로 위 기간의 일별 값을 받아, 오늘의 관측
값 옆에 **다음 날의 강수량**을 붙였습니다. 그래야 예보가 됩니다 — 같은 날의
강수량으로 같은 날 비를 맞히는 것은 예측이 아닙니다.

마지막 날은 다음 날이 없어 뺐습니다. 값이 비어 있는 자리는 빈 칸입니다.

도시가 셋인 이유는, 한 도시로 학습한 모델이 다른 도시에서도 통하는지
시험해 볼 수 있기 때문입니다.
"""
    return f"""# Will it rain tomorrow — three cities

Source: https://open-meteo.com/  (Open-Meteo)
License: CC BY 4.0

Predict **tomorrow's** rain from today's temperature, humidity, cloud cover,
pressure, and wind. Daily records from {START} to {END}.

| File | City | Coordinates | Time zone |
|---|---|---|---|
{table}

## There are two target columns — pick one and drop the other

- `precipitation_next_day_mm` — regression
- `rain_next_day` — classification, `yes` when tomorrow's total reaches {RAIN_MM}mm

**Keeping both is reading the answer off the answer sheet.** Classify with the
millimetre column still in place and accuracy runs near 100%, on a model that
has learned nothing.

Drop `date` from training too — there is one row per day, so every value is
unique. It is useful for splitting train and test in chronological order.

## How this was built

Daily values for each city were taken from the Open-Meteo historical weather
API for the period above, and each day's observations were paired with **the
next day's** precipitation. That is what makes it a forecast: predicting the
same day's rain from the same day's rainfall is not prediction.

The final day is dropped, having no following day. Empty cells are blanks.

Three cities are included so that a model trained on one can be tried on
another.
"""


def write(zip_name, header, per_city, bom, lang):
    path = os.path.join(OUT, zip_name)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for slug, rows in per_city:
            buf = io.StringIO(newline="")
            csv.writer(buf, lineterminator="\r\n").writerows([header] + rows)
            data = ("\ufeff" if bom else "") + buf.getvalue()
            z.writestr(f"{slug}.csv", data.encode("utf-8"))
        z.writestr("README.md", readme(lang).encode("utf-8"))
    return os.path.getsize(path)


en_all, ko_all = [], []
for slug, ko, en, lat, lon, tz in CITIES:
    d = fetch(lat, lon, tz)
    rows, dropped = build(d)
    wet = sum(1 for r in rows if r[-1] == "yes")
    print(f"  {en:<9} {len(rows):>5}행  비 온 날 {wet:>4} ({wet/len(rows)*100:.1f}%)"
          f"  목표 없어 뺀 날 {dropped}")
    en_all.append((slug, rows))
    ko_all.append((slug, [r[:-1] + [RAIN_KO[r[-1]]] for r in rows]))
    time.sleep(1)

print("open-meteo.ko.zip ", f"{write('open-meteo.ko.zip', HEADER_KO, ko_all, True, 'ko'):,}")
print("open-meteo.en.zip ", f"{write('open-meteo.en.zip', HEADER_EN, en_all, False, 'en'):,}")
