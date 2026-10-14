"""galton-heights - 원본을 build_dataset.py에 넣을 영어 CSV로 다듬고 레시피를 쓴다.

    python preprocess/galton-heights.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  galton.tsv         https://dataverse.harvard.edu/api/access/datafile/3037856

그다음:
  python build_dataset.py recipes/galton-heights.json --csv <clean>/galton-heights.csv --out <자산 폴더>
"""
from _common import *


# ── Galton ────────────────────────────────────────────────────────────────
def galton_heights():
    h, rows = read(os.path.join(RAW, "galton.tsv"), "\t")
    i = {c: h.index(c) for c in h}
    out = [[cm(r[i["father"]]), cm(r[i["mother"]]), r[i["gender"]], r[i["kids"]], cm(r[i["height"]])]
           for r in rows]
    write("galton-heights.csv", ["father (cm)", "mother (cm)", "gender", "kids", "height (cm)"], out)
    recipe({
        "id": "galton-heights",
        "csv_name": "galton-heights.csv",
        "source_url": "https://doi.org/10.7910/DVN/T0HSJ1",
        "license": "CC0 1.0",
        "title": {"ko": "부모와 자녀의 키 (Galton)", "en": "Galton Family Heights"},
        "target": {"ko": "자녀 키 (height, cm)", "en": "height (cm)"},
        "headers": [
            H("father (cm)", "아버지 키 (father, cm)"),
            H("mother (cm)", "어머니 키 (mother, cm)"),
            H("gender", "자녀 성별 (gender)"),
            H("kids", "가족의 자녀 수 (kids)"),
            H("height (cm)", "자녀 키 (height, cm)"),
        ],
        "values": {"gender": {"ko": {"M": "아들 (M)", "F": "딸 (F)"},
                              "en": {"M": "Son (M)", "F": "Daughter (F)"}}},
        "body": {
            "ko": "1880년대 프랜시스 골턴이 모은 가족 키 기록입니다. 아버지와 어머니의 키로 자녀의 키를 예측합니다.\n"
                  "성별 열로 아들과 딸을 나누어 각각 회귀선을 그려 보면 '평균으로의 회귀'가 어디서 나온 말인지 보입니다.",
            "en": "Francis Galton's family height records from the 1880s. Predict a child's height from the father's and mother's.\n"
                  "Split by gender and fit sons and daughters separately to see where 'regression to the mean' got its name.",
        },
        "notes": {
            "ko": ["키를 인치에서 센티미터로 바꾸었습니다 (소수 첫째 자리).",
                   "가족 번호(family)와, 성별을 0/1로 다시 적은 male·female 열을 뺐습니다."],
            "en": ["Heights were converted from inches to centimetres (one decimal place).",
                   "Dropped the family ID and the male/female columns, which repeat gender as 0/1."],
        },
    })


if __name__ == "__main__":
    galton_heights()
