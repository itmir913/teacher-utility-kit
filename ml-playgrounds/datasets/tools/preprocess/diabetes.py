"""diabetes - 원본을 build_dataset.py에 넣을 영어 CSV로 다듬고 레시피를 쓴다.

    python preprocess/diabetes.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  diabetes.csv       https://hbiostat.org/data/repo/diabetes.csv

그다음:
  python build_dataset.py recipes/diabetes.json --csv <clean>/diabetes.csv --out <자산 폴더>
"""
from _common import *


# ── Diabetes (Willems et al., Vanderbilt) ────────────────────────────────
def diabetes():
    h, rows = read(os.path.join(RAW, "diabetes.csv"))
    i = {c: h.index(c) for c in h}
    out = []
    for r in rows:
        g = r[i["glyhb"]]
        if g == "":
            continue
        out.append([
            r[i["gender"]], r[i["age"]], r[i["location"]],
            cm(r[i["height"]]), kg(r[i["weight"]]), r[i["frame"]],
            cm(r[i["waist"]]), cm(r[i["hip"]]),
            r[i["bp.1s"]], r[i["bp.1d"]],
            r[i["chol"]], r[i["hdl"]], r[i["stab.glu"]],
            "yes" if float(g) >= 7.0 else "no",
        ])
    write("diabetes.csv",
          ["gender", "age", "location", "height (cm)", "weight (kg)", "frame",
           "waist (cm)", "hip (cm)", "systolic bp", "diastolic bp",
           "cholesterol", "hdl", "glucose", "diabetes"], out)
    recipe({
        "id": "diabetes",
        "csv_name": "diabetes.csv",
        "source_url": "https://hbiostat.org/data/",
        "license": "Free to use with attribution - \"Data obtained from http://hbiostat.org/data courtesy of the Vanderbilt University Department of Biostatistics.\"",
        "title": {"ko": "당뇨 검사", "en": "Diabetes Screening"},
        "target": {"ko": "당뇨 여부 (diabetes)", "en": "diabetes"},
        "headers": [
            H("gender", "성별 (gender)"),
            H("age", "나이 (age)"),
            H("location", "거주 지역 (location)"),
            H("height (cm)", "키 (height, cm)"),
            H("weight (kg)", "몸무게 (weight, kg)"),
            H("frame", "체격 (frame)"),
            H("waist (cm)", "허리둘레 (waist, cm)"),
            H("hip (cm)", "엉덩이둘레 (hip, cm)"),
            H("systolic bp", "수축기 혈압 (systolic bp)"),
            H("diastolic bp", "이완기 혈압 (diastolic bp)"),
            H("cholesterol", "총콜레스테롤 (cholesterol)"),
            H("hdl", "HDL 콜레스테롤 (hdl)"),
            H("glucose", "혈당 (glucose)"),
            H("diabetes", "당뇨 여부 (diabetes)"),
        ],
        "values": {
            "gender": {"ko": {"male": "남성 (male)", "female": "여성 (female)"}},
            "location": {"ko": {"Buckingham": "버킹엄 (Buckingham)", "Louisa": "루이자 (Louisa)"}},
            "frame": {"ko": {"small": "작음 (small)", "medium": "보통 (medium)", "large": "큼 (large)", "": ""}},
            "diabetes": {"ko": {"yes": "당뇨 (yes)", "no": "정상 (no)"}},
        },
        "body": {
            "ko": "미국 버지니아주 두 지역의 성인 약 400명을 검사한 기록입니다. 키·몸무게·허리둘레·혈압·콜레스테롤·혈당으로 당뇨 여부를 맞힙니다.\n"
                  "당뇨 여부는 당화혈색소(glyhb) 7.0 이상을 기준으로 정했습니다. 그 수치는 정답을 그대로 알려 주므로 파일에서 뺐습니다.",
            "en": "Screening records of about 400 adults from two counties in Virginia, USA. Predict diabetes from height, weight, waist, blood pressure, cholesterol and glucose.\n"
                  "Diabetes is defined as glycosylated haemoglobin (glyhb) of 7.0 or more. That value gives the answer away, so it is not in the file.",
        },
        "notes": {
            "ko": ["당화혈색소(glyhb)로 당뇨 여부 열을 만들고 glyhb 열은 뺐습니다. glyhb가 없는 13행도 뺐습니다.",
                   "키·허리둘레·엉덩이둘레는 인치에서 센티미터로, 몸무게는 파운드에서 킬로그램으로 바꾸었습니다.",
                   "대부분 비어 있는 두 번째 혈압 측정값, 피험자 번호, 콜레스테롤/HDL 비율(두 열로 계산되는 값), 채혈 시각 열을 뺐습니다.",
                   "원 연구: Willems JP et al. (1997) Prevalence of coronary heart disease risk factors among rural blacks. Journal of Community Health 22:365-375."],
            "en": ["Built the diabetes column from glycosylated haemoglobin (glyhb) and dropped glyhb itself, along with the 13 rows where it was missing.",
                   "Height, waist and hip were converted from inches to centimetres; weight from pounds to kilograms.",
                   "Dropped the mostly empty second blood-pressure reading, the subject ID, the cholesterol/HDL ratio (computable from two other columns) and the time of the blood draw.",
                   "Original study: Willems JP et al. (1997) Prevalence of coronary heart disease risk factors among rural blacks. Journal of Community Health 22:365-375."],
        },
    })


if __name__ == "__main__":
    diabetes()
