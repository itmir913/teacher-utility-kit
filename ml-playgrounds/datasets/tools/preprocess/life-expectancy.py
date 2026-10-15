"""life-expectancy - 원본을 build_dataset.py에 넣을 영어 CSV로 다듬고 레시피를 쓴다.

    python preprocess/life-expectancy.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (zip을 풀어 파일 이름 그대로):
  Life-Expectancy-Data-Updated.csv
      https://www.kaggle.com/datasets/lashagoch/life-expectancy-who-updated  (CC0)

그다음:
  python build_dataset.py recipes/life-expectancy.json --csv <clean>/life-expectancy.csv --out <자산 폴더>
"""
from _common import *


# ── Life Expectancy (WHO) Fixed ──────────────────────────────────────────
def life_expectancy():
    h, rows = read(os.path.join(RAW, "Life-Expectancy-Data-Updated.csv"))
    i = {c: h.index(c) for c in h}
    # 선진국·개도국 열은 한쪽이 1이면 다른 쪽이 0인 원-핫 한 쌍이다. 둘 다 두면
    # 같은 정보가 두 번 들어가므로 낱말 열 하나로 합친다.
    out = []
    for r in rows:
        dev, ing = r[i["Economy_status_Developed"]], r[i["Economy_status_Developing"]]
        if {dev, ing} != {"0", "1"}:
            sys.exit(f"선진국·개도국 열이 한 쌍이 아니다: {r[:3]} {dev} {ing}")
        status = "Developed" if dev == "1" else "Developing"
        keep = [r[i[c]] for c in h if not c.startswith("Economy_status") and c != "Life_expectancy"]
        out.append(keep + [status, r[i["Life_expectancy"]]])
    order = [c for c in h if not c.startswith("Economy_status") and c != "Life_expectancy"]
    order += ["Economy_status", "Life_expectancy"]
    write("life-expectancy.csv", order, out)

    recipe({
        "id": "life-expectancy",
        "csv_name": "life-expectancy.csv",
        "source_url": "https://www.kaggle.com/datasets/lashagoch/life-expectancy-who-updated",
        "license": "CC0 1.0",
        "title": {"ko": "세계 기대수명", "en": "World Life Expectancy"},
        "target": {"ko": "기대수명 (Life_expectancy, 세)", "en": "Life_expectancy"},
        "headers": [
            H("Country", "국가 (Country)"),
            H("Region", "권역 (Region)"),
            H("Year", "연도 (Year)"),
            H("Infant_deaths", "영아 사망 (Infant_deaths, 출생 1000명당)"),
            H("Under_five_deaths", "5세 미만 사망 (Under_five_deaths, 출생 1000명당)"),
            H("Adult_mortality", "성인 사망률 (Adult_mortality, 15~60세 1000명당)"),
            H("Alcohol_consumption", "음주량 (Alcohol_consumption, 15세 이상 1인당 순알코올 L)"),
            H("Hepatitis_B", "B형 간염 접종률 (Hepatitis_B, %)"),
            H("Measles", "홍역 접종률 (Measles, %)"),
            H("BMI", "평균 체질량지수 (BMI)"),
            H("Polio", "소아마비 접종률 (Polio, %)"),
            H("Diphtheria", "디프테리아 접종률 (Diphtheria, %)"),
            H("Incidents_HIV", "HIV 신규 감염 (Incidents_HIV, 15~49세 1000명당)"),
            H("GDP_per_capita", "1인당 GDP (GDP_per_capita, 미국 달러)"),
            H("Population_mln", "인구 (Population_mln, 백만 명)"),
            H("Thinness_ten_nineteen_years", "10~19세 저체중 비율 (Thinness_ten_nineteen_years, %)"),
            H("Thinness_five_nine_years", "5~9세 저체중 비율 (Thinness_five_nine_years, %)"),
            H("Schooling", "평균 교육 연수 (Schooling, 25세 이상, 년)"),
            H("Economy_status", "경제 수준 (Economy_status)"),
            H("Life_expectancy", "기대수명 (Life_expectancy, 세)"),
        ],
        "values": {
            "Region": {"ko": {
                "Africa": "아프리카 (Africa)",
                "Asia": "아시아 (Asia)",
                "Central America and Caribbean": "중앙아메리카·카리브 (Central America and Caribbean)",
                "European Union": "유럽연합 (European Union)",
                "Middle East": "중동 (Middle East)",
                "North America": "북아메리카 (North America)",
                "Oceania": "오세아니아 (Oceania)",
                "Rest of Europe": "그 밖의 유럽 (Rest of Europe)",
                "South America": "남아메리카 (South America)",
            }},
            "Economy_status": {"ko": {"Developed": "선진국 (Developed)", "Developing": "개발도상국 (Developing)"}},
        },
        "body": {
            "ko": "세계 179개국의 2000~2015년 기록입니다. 사망률·예방접종률·음주량·체질량지수·1인당 GDP·교육 연수로 그 나라 사람이 태어나서 평균 몇 살까지 사는지(기대수명)를 예측합니다.\n"
                  "돈이 많은 나라가 오래 사는지, 학교를 오래 다니는 나라가 오래 사는지 학습 전에 예상해 보고 모델의 특성 중요도와 비교해 보세요.\n\n"
                  "## 학습 전에 생각할 것\n\n"
                  "- 같은 나라가 16년 동안 16번 나옵니다. 행을 무작위로 나누면 같은 나라의 다른 해가 학습과 시험에 함께 들어가, 모델이 나라를 외워서 점수가 실제보다 높게 나옵니다. 시험용으로 몇 나라를 통째로 떼어 두면 공정합니다.\n"
                  "- `국가 (Country)` 열은 이름표이므로 빼고 학습하십시오.\n"
                  "- 영아·5세 미만·성인 사망률은 기대수명을 계산하는 재료에 가깝습니다. 이 열들을 빼고도 얼마나 맞히는지 비교해 보면 재미있습니다.\n"
                  "- `경제 수준 (Economy_status)`을 목표로 하면 분류 문제가 됩니다.",
            "en": "Records for 179 countries, 2000-2015. Predict life expectancy at birth from mortality, vaccination coverage, alcohol, BMI, GDP per capita and years of schooling.\n"
                  "Guess first whether richer countries or better-schooled countries live longer, then compare with the model's feature importance.\n\n"
                  "## Before you train\n\n"
                  "- Each country appears 16 times, once per year. A random row split puts other years of the same country in both training and test, so the model memorises countries and scores higher than it should. Holding out whole countries is fairer.\n"
                  "- `Country` is a label; drop it.\n"
                  "- Infant, under-five and adult mortality are close to the ingredients life expectancy is computed from. Try training without them and compare.\n"
                  "- Use `Economy_status` as the target for a classification task.",
        },
        "notes": {
            "ko": ["원본의 Economy_status_Developed·Economy_status_Developing 두 열(서로 반대인 0/1)을 낱말 열 Economy_status 하나로 합쳤습니다.",
                   "기대수명을 맨 끝 열로 옮겼습니다.",
                   "배포자가 원본 캐글 자료(kumarajarshi/life-expectancy-who)의 틀린 값을 WHO·World Bank·Our World in Data 자료로 다시 채웠습니다. 빈 값은 가까운 3년 평균이나 같은 권역 평균으로 메웠으므로, 일부 값은 실측이 아니라 추정입니다.",
                   "배포자 설명: 결측 열이 다섯 개 이상인 나라(수단, 남수단, 북한 등)는 빠졌습니다."],
            "en": ["Merged the two opposite 0/1 columns Economy_status_Developed and Economy_status_Developing into one word column, Economy_status.",
                   "Moved life expectancy to the last column.",
                   "The publisher rebuilt the original Kaggle set (kumarajarshi/life-expectancy-who) from WHO, World Bank and Our World in Data figures. Gaps were filled with the nearest three-year average or the regional average, so some values are estimates rather than measurements.",
                   "Per the publisher, countries missing more than four columns (Sudan, South Sudan, North Korea and others) were left out."],
        },
    })


if __name__ == "__main__":
    life_expectancy()
