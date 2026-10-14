"""titanic - 원본을 build_dataset.py에 넣을 영어 CSV로 다듬고 레시피를 쓴다.

    python preprocess/titanic.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  titanic3.csv       https://hbiostat.org/data/repo/titanic3.csv

그다음:
  python build_dataset.py recipes/titanic.json --csv <clean>/titanic.csv --out <자산 폴더>
"""
from _common import *


# ── Titanic (titanic3) ───────────────────────────────────────────────────
def titanic():
    h, rows = read(os.path.join(RAW, "titanic3.csv"))
    i = {c: h.index(c) for c in h}
    keep = ["pclass", "sex", "age", "sibsp", "parch", "fare", "embarked", "survived"]
    write("titanic.csv", keep, [[r[i[c]] for c in keep] for r in rows])
    recipe({
        "id": "titanic",
        "csv_name": "titanic.csv",
        "source_url": "https://hbiostat.org/data/",
        "license": "Free to use with attribution - \"Data obtained from http://hbiostat.org/data courtesy of the Vanderbilt University Department of Biostatistics.\"",
        "title": {"ko": "타이타닉 생존자", "en": "Titanic Survivors"},
        "target": {"ko": "생존 여부 (survived)", "en": "survived"},
        "headers": [
            H("pclass", "객실 등급 (pclass)"),
            H("sex", "성별 (sex)"),
            H("age", "나이 (age)"),
            H("sibsp", "함께 탄 형제·배우자 수 (sibsp)"),
            H("parch", "함께 탄 부모·자녀 수 (parch)"),
            H("fare", "운임 (fare, 파운드)"),
            H("embarked", "탑승 항구 (embarked)"),
            H("survived", "생존 여부 (survived)"),
        ],
        "values": {
            "pclass": {"ko": {"1": "1등석 (1)", "2": "2등석 (2)", "3": "3등석 (3)"},
                       "en": {"1": "1st class (1)", "2": "2nd class (2)", "3": "3rd class (3)"}},
            "sex": {"ko": {"male": "남성 (male)", "female": "여성 (female)"}},
            "embarked": {"ko": {"S": "사우샘프턴 (S)", "C": "셰르부르 (C)", "Q": "퀸스타운 (Q)", "": ""},
                         "en": {"S": "Southampton (S)", "C": "Cherbourg (C)", "Q": "Queenstown (Q)", "": ""}},
            "survived": {"ko": {"0": "사망 (0)", "1": "생존 (1)"},
                         "en": {"0": "Died (0)", "1": "Survived (1)"}},
        },
        "body": {
            "ko": "1912년 타이타닉호 승객 1,309명의 기록입니다. 객실 등급·성별·나이·동승 가족·운임으로 생존 여부를 맞힙니다.\n"
                  "\"여성과 아이 먼저\"가 실제로 지켜졌는지, 객실 등급이 생사를 갈랐는지 모델에게 물어볼 수 있습니다. 나이가 비어 있는 승객이 약 260명 있습니다.",
            "en": "Records of 1,309 passengers on the Titanic in 1912. Predict survival from class, sex, age, family aboard and fare.\n"
                  "Ask the model whether 'women and children first' really held, and whether class decided who lived. About 260 passengers have no recorded age.",
        },
        "notes": {
            "ko": ["구명보트 번호(boat)와 시신 번호(body)를 뺐습니다. 생존 여부를 그대로 알려 주는 열입니다.",
                   "이름, 표 번호, 객실 번호, 목적지는 학습에 쓰기 어려운 글자 열이라 뺐습니다.",
                   "생존 여부를 맨 끝 열로 옮겼습니다.",
                   "원 자료: Thomas Cason (UVa)이 Encyclopedia Titanica를 바탕으로 정리한 titanic3, Frank E. Harrell Jr. 배포."],
            "en": ["Dropped the lifeboat number (boat) and body number (body); both give away whether a passenger survived.",
                   "Dropped name, ticket, cabin and destination - free-text columns that a model cannot use directly.",
                   "Moved survived to the last column.",
                   "Original: titanic3, compiled by Thomas Cason (UVa) from Encyclopedia Titanica and distributed by Frank E. Harrell Jr."],
        },
    })


if __name__ == "__main__":
    titanic()
