"""fashion-mnist - 옷 사진 7만 장을 폴더별 JPG로 풀어 샘플판과 원본판 zip 두 개를 만든다.

    python preprocess/fashion-mnist.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로, gzip 그대로):
  fmnist/train-images-idx3-ubyte.gz, fmnist/train-labels-idx1-ubyte.gz,
  fmnist/t10k-images-idx3-ubyte.gz,  fmnist/t10k-labels-idx1-ubyte.gz
                     http://fashion-mnist.s3-website.eu-central-1.amazonaws.com/<파일 이름>

이미지 자료라 레시피가 없다. <clean>/fashion-mnist-sample.zip과
<clean>/fashion-mnist-full.zip이 바로 올릴 파일이다. Pillow가 있어야 한다.

샘플판은 손글씨 숫자 샘플과 같은 크기다 - 범주마다 학습 300장, 테스트 100장.
"""
from _common import *
import gzip, io, random, struct, zipfile
from PIL import Image

# 폴더 이름이 곧 정답이다. 원본의 번호 순서 그대로.
CLASSES = ["t-shirt", "trouser", "pullover", "dress", "coat",
           "sandal", "shirt", "sneaker", "bag", "ankle-boot"]
SAMPLE = {"training_set": 300, "test_set": 100}
SEED = 20261014


def load(images, labels):
    with gzip.open(os.path.join(RAW, "fmnist", images)) as f:
        _, n, rows, cols = struct.unpack(">IIII", f.read(16))
        pixels = f.read()
    with gzip.open(os.path.join(RAW, "fmnist", labels)) as f:
        f.read(8)
        ys = f.read()
    assert len(ys) == n and len(pixels) == n * rows * cols
    size = rows * cols
    return [(i, ys[i], pixels[i * size:(i + 1) * size]) for i in range(n)], (cols, rows)


def jpg(raw, dims):
    buf = io.BytesIO()
    Image.frombytes("L", dims, raw).save(buf, "JPEG", quality=90)
    return buf.getvalue()


README = """# {title}

Source: https://github.com/zalandoresearch/fashion-mnist
License: MIT — Copyright (c) 2017 Zalando SE

28×28 grayscale photos of clothing in ten categories, a drop-in replacement for
handwritten digits that is harder to get right. Split into training_set and
test_set folders; the folder name is the label. Choose clustering instead and
those names are set aside.

Categories: {classes}

## Changed from the original

- The original IDX binary files were unpacked into one JPG (quality 90) per image.
- Folder names are the English category names from the dataset documentation.
{extra}"""


def fashion_mnist():
    splits = {"training_set": load("train-images-idx3-ubyte.gz", "train-labels-idx1-ubyte.gz"),
              "test_set": load("t10k-images-idx3-ubyte.gz", "t10k-labels-idx1-ubyte.gz")}
    rng = random.Random(SEED)
    picks = {}
    for split, (items, _) in splits.items():
        for c in range(len(CLASSES)):
            pool = [it for it in items if it[1] == c]
            picks[(split, c)] = sorted(rng.sample(pool, SAMPLE[split]))

    for name, title, chosen, extra in (
        ("fashion-mnist-full.zip", "Fashion-MNIST (full)",
         {k: [it for it in splits[k[0]][0] if it[1] == k[1]] for k in picks},
         "- All 70,000 images: 60,000 training and 10,000 test.\n"),
        ("fashion-mnist-sample.zip", "Fashion-MNIST (sample)", picks,
         f"- A sample of {SAMPLE['training_set']} training and {SAMPLE['test_set']} test images per category "
         f"(4,000 in all), drawn with a fixed random seed ({SEED}).\n"),
    ):
        path = os.path.join(CLEAN, name)
        with zipfile.ZipFile(path, "w", zipfile.ZIP_STORED) as z:   # JPG는 이미 압축되어 있다
            for (split, c), items in sorted(chosen.items()):
                dims = splits[split][1]
                for i, _, raw in items:
                    z.writestr(f"{split}/{CLASSES[c]}/{i:05d}.jpg", jpg(raw, dims))
            z.writestr("README.md", README.format(title=title, classes=", ".join(CLASSES), extra=extra).encode("utf-8"))
        total = sum(len(v) for v in chosen.values())
        print(f"  {name}: {total:,}장  {os.path.getsize(path):,} bytes")


if __name__ == "__main__":
    fashion_mnist()
