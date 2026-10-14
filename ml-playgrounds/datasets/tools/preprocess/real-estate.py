"""real-estate - 원본을 build_dataset.py에 넣을 영어 CSV로 다듬고 레시피를 쓴다.

    python preprocess/real-estate.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  realestate/Real estate valuation data set.xlsx
                     https://archive.ics.uci.edu/static/public/477/real+estate+valuation+data+set.zip 를 realestate/에 푼다

openpyxl이 있어야 한다.

그다음:
  python build_dataset.py recipes/real-estate.json --csv <clean>/real-estate.csv --out <자산 폴더>
"""
from _common import *


# ── Real Estate Valuation (Taiwan) ───────────────────────────────────────
def real_estate():
    import openpyxl
    wb = openpyxl.load_workbook(os.path.join(RAW, "realestate", "Real estate valuation data set.xlsx"), read_only=True)
    rows = list(wb.worksheets[0].iter_rows(values_only=True))
    assert rows[0][0] == "No" and rows[0][-1].startswith("Y"), rows[0]

    def ym(x):  # 2012.917 -> 2012년 11월. 원본은 (월 - 1) / 12 가 아니라 월 / 12 로 적었다.
        y = int(x)
        m = round((x - y) * 12)
        return (y, m) if m else (y - 1, 12)

    out = []
    for r in rows[1:]:
        y, m = ym(r[1])
        out.append([f"{y}-{m:02d}", f"{r[2]:g}", f"{r[3]:.1f}", str(r[4]), f"{r[5]:.5f}", f"{r[6]:.5f}", f"{r[7]:g}"])
    write("real-estate.csv",
          ["transaction month", "house age (years)", "distance to MRT (m)", "convenience stores",
           "latitude", "longitude", "price per ping (10k NTD)"], out)
    recipe({
        "id": "real-estate",
        "csv_name": "real-estate.csv",
        "source_url": "https://archive.ics.uci.edu/dataset/477/real+estate+valuation+data+set",
        "license": "CC BY 4.0",
        "title": {"ko": "대만 집값", "en": "Taiwan Real Estate Valuation"},
        "target": {"ko": "평당 가격 (price per ping, 만 대만달러)", "en": "price per ping (10k NTD)"},
        "headers": [
            H("transaction month", "거래 연월 (transaction month)"),
            H("house age (years)", "집 나이 (house age, 년)"),
            H("distance to MRT (m)", "가장 가까운 지하철역까지 거리 (distance to MRT, m)"),
            H("convenience stores", "걸어갈 수 있는 편의점 수 (convenience stores)"),
            H("latitude", "위도 (latitude)"),
            H("longitude", "경도 (longitude)"),
            H("price per ping (10k NTD)", "평당 가격 (price per ping, 만 대만달러)"),
        ],
        "body": {
            "ko": "대만 신베이시 신뎬구에서 2012~2013년에 거래된 집 414채의 기록입니다. 집 나이, 지하철역까지 거리, 주변 편의점 수로 집값을 예측합니다.\n"
                  "\"역이 가깝고 편의점이 많으면 비싸다, 오래된 집은 싸다\"는 짐작이 맞는지 확인해 보세요.\n\n"
                  "가격 단위는 1평(약 3.3㎡)당 만 대만달러입니다. 예를 들어 37.9는 평당 37만 9천 대만달러입니다.\n"
                  "거래 연월은 하나하나가 다른 값이 아니라 12개월 중 하나이므로 범주로 써도 됩니다. 위도·경도는 지도 위치이므로 군집에 써 볼 만합니다.",
            "en": "414 home sales in Xindian District, New Taipei City, Taiwan, in 2012-2013. Predict price from house age, distance to the nearest MRT station and the number of convenience stores nearby.\n"
                  "Check the hunch that near-the-station, many-shops homes cost more and old homes cost less.\n\n"
                  "Price is in units of 10,000 New Taiwan dollars per ping (about 3.3 m²): 37.9 means 379,000 NTD per ping.\n"
                  "The transaction month takes only twelve values, so it can be treated as a category. Latitude and longitude place each home on the map and are worth trying for clustering.",
        },
        "notes": {
            "ko": ["원본의 일련번호 열(No)을 뺐습니다.",
                   "거래 시점이 2012.917처럼 연도의 소수로 적혀 있어 2012-11 같은 연월로 바꾸었습니다 (소수 부분 × 12 = 월).",
                   "원본 열 이름의 X1~X6, Y 기호를 떼고 단위를 열 이름에 적었습니다.",
                   "원 연구: Yeh I-C, Hsu T-K (2018) Building real estate valuation models with comparative approach through case-based reasoning. Applied Soft Computing 65:260-271."],
            "en": ["Dropped the row-number column (No).",
                   "The transaction date was a decimal year such as 2012.917; it is written as a year-month such as 2012-11 (fraction × 12 = month).",
                   "Removed the X1-X6/Y prefixes from the column names and put units in the names.",
                   "Original study: Yeh I-C, Hsu T-K (2018) Building real estate valuation models with comparative approach through case-based reasoning. Applied Soft Computing 65:260-271."],
        },
    })


if __name__ == "__main__":
    real_estate()
