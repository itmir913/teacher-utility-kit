"""preprocess/의 스크립트들이 함께 쓰는 것.

자료마다 스크립트 하나다. 모두 같은 꼴로 부른다:

    python preprocess/<id>.py <raw 폴더> <clean 폴더>

raw 폴더에서 원본을 읽어 clean 폴더에 영어 CSV를 쓰고, 레시피는 ../recipes/<id>.json에
쓴다. 버섯처럼 코드표가 큰 것은 손으로 옮기다 틀리므로 레시피도 스크립트가 쓴다.
"""
import csv, json, os, sys

if len(sys.argv) < 3:
    sys.exit(__doc__)
RAW, CLEAN = sys.argv[1:3]
RECIPES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "recipes")
os.makedirs(CLEAN, exist_ok=True)

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
WEEKDAYS_KO = ["월", "화", "수", "목", "금", "토", "일"]


def read(path, delim=",", header=True):
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.reader(f, delimiter=delim) if any(c.strip() for c in r)]
    return (rows[0], rows[1:]) if header else (None, rows)


def write(name, header, rows):
    with open(os.path.join(CLEAN, name), "w", encoding="utf-8", newline="") as f:
        csv.writer(f, lineterminator="\n").writerows([header] + rows)


def recipe(rec):
    with open(os.path.join(RECIPES, rec["id"] + ".json"), "w", encoding="utf-8", newline="
") as f:
        json.dump(rec, f, ensure_ascii=False, indent=2)
        f.write("\n")


def cm(v):
    return "" if v in ("", "NA") else f"{float(v) * 2.54:.1f}"


def kg(v):
    return "" if v in ("", "NA") else f"{float(v) * 0.45359237:.1f}"


def H(en, ko):
    return {"en": en, "ko": ko}
