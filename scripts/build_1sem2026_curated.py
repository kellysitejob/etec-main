import csv
import json
import re
from pathlib import Path

from extract_etec_prova import (
    GABARITO,
    LETTER_INDEX,
    PROVA_SOURCES,
    anchor_block_1sem_2026,
    extract_text,
    fold,
    load_csv_hints,
    parse_alternatives,
    pick_block,
    split_by_markers,
    split_reading_enunciado,
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PROVA_KEY = "prova 2026 1 sem"
CURATED_Q1 = {
    "bnccCode": "EF69LP03",
    "tema": "Interpretação de texto: domesticação de animais e evolução humana",
    "reading": (
        "A convivência com os animais mudou os seres humanos. Talvez o exemplo mais popular seja o consumo de leite: "
        "antes da domesticação animal, as pessoas naturalmente desenvolviam intolerância a lactose à medida que "
        "cresciam e não precisavam mais do leite materno. Quando os seres humanos começaram a criar gado, começaram "
        "a beber mais leite, havendo uma adaptação do sistema digestivo para o consumo do leite durante toda a vida. "
        "A domesticação é parte da conexão humana com os animais, que percorre toda a história e conecta grandes "
        "saltos evolutivos, como o desenvolvimento de ferramentas e até da linguagem.\n\n"
        "Fonte: https://tinyurl.com/wm2m58xm · Acesso em: 10.04.2025. Adaptado."
    ),
    "enunciado": "Segundo o texto, a domesticação de animais",
    "answers": [
        "ocorreu recentemente, no período medieval, e foi possível devido à invenção da linguagem e das ferramentas de pedra.",
        "causou danos à saúde humana, que não estava preparada para o consumo de leite na vida adulta, diminuindo a expectativa média de vida do homem contemporâneo.",
        "aumentou os níveis naturais de intolerância a lactose no homem pré-histórico devido às diferenças entre o leite materno e o leite de vaca.",
        "contribuiu para o desenvolvimento de aspectos culturais que favoreceram a evolução humana, como a criação de ferramentas e da linguagem.",
        "provocou saltos evolutivos que atrasaram o desenvolvimento da linguagem e da tecnologia.",
    ],
    "correct": 3,
    "gabarito": "D",
    "curated": True,
}


def load_mission_rows() -> list[dict]:
    rows_out = []
    current_prova = PROVA_KEY
    with (DATA / "missao-etec.csv").open(encoding="utf-8", newline="") as f:
        for row in csv.reader(f):
            if len(row) < 4:
                continue
            prova_cell = (row[3] or "").strip()
            if re.search(r"prova\s+\d+", prova_cell, re.I):
                current_prova = prova_cell
            if current_prova != PROVA_KEY:
                continue
            code = (row[0] or "").strip()
            if not code or code == "Código BNCC relacionado" or code.startswith("-"):
                continue
            questao = (row[2] or "").strip()
            if not questao.isdigit():
                continue
            rows_out.append(
                {
                    "code": code,
                    "tema": (row[1] or "").strip(),
                    "questao": int(questao),
                }
            )
    return rows_out


def codes_by_question(missions: list[dict]) -> dict[int, list[dict]]:
    out: dict[int, list[dict]] = {}
    for m in missions:
        out.setdefault(m["questao"], []).append(m)
    return out


def refine_reading_enunciado(n: int, block: str, answers: list[str]) -> tuple[str, str]:
    if n == 10:
        low = fold(block)
        pos = low.find("pronome eles")
        reading = block[:pos].strip() if pos > 0 else ""
        return reading, "O pronome eles, sublinhado no quarto parágrafo do texto, refere-se aos termos"
    if n == 33:
        m = re.search(r"correto\s+afirmar\s+que\s+a\s+til", block, flags=re.I)
        pos = m.start() if m else -1
        reading = block[:pos].strip() if pos > 0 else block
        m = re.search(r"(O\s+Brasil.+?Adaptado\.)", reading, flags=re.I | re.S)
        reading = m.group(1).strip() if m else reading
        return reading, "Com base no texto, é correto afirmar que a tilápia é"
    if n == 41:
        m = re.search(r"(\(A\))", block, flags=re.I)
        reading = block[: m.start()].strip() if m else block.strip()
        return reading, "Com base no texto, assinale a alternativa correta."
    return split_reading_enunciado(block)


def pick_block_multi(raw: str, marked: dict, n: int, temas: list[str]) -> str:
    for tema in temas:
        block = pick_block(raw, marked, n, tema)
        if block and len(parse_alternatives(block)) >= 5:
            return block
    return pick_block(raw, marked, n, temas[0] if temas else "")


def main() -> None:
    meta = PROVA_SOURCES[PROVA_KEY]
    pdf_path = DATA / "cache" / meta["file"]
    if not pdf_path.is_file():
        import urllib.request

        urllib.request.urlretrieve(meta["caderno"], pdf_path)

    missions = load_mission_rows()
    by_q = codes_by_question(missions)
    hints = load_csv_hints().get(PROVA_KEY, {})
    raw = extract_text(pdf_path)
    marked = split_by_markers(raw)
    letters = GABARITO[PROVA_KEY]

    questions = {}
    for n in range(1, 51):
        temas = [m["tema"] for m in by_q.get(n, []) if m["tema"]]
        if not temas and hints.get(str(n)):
            temas = [hints[str(n)]]
        block = anchor_block_1sem_2026(raw, n) or pick_block_multi(raw, marked, n, temas)
        answers = parse_alternatives(block) if block else []
        reading, enunciado = (
            refine_reading_enunciado(n, block, answers) if block and answers else ("", "")
        )
        letter = letters[n - 1] if n - 1 < len(letters) else "A"
        codes = [m["code"] for m in by_q.get(n, [])]
        tema = temas[0] if temas else hints.get(str(n), "")
        if len(answers) < 5:
            answers = [f"(Alternativa {L} — ver caderno oficial)" for L in "ABCDE"]
            enunciado = (
                f"Questão {n} · Vestibulinho 1º semestre 2026. "
                f"{tema or 'Consulte o caderno oficial.'}"
            )
            reading = ""
        questions[str(n)] = {
            "bnccCodes": codes,
            "tema": tema,
            "reading": reading,
            "enunciado": enunciado,
            "stem": enunciado,
            "answers": answers[:5],
            "correct": LETTER_INDEX.get(letter, 0),
            "gabarito": letter,
            "cadernoUrl": meta["caderno"],
            "gabaritoUrl": meta["gabarito"],
            "curated": len(answers) >= 5 and not answers[0].startswith("(Alternativa"),
        }

    questions["1"] = {**questions.get("1", {}), **CURATED_Q1, "bnccCodes": ["EF69LP03"]}

    out = {
        PROVA_KEY: {
            "prova": PROVA_KEY,
            "cadernoUrl": meta["caderno"],
            "gabaritoUrl": meta["gabarito"],
            "questions": questions,
        }
    }

    path = DATA / "etec-provas-curated.json"
    existing = {}
    if path.is_file():
        existing = json.loads(path.read_text(encoding="utf-8"))
    previous_questions = (existing.get(PROVA_KEY) or {}).get("questions") or {}
    for number, question in questions.items():
        previous_image = (previous_questions.get(number) or {}).get("quizImage")
        if previous_image:
            question["quizImage"] = previous_image
    existing.update(out)
    path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")

    ok = sum(1 for q in questions.values() if q.get("curated"))
    mapped = sum(1 for q in questions.values() if q.get("bnccCodes"))
    print(f"wrote {path}")
    print(f"questions: {ok}/50 parsed · {mapped} linked to BNCC rows in CSV")


if __name__ == "__main__":
    main()
