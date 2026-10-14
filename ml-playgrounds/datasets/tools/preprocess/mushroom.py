"""mushroom - 원본을 build_dataset.py에 넣을 영어 CSV로 다듬고 레시피를 쓴다.

    python preprocess/mushroom.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  mushroom/agaricus-lepiota.data
                     https://archive.ics.uci.edu/static/public/73/mushroom.zip 를 mushroom/에 푼다

그다음:
  python build_dataset.py recipes/mushroom.json --csv <clean>/mushroom.csv --out <자산 폴더>
"""
from _common import *


# ── Mushroom ─────────────────────────────────────────────────────────────
def mushroom():
    _, rows = read(os.path.join(RAW, "mushroom", "agaricus-lepiota.data"), header=False)
    COLOR = {"k": ("black", "검정"), "n": ("brown", "갈색"), "b": ("buff", "담황색"), "h": ("chocolate", "초콜릿색"),
             "g": ("gray", "회색"), "r": ("green", "초록"), "o": ("orange", "주황"), "p": ("pink", "분홍"),
             "u": ("purple", "보라"), "e": ("red", "빨강"), "w": ("white", "흰색"), "y": ("yellow", "노랑"),
             "c": ("cinnamon", "계피색")}
    SURF = {"f": ("fibrous", "섬유질"), "y": ("scaly", "비늘"), "k": ("silky", "비단결"), "s": ("smooth", "매끈함")}


    def pick(d, keys):
        return {k: d[k] for k in keys}


    M = [  # (en column, ko name, {code: (en, ko)})
        ("cap-shape", "갓 모양", {"b": ("bell", "종 모양"), "c": ("conical", "원뿔형"), "x": ("convex", "볼록형"),
                                "f": ("flat", "평평함"), "k": ("knobbed", "혹 있음"), "s": ("sunken", "움푹함")}),
        ("cap-surface", "갓 표면", {"f": ("fibrous", "섬유질"), "g": ("grooves", "홈 있음"), "y": ("scaly", "비늘"), "s": ("smooth", "매끈함")}),
        ("cap-color", "갓 색", pick(COLOR, "nbcgrpuewy")),
        ("bruises", "멍 자국", {"t": ("bruises", "있음"), "f": ("no", "없음")}),
        ("odor", "냄새", {"a": ("almond", "아몬드"), "l": ("anise", "아니스"), "c": ("creosote", "크레오소트"),
                         "y": ("fishy", "비린내"), "f": ("foul", "악취"), "m": ("musty", "곰팡내"), "n": ("none", "없음"),
                         "p": ("pungent", "톡 쏘는 냄새"), "s": ("spicy", "매운 냄새")}),
        ("gill-attachment", "주름살 붙음새", {"a": ("attached", "붙음"), "d": ("descending", "내려붙음"),
                                           "f": ("free", "떨어짐"), "n": ("notched", "홈파진")}),
        ("gill-spacing", "주름살 간격", {"c": ("close", "촘촘함"), "w": ("crowded", "빽빽함"), "d": ("distant", "성김")}),
        ("gill-size", "주름살 폭", {"b": ("broad", "넓음"), "n": ("narrow", "좁음")}),
        ("gill-color", "주름살 색", pick(COLOR, "knbhgropuewy")),
        ("stalk-shape", "자루 모양", {"e": ("enlarging", "아래로 굵어짐"), "t": ("tapering", "아래로 가늘어짐")}),
        ("stalk-root", "자루 뿌리", {"b": ("bulbous", "구근형"), "c": ("club", "곤봉형"), "u": ("cup", "컵형"),
                                   "e": ("equal", "굵기 같음"), "z": ("rhizomorphs", "뿌리꼴균사"), "r": ("rooted", "뿌리형"),
                                   "?": ("", "")}),
        ("stalk-surface-above-ring", "턱받이 위 자루 표면", SURF),
        ("stalk-surface-below-ring", "턱받이 아래 자루 표면", SURF),
        ("stalk-color-above-ring", "턱받이 위 자루 색", pick(COLOR, "nbcgopewy")),
        ("stalk-color-below-ring", "턱받이 아래 자루 색", pick(COLOR, "nbcgopewy")),
        ("veil-type", "내피막 종류", {"p": ("partial", "부분"), "u": ("universal", "전체")}),
        ("veil-color", "내피막 색", pick(COLOR, "nowy")),
        ("ring-number", "턱받이 수", {"n": ("none", "없음"), "o": ("one", "하나"), "t": ("two", "둘")}),
        ("ring-type", "턱받이 모양", {"c": ("cobwebby", "거미줄형"), "e": ("evanescent", "사라짐"), "f": ("flaring", "벌어짐"),
                                     "l": ("large", "큼"), "n": ("none", "없음"), "p": ("pendant", "늘어짐"),
                                     "s": ("sheathing", "칼집형"), "z": ("zone", "띠형")}),
        ("spore-print-color", "포자 색", pick(COLOR, "knbhrouwy")),
        ("population", "자라는 모습", {"a": ("abundant", "아주 많음"), "c": ("clustered", "모여 남"), "n": ("numerous", "많음"),
                                      "s": ("scattered", "흩어짐"), "v": ("several", "여럿"), "y": ("solitary", "홀로")}),
        ("habitat", "서식지", {"g": ("grasses", "풀밭"), "l": ("leaves", "낙엽"), "m": ("meadows", "목초지"),
                              "p": ("paths", "길가"), "u": ("urban", "도시"), "w": ("waste", "황무지"), "d": ("woods", "숲")}),
        ("class", "식용 여부", {"e": ("edible", "식용"), "p": ("poisonous", "독버섯")}),
    ]
    write("mushroom.csv", [c for c, _, _ in M], [r[1:] + r[:1] for r in rows])


    def vm(codes):
        ko = {k: (f"{v[1]} ({v[0]})" if v[0] else "") for k, v in codes.items()}
        en = {k: v[0] for k, v in codes.items()}
        return {"ko": ko, "en": en}


    recipe({
        "id": "mushroom",
        "csv_name": "mushroom.csv",
        "source_url": "https://archive.ics.uci.edu/dataset/73/mushroom",
        "license": "CC BY 4.0",
        "title": {"ko": "독버섯 판별", "en": "Mushroom"},
        "target": {"ko": "식용 여부 (class)", "en": "class"},
        "headers": [H(c, f"{k} ({c})") for c, k, _ in M],
        "values": {c: vm(codes) for c, _, codes in M},
        "body": {
            "ko": "북미 버섯 도감에 실린 주름버섯류 23종을 갓·주름살·자루·냄새 등 스물두 가지 특징으로 적은 8,124개 표본입니다. 먹을 수 있는지, 독버섯인지 맞힙니다.\n"
                  "모든 열이 숫자가 아닌 범주라 결정 트리가 특히 잘 맞습니다. 냄새 하나만으로 얼마나 맞힐 수 있는지 확인해 보세요. 실제 버섯을 이 모델로 판단해서는 안 됩니다.",
            "en": "8,124 samples of 23 gilled-mushroom species from a North American field guide, described by 22 traits of cap, gills, stalk and odour. Predict edible or poisonous.\n"
                  "Every column is categorical, which suits decision trees. Try predicting from odour alone. Never use this model on a real mushroom.",
        },
        "notes": {
            "ko": ["원본에는 헤더가 없고 값이 모두 알파벳 한 글자 코드입니다. 문서(agaricus-lepiota.names)를 따라 열 이름을 붙이고 코드를 낱말로 풀어 적었습니다.",
                   "자루 뿌리(stalk-root)의 결측 표시 ?를 빈칸으로 바꾸었습니다 (2,480행).",
                   "식용 여부를 맨 앞에서 맨 끝 열로 옮겼습니다. 원본에서 '먹을 수 있는지 알 수 없음'은 독버섯으로 분류되어 있습니다.",
                   "내피막 종류(veil-type)는 모든 행이 partial로 같습니다. 원본 그대로 두었습니다."],
            "en": ["The original has no header and every value is a one-letter code. Column names and codes were spelled out following agaricus-lepiota.names.",
                   "The missing-value marker ? in stalk-root was replaced with an empty cell (2,480 rows).",
                   "Moved class from the first column to the last. In the original, 'edibility unknown' was folded into poisonous.",
                   "veil-type is 'partial' in every row; it is kept as in the original."],
        },
    })


if __name__ == "__main__":
    mushroom()
