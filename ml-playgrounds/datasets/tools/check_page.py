"""페이지가 가리키는 파일과 자산 폴더를 대조한다.

    python check_page.py ~/Desktop/ml-release-assets

릴리스에 올리기 전에 돌린다. 페이지가 요구하는데 폴더에 없는 파일이 있으면
그 카드의 내려받기 단추가 404가 된다.

카드에 적힌 용량이 실제 파일과 맞는지도 함께 본다. 자산을 다시 포장하면
크기가 달라지는데 카드는 옛 값을 들고 있기 쉽다.
"""

import os, re, sys

PAGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "index.html")


def human(n):
    mb = n / 1024 ** 2
    if mb >= 0.95:
        return f"{mb:.1f} MB" if mb < 10 else f"{round(mb)} MB"
    kb = n / 1024
    return f"{kb:.1f} KB" if kb < 10 else f"{round(kb)} KB"


def main(folder):
    page = open(PAGE, encoding="utf-8").read()
    i, j = page.index("const DATASETS = ["), page.index("\n    ];")
    block = page[i:j]

    wanted = set(re.findall(r"'([a-z0-9-]+\.(?:ko|en)\.zip|[a-z0-9-]+\.zip)'", block))
    have = {f for f in os.listdir(folder) if f.endswith(".zip")}
    bad = 0

    missing = sorted(wanted - have)
    extra = sorted(have - wanted)
    print(f"페이지 {len(wanted)}개 / 폴더 {len(have)}개")
    if missing:
        bad = 1
        print("\n페이지가 요구하는데 폴더에 없다 — 올리면 404가 난다:")
        for f in missing:
            print("  ·", f)
    if extra:
        print("\n폴더에만 있다 (해롭지는 않다):")
        for f in extra:
            print("  ·", f)

    print("\n── 카드에 적힌 용량")
    for m in re.finditer(r"\{\s*\n\s+id: '([a-z0-9-]+)',(.*?)\n        \}", block, re.S):
        ds, body = m.group(1), m.group(2)
        files = re.findall(r"'([a-z0-9-]+\.(?:ko|en)\.zip|[a-z0-9-]+\.zip)'", body)
        paths = [os.path.join(folder, f) for f in files if os.path.exists(os.path.join(folder, f))]
        if not paths:
            continue
        # 두 판의 크기가 다르면 큰 쪽을 적는다 - 받는 사람이 겪는 최대치다
        actual = human(max(os.path.getsize(p) for p in paths))
        stated = (re.search(r"size: '([^']*)'", body) or [None, None])[1]
        if stated != actual:
            bad = 1
            print(f"  {ds:<22}{str(stated):>10}  →  {actual}")
    if not bad:
        print("  전부 일치")

    print("\n" + "=" * 50)
    print("문제 없음" if not bad else "위 항목을 고친 뒤 올리십시오")
    return bad


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1]))
