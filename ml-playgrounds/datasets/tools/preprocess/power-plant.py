"""power-plant - 원본을 build_dataset.py에 넣을 영어 CSV로 다듬고 레시피를 쓴다.

    python preprocess/power-plant.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  ccpp/CCPP/Folds5x2_pp.xlsx
                     https://archive.ics.uci.edu/static/public/294/combined+cycle+power+plant.zip 를 ccpp/에 푼다

openpyxl이 있어야 한다.

그다음:
  python build_dataset.py recipes/power-plant.json --csv <clean>/power-plant.csv --out <자산 폴더>
"""
from _common import *


# ── Combined Cycle Power Plant ───────────────────────────────────────────
def power_plant():
    import openpyxl
    wb = openpyxl.load_workbook(os.path.join(RAW, "ccpp", "CCPP", "Folds5x2_pp.xlsx"), read_only=True)
    rows = list(wb.worksheets[0].iter_rows(values_only=True))  # 시트 다섯 장은 같은 자료를 섞은 순서만 다르다
    assert list(rows[0]) == ["AT", "V", "AP", "RH", "PE"], rows[0]
    write("power-plant.csv", ["AT", "V", "AP", "RH", "PE"], [[str(c) for c in r] for r in rows[1:]])
    recipe({
        "id": "power-plant",
        "csv_name": "power-plant.csv",
        "source_url": "https://archive.ics.uci.edu/dataset/294/combined+cycle+power+plant",
        "license": "CC BY 4.0",
        "title": {"ko": "발전소 출력", "en": "Combined Cycle Power Plant"},
        "target": {"ko": "발전량 (PE, MW)", "en": "PE"},
        "headers": [
            H("AT", "기온 (AT, °C)"),
            H("V", "배기 진공도 (V, cmHg)"),
            H("AP", "기압 (AP, mbar)"),
            H("RH", "상대습도 (RH, %)"),
            H("PE", "발전량 (PE, MW)"),
        ],
        "body": {
            "ko": "터키의 한 복합화력발전소가 6년 동안 전부하로 돌 때 한 시간 평균으로 기록한 9,568개 값입니다. 바깥 기온·기압·습도와 배기 진공도로 그 시간의 발전량을 예측합니다.\n"
                  "공기가 더우면 밀도가 낮아져 가스터빈이 들이마시는 공기가 줄고, 발전량도 줄어듭니다. 기온 하나만으로도 꽤 정확한 직선이 그려집니다.\n\n"
                  "- AT: 바깥 기온 (°C)\n- V: 증기터빈 배기 쪽 진공도 (cmHg). 기온이 오르면 함께 오르는 경향이 있습니다.\n"
                  "- AP: 대기압 (mbar, = hPa)\n- RH: 상대습도 (%)\n- PE: 순 발전량 (MW)",
            "en": "9,568 hourly averages from a combined-cycle power plant in Turkey running at full load over six years. Predict the hour's power output from outdoor temperature, pressure, humidity and exhaust vacuum.\n"
                  "Hot air is thin, so the gas turbine draws in less of it and output drops. Temperature alone already gives a fairly tight straight line.\n\n"
                  "- AT: ambient temperature (°C)\n- V: exhaust vacuum on the steam-turbine side (cmHg); it tends to rise with temperature\n"
                  "- AP: ambient pressure (mbar, = hPa)\n- RH: relative humidity (%)\n- PE: net electrical output (MW)",
        },
        "notes": {
            "ko": ["원본 엑셀의 첫 번째 시트를 CSV로 옮겼습니다. 다섯 시트는 같은 자료의 행 순서만 다릅니다.",
                   "원 연구: Tüfekci P. (2014) Prediction of full load electrical power output of a base load operated combined cycle power plant using machine learning methods. International Journal of Electrical Power & Energy Systems 60:126-140."],
            "en": ["Converted the first sheet of the original workbook to CSV; the five sheets hold the same rows in different orders.",
                   "Original study: Tüfekci P. (2014) Prediction of full load electrical power output of a base load operated combined cycle power plant using machine learning methods. International Journal of Electrical Power & Energy Systems 60:126-140."],
        },
    })


if __name__ == "__main__":
    power_plant()
