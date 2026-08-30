"""자산 폴더를 전수 검사한다.

    python audit_assets.py ~/Desktop/ml-release-assets

찾아 주는 것:
  · ko/en 두 판의 행·열 수가 어긋난 곳
  · 값이 몇 가지뿐인 열 — 거기 뜻 없는 코드(0/1/2)가 남아 있으면 실습이 막힌다
  · 결측값이 있는 열
  · README 언어가 잘못 든 zip (.en에 한글, .ko에 한글 없음)

코드는 사람이 보고 판단한다. 숫자로 보인다고 다 코드가 아니다 -
실린더 개수나 조명 전력량은 진짜 수치다.
"""

import csv, io, os, re, sys, zipfile

MAX_DISTINCT = 25      # 이보다 많으면 연속형으로 보고 넘어간다
SAMPLE = 10
HANGUL = re.compile(r"[가-힣]")
LATIN = re.compile(r"[A-Za-z]{4,}")


def read_csvs(path):
    """zip 안의 CSV를 모두 돌려준다. 한 zip에 여러 개인 것도 있다."""
    out = []
    with zipfile.ZipFile(path) as z:
        for n in z.namelist():
            if n.lower().endswith(".csv"):
                text = z.read(n).decode("utf-8-sig")
                rows = list(csv.reader(io.StringIO(text, newline="")))
                out.append((n, rows[0], rows[1:]))
    return out


def readme_text(path):
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist()
                 if os.path.basename(n).lower().startswith("readme")]
        if not names:
            return None
        return z.read(names[0]).decode("utf-8", "replace")


def numeric(v):
    try:
        float(v)
        return True
    except ValueError:
        return False


def main(folder):
    zips = sorted(f for f in os.listdir(folder) if f.endswith(".zip"))
    problems = []

    # ── README 언어 ──────────────────────────────────────────────────────
    print("── README 언어")
    for z in zips:
        body = readme_text(os.path.join(folder, z))
        if body is None:
            problems.append(f"{z}: README 없음")
            continue
        prose = "\n".join(l for l in body.splitlines() if "http" not in l)
        han, lat = bool(HANGUL.search(prose)), bool(LATIN.search(prose))
        if z.endswith(".ko.zip"):
            if not han:
                problems.append(f"{z}: 한국어 판인데 한글이 없다")
        else:                      # .en.zip 과 언어 접미사 없는 공통 자산
            if han:
                problems.append(f"{z}: 영어여야 하는데 한글이 있다")
            if not lat:
                problems.append(f"{z}: 영문 설명이 없다")
    print(f"   검사 {len(zips)}개")

    # ── 두 판의 크기와 값 ────────────────────────────────────────────────
    bases = sorted({f[: -len(".ko.zip")] for f in zips if f.endswith(".ko.zip")})
    for base in bases:
        ko = read_csvs(os.path.join(folder, base + ".ko.zip"))
        en = read_csvs(os.path.join(folder, base + ".en.zip"))
        print(f"\n── {base}")
        if len(ko) != len(en):
            problems.append(f"{base}: 두 판의 CSV 개수가 다르다")
            continue

        for (nk, hk, rk), (ne, he, re_) in zip(ko, en):
            tag = f"  {nk}" if len(ko) > 1 else ""
            if tag:
                print(tag)
            if len(rk) != len(re_) or len(hk) != len(he):
                problems.append(f"{base}/{nk}: 행·열 수가 두 판에서 다르다")
                continue

            differing = {i for a, b in zip(rk, re_)
                         for i in range(len(hk)) if a[i] != b[i]}

            for i, name in enumerate(hk):
                blanks = sum(1 for r in rk if not r[i].strip())
                if blanks:
                    print(f"     결측값 {blanks:>6}개  [{i}] {name}")

            for i, name in enumerate(hk):
                vals = {r[i] for r in rk}
                if len(vals) > MAX_DISTINCT:
                    continue
                code = all(numeric(v) for v in vals if v.strip()) and len(vals) <= 12
                mark = " [두 판 다름]" if i in differing else ""
                warn = "  ⚠ 숫자 코드인지 확인" if code else ""
                print(f"     [{i}] {name}{mark}{warn}")
                print(f"         {sorted(vals)[:SAMPLE]}")

    print("\n" + "=" * 60)
    if problems:
        print("문제:")
        for p in problems:
            print("  ·", p)
        return 1
    print("문제 없음")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1]))
