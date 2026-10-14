"""credit-card-fraud - 원본을 build_dataset.py에 넣을 영어 CSV로 다듬고 레시피를 쓴다.

    python preprocess/credit-card-fraud.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  fraud/fraudTrain.csv, fraud/fraudTest.csv
                     https://www.kaggle.com/datasets/kartik2112/fraud-detection (로그인 필요, 약 500MB)

결과 CSV가 셋이므로 build_dataset.py에 --csv를 csv_name 순서대로 세 번 준다:
  python build_dataset.py recipes/credit-card-fraud.json
      --csv <clean>/credit-card-fraud-100k.csv --csv <clean>/credit-card-fraud-48k.csv
      --csv <clean>/credit-card-fraud-10k.csv --out <자산 폴더>

"""
from _common import *


# ── 신용카드 이상거래 (Sparkov 합성 자료) ──────────────────────────────────
FRAUD_RATIO = 4      # 사기 1건에 정상 몇 건을 붙일지 (사기가 모자라는 큰 파일은 예외). 원본의 사기 비율은 약 0.5%다.
FRAUD_SEED = 20261014
FRAUD_SIZES = [100_000, 48_000, 10_000]   # 교실 컴퓨터 사정에 맞춰 고르도록 세 크기를 함께 넣는다
FRAUD_ALL = 48_000   # 이 판은 행 수를 딱 맞추지 않고 사기를 전부 넣는다 (사기 × (1 + FRAUD_RATIO)행)


def fraud_file(n):
    return f"credit-card-fraud-{n // 1000}k.csv"

FRAUD_CATEGORIES = {
    "entertainment": "오락", "food_dining": "외식", "gas_transport": "주유·교통",
    "grocery_net": "식료품 (온라인)", "grocery_pos": "식료품 (매장)", "health_fitness": "건강·운동",
    "home": "생활용품", "kids_pets": "아동·반려동물", "misc_net": "기타 (온라인)", "misc_pos": "기타 (매장)",
    "personal_care": "미용·위생", "shopping_net": "쇼핑 (온라인)", "shopping_pos": "쇼핑 (매장)", "travel": "여행",
}


def credit_card_fraud():
    import datetime as dt, math, random
    frauds, normals, total = [], [], 0
    for name in ("fraudTrain.csv", "fraudTest.csv"):   # 둘은 기간만 다르다. 사기를 하나라도 더 남기려고 합친다.
        with open(os.path.join(RAW, "fraud", name), encoding="utf-8", newline="") as f:
            rd = csv.DictReader(f)
            for r in rd:
                total += 1
                (frauds if r["is_fraud"] == "1" else normals).append(r)
    # 크기별로 세 파일을 만든다. 작은 파일이 큰 파일의 부분집합이 되도록 한 번 섞은
    # 목록의 앞에서부터 자른다 - 크기만 다를 뿐 같은 자료다.
    rng = random.Random(FRAUD_SEED)
    rng.shuffle(frauds)
    rng.shuffle(normals)
    n_f = len(frauds)
    sizes = {}
    for rows_total in FRAUD_SIZES:
        if rows_total == FRAUD_ALL:
            sizes[rows_total] = (n_f, n_f * FRAUD_RATIO)
            continue
        nf = min(n_f, rows_total // (FRAUD_RATIO + 1))
        sizes[rows_total] = (nf, rows_total - nf)

    def km(a1, o1, a2, o2):
        a1, o1, a2, o2 = map(math.radians, (a1, o1, a2, o2))
        h = math.sin((a2 - a1) / 2) ** 2 + math.cos(a1) * math.cos(a2) * math.sin((o2 - o1) / 2) ** 2
        return 6371.0 * 2 * math.asin(math.sqrt(h))

    def row(r):
        t = dt.datetime.fromisoformat(r["trans_date_trans_time"])
        b = dt.date.fromisoformat(r["dob"])
        age = t.year - b.year - ((t.month, t.day) < (b.month, b.day))
        return [str(t.hour), WEEKDAYS[t.weekday()], r["category"], r["amt"], r["gender"], str(age),
                r["city_pop"],
                f"{km(float(r['lat']), float(r['long']), float(r['merch_lat']), float(r['merch_long'])):.1f}",
                r["is_fraud"]]

    header = ["hour", "weekday", "category", "amount (USD)", "gender", "age", "city population", "distance (km)", "is_fraud"]
    print(f"  credit-card-fraud: 원본 {total:,}행, 사기 {n_f:,}건 ({n_f / total * 100:.2f}%)")
    for rows_total, (nf, nn) in sizes.items():
        picked = frauds[:nf] + normals[:nn]
        random.Random(FRAUD_SEED + rows_total).shuffle(picked)
        write(fraud_file(rows_total), header, [row(r) for r in picked])
        print(f"    {fraud_file(rows_total)}: 사기 {nf:,} + 정상 {nn:,} = {nf + nn:,}행 ({nf / (nf + nn) * 100:.1f}%)")

    def size_table(lang):
        head = "| 파일 | 행 | 사기 | 정상 | 사기 비율 |" if lang == "ko" else "| File | Rows | Fraud | Normal | Fraud rate |"
        lines = [head, "|---|---|---|---|---|"]
        for rows_total, (nf, nn) in sizes.items():
            lines.append(f"| `{fraud_file(rows_total)}` | {nf + nn:,} | {nf:,} | {nn:,} | {nf / (nf + nn) * 100:.0f}% |")
        return "\n".join(lines)

    recipe({
        "id": "credit-card-fraud",
        "csv_name": [fraud_file(n) for n in FRAUD_SIZES],
        "source_url": "https://www.kaggle.com/datasets/kartik2112/fraud-detection",
        "license": "CC0: Public Domain (자료), MIT (생성 프로그램 https://github.com/namebrandon/Sparkov_Data_Generation)",
        "title": {"ko": "신용카드 이상거래", "en": "Credit Card Fraud"},
        "target": {"ko": "사기 여부 (is_fraud)", "en": "is_fraud"},
        "headers": [
            H("hour", "거래 시각 (hour)"),
            H("weekday", "요일 (weekday)"),
            H("category", "업종 (category)"),
            H("amount (USD)", "금액 (amount, 달러)"),
            H("gender", "카드 주인 성별 (gender)"),
            H("age", "카드 주인 나이 (age)"),
            H("city population", "사는 도시 인구 (city population)"),
            H("distance (km)", "집과 가게 사이 거리 (distance, km)"),
            H("is_fraud", "사기 여부 (is_fraud)"),
        ],
        "values": {
            "weekday": {"ko": {e: f"{k} ({e})" for e, k in zip(WEEKDAYS, WEEKDAYS_KO)}},
            "category": {"ko": {e: f"{k} ({e})" for e, k in FRAUD_CATEGORIES.items()}},
            "gender": {"ko": {"F": "여성 (F)", "M": "남성 (M)"}, "en": {"F": "Female (F)", "M": "Male (M)"}},
            "is_fraud": {"ko": {"0": "정상 (0)", "1": "사기 (1)"}, "en": {"0": "Normal (0)", "1": "Fraud (1)"}},
        },
        "body": {
            "ko": "미국의 카드 거래를 흉내 내어 만든 **합성 자료**입니다. 실제 사람의 거래가 아닙니다. 거래 시각·업종·금액·카드 주인의 나이 등으로 사기 거래를 가려냅니다.\n"
                  "늦은 밤에, 큰 금액이, 온라인 쇼핑에서 결제되면 수상하다는 짐작을 확인해 보세요. 로지스틱 회귀로 사기일 확률을 보거나, 정답 열을 빼고 군집으로 튀는 거래 무리가 생기는지 볼 수 있습니다.\n\n"
                  f"## 사기 비율을 일부러 높였습니다\n\n"
                  f"원본에서 사기는 {n_f / total * 100:.2f}%뿐입니다. 그대로 쓰면 \"전부 정상\"이라고만 답하는 모델이 정확도 99% 이상을 받고, 사기는 한 건도 잡지 못합니다. "
                  "그래서 사기 거래를 남기고 정상 거래를 무작위로 뽑아 섞었습니다. 교실 컴퓨터 사정에 맞춰 고를 수 있도록 크기가 다른 파일 세 개를 넣었습니다.\n\n"
                  + size_table("ko") + "\n\n"
                  f"사기 거래는 원본 전체를 통틀어 {n_f:,}건뿐이라, 10만 행 파일은 사기 비율이 다른 두 파일보다 낮습니다. "
                  "작은 파일은 큰 파일의 부분집합입니다 - 크기만 다를 뿐 같은 자료에서 잘라 낸 것입니다. 처음에는 가장 작은 파일로 시작하십시오.\n"
                  "실제 세상의 사기는 훨씬 드물다는 것을 기억하십시오. 이 비율의 차이 자체가 좋은 토론거리입니다.\n\n"
                  "## 이렇게 만들었습니다\n\n"
                  f"1. 원본의 학습용(fraudTrain.csv)과 테스트용(fraudTest.csv)을 합쳤습니다 (총 {total:,}건). 두 파일은 기간만 다릅니다.\n"
                  f"2. 사기와 정상 거래를 각각 고정된 난수 씨앗({FRAUD_SEED})으로 섞은 뒤, 위 표의 개수만큼 앞에서부터 가져와 다시 섞었습니다.\n"
                  "3. 거래 일시에서 시각(0~23)과 요일을 뽑았습니다.\n"
                  "4. 생년월일과 거래일로 거래 당시 나이를 계산했습니다.\n"
                  "5. 카드 주인 집과 가게의 위도·경도로 둘 사이 거리(km, 대원 거리)를 계산했습니다.\n"
                  "6. 이름·주소·카드번호·거래번호·직업 등 가짜 개인정보 열과 가게 이름, 원본 좌표는 뺐습니다. 지어낸 값이지만 실제 개인정보처럼 보이기 때문입니다.\n\n"
                  "거리 열은 원본 생성 방식상 가게 위치를 집 근처에 무작위로 흩어 놓았기 때문에 사기와 거의 관련이 없습니다. \"쓸모없는 특징\"을 찾아보는 연습으로 쓰십시오.\n\n"
                  "스크립트: https://github.com/itmir913/teacher-utility-kit/blob/master/ml-playgrounds/datasets/tools/preprocess/credit-card-fraud.py",
            "en": "A **synthetic** set imitating US card transactions - no real person's purchases. Pick out fraud from the hour, merchant category, amount, the cardholder's age and so on.\n"
                  "Check the hunch that late-night, large, online purchases look suspicious. Use logistic regression to read off a fraud probability, or drop the label and cluster to see whether a group of odd transactions stands apart.\n\n"
                  "## The fraud rate was raised on purpose\n\n"
                  f"Only {n_f / total * 100:.2f}% of the original transactions are fraud. Used as is, a model that answers \"normal\" every time scores over 99% accuracy and catches nothing. "
                  "So frauds were kept and normal transactions drawn at random. Three files of different sizes are included, so you can pick one your classroom computers can handle.\n\n"
                  + size_table("en") + "\n\n"
                  f"There are only {n_f:,} frauds in the whole original, so the 100k file has a lower fraud rate than the other two. "
                  "Each smaller file is a subset of the larger one - the same data, cut shorter. Start with the smallest.\n"
                  "Remember that real-world fraud is far rarer - the gap itself is worth discussing.\n\n"
                  "## How this was built\n\n"
                  f"1. The original training file (fraudTrain.csv) and test file (fraudTest.csv) were combined ({total:,} transactions); they differ only in period.\n"
                  f"2. Frauds and normal transactions were each shuffled with a fixed random seed ({FRAUD_SEED}); each file takes the counts in the table above from the front and is shuffled again.\n"
                  "3. Hour (0-23) and weekday come from the transaction timestamp.\n"
                  "4. Age at the time of the transaction comes from the date of birth.\n"
                  "5. Distance (km, great-circle) is computed from the cardholder's and the merchant's latitude and longitude.\n"
                  "6. Fake personal columns - names, address, card number, transaction ID, job - plus merchant name and raw coordinates were dropped; invented, but they look like real personal data.\n\n"
                  "Because the generator scatters merchants randomly around the cardholder's home, distance has almost nothing to do with fraud. Use it to practise spotting a useless feature.\n\n"
                  "Script: https://github.com/itmir913/teacher-utility-kit/blob/master/ml-playgrounds/datasets/tools/preprocess/credit-card-fraud.py",
        },
        "notes": {
            "ko": ["위 \"이렇게 만들었습니다\"에 적은 것이 전부입니다."],
            "en": ["Everything changed is listed under \"How this was built\" above."],
        },
    })


if __name__ == "__main__":
    credit_card_fraud()
