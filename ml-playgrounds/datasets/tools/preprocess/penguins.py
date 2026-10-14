"""penguins - 원본을 build_dataset.py에 넣을 영어 CSV로 다듬고 레시피를 쓴다.

    python preprocess/penguins.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  penguins.csv       https://raw.githubusercontent.com/allisonhorst/palmerpenguins/main/inst/extdata/penguins.csv

그다음:
  python build_dataset.py recipes/penguins.json --csv <clean>/penguins.csv --out <자산 폴더>
"""
from _common import *


# ── Palmer Penguins ──────────────────────────────────────────────────────
def penguins():
    h, rows = read(os.path.join(RAW, "penguins.csv"))
    i = {c: h.index(c) for c in h}
    order = ["island", "bill_length_mm", "bill_depth_mm", "flipper_length_mm", "body_mass_g", "sex", "year", "species"]
    write("penguins.csv", order, [["" if r[i[c]] == "NA" else r[i[c]] for c in order] for r in rows])
    recipe({
        "id": "penguins",
        "csv_name": "penguins.csv",
        "source_url": "https://allisonhorst.github.io/palmerpenguins/",
        "license": "CC0 1.0",
        "title": {"ko": "남극 펭귄", "en": "Palmer Penguins"},
        "target": {"ko": "펭귄 종 (species)", "en": "species"},
        "headers": [
            H("island", "서식 섬 (island)"),
            H("bill_length_mm", "부리 길이 (bill_length_mm)"),
            H("bill_depth_mm", "부리 깊이 (bill_depth_mm)"),
            H("flipper_length_mm", "날개 길이 (flipper_length_mm)"),
            H("body_mass_g", "몸무게 (body_mass_g)"),
            H("sex", "성별 (sex)"),
            H("year", "관측 연도 (year)"),
            H("species", "펭귄 종 (species)"),
        ],
        "values": {
            "island": {"ko": {"Biscoe": "비스코 섬 (Biscoe)", "Dream": "드림 섬 (Dream)", "Torgersen": "토르거센 섬 (Torgersen)"}},
            "sex": {"ko": {"male": "수컷 (male)", "female": "암컷 (female)", "": ""}},
            "species": {"ko": {"Adelie": "아델리 (Adelie)", "Chinstrap": "턱끈 (Chinstrap)", "Gentoo": "젠투 (Gentoo)"}},
        },
        "body": {
            "ko": "남극 파머 기지 근처 세 섬에서 관측한 펭귄 344마리의 기록입니다. 부리·날개 길이와 몸무게로 세 종을 구별합니다.\n"
                  "몸무게를 목표로 하면 회귀, 종 열을 빼면 군집으로도 쓸 수 있습니다. 붓꽃 데이터의 다음 단계로 알맞습니다.",
            "en": "344 penguins observed on three islands near Palmer Station, Antarctica. Tell three species apart by bill, flipper and body mass.\n"
                  "Use body mass as the target for regression, or drop species for clustering - a natural next step after Iris.",
        },
        "notes": {
            "ko": ["원본의 결측 표시 NA를 빈칸으로 바꾸었습니다. 측정값이 모두 빈 2행과 성별만 빈 9행이 있습니다.",
                   "펭귄 종을 맨 끝 열로 옮겼습니다.",
                   "원 자료: Gorman KB, Williams TD, Fraser WR (2014). PLoS ONE 9(3):e90081. Palmer Station Antarctica LTER."],
            "en": ["Replaced the NA marker with empty cells. Two rows have no measurements at all; nine more are missing only sex.",
                   "Moved species to the last column.",
                   "Original: Gorman KB, Williams TD, Fraser WR (2014). PLoS ONE 9(3):e90081. Palmer Station Antarctica LTER."],
        },
    })


if __name__ == "__main__":
    penguins()
