"""pokemon - PokéAPI의 표 여러 개를 포켓몬 한 마리 한 줄로 합치고, 이름과 타입에 한국어를 붙인다.

    python preprocess/pokemon.py <raw 폴더> <clean 폴더>

raw 폴더에 받아 둘 것 (파일 이름 그대로):
  pokeapi/<이름>.csv  https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/<이름>.csv
                     이름: pokemon, pokemon_species, pokemon_species_names, pokemon_stats,
                           stats, pokemon_types, types, type_names

그다음 (세대 범위가 다른 CSV 셋, csv_name 순서대로):
  python build_dataset.py recipes/pokemon.json --csv <clean>/pokemon-gen1.csv
      --csv <clean>/pokemon-gen1-4.csv --csv <clean>/pokemon-all.csv --out <자산 폴더>
"""
from _common import *

KO, EN = "3", "9"     # PokéAPI languages.csv의 언어 번호
STATS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"]
STATS_KO = {"hp": "HP", "attack": "공격", "defense": "방어", "special-attack": "특수공격",
            "special-defense": "특수방어", "speed": "스피드"}


# 세대 범위가 다른 판을 함께 넣는다. 1세대는 누구나 아는 151마리, 1~4세대는 학생들에게 익숙한
# 범위, 마지막은 최신 세대까지 전부. None은 '있는 세대 전부'다.
EDITIONS = [
    (1, "1세대", "Generation 1"),
    (4, "1~{top}세대", "Generations 1-{top}"),
    (None, "1~{top}세대 (전체)", "Generations 1-{top} (all)"),
]


def pokemon_file(top, last_gen):
    return "pokemon-all.csv" if top == last_gen else "pokemon-gen1.csv" if top == 1 else f"pokemon-gen1-{top}.csv"


def table(name):
    with open(os.path.join(RAW, "pokeapi", name + ".csv"), encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def pokemon():
    species = {r["id"]: r for r in table("pokemon_species")}
    names = {}
    for r in table("pokemon_species_names"):
        if r["local_language_id"] in (KO, EN):
            names[(r["pokemon_species_id"], r["local_language_id"])] = r["name"]
    stat_id = {r["id"]: r["identifier"] for r in table("stats")}
    stats = {}
    for r in table("pokemon_stats"):
        stats.setdefault(r["pokemon_id"], {})[stat_id[r["stat_id"]]] = r["base_stat"]
    type_id = {r["id"]: r["identifier"] for r in table("types")}
    type_ko = {type_id[r["type_id"]]: r["name"].strip() for r in table("type_names")
               if r["local_language_id"] == KO and r["type_id"] in type_id}
    types = {}
    for r in table("pokemon_types"):
        types.setdefault(r["pokemon_id"], {})[r["slot"]] = type_id[r["type_id"]]

    # 종마다 기본 모습 하나만 - 메가진화·지역 모습 같은 다른 모습은 이름이 같아 헷갈린다.
    out, name_ko = [], {}
    for p in table("pokemon"):
        if p["is_default"] != "1":
            continue
        s = species[p["species_id"]]
        en = names[(s["id"], EN)]
        ko = names[(s["id"], KO)]
        name_ko[en] = f"{ko} ({en})"
        st = stats[p["id"]]
        ty = types[p["id"]]
        status = "mythical" if s["is_mythical"] == "1" else "legendary" if s["is_legendary"] == "1" else "normal"
        out.append([en, s["generation_id"], ty["1"], ty.get("2", ""),
                    f"{int(p['height']) / 10:g}", f"{int(p['weight']) / 10:g}"]
                   + [st[k] for k in STATS] + [str(sum(int(st[k]) for k in STATS)), status])
    assert len(out) == len(species), (len(out), len(species))
    assert len(name_ko) == len(out), "영어 이름이 겹치는 포켓몬이 있다"

    header = ["name", "generation", "type 1", "type 2", "height (m)", "weight (kg)"] + STATS + ["total", "status"]
    last_gen = max(int(r[1]) for r in out)
    editions = []   # (파일 이름, 행, 한국어 설명, 영어 설명)
    for top, ko_label, en_label in EDITIONS:
        top = top or last_gen
        rows = [r for r in out if int(r[1]) <= top]
        name = pokemon_file(top, last_gen)
        write(name, header, rows)
        editions.append((name, rows, ko_label.format(top=top), en_label.format(top=top)))
        n_rare = sum(r[-1] != "normal" for r in rows)
        print(f"  {name}: {len(rows)}마리, 전설·환상 {n_rare}")
    used_types = sorted({r[2] for r in out} | {r[3] for r in out} - {""})
    status_n = {k: sum(r[-1] == k for r in out) for k in ("normal", "legendary", "mythical")}

    def size_table(lang):
        head = ["| 파일 | 범위 | 마리 수 | 전설·환상 |" if lang == "ko" else "| File | Range | Pokémon | Legendary/mythical |",
                "|---|---|---|---|"]
        return "\n".join(head + [f"| `{n}` | {ko if lang == 'ko' else en} | {len(rows):,} | {sum(r[-1] != 'normal' for r in rows)} |"
                                 for n, rows, ko, en in editions])

    type_values = {"ko": {t: f"{type_ko[t]} ({t})" for t in used_types}}
    type_values_2 = {"ko": dict(type_values["ko"], **{"": ""})}
    recipe({
        "id": "pokemon",
        "csv_name": [e[0] for e in editions],
        "source_url": "https://pokeapi.co/ (https://github.com/PokeAPI/pokeapi)",
        "license": "BSD-3-Clause (PokéAPI). Pokémon and Pokémon character names are trademarks of Nintendo.",
        "title": {"ko": "포켓몬 능력치", "en": "Pokémon Stats"},
        "target": {"ko": "구분 (status)", "en": "status"},
        "headers": [
            H("name", "이름 (name)"),
            H("generation", "세대 (generation)"),
            H("type 1", "타입 1 (type 1)"),
            H("type 2", "타입 2 (type 2)"),
            H("height (m)", "키 (height, m)"),
            H("weight (kg)", "몸무게 (weight, kg)"),
        ] + [H(k, f"{STATS_KO[k]} ({k})") for k in STATS] + [
            H("total", "능력치 합계 (total)"),
            H("status", "구분 (status)"),
        ],
        "values": {
            "name": {"ko": name_ko},
            "type 1": type_values,
            "type 2": type_values_2,
            "status": {"ko": {"normal": "일반 (normal)", "legendary": "전설 (legendary)", "mythical": "환상 (mythical)"}},
        },
        "body": {
            "ko": f"1세대부터 {last_gen}세대까지 포켓몬 {len(out):,}마리의 타입·키·몸무게와 여섯 가지 기본 능력치입니다.\n"
                  "익숙한 포켓몬만으로 시작할 수 있도록 세대 범위가 다른 파일 세 개를 넣었습니다. "
                  "작은 파일은 큰 파일의 앞부분과 같습니다.\n\n"
                  + size_table("ko") + "\n\n"
                  "목표는 마음대로 고를 수 있습니다.\n\n"
                  f"- 분류: 능력치로 전설·환상 포켓몬 맞히기 ({status_n['legendary'] + status_n['mythical']}마리뿐이라 불균형도 함께 볼 수 있습니다)\n"
                  "- 분류: 능력치로 첫 번째 타입 맞히기 (생각보다 어렵습니다)\n"
                  "- 회귀: 키로 몸무게 예측하기\n"
                  "- 군집: 능력치만으로 묶어 '공격형·방어형·스피드형' 같은 무리가 생기는지 보기\n\n"
                  "이름은 한 마리에 하나뿐인 값이므로 학습에서 빼고 결과를 확인할 때만 보십시오. "
                  "능력치 합계는 여섯 능력치를 더한 값이라, 함께 넣으면 같은 정보가 두 번 들어갑니다.\n\n"
                  "Pokémon과 포켓몬 이름은 Nintendo의 상표입니다. 이 자료는 PokéAPI가 정리한 능력치 표만 담았고 이미지는 없습니다.",
            "en": f"Type, height, weight and the six base stats of all {len(out):,} Pokémon from generation 1 to {last_gen}.\n"
                  "Three files covering different generations are included, so you can start with the familiar ones. "
                  "Each smaller file is the front of the larger one.\n\n"
                  + size_table("en") + "\n\n"
                  "Choose your own target:\n\n"
                  f"- Classification: spot legendary and mythical Pokémon from their stats (only {status_n['legendary'] + status_n['mythical']} of them, so imbalance comes along)\n"
                  "- Classification: guess the first type from the stats (harder than it sounds)\n"
                  "- Regression: predict weight from height\n"
                  "- Clustering: group by stats alone and see whether attackers, tanks and speedsters fall out\n\n"
                  "The name is unique to each Pokémon; leave it out of training and use it to check results. "
                  "Total is the sum of the six stats, so keeping both feeds the model the same information twice.\n\n"
                  "Pokémon and Pokémon character names are trademarks of Nintendo. This file holds only the stat tables compiled by PokéAPI - no images.",
        },
        "notes": {
            "ko": ["PokéAPI의 표 여덟 개(포켓몬, 종, 종 이름, 능력치, 타입 등)를 포켓몬 한 마리 한 줄로 합쳤습니다.",
                   "종마다 기본 모습 하나만 남겼습니다. 메가진화·지역 모습 등 다른 모습은 뺐습니다.",
                   "키와 몸무게를 원본의 0.1m·0.1kg 단위에서 m·kg으로 바꾸었습니다.",
                   "능력치 합계 열과, 전설·환상 여부를 하나로 묶은 구분 열을 새로 만들었습니다.",
                   "한국어 판의 이름과 타입은 PokéAPI에 실린 한국어 공식 명칭을 앞에 붙였습니다."],
            "en": ["Joined eight PokéAPI tables (pokemon, species, species names, stats, types, ...) into one row per Pokémon.",
                   "Kept only the default form of each species; Mega Evolutions, regional forms and other alternate forms were dropped.",
                   "Height and weight were converted from the original 0.1 m and 0.1 kg units to m and kg.",
                   "Added a total column and a status column combining the legendary and mythical flags."],
        },
    })


if __name__ == "__main__":
    pokemon()
