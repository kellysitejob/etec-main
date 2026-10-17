import json
import re
from pathlib import Path

from pypdf import PdfReader

from extract_etec_prova import (
    GABARITO,
    LETTER_INDEX,
    PROVA_SOURCES,
    _parse_alt_cluster,
    fold,
    load_csv_hints,
    normalize_ws,
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def junk_opts(opts: list[str]) -> bool:
    shorts = sum(1 for o in opts if len(normalize_ws(o)) < 8)
    letters = sum(1 for o in opts if re.fullmatch(r"\(?[A-E]\)?", normalize_ws(o)))
    return shorts >= 3 or letters >= 2


def broken(q: dict) -> bool:
    en = q.get("enunciado") or ""
    ans = q.get("answers") or []
    if len(ans) < 5:
        return True
    if str(ans[0]).startswith("(Alternativa"):
        return True
    if re.search(r"\([A-E]\)", en):
        return True
    if any(len(normalize_ws(a)) < 4 for a in ans):
        return True
    if any(re.fullmatch(r"\(?[A-E]\)?", normalize_ws(a)) for a in ans):
        return True
    return False


def same_answer(a: str, b: str) -> bool:
    return fold(normalize_ws(a))[:42] == fold(normalize_ws(b))[:42]


def stem_from_pre(pre: str) -> tuple[str, str]:
    pre = re.sub(r"(?i)\d+\s+VESTIBULINHO[^\n]*", " ", pre)
    pre = re.sub(r"(?i)Quest[aã\uFFFD]?o\s+\d+", " ", pre)
    pre = re.sub(r"https?://\S+", " ", pre)
    lines = []
    for line in pre.splitlines():
        line = normalize_ws(line)
        if not line or re.match(r"^\([A-E]\)", line):
            continue
        if re.match(r"(?i)^quest[aã]o\s+\d+", line):
            continue
        if re.search(r"(?i)acesso em|adaptado|<http", line):
            continue
        lines.append(line)
    if not lines:
        return "", ""
    enunciado = lines[-1]
    if len(enunciado) < 18 and len(lines) > 1:
        enunciado = f"{lines[-2]} {lines[-1]}"
    reading = normalize_ws(" ".join(lines[:-1]))
    if len(reading) > 180 and not re.search(
        r"(?i)assinale|correto|afirm|consider|determin|calcul|apresent|classific|refere|aponta|necess[aá]rio|objetivo|respectiv|podemos|indique|conclu|\?",
        enunciado,
    ):
        reading = normalize_ws(f"{reading} {enunciado}")
        enunciado = "Com base no texto, assinale a alternativa correta."
    if len(reading) > 1800:
        reading = reading[-1800:]
    return reading, enunciado


def page_questions(pdf_path: Path) -> list[dict]:
    reader = PdfReader(str(pdf_path))
    out: list[dict] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if not re.search(r"(?i)quest", text):
            continue
        cursor = 0
        prev_end = 0
        while True:
            m = re.search(r"\(A\)", text[cursor:])
            if not m:
                break
            start = cursor + m.start()
            opts = _parse_alt_cluster(text[start : start + 3400])
            if len(opts) != 5 or "et al" in fold(opts[0]) or fold(opts[0]).startswith("(f)"):
                cursor = start + 3
                continue
            em = re.search(r"\(E\)", text[start : start + 3400])
            end = start + (em.end() if em else 80)
            window = text[max(prev_end, start - 900) : start]
            reading, enunciado = stem_from_pre(window)
            image = junk_opts(opts)
            if image:
                opts = [f"(Alternativa {letter} — gráfico no caderno)" for letter in "ABCDE"]
            out.append(
                {
                    "reading": "" if image else reading,
                    "enunciado": enunciado,
                    "answers": opts[:5],
                    "image": image,
                }
            )
            prev_end = end
            cursor = max(end, start + 4)
    return out


def codes_for(prova_key: str) -> dict[str, list[str]]:
    import csv

    out: dict[str, list[str]] = {}
    current = "prova 2026 1 sem"
    with (DATA / "missao-etec.csv").open(encoding="utf-8", newline="") as f:
        for row in csv.reader(f):
            if len(row) < 4:
                continue
            cell = (row[3] or "").strip()
            if re.search(r"prova\s+\d+", cell, re.I):
                current = cell
            if current != prova_key:
                continue
            code = (row[0] or "").strip()
            questao = (row[2] or "").strip()
            if not code or code == "Código BNCC relacionado" or code.startswith("-"):
                continue
            if not questao.isdigit():
                continue
            out.setdefault(str(int(questao)), []).append(code)
    return out


def align_prova(prova_key: str, current: dict) -> tuple[dict, int, int]:
    meta = PROVA_SOURCES[prova_key]
    pdf_path = DATA / "cache" / meta["file"]
    official = page_questions(pdf_path)
    if len(official) != 50:
        raise SystemExit(f"{prova_key}: expected 50 questions, got {len(official)}")
    hints = load_csv_hints().get(prova_key, {})
    codes = codes_for(prova_key)
    letters = GABARITO[prova_key]
    questions = {}
    kept = replaced = 0
    for n in range(1, 51):
        src = official[n - 1]
        old = (current or {}).get(str(n)) or {}
        letter = letters[n - 1]
        use_old = False
        if (
            prova_key == "prova 2026 1 sem"
            and n == 1
            and old.get("reading")
            and "domestica" in fold(old.get("reading") or "")
            and old.get("answers")
            and same_answer(old["answers"][0], src["answers"][0])
        ):
            use_old = True
        if use_old:
            kept += 1
            reading = old.get("reading") or src["reading"]
            enunciado = old.get("enunciado") or src["enunciado"]
            answers = old["answers"][:5]
        else:
            replaced += 1
            reading = src["reading"]
            enunciado = src["enunciado"]
            answers = src["answers"][:5]
        if reading and len(reading) < 100 and reading.count(".") < 2:
            reading = ""
        tema = (old.get("tema") or hints.get(str(n)) or "").strip()
        bncc = old.get("bnccCodes") or codes.get(str(n)) or []
        if not bncc and codes.get(str(n)):
            bncc = codes[str(n)]
        questions[str(n)] = {
            "bnccCodes": bncc,
            "tema": tema,
            "reading": reading or "",
            "enunciado": enunciado,
            "stem": enunciado,
            "answers": answers,
            "correct": LETTER_INDEX.get(letter, 0),
            "gabarito": letter,
            "cadernoUrl": meta["caderno"],
            "gabaritoUrl": meta["gabarito"],
            "curated": not str(answers[0]).startswith("(Alternativa"),
        }
        if old.get("quizImage"):
            questions[str(n)]["quizImage"] = old["quizImage"]
    if prova_key == "prova 2026 2 sem":
        q21, q22 = questions["21"], questions["22"]
        if "socioemoc" in fold(q22.get("enunciado") or "") and "socioemoc" not in fold(q21.get("enunciado") or ""):
            for field in ("reading", "enunciado", "stem", "answers", "curated"):
                q21[field], q22[field] = q22[field], q21[field]
        soc = questions["21"]
        if "muitas vezes" in fold(soc.get("reading") or ""):
            raw = soc["reading"]
            idx = fold(raw).find("muitas vezes")
            soc["reading"] = raw[idx:].strip()
    return questions, kept, replaced


def main() -> None:
    path = DATA / "etec-provas-curated.json"
    auto_path = DATA / "etec-provas.json"
    curated = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    auto = json.loads(auto_path.read_text(encoding="utf-8")) if auto_path.is_file() else {}
    for key in PROVA_SOURCES:
        current = (curated.get(key) or auto.get(key) or {}).get("questions") or {}
        if key == "prova 2026 1 sem" and "1" in current:
            pass
        questions, kept, replaced = align_prova(key, current)
        meta = PROVA_SOURCES[key]
        curated[key] = {
            "prova": key,
            "cadernoUrl": meta["caderno"],
            "gabaritoUrl": meta["gabarito"],
            "questions": questions,
        }
        print(f"{key}: kept {kept} · replaced {replaced}")
    path.write_text(json.dumps(curated, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
