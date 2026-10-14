"""beijing-pm25 - 원본을 build_dataset.py에 넣을 영어 CSV로 다듬고 레시피를 쓴다.

    python preprocess/beijing-pm25.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  pm25/PRSA_data_2010.1.1-2014.12.31.csv
                     https://archive.ics.uci.edu/static/public/381/beijing+pm2+5+data.zip 를 pm25/에 푼다

그다음:
  python build_dataset.py recipes/beijing-pm25.json --csv <clean>/beijing-pm25.csv --out <자산 폴더>
"""
from _common import *


# ── Beijing PM2.5 ────────────────────────────────────────────────────────
PM_LEVELS = [(15, "good"), (35, "moderate"), (75, "bad")]  # 한국 환경부 초미세먼지 예보 등급


def beijing_pm25():
    h, rows = read(os.path.join(RAW, "pm25", "PRSA_data_2010.1.1-2014.12.31.csv"))
    i = {c: h.index(c) for c in h}
    out, dropped = [], 0
    for r in rows:
        pm = r[i["pm2.5"]]
        if pm == "NA":
            dropped += 1
            continue
        v = float(pm)
        level = next((name for top, name in PM_LEVELS if v <= top), "very bad")
        out.append([r[i[c]] for c in ("year", "month", "day", "hour", "TEMP", "DEWP", "PRES", "cbwd", "Iws", "Is", "Ir")]
                   + [pm, level])
    assert dropped == 2067, dropped
    write("beijing-pm25.csv",
          ["year", "month", "day", "hour", "TEMP", "DEWP", "PRES", "cbwd", "Iws", "Is", "Ir", "pm2.5", "pm2.5 level"], out)
    level_ko = {"good": "좋음 (good)", "moderate": "보통 (moderate)", "bad": "나쁨 (bad)", "very bad": "매우 나쁨 (very bad)"}
    recipe({
        "id": "beijing-pm25",
        "csv_name": "beijing-pm25.csv",
        "source_url": "https://archive.ics.uci.edu/dataset/381/beijing+pm2+5+data",
        "license": "CC BY 4.0",
        "title": {"ko": "베이징 초미세먼지", "en": "Beijing PM2.5"},
        "target": {"ko": "초미세먼지 농도 (pm2.5) 또는 등급 (pm2.5 level)", "en": "pm2.5 or pm2.5 level"},
        "headers": [
            H("year", "연 (year)"), H("month", "월 (month)"), H("day", "일 (day)"), H("hour", "시 (hour)"),
            H("TEMP", "기온 (TEMP, °C)"),
            H("DEWP", "이슬점 (DEWP, °C)"),
            H("PRES", "기압 (PRES, hPa)"),
            H("cbwd", "풍향 (cbwd)"),
            H("Iws", "누적 풍속 (Iws, m/s)"),
            H("Is", "눈 누적 시간 (Is, 시간)"),
            H("Ir", "비 누적 시간 (Ir, 시간)"),
            H("pm2.5", "초미세먼지 농도 (pm2.5, μg/m³)"),
            H("pm2.5 level", "초미세먼지 등급 (pm2.5 level)"),
        ],
        "values": {
            "cbwd": {"ko": {"NE": "북동풍 (NE)", "NW": "북서풍 (NW)", "SE": "남동풍 (SE)", "cv": "바람 약하고 바뀜 (cv)"},
                     "en": {"NE": "northeast (NE)", "NW": "northwest (NW)", "SE": "southeast (SE)", "cv": "calm and variable (cv)"}},
            "pm2.5 level": {"ko": level_ko},
        },
        "body": {
            "ko": "2010~2014년 베이징 주재 미국 대사관에서 잰 시간별 초미세먼지(PM2.5) 농도와 베이징 공항의 기상 관측을 묶은 자료입니다. 기온·이슬점·기압·바람·눈비로 초미세먼지를 예측합니다.\n"
                  "겨울에, 밤에, 바람이 잦아들 때 나빠진다는 짐작을 확인해 보세요. 북서풍이 불면 깨끗해지는 것도 보입니다.\n\n"
                  "## 목표 열이 둘입니다 - 하나를 고르고 나머지는 빼십시오\n\n"
                  "- `초미세먼지 농도 (pm2.5, μg/m³)` - 회귀\n"
                  "- `초미세먼지 등급 (pm2.5 level)` - 분류. 한국 환경부 예보 기준으로 15 이하 좋음, 35 이하 보통, 75 이하 나쁨, 그 위는 매우 나쁨입니다.\n\n"
                  "둘 다 넣으면 농도로 등급을 맞히는 셈이라, 모델은 아무것도 배우지 않고 100%에 가까운 점수를 냅니다.\n\n"
                  "## 헷갈리는 열\n\n"
                  "- 누적 풍속: 같은 풍향이 이어진 동안의 풍속을 계속 더한 값입니다. 바람이 오래 같은 방향으로 불수록 커집니다.\n"
                  "- 눈·비 누적 시간: 눈이나 비가 몇 시간째 이어지고 있는지입니다.\n"
                  "- 이슬점: 공기 속 수증기가 많을수록 높습니다. 기온과 가까우면 습한 날입니다.",
            "en": "Hourly PM2.5 measured at the US Embassy in Beijing, 2010-2014, joined with weather observed at Beijing airport. Predict fine dust from temperature, dew point, pressure, wind and snow or rain.\n"
                  "Check the hunch that it gets worse in winter, at night and when the wind dies down - and that a northwest wind clears it.\n\n"
                  "## There are two target columns - pick one and drop the other\n\n"
                  "- `pm2.5` (μg/m³) - regression\n"
                  "- `pm2.5 level` - classification, using the Korean Ministry of Environment forecast bands: up to 15 good, up to 35 moderate, up to 75 bad, above that very bad.\n\n"
                  "Keeping both means predicting the band from the number, and the model scores near 100% having learned nothing.\n\n"
                  "## Columns that need explaining\n\n"
                  "- Iws: cumulated wind speed - the wind speed summed over the hours the same direction has persisted.\n"
                  "- Is, Ir: how many hours snow or rain has been falling so far.\n"
                  "- DEWP: dew point; the closer it is to the temperature, the more humid the air.",
        },
        "notes": {
            "ko": ["초미세먼지 값이 비어 있는(NA) 2,067시간을 뺐습니다. 목표가 없는 행은 학습에 쓸 수 없습니다.",
                   "원본의 일련번호 열(No)을 뺐습니다.",
                   "한국 환경부 초미세먼지 예보 기준으로 등급 열을 새로 만들었습니다.",
                   "목표 열을 맨 끝으로 옮겼습니다.",
                   "원 연구: Liang X. et al. (2015) Assessing Beijing's PM2.5 pollution: severity, weather impact, APEC and winter heating. Proceedings of the Royal Society A 471:20150257."],
            "en": ["Dropped the 2,067 hours with no PM2.5 reading (NA); rows without a target cannot be used for training.",
                   "Dropped the row-number column (No).",
                   "Added a level column using the Korean Ministry of Environment PM2.5 forecast bands.",
                   "Moved the targets to the end.",
                   "Original study: Liang X. et al. (2015) Assessing Beijing's PM2.5 pollution: severity, weather impact, APEC and winter heating. Proceedings of the Royal Society A 471:20150257."],
        },
    })


if __name__ == "__main__":
    beijing_pm25()
