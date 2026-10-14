"""원본을 그대로 쓸 수 없는 자료를 build_dataset.py에 넣을 영어 CSV로 다듬는다.

    python prepare_sources.py <raw 폴더> <clean 폴더> recipes

단위 변환(인치 -> cm), 정답을 새는 열 빼기, 목표 열을 맨 끝으로 옮기기,
헤더 없는 UCI 원본에 열 이름 붙이기처럼 레시피만으로는 할 수 없는 일을 한다.
레시피 JSON도 여기서 함께 쓴다 - 버섯처럼 코드표가 큰 것은 손으로 옮기다 틀린다.

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  galton.tsv         https://dataverse.harvard.edu/api/access/datafile/3037856
  diabetes.csv       https://hbiostat.org/data/repo/diabetes.csv
  titanic3.csv       https://hbiostat.org/data/repo/titanic3.csv
  penguins.csv       https://raw.githubusercontent.com/allisonhorst/palmerpenguins/main/inst/extdata/penguins.csv
  zoo/zoo.data       https://archive.ics.uci.edu/static/public/111/zoo.zip 를 zoo/에 푼다
  mushroom/agaricus-lepiota.data
                     https://archive.ics.uci.edu/static/public/73/mushroom.zip 를 mushroom/에 푼다

그다음 자료마다:
  python build_dataset.py recipes/<id>.json --csv <clean 폴더>/<id>.csv --out <자산 폴더>
"""
import csv, json, os, sys

RAW, CLEAN, RECIPES = sys.argv[1:4]
os.makedirs(CLEAN, exist_ok=True)


def read(path, delim=",", header=True):
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.reader(f, delimiter=delim) if any(c.strip() for c in r)]
    return (rows[0], rows[1:]) if header else (None, rows)


def write(name, header, rows):
    with open(os.path.join(CLEAN, name), "w", encoding="utf-8", newline="") as f:
        csv.writer(f, lineterminator="\n").writerows([header] + rows)


def recipe(rec):
    with open(os.path.join(RECIPES, rec["id"] + ".json"), "w", encoding="utf-8") as f:
        json.dump(rec, f, ensure_ascii=False, indent=2)
        f.write("\n")


def cm(v):
    return "" if v in ("", "NA") else f"{float(v) * 2.54:.1f}"


def kg(v):
    return "" if v in ("", "NA") else f"{float(v) * 0.45359237:.1f}"


def H(en, ko):
    return {"en": en, "ko": ko}


# ── Galton ────────────────────────────────────────────────────────────────
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

# ── Diabetes (Willems et al., Vanderbilt) ────────────────────────────────
h, rows = read(os.path.join(RAW, "diabetes.csv"))
i = {c: h.index(c) for c in h}
out = []
for r in rows:
    g = r[i["glyhb"]]
    if g == "":
        continue
    out.append([
        r[i["gender"]], r[i["age"]], r[i["location"]],
        cm(r[i["height"]]), kg(r[i["weight"]]), r[i["frame"]],
        cm(r[i["waist"]]), cm(r[i["hip"]]),
        r[i["bp.1s"]], r[i["bp.1d"]],
        r[i["chol"]], r[i["hdl"]], r[i["stab.glu"]],
        "yes" if float(g) >= 7.0 else "no",
    ])
write("diabetes.csv",
      ["gender", "age", "location", "height (cm)", "weight (kg)", "frame",
       "waist (cm)", "hip (cm)", "systolic bp", "diastolic bp",
       "cholesterol", "hdl", "glucose", "diabetes"], out)
recipe({
    "id": "diabetes",
    "csv_name": "diabetes.csv",
    "source_url": "https://hbiostat.org/data/",
    "license": "Free to use with attribution - \"Data obtained from http://hbiostat.org/data courtesy of the Vanderbilt University Department of Biostatistics.\"",
    "title": {"ko": "당뇨 검사", "en": "Diabetes Screening"},
    "target": {"ko": "당뇨 여부 (diabetes)", "en": "diabetes"},
    "headers": [
        H("gender", "성별 (gender)"),
        H("age", "나이 (age)"),
        H("location", "거주 지역 (location)"),
        H("height (cm)", "키 (height, cm)"),
        H("weight (kg)", "몸무게 (weight, kg)"),
        H("frame", "체격 (frame)"),
        H("waist (cm)", "허리둘레 (waist, cm)"),
        H("hip (cm)", "엉덩이둘레 (hip, cm)"),
        H("systolic bp", "수축기 혈압 (systolic bp)"),
        H("diastolic bp", "이완기 혈압 (diastolic bp)"),
        H("cholesterol", "총콜레스테롤 (cholesterol)"),
        H("hdl", "HDL 콜레스테롤 (hdl)"),
        H("glucose", "혈당 (glucose)"),
        H("diabetes", "당뇨 여부 (diabetes)"),
    ],
    "values": {
        "gender": {"ko": {"male": "남성 (male)", "female": "여성 (female)"}},
        "location": {"ko": {"Buckingham": "버킹엄 (Buckingham)", "Louisa": "루이자 (Louisa)"}},
        "frame": {"ko": {"small": "작음 (small)", "medium": "보통 (medium)", "large": "큼 (large)", "": ""}},
        "diabetes": {"ko": {"yes": "당뇨 (yes)", "no": "정상 (no)"}},
    },
    "body": {
        "ko": "미국 버지니아주 두 지역의 성인 약 400명을 검사한 기록입니다. 키·몸무게·허리둘레·혈압·콜레스테롤·혈당으로 당뇨 여부를 맞힙니다.\n"
              "당뇨 여부는 당화혈색소(glyhb) 7.0 이상을 기준으로 정했습니다. 그 수치는 정답을 그대로 알려 주므로 파일에서 뺐습니다.",
        "en": "Screening records of about 400 adults from two counties in Virginia, USA. Predict diabetes from height, weight, waist, blood pressure, cholesterol and glucose.\n"
              "Diabetes is defined as glycosylated haemoglobin (glyhb) of 7.0 or more. That value gives the answer away, so it is not in the file.",
    },
    "notes": {
        "ko": ["당화혈색소(glyhb)로 당뇨 여부 열을 만들고 glyhb 열은 뺐습니다. glyhb가 없는 13행도 뺐습니다.",
               "키·허리둘레·엉덩이둘레는 인치에서 센티미터로, 몸무게는 파운드에서 킬로그램으로 바꾸었습니다.",
               "대부분 비어 있는 두 번째 혈압 측정값, 피험자 번호, 콜레스테롤/HDL 비율(두 열로 계산되는 값), 채혈 시각 열을 뺐습니다.",
               "원 연구: Willems JP et al. (1997) Prevalence of coronary heart disease risk factors among rural blacks. Journal of Community Health 22:365-375."],
        "en": ["Built the diabetes column from glycosylated haemoglobin (glyhb) and dropped glyhb itself, along with the 13 rows where it was missing.",
               "Height, waist and hip were converted from inches to centimetres; weight from pounds to kilograms.",
               "Dropped the mostly empty second blood-pressure reading, the subject ID, the cholesterol/HDL ratio (computable from two other columns) and the time of the blood draw.",
               "Original study: Willems JP et al. (1997) Prevalence of coronary heart disease risk factors among rural blacks. Journal of Community Health 22:365-375."],
    },
})

# ── Titanic (titanic3) ───────────────────────────────────────────────────
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

# ── Palmer Penguins ──────────────────────────────────────────────────────
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

# ── Zoo ──────────────────────────────────────────────────────────────────
_, rows = read(os.path.join(RAW, "zoo", "zoo.data"), header=False)
zh = ["animal_name", "hair", "feathers", "eggs", "milk", "airborne", "aquatic", "predator",
      "toothed", "backbone", "breathes", "venomous", "fins", "legs", "tail", "domestic", "catsize", "type"]
write("zoo.csv", zh, rows)
zko = {"hair": "털", "feathers": "깃털", "eggs": "알을 낳음", "milk": "젖을 먹임", "airborne": "날 수 있음",
       "aquatic": "물에 삶", "predator": "포식자", "toothed": "이빨", "backbone": "척추", "breathes": "공기 호흡",
       "venomous": "독", "fins": "지느러미", "tail": "꼬리", "domestic": "가축·반려동물", "catsize": "고양이보다 큼"}
yn = {"ko": {"0": "아니오 (0)", "1": "예 (1)"}, "en": {"0": "No (0)", "1": "Yes (1)"}}
zhead = [H("animal_name", "동물 이름 (animal_name)")]
for c in zh[1:-1]:
    zhead.append(H(c, "다리 수 (legs)" if c == "legs" else f"{zko[c]} ({c})"))
zhead.append(H("type", "동물 분류 (type)"))
recipe({
    "id": "zoo",
    "csv_name": "zoo.csv",
    "source_url": "https://archive.ics.uci.edu/dataset/111/zoo",
    "license": "CC BY 4.0",
    "title": {"ko": "동물원", "en": "Zoo"},
    "target": {"ko": "동물 분류 (type)", "en": "type"},
    "headers": zhead,
    "values": dict({c: yn for c in zko}, type={
        "ko": {"1": "포유류 (1)", "2": "조류 (2)", "3": "파충류 (3)", "4": "어류 (4)",
               "5": "양서류 (5)", "6": "곤충 (6)", "7": "무척추동물 (7)"},
        "en": {"1": "Mammal (1)", "2": "Bird (2)", "3": "Reptile (3)", "4": "Fish (4)",
               "5": "Amphibian (5)", "6": "Insect (6)", "7": "Invertebrate (7)"}}),
    "body": {
        "ko": "동물 101종을 털·깃털·알·젖·다리 수 같은 특징 열여섯 가지로 적은 표입니다. 포유류·조류·어류 등 일곱 무리로 분류합니다.\n"
              "결정 트리를 그려 보면 '젖을 먹이면 포유류'처럼 생물 시간에 배운 기준이 그대로 나타납니다. 오리너구리나 돌고래가 어디로 가는지 확인해 보세요.",
        "en": "101 animals described by sixteen traits - hair, feathers, eggs, milk, number of legs and so on - sorted into seven groups such as mammals, birds and fish.\n"
              "A decision tree rediscovers biology-class rules like 'gives milk -> mammal'. See where the platypus and the dolphin end up.",
    },
    "notes": {
        "ko": ["원본에는 헤더가 없어 문서(zoo.names)의 순서대로 열 이름을 붙였습니다.",
               "0/1로 적힌 특징은 예/아니오로, 분류 번호 1~7은 무리 이름으로 풀어 적었습니다.",
               "동물 이름 열은 학습에 쓰지 말고 결과를 확인할 때만 보세요. 원본 그대로 frog가 두 번(독이 있는 개구리와 없는 개구리), girl이 포유류로 들어 있습니다."],
        "en": ["The original has no header; column names follow the order in zoo.names.",
               "0/1 traits are spelled out as Yes/No, and the class numbers 1-7 as group names.",
               "Leave animal_name out of training and use it only to check results. As in the original, 'frog' appears twice (venomous and not) and 'girl' is listed as a mammal."],
    },
})

# ── Mushroom ─────────────────────────────────────────────────────────────
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
print("ok")
