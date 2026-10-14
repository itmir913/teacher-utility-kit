"""power-demand - 원본을 build_dataset.py에 넣을 영어 CSV로 다듬고 레시피를 쓴다.

    python preprocess/power-demand.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  kpx.csv            https://www.data.go.kr/data/15065266/fileData.do 에서 받은 CSV (CP949)

기온은 이 스크립트가 Open-Meteo에서 직접 받는다 (인터넷 필요).
해가 바뀌면 DEMAND_YEAR와 DEMAND_HOLIDAYS를 고친다.

그다음:
  python build_dataset.py recipes/power-demand.json --csv <clean>/power-demand.csv --out <자산 폴더>
"""
from _common import *


# ── 전국 전력수요 + 기온 ─────────────────────────────────────────────────
# 전력거래소 자료에는 기온이 없다. 다섯 대도시의 시간별 기온을 Open-Meteo에서 받아
# 평균을 낸 뒤 같은 시각에 붙인다. 한 도시만 쓰면 그 도시 날씨만 반영된다.
DEMAND_YEAR = 2025
DEMAND_CITIES = [("서울", 37.5665, 126.9780), ("부산", 35.1796, 129.0756), ("대구", 35.8714, 128.6014),
                 ("광주", 35.1595, 126.8526), ("대전", 36.3504, 127.3845)]
# 2025년 대한민국 공휴일 (대체공휴일·임시공휴일 포함). 해가 바뀌면 고친다.
DEMAND_HOLIDAYS = {
    "2025-01-01", "2025-01-27", "2025-01-28", "2025-01-29", "2025-01-30",
    "2025-03-01", "2025-03-03", "2025-05-05", "2025-05-06", "2025-06-03", "2025-06-06",
    "2025-08-15", "2025-10-03", "2025-10-05", "2025-10-06", "2025-10-07", "2025-10-08",
    "2025-10-09", "2025-12-25",
}


def power_demand():
    import datetime as dt, urllib.parse, urllib.request, time
    with open(os.path.join(RAW, "kpx.csv"), encoding="cp949", newline="") as f:
        kpx = [r for r in csv.reader(f) if any(c.strip() for c in r)]   # 원본 끝에 쉼표만 있는 줄이 있다
    assert kpx[0][0] == "날짜" and len(kpx[0]) == 25, kpx[0]

    # 시각마다 다섯 도시 기온의 평균. 1시~24시를 덮으려면 다음 해 1월 1일 0시까지 필요하다.
    temps = {}
    for name, lat, lon in DEMAND_CITIES:
        q = urllib.parse.urlencode({"latitude": lat, "longitude": lon, "hourly": "temperature_2m",
                                    "start_date": f"{DEMAND_YEAR}-01-01", "end_date": f"{DEMAND_YEAR + 1}-01-01",
                                    "timezone": "Asia/Seoul"})
        with urllib.request.urlopen("https://archive-api.open-meteo.com/v1/archive?" + q, timeout=120) as r:
            hourly = json.load(r)["hourly"]
        for t, v in zip(hourly["time"], hourly["temperature_2m"]):
            temps.setdefault(t, []).append(v)
        time.sleep(1)

    out = []
    for r in kpx[1:]:
        d = dt.date.fromisoformat(r[0])
        for hour in range(1, 25):
            # '1시'는 0시~1시 사이의 수요다. 그 구간이 끝나는 시각(1시, 24시는 다음 날 0시)의 기온을 붙인다.
            stamp = (dt.datetime.combine(d, dt.time()) + dt.timedelta(hours=hour)).strftime("%Y-%m-%dT%H:%M")
            vals = temps[stamp]
            assert len(vals) == len(DEMAND_CITIES) and None not in vals, stamp
            out.append([r[0], str(d.month), WEEKDAYS[d.weekday()],
                        "yes" if r[0] in DEMAND_HOLIDAYS else "no",
                        str(hour), f"{sum(vals) / len(vals):.1f}", r[hour].replace(",", "").strip()])
    assert len(out) == 365 * 24, len(out)
    write("power-demand.csv", ["date", "month", "weekday", "holiday", "hour", "temperature (C)", "demand (MWh)"], out)

    city_list_ko = "·".join(n for n, _, _ in DEMAND_CITIES)
    recipe({
        "id": "power-demand",
        "csv_name": "power-demand.csv",
        "source_url": {"ko": "https://www.data.go.kr/data/15065266/fileData.do (전력수요, 한국전력거래소) + https://open-meteo.com/ (기온)",
                       "en": "https://www.data.go.kr/data/15065266/fileData.do (demand, Korea Power Exchange) + https://open-meteo.com/ (temperature)"},
        "license": {"ko": "전력수요: 공공데이터포털 이용허락범위 제한 없음. 기온: CC BY 4.0 (Open-Meteo)",
                    "en": "Demand: no usage restrictions per data.go.kr. Temperature: CC BY 4.0 (Open-Meteo)"},
        "title": {"ko": "전국 전력수요", "en": "Korea Hourly Power Demand"},
        "target": {"ko": "전력수요 (demand, MWh)", "en": "demand (MWh)"},
        "headers": [
            H("date", "날짜 (date)"),
            H("month", "월 (month)"),
            H("weekday", "요일 (weekday)"),
            H("holiday", "공휴일 (holiday)"),
            H("hour", "시각 (hour)"),
            H("temperature (C)", "기온 (temperature, °C)"),
            H("demand (MWh)", "전력수요 (demand, MWh)"),
        ],
        "values": {
            "weekday": {"ko": {e: f"{k} ({e})" for e, k in zip(WEEKDAYS, WEEKDAYS_KO)}},
            "holiday": {"ko": {"yes": "공휴일 (yes)", "no": "평일·주말 (no)"}},
        },
        "body": {
            "ko": f"{DEMAND_YEAR}년 한 해 동안 한 시간마다 전국(육지와 제주)에서 쓴 전력량과 그 시각의 기온입니다. 시각·요일·공휴일·기온으로 전력수요를 예측합니다.\n"
                  "낮에 많고 새벽에 적다, 주말과 공휴일에는 줄어든다, 한여름과 한겨울에는 냉난방 때문에 늘어난다 - 학습 전에 짐작해 보고 모델과 비교해 보세요.\n"
                  "기온과 전력수요로 산점도를 그리면 봄·가을에 낮고 양쪽으로 올라가는 U자가 보입니다. 직선 하나로는 잘 맞지 않는 이유를 생각해 볼 수 있습니다.\n\n"
                  "`날짜 (date)`는 하루에 24행씩 같은 값이므로 학습에서 빼고, 학습·테스트를 시간 순서로 나눌 때 쓰십시오.\n\n"
                  "## 이렇게 만들었습니다 - 두 자료를 합쳤습니다\n\n"
                  f"1. **전력수요**: 한국전력거래소가 공공데이터포털에 올린 \"시간별 전국 전력수요량\" {DEMAND_YEAR}년 파일입니다. 원본은 하루가 한 행이고 1시~24시가 열로 늘어선 표(365행 × 25열)라서, 하루 24행씩 세로로 펼쳤습니다. 원본 설명에 따르면 발전단 기준이며 수요예측용 잠정자료입니다.\n"
                  f"2. **기온**: 전력거래소 자료에는 기온이 없습니다. Open-Meteo 과거 기상 API에서 {city_list_ko} 다섯 도시의 시간별 기온(지상 2m)을 받아 같은 시각끼리 평균을 냈습니다. 한 도시만 쓰면 그 도시의 날씨만 반영되기 때문입니다.\n"
                  "3. **시각 맞추기**: 원본의 '1시'는 0시부터 1시까지 쓴 양입니다. 그 구간이 끝나는 시각의 기온을 붙였습니다. '24시'에는 다음 날 0시의 기온이 붙습니다.\n"
                  "4. **달력 열**: 날짜에서 월과 요일을 계산했고, 공휴일은 대체공휴일과 임시공휴일(1월 27일, 6월 3일 대통령 선거일)을 포함해 직접 표시했습니다.\n\n"
                  "스크립트: https://github.com/itmir913/teacher-utility-kit/blob/master/ml-playgrounds/datasets/tools/preprocess/power-demand.py",
            "en": f"How much electricity all of Korea (mainland and Jeju) used each hour through {DEMAND_YEAR}, with the temperature at that hour. Predict demand from hour, weekday, holiday and temperature.\n"
                  "High in the day and low before dawn, lower at weekends and on holidays, higher in deep summer and deep winter for cooling and heating - guess first, then compare with the model.\n"
                  "Plot temperature against demand and a U shape appears, lowest in spring and autumn - a good reason to ask why one straight line does not fit.\n\n"
                  "Leave `date` out of training (it repeats across 24 rows a day) and use it to split train and test in time order.\n\n"
                  "## How this was built - two sources joined\n\n"
                  f"1. **Demand**: the {DEMAND_YEAR} file of Korea Power Exchange's \"Hourly national electricity demand\" on data.go.kr. The original is one row per day with hours 1-24 across 25 columns (365 rows); it was unfolded into 24 rows per day. Per the publisher, the figures are at the generation end and are provisional, for demand forecasting.\n"
                  "2. **Temperature**: the demand file has none. Hourly 2 m temperature for five cities - Seoul, Busan, Daegu, Gwangju and Daejeon - was taken from the Open-Meteo historical weather API and averaged hour by hour, so the figure is not just one city's weather.\n"
                  "3. **Aligning hours**: the original '1' is the energy used from 00:00 to 01:00; it gets the temperature at the end of that interval. Hour 24 gets the next day's 00:00 temperature.\n"
                  "4. **Calendar columns**: month and weekday come from the date. Holidays were marked by hand, including substitute holidays and the one-off holidays of 27 January and 3 June (presidential election).\n\n"
                  "Script: https://github.com/itmir913/teacher-utility-kit/blob/master/ml-playgrounds/datasets/tools/preprocess/power-demand.py",
        },
        "notes": {
            "ko": ["원본 열 이름(날짜, 1시~24시)은 한국어였습니다. 세로로 펼치면서 영어 열 이름을 새로 붙였습니다.",
                   "원본은 365일이고 결측은 없었습니다. 파일 끝의 쉼표만 있는 줄은 뺐습니다."],
            "en": ["The original column names (date, hours 1-24) were in Korean; English names were given when the table was unfolded.",
                   "The original covers 365 days with no missing values; a trailing line of bare commas was dropped."],
        },
    })


if __name__ == "__main__":
    power_demand()
