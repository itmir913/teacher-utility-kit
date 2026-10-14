"""earthquakes - USGS 지진 목록에서 위치·깊이·규모만 남긴다.

    python preprocess/earthquakes.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것:
  usgs/quakes-2025-m4.5.csv
      https://earthquake.usgs.gov/fdsnws/event/1/query?format=csv&starttime=2025-01-01&endtime=2026-01-01&minmagnitude=4.5&orderby=time-asc
      (USGS 자료는 미국 공공 영역이다. 해가 바뀌면 기간을 고쳐 받고 YEAR를 고친다.)

그다음:
  python build_dataset.py recipes/earthquakes.json --csv <clean>/earthquakes.csv --out <자산 폴더>
"""
from _common import *

YEAR = 2025
MIN_MAG = 4.5


def earthquakes():
    h, rows = read(os.path.join(RAW, "usgs", f"quakes-{YEAR}-m{MIN_MAG}.csv"))
    i = {c: h.index(c) for c in h}
    out, other = [], 0
    for r in rows:
        if r[i["type"]] != "earthquake":       # 산사태 같은 다른 사건이 섞여 있다
            other += 1
            continue
        place = r[i["place"]]
        # "67 km WNW of Rabaul, Papua New Guinea" -> "Papua New Guinea". 쉼표가 없으면 바다·해령 이름 그대로.
        region = place.rsplit(",", 1)[-1].strip()
        out.append([r[i["time"]][5:7].lstrip("0"), r[i["latitude"]], r[i["longitude"]],
                    f"{float(r[i['depth']]):g}", r[i["mag"]], region])
    write("earthquakes.csv", ["month", "latitude", "longitude", "depth (km)", "magnitude", "region"], out)
    print(f"  earthquakes: {len(out):,}건 (지진이 아닌 사건 {other}건 제외)")

    recipe({
        "id": "earthquakes",
        "csv_name": "earthquakes.csv",
        "source_url": "https://earthquake.usgs.gov/earthquakes/search/ (USGS ComCat)",
        "license": "U.S. Public Domain (USGS-authored or produced data)",
        "title": {"ko": f"{YEAR}년 세계 지진", "en": f"World Earthquakes {YEAR}"},
        "target": {"ko": "없음 - 군집용 (규모를 목표로 회귀도 가능)", "en": "none - for clustering (magnitude for regression)"},
        "headers": [
            H("month", "월 (month)"),
            H("latitude", "위도 (latitude)"),
            H("longitude", "경도 (longitude)"),
            H("depth (km)", "진원 깊이 (depth, km)"),
            H("magnitude", "규모 (magnitude)"),
            H("region", "지역 (region)"),
        ],
        "body": {
            "ko": f"{YEAR}년 한 해 동안 전 세계에서 일어난 규모 {MIN_MAG} 이상 지진 {len(out):,}건입니다.\n"
                  "경도를 가로축, 위도를 세로축으로 산점도를 그리면 지도 없이도 세계지도처럼 보이고, 지진이 판의 경계를 따라 줄지어 있는 것이 드러납니다. "
                  "위도·경도(와 깊이)로 군집하면 태평양을 둘러싼 '불의 고리'와 히말라야·지중해 쪽 띠 같은 무리가 갈라지는지 보십시오.\n"
                  "규모를 목표로 회귀할 수도 있지만, 위치와 깊이만으로는 잘 맞지 않습니다. 지진의 크기를 미리 알기 어려운 이유를 이야기해 볼 수 있습니다.\n\n"
                  "## 세계지도와 겹쳐 보기\n\n"
                  "1. 군집 결과 산점도에서 가로축(x)을 경도, 세로축(y)을 위도로 고릅니다.\n"
                  "2. 산점도를 화면에 띄워 둔 채, Snipaste처럼 이미지를 화면 맨 위에 띄울 수 있는 프로그램으로 세계지도 그림을 불러옵니다.\n"
                  "3. 지도를 반투명하게 하고 크기를 맞춰 산점도 위에 겹치면, 각 군집이 어느 바다·대륙에 있는지 바로 보입니다.\n\n"
                  "지도는 경선과 위선이 곧은 격자로 그려진 '정거원통도법(equirectangular)' 세계지도를 쓰십시오. "
                  "다른 도법의 지도는 점과 해안선이 어긋납니다. 지도의 왼쪽 끝은 경도 -180, 오른쪽 끝은 180, 위·아래 끝은 위도 90·-90이므로, "
                  "산점도의 축 범위도 이와 같아야 딱 맞습니다.\n\n"
                  "지역 열은 USGS가 적은 장소 설명에서 마지막 쉼표 뒤(나라·바다 이름)만 남긴 것입니다. 학습에는 쓰지 말고 결과를 확인할 때 보십시오.",
            "en": f"All {len(out):,} earthquakes of magnitude {MIN_MAG} or more worldwide in {YEAR}.\n"
                  "Plot longitude against latitude and a world map appears with no map at all, with quakes lined up along plate boundaries. "
                  "Cluster on latitude and longitude (and depth) and see whether the Pacific 'Ring of Fire' and the Himalaya-Mediterranean belt separate.\n"
                  "You can regress magnitude, but location and depth predict it poorly - a good start for talking about why quake size is hard to foresee.\n\n"
                  "## Overlaying a world map\n\n"
                  "1. In the cluster scatter plot, put longitude on the x axis and latitude on the y axis.\n"
                  "2. With the plot on screen, open a world map image in a tool that pins images on top of the screen, such as Snipaste.\n"
                  "3. Make the map semi-transparent and size it over the plot - each cluster's ocean or continent shows at a glance.\n\n"
                  "Use an equirectangular world map, the kind with straight, evenly spaced meridians and parallels; other projections will not line up with the dots. "
                  "Its left and right edges are longitude -180 and 180 and its top and bottom are latitude 90 and -90, so the plot's axes should span the same range.\n\n"
                  "The region column keeps only the part of USGS's place description after the last comma (a country or sea). Use it to check results, not to train.",
        },
        "notes": {
            "ko": [f"USGS 지진 목록 검색(ComCat)에서 {YEAR}년, 규모 {MIN_MAG} 이상으로 받은 CSV입니다.",
                   f"지진이 아닌 사건(산사태 등) {other}건을 뺐습니다.",
                   "발생 시각에서 월만 남겼습니다.",
                   "측정 오차, 관측소 수, 사건 번호 등 관측 기술 열은 뺐습니다.",
                   "규모는 측정 방식(mb, Mww 등)이 섞여 있으나 원본 값 그대로 두었습니다."],
            "en": [f"CSV from the USGS earthquake catalogue (ComCat) for {YEAR}, magnitude {MIN_MAG} and above.",
                   f"Dropped {other} non-earthquake events (landslides and the like).",
                   "Kept only the month from the event time.",
                   "Dropped measurement-detail columns: errors, station counts, event IDs.",
                   "Magnitudes mix scales (mb, Mww and others) and are kept as published."],
        },
    })


if __name__ == "__main__":
    earthquakes()
