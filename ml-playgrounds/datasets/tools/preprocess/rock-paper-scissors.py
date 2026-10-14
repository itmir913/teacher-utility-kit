"""rock-paper-scissors - 원본을 build_dataset.py에 넣을 영어 CSV로 다듬고 레시피를 쓴다.

    python preprocess/rock-paper-scissors.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  rps.zip            https://storage.googleapis.com/learning-datasets/rps.zip
  rps-test.zip       https://storage.googleapis.com/learning-datasets/rps-test-set.zip

이미지 자료라 레시피가 없다. <clean>/rock-paper-scissors.zip이 바로 올릴 파일이다.
Pillow가 있어야 한다.

"""
from _common import *


# ── 가위바위보 (이미지) ──────────────────────────────────────────────────
RPS_SIZE = 150       # 원본 300×300을 절반으로. 손 모양은 그대로 보이고 용량은 1/4 남짓이 된다.


def rock_paper_scissors():
    """이미지 자료는 build_dataset.py를 거치지 않는다. zip을 바로 만든다 (Pillow 필요)."""
    import io, zipfile
    from PIL import Image
    out_zip = os.path.join(CLEAN, "rock-paper-scissors.zip")
    counts = {}
    with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_STORED) as z:   # JPG는 이미 압축되어 있다
        for src, split in (("rps.zip", "training_set"), ("rps-test.zip", "test_set")):
            with zipfile.ZipFile(os.path.join(RAW, src)) as zin:
                for n in sorted(zin.namelist()):
                    parts = n.split("/")
                    if len(parts) != 3 or not parts[2].lower().endswith(".png"):
                        continue
                    label = parts[1]
                    assert label in ("rock", "paper", "scissors"), n
                    img = Image.open(io.BytesIO(zin.read(n))).convert("RGB").resize((RPS_SIZE, RPS_SIZE), Image.LANCZOS)
                    buf = io.BytesIO()
                    img.save(buf, "JPEG", quality=85)
                    z.writestr(f"{split}/{label}/{parts[2][:-4]}.jpg", buf.getvalue())
                    counts[(split, label)] = counts.get((split, label), 0) + 1
        z.writestr("README.md", f"""# Rock Paper Scissors

Source: https://laurencemoroney.com/datasets.html
License: CC BY 2.0 — Laurence Moroney (lmoroney@gmail.com / laurencemoroney.com)

Computer-generated (CGI) hands of different ages, skin tones and genders,
posed as rock, paper or scissors on a white background. Split into
training_set and test_set folders; the folder name is the label.
Choose clustering instead and those names are set aside.

## Changed from the original

- Resized from 300×300 PNG to {RPS_SIZE}×{RPS_SIZE} JPG (quality 85) to keep the download small.
- The training set (rps.zip) became training_set and the test set (rps-test-set.zip) became test_set.
""".encode("utf-8"))
    for k in sorted(counts):
        print(f"  {k[0]}/{k[1]}: {counts[k]}")
    print(f"  rock-paper-scissors.zip  {os.path.getsize(out_zip):,} bytes")


if __name__ == "__main__":
    rock_paper_scissors()
