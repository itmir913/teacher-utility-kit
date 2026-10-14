"""rock-paper-scissors - 가위바위보 사진을 줄여 샘플판과 원본판 zip 두 개를 만든다.

    python preprocess/rock-paper-scissors.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  rps.zip            https://storage.googleapis.com/learning-datasets/rps.zip
  rps-test.zip       https://storage.googleapis.com/learning-datasets/rps-test-set.zip

이미지 자료라 레시피가 없다. <clean>/rock-paper-scissors-sample.zip과
<clean>/rock-paper-scissors.zip이 바로 올릴 파일이다. Pillow가 있어야 한다.

원본판은 2,892장이라 교실 컴퓨터에서 학습이 오래 걸린다. 샘플판은 범주마다
학습 100장, 테스트 30장만 넣는다.
"""
from _common import *
import io, random, zipfile
from PIL import Image

RPS_SIZE = 150       # 원본 300×300을 절반으로. 손 모양은 그대로 보이고 용량은 1/4 남짓이 된다.
SAMPLE = {"training_set": 100, "test_set": 30}
SEED = 20261014

README = """# {title}

Source: https://laurencemoroney.com/datasets.html
License: CC BY 2.0 — Laurence Moroney (lmoroney@gmail.com / laurencemoroney.com)

Computer-generated (CGI) hands of different ages, skin tones and genders,
posed as rock, paper or scissors on a white background. Split into
training_set and test_set folders; the folder name is the label.
Choose clustering instead and those names are set aside.

## Changed from the original

- Resized from 300×300 PNG to {size}×{size} JPG (quality 85) to keep the download small.
- The training set (rps.zip) became training_set and the test set (rps-test-set.zip) became test_set.
{extra}"""


def rock_paper_scissors():
    """이미지 자료는 build_dataset.py를 거치지 않는다. zip을 바로 만든다."""
    images = {}   # (split, label) -> [(파일 이름, JPG 바이트)]
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
                images.setdefault((split, label), []).append((parts[2][:-4] + ".jpg", buf.getvalue()))

    rng = random.Random(SEED)
    sample = {k: sorted(rng.sample(v, SAMPLE[k[0]])) for k, v in sorted(images.items())}

    for name, title, chosen, extra in (
        ("rock-paper-scissors.zip", "Rock Paper Scissors (full)", images,
         "- All 2,892 images.\n"),
        ("rock-paper-scissors-sample.zip", "Rock Paper Scissors (sample)", sample,
         f"- A sample of {SAMPLE['training_set']} training and {SAMPLE['test_set']} test images per hand shape, "
         f"drawn with a fixed random seed ({SEED}), so a lesson's training run finishes quickly.\n"),
    ):
        path = os.path.join(CLEAN, name)
        with zipfile.ZipFile(path, "w", zipfile.ZIP_STORED) as z:   # JPG는 이미 압축되어 있다
            for (split, label), files in sorted(chosen.items()):
                for fname, data in files:
                    z.writestr(f"{split}/{label}/{fname}", data)
            z.writestr("README.md", README.format(title=title, size=RPS_SIZE, extra=extra).encode("utf-8"))
        total = sum(len(v) for v in chosen.values())
        print(f"  {name}: {total:,}장  {os.path.getsize(path):,} bytes")


if __name__ == "__main__":
    rock_paper_scissors()
