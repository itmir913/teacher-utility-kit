"""원본 CSV 한 개에서 .ko.zip / .en.zip 한 쌍을 만든다.

    python build_dataset.py recipes/iris.json --csv ~/Downloads/iris.csv --out ../../../dist

무엇을 어떻게 번역할지는 사람이 정한다(레시피 파일). 이 스크립트는 그 판단을
받아 기계적인 일만 한다 - 헤더 교체, 값 치환, BOM, 줄바꿈, zip, README.

규칙은 tools/README.md에 적혀 있다.
"""

import argparse, csv, io, json, os, sys, zipfile


def read_rows(path, encoding):
    with open(path, "r", encoding=encoding, newline="") as f:
        rows = list(csv.reader(f))
    # 파일 끝의 빈 줄이 빈 행으로 들어온다. 그대로 두면 앱에서 결측값만 있는
    # 행이 되므로 턴다. 가운데의 빈 행은 자료의 일부일 수 있어 남긴다.
    while rows and not any(c.strip() for c in rows[-1]):
        rows.pop()
    return rows


def apply_values(rows, header_en, value_maps, lang):
    """뜻이 통하지 않는 값을 풀어 적는다. 숫자 코드는 두 언어 모두에서 푼다."""
    if not value_maps:
        return rows
    idx = {col: header_en.index(col) for col in value_maps if col in header_en}
    missing = set(value_maps) - set(idx)
    if missing:
        sys.exit(f"레시피의 values에 없는 열이 있다: {sorted(missing)}")

    out = []
    for r in rows:
        r = list(r)
        for col, i in idx.items():
            table = value_maps[col].get(lang)
            if table:
                if r[i] not in table:
                    sys.exit(f"'{col}' 열의 값 '{r[i]}'가 {lang} 사전에 없다")
                r[i] = table[r[i]]
        out.append(r)
    return out


def readme(rec, lang):
    ko = lang == "ko"
    lines = [f"# {rec['title'][lang]}", ""]
    lines.append(f"{'출처' if ko else 'Source'}: {rec['source_url']}")
    lines.append(f"{'라이선스' if ko else 'License'}: {rec['license']}")
    if rec.get("target"):
        lines += ["", f"{'목표 열' if ko else 'Target column'}: `{rec['target'][lang]}`"]
    if rec.get("body", {}).get(lang):
        lines += ["", rec["body"][lang]]
    notes = rec.get("notes", {}).get(lang) or []
    if notes:
        lines += ["", "## " + ("원본에서 손댄 것" if ko else "Changed from the original"), ""]
        lines += [f"- {n}" for n in notes]
    return "\n".join(lines) + "\n"


def write_zip(path, csv_name, header, rows, readme_text, bom):
    buf = io.StringIO(newline="")
    csv.writer(buf, lineterminator="\r\n").writerows([header] + rows)
    data = ("﻿" if bom else "") + buf.getvalue()
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.writestr(csv_name, data.encode("utf-8"))
        z.writestr("README.md", readme_text.encode("utf-8"))
    return os.path.getsize(path)


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("recipe", help="레시피 JSON")
    p.add_argument("--csv", required=True, help="원본 CSV")
    p.add_argument("--out", default=".", help="zip을 내놓을 폴더")
    p.add_argument("--encoding", default="utf-8-sig",
                   help="원본 인코딩 (서울 자전거처럼 CP949인 것이 있다)")
    p.add_argument("--has-header", dest="has_header", action="store_true", default=True)
    p.add_argument("--no-header", dest="has_header", action="store_false",
                   help="원본에 헤더가 없을 때 (UCI의 *.data가 흔히 그렇다)")
    a = p.parse_args()

    rec = json.loads(open(a.recipe, encoding="utf-8").read())
    header_en = [h["en"] for h in rec["headers"]]
    header_ko = [h["ko"] for h in rec["headers"]]

    rows = read_rows(a.csv, a.encoding)
    if a.has_header:
        rows = rows[1:]

    bad = [i for i, r in enumerate(rows) if len(r) != len(header_en)]
    if bad:
        sys.exit(f"열 수가 레시피({len(header_en)})와 다른 행이 {len(bad)}개 있다 "
                 f"(첫 행 번호 {bad[0] + 1})")

    os.makedirs(a.out, exist_ok=True)
    vm = rec.get("values")
    for lang, header, bom in (("ko", header_ko, True), ("en", header_en, False)):
        body = apply_values(rows, header_en, vm, lang)
        path = os.path.join(a.out, f"{rec['id']}.{lang}.zip")
        size = write_zip(path, rec["csv_name"], header, body, readme(rec, lang), bom)
        print(f"  {os.path.basename(path):<30}{size:>10,} bytes")

    print(f"  행 {len(rows)}  열 {len(header_en)}")


if __name__ == "__main__":
    main()
