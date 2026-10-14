"""music - FMA의 곡별 오디오 특징(Echo Nest)에 장르와 길이를 붙여 크기가 다른 CSV 셋을 만든다.

    python preprocess/music.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것:
  fma/fma_metadata.zip  https://os.unil.cloud.switch.ch/fma/fma_metadata.zip (342MB, 로그인 필요 없음)
                        sha1 f0df49ffe5f2a6008d7dc83c6915b31835dfe733
                        안의 fma_metadata/echonest.csv와 tracks.csv만 쓴다 (zip째 두면 된다)

그다음 (크기가 다른 CSV 셋, csv_name 순서대로):
  python build_dataset.py recipes/music.json --csv <clean>/music-all.csv
      --csv <clean>/music-5k.csv --csv <clean>/music-1k.csv --out <자산 폴더>

pandas가 있어야 한다 (원본 CSV의 헤더가 여러 줄이다).
"""
from _common import *
import io, random, zipfile
import pandas as pd

FEATURES = ["acousticness", "danceability", "energy", "instrumentalness",
            "liveness", "speechiness", "tempo", "valence"]
FEATURES_KO = {"acousticness": "어쿠스틱 정도", "danceability": "춤추기 좋은 정도", "energy": "에너지",
               "instrumentalness": "연주곡 정도", "liveness": "라이브 느낌", "speechiness": "말하는 정도",
               "tempo": "빠르기", "valence": "밝은 분위기"}
GENRES_KO = {"Rock": "록", "Electronic": "일렉트로닉", "Hip-Hop": "힙합", "Folk": "포크",
             "Old-Time / Historic": "옛 음악", "Pop": "팝", "Classical": "클래식", "Jazz": "재즈",
             "International": "월드 뮤직", "Instrumental": "연주곡", "Blues": "블루스",
             "Experimental": "실험 음악", "Soul-RnB": "소울·R&B", "Spoken": "낭독", "Country": "컨트리",
             "Easy Listening": "이지 리스닝"}
SIZES = [None, 5_000, 1_000]      # None은 장르가 있는 곡 전부
SEED = 20261014


def music_file(n):
    return "music-all.csv" if n is None else f"music-{n // 1000}k.csv"


def music():
    with zipfile.ZipFile(os.path.join(RAW, "fma", "fma_metadata.zip")) as z:
        echonest = pd.read_csv(io.BytesIO(z.read("fma_metadata/echonest.csv")), index_col=0, header=[0, 1, 2], low_memory=False)
        tracks = pd.read_csv(io.BytesIO(z.read("fma_metadata/tracks.csv")), index_col=0, header=[0, 1], low_memory=False)
    audio = echonest["echonest", "audio_features"][FEATURES]
    genre = tracks.loc[audio.index, ("track", "genre_top")]
    duration = tracks.loc[audio.index, ("track", "duration")]

    # 장르가 비어 있는 곡은 뺀다 - 군집 결과를 맞춰 볼 답이 없다.
    rows = []
    for tid in audio.index:
        g = genre[tid]
        if pd.isna(g):
            continue
        a = audio.loc[tid]
        rows.append([f"{a[f]:.1f}" if f == "tempo" else f"{a[f]:.3f}" for f in FEATURES]
                    + [str(int(duration[tid])), g])
    n_all = len(rows)
    random.Random(SEED).shuffle(rows)     # 작은 판이 큰 판의 앞부분이 되도록 한 번만 섞는다
    print(f"  music: 오디오 특징 {len(audio):,}곡 중 장르가 있는 {n_all:,}곡")

    header = FEATURES + ["duration (s)", "genre"]
    editions = []
    for n in SIZES:
        part = rows if n is None else rows[:n]
        write(music_file(n), header, part)
        editions.append((music_file(n), part))
        print(f"    {music_file(n)}: {len(part):,}행")

    genres = sorted({r[-1] for r in rows})
    missing = [g for g in genres if g not in GENRES_KO]
    assert not missing, f"번역이 없는 장르: {missing}"

    def size_table(lang):
        head = ["| 파일 | 곡 수 |" if lang == "ko" else "| File | Tracks |", "|---|---|"]
        return "\n".join(head + [f"| `{name}` | {len(part):,} |" for name, part in editions])

    recipe({
        "id": "music",
        "csv_name": [e[0] for e in editions],
        "source_url": "https://github.com/mdeff/fma (Free Music Archive dataset)",
        "license": "CC BY 4.0 (FMA metadata) - Defferrard et al., FMA: A Dataset for Music Analysis, ISMIR 2017",
        "title": {"ko": "음악 분위기", "en": "Music Moods (FMA)"},
        "target": {"ko": "장르 (genre)", "en": "genre"},
        "headers": [H(f, f"{FEATURES_KO[f]} ({f}{', BPM' if f == 'tempo' else ''})") for f in FEATURES]
                   + [H("duration (s)", "길이 (duration, 초)"), H("genre", "장르 (genre)")],
        "values": {"genre": {"ko": {g: f"{GENRES_KO[g]} ({g})" for g in genres}}},
        "body": {
            "ko": "Free Music Archive에 공개된 곡들의 오디오 특징입니다. 곡마다 춤추기 좋은 정도·에너지·밝은 분위기 같은 값이 0~1 사이로 매겨져 있습니다. "
                  "장르 열을 빼고 군집하면 '신나는 곡·잔잔한 곡·말이 많은 곡' 같은 무리가 생기는지 볼 수 있고, 그 무리를 실제 장르와 견주어 볼 수 있습니다. "
                  "장르를 목표로 분류할 수도 있습니다.\n\n"
                  "교실 컴퓨터 사정에 맞춰 고를 수 있도록 크기가 다른 파일 세 개를 넣었습니다. 작은 파일은 큰 파일의 앞부분과 같습니다.\n\n"
                  + size_table("ko") + "\n\n"
                  "## 열의 뜻\n\n"
                  "- 어쿠스틱 정도: 전자 악기 없이 생악기로 연주했을 가능성\n"
                  "- 춤추기 좋은 정도: 박자가 고르고 리듬이 뚜렷한 정도\n"
                  "- 에너지: 빠르고 크고 시끄러운 정도\n"
                  "- 연주곡 정도: 노래(목소리)가 없을 가능성\n"
                  "- 라이브 느낌: 관객 앞에서 녹음했을 가능성\n"
                  "- 말하는 정도: 노래보다 말(랩·낭독)이 많은 정도\n"
                  "- 빠르기: 1분에 몇 박자인지 (BPM)\n"
                  "- 밝은 분위기: 높을수록 즐겁고 밝고, 낮을수록 슬프고 어둡게 들림\n\n"
                  "장르마다 곡 수가 크게 다릅니다(록이 가장 많습니다). 분류할 때 정확도만 보지 마십시오.",
            "en": "Audio features of tracks published on the Free Music Archive. Each track carries values such as danceability, energy and valence on a 0-1 scale. "
                  "Drop the genre and cluster to see whether groups like upbeat, calm or talky tracks appear, then compare them with the real genres. "
                  "You can also classify the genre directly.\n\n"
                  "Three files of different sizes are included, so you can pick one your classroom computers can handle. Each smaller file is the front of the larger one.\n\n"
                  + size_table("en") + "\n\n"
                  "## What the columns mean\n\n"
                  "- acousticness: how likely the track is acoustic rather than electronic\n"
                  "- danceability: how steady the beat and clear the rhythm are\n"
                  "- energy: how fast, loud and noisy it feels\n"
                  "- instrumentalness: how likely the track has no vocals\n"
                  "- liveness: how likely it was recorded in front of an audience\n"
                  "- speechiness: how much spoken word (rap, narration) it contains\n"
                  "- tempo: beats per minute\n"
                  "- valence: high sounds happy and bright, low sounds sad or dark\n\n"
                  "Genres are very unevenly represented (rock dominates), so do not judge a classifier on accuracy alone.",
        },
        "notes": {
            "ko": [f"FMA 메타데이터의 echonest.csv(오디오 특징 {len(audio):,}곡)에 tracks.csv의 대표 장르와 곡 길이를 붙였습니다.",
                   f"대표 장르가 비어 있는 곡은 뺐습니다 ({len(audio) - n_all:,}곡).",
                   "곡 제목·가수·앨범 등 사람과 작품을 가리키는 열은 뺐습니다.",
                   f"고정된 난수 씨앗({SEED})으로 한 번 섞은 뒤 앞에서부터 잘라 작은 판을 만들었습니다.",
                   "오디오 특징은 소수 셋째 자리, 빠르기는 첫째 자리로 줄였습니다."],
            "en": [f"Joined the primary genre and duration from tracks.csv onto echonest.csv (audio features for {len(audio):,} tracks) from the FMA metadata.",
                   f"Dropped tracks with no primary genre ({len(audio) - n_all:,}).",
                   "Dropped columns naming people and works - titles, artists, albums.",
                   f"Shuffled once with a fixed random seed ({SEED}); the smaller files are cut from the front.",
                   "Audio features are rounded to three decimals, tempo to one."],
        },
    })


if __name__ == "__main__":
    music()
