"""zoo - 원본을 build_dataset.py에 넣을 영어 CSV로 다듬고 레시피를 쓴다.

    python preprocess/zoo.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  zoo/zoo.data       https://archive.ics.uci.edu/static/public/111/zoo.zip 를 zoo/에 푼다

그다음:
  python build_dataset.py recipes/zoo.json --csv <clean>/zoo.csv --out <자산 폴더>
"""
from _common import *


# ── Zoo ──────────────────────────────────────────────────────────────────
def zoo():
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


if __name__ == "__main__":
    zoo()
