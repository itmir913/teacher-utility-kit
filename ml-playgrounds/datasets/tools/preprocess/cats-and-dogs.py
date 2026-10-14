"""cats-and-dogs - 이미 올라가 있는 원본판에서 샘플판을 뽑는다.

    python preprocess/cats-and-dogs.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  cats-and-dogs.zip  https://github.com/itmir913/ml-playgrounds/releases/download/datasets/cats-and-dogs.zip
                     (원 출처: https://www.kaggle.com/datasets/tongpython/cat-and-dog, CC0)

이미지 자료라 레시피가 없다. <clean>/cats-and-dogs-sample.zip이 바로 올릴 파일이다.
원본판은 1,200장이라 학습이 오래 걸린다. 샘플판은 범주마다 학습 100장, 테스트 25장만 넣는다.
"""
from _common import *
import random, zipfile

SAMPLE = {"training_set": 100, "test_set": 25}
SEED = 20261014


def cats_and_dogs():
    with zipfile.ZipFile(os.path.join(RAW, "cats-and-dogs.zip")) as zin:
        groups = {}
        for n in sorted(zin.namelist()):
            parts = n.split("/")
            if len(parts) == 3 and parts[2].lower().endswith(".jpg"):
                groups.setdefault((parts[0], parts[1]), []).append(n)
        rng = random.Random(SEED)
        path = os.path.join(CLEAN, "cats-and-dogs-sample.zip")
        total = 0
        with zipfile.ZipFile(path, "w", zipfile.ZIP_STORED) as z:
            for (split, label), names in sorted(groups.items()):
                for n in sorted(rng.sample(names, SAMPLE[split])):
                    z.writestr(n, zin.read(n))
                    total += 1
            z.writestr("README.md", f"""# Cats and Dogs (sample)

Source: https://www.kaggle.com/datasets/tongpython/cat-and-dog
License: CC0

Cat and dog photographs, split into training_set and test_set folders.
The folder name is the label. Choose clustering instead and those names are
set aside — every image is grouped together with no labels given.

## Changed from the original

- A sample of {SAMPLE['training_set']} training and {SAMPLE['test_set']} test photos per animal
  from the full set (cats-and-dogs.zip), drawn with a fixed random seed ({SEED}),
  so a lesson's training run finishes quickly.
""".encode("utf-8"))
    print(f"  cats-and-dogs-sample.zip: {total:,}장  {os.path.getsize(path):,} bytes")


if __name__ == "__main__":
    cats_and_dogs()
