import csv
import json
import re
import unicodedata
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CSV_PATH = DATA / "missao-etec.csv"

PROVA_SOURCES = {
    "prova 2026 1 sem": {
        "caderno": "https://fatweb.s3.amazonaws.com/vestibulinhoetec/gabarito/20261176943/A-CADERNO-VESTIBULINHO-1SEM2026.pdf",
        "gabarito": "https://fatweb.s3.amazonaws.com/vestibulinhoetec/gabarito/20261176943/A-GABARITO-VESTIBULINHO-1SEM2026.pdf",
        "file": "vest-1sem2026.pdf",
    },
    "prova 2026 2 sem": {
        "caderno": "https://fatweb.s3.amazonaws.com/vestibulinhoetec/gabarito/20262210689/A-CADERNO-VESTIBULINHO-2SEM2026.pdf",
        "gabarito": "https://fatweb.s3.amazonaws.com/vestibulinhoetec/gabarito/20262210689/A-GABARITO-VESTIBULINHO-2SEM2026.pdf",
        "file": "vest-2sem2026.pdf",
    },
}

GABARITO = {
    "prova 2026 1 sem": list("DCDEAEEDDECDADABCAECDEACEEAEBDAEBAADCECEBCBCBCDDCE"),
    "prova 2026 2 sem": list("CBEDDBDADBBAAEBABBDECCEEBCDADBECACDAEECEBCDACEADEB"),
}

LETTER_INDEX = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}


def normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def clean_fragment(text: str) -> str:
    text = text or ""
    text = re.split(r"(?i)\s*\d+\s+VESTIBULINHO", text)[0]
    text = re.split(r"(?i)\s*Quest[aã\uFFFD]?o\s*0*\d+", text)[0]
    text = re.split(r"(?i)\s*Leia (o|a) texto", text)[0]
    parts = re.split(r"\.\s+(?=[A-ZÁÉÍÓÚ\"“])", text, maxsplit=1)
    if len(parts) > 1 and len(parts[0]) > 20:
        text = parts[0] + "."
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"(?i)Acesso em:.*", "", text)
    return normalize_ws(text)


def extract_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    return "\n".join((p.extract_text() or "") for p in reader.pages)


def _parse_alt_cluster(sub: str) -> list[str]:
    opts: list[str] = []
    for letter in "ABCDE":
        m = re.search(
            rf"\({letter}\)\s*(.+?)(?=\s*\([ABCDE]\)|\Z)",
            sub,
            flags=re.I | re.S,
        )
        if not m:
            return []
        opts.append(clean_fragment(m.group(1))[:600])
    return opts


def _alt_cluster_ok(opts: list[str]) -> bool:
    if len(opts) != 5:
        return False
    first = fold(opts[0])
    if "et al" in first or "revista" in first:
        return False
    if re.match(r"^[\d.,\s]+", opts[0]):
        return False
    if re.search(r"\d+\s*m/s", opts[0], flags=re.I):
        return False
    if re.search(r"\d+\s*m3", fold(opts[-1]), flags=re.I):
        return False
    return True


def parse_alternatives(block: str) -> list[str]:
    for m in re.finditer(r"\(A\)", block, flags=re.I):
        sub = block[m.start() : m.start() + 2800]
        opts = _parse_alt_cluster(sub)
        if _alt_cluster_ok(opts):
            return opts
    fallback = _parse_alt_cluster(block)
    return fallback if _alt_cluster_ok(fallback) else []


def first_alt_pos(block: str) -> int | None:
    for m in re.finditer(r"\(A\)", block, flags=re.I):
        sub = block[m.start() : m.start() + 2800]
        if _alt_cluster_ok(_parse_alt_cluster(sub)):
            return m.start()
    return None


def split_reading_enunciado(block: str) -> tuple[str, str]:
    alt_pos = first_alt_pos(block)
    if alt_pos is not None:
        before = block[:alt_pos]
    else:
        cut = re.search(r"\([A]\)", block, flags=re.I)
        before = block[: cut.start()] if cut else block
    before = re.sub(r"https?://\S+", "", before)
    before = re.sub(r"(?i)Acesso em:.*?(?=\.|$)", "", before)
    before = normalize_ws(before)
    if not before:
        return "", ""

    m_soc_early = re.search(
        r"(?i)(muitas vezes, a realiza[cç][aã]o.+?compet[eê]ncia\s+socioemocional\s+[eé]\s+necess[aá]rio\s+para)",
        before,
        flags=re.S,
    )
    if m_soc_early:
        command = normalize_ws(m_soc_early.group(1))
    elif re.search(r"(?i)(considerando[^?]{10,}\?)", before):
        command = normalize_ws(re.search(r"(?i)(considerando[^?]{10,}\?)", before).group(1))
    else:
        sentences = re.split(r"(?<=[.?!])\s+", before)
        command = ""
        for s in reversed(sentences):
            if "?" in s or re.search(
                r"(?i)(assinale|correto|concluir|indique|apresenta|calcule|considere|necess[aá]rio para)",
                s,
            ):
                command = normalize_ws(s)
                break
        if not command:
            command = normalize_ws(sentences[-1]) if sentences else before
    if re.search(r"(?i)caderno de quest|prezado candidato", command):
        command = ""

    reading = before
    if command and command in reading:
        reading = normalize_ws(reading.replace(command, "", 1))
    reading = re.sub(r"(?i)Quest[aã\uFFFD]?o\s*0*\d+\s*", "", reading)
    if re.search(r"(?i)boa prova|gabarito oficial", reading):
        intro = re.search(
            r"(A convivência com os animais[^.]+(?:\.[^.]+){0,6})",
            block,
            flags=re.I,
        )
        reading = normalize_ws(intro.group(1)) if intro else ""
    reading = clean_fragment(reading)
    command = clean_fragment(command)
    if re.search(r"(?i)prochno|caderno|prezado|\(j\)", command):
        command = ""
    m_soc = re.search(
        r"(?i)(muitas vezes, a realiza[cç][aã]o.+?necess[aá]rio para)",
        block,
    )
    if m_soc:
        command = normalize_ws(m_soc.group(1))
    elif not command or re.search(r"(?i)caderno|prezado", command):
        m2 = re.search(r"(?i)(segundo o texto[^?]*\?)", block)
        if m2:
            command = normalize_ws(m2.group(1))
        elif re.search(r"(?i)considerando[^?]+\?", block):
            command = normalize_ws(re.search(r"(?i)considerando[^?]+\?", block).group(0))
    m_read = re.search(
        r"(Estima-se que o trecho[^.]+(?:\.[^.]+){0,8}Adaptado\.)",
        block,
        flags=re.I | re.S,
    )
    if m_read:
        reading = normalize_ws(m_read.group(1))
    if len(reading) > 2200:
        reading = reading[:2197] + "…"
    if len(command) > 1200:
        command = command[:1197] + "…"
    return reading, command


def fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower().replace("-", " ")


def hint_tokens(tema: str) -> list[str]:
    raw = (tema or "").strip()
    focus = raw.split(":", 1)[-1].strip() if ":" in raw else raw
    stop = {"texto", "interpretacao", "identificacao", "relacoes", "sentido", "questao"}
    words = [
        w
        for w in re.findall(r"[a-záàâãéêíóôõúç]{6,}", focus.lower())
        if w not in stop
    ]
    return words[:5]


def block_matches_tema(block: str, tema: str) -> bool:
    if not tema or not block:
        return bool(block)
    f = fold(block)
    words = hint_tokens(tema)
    if not words:
        return True
    hits = sum(1 for w in words if w in f)
    return hits >= min(2, len(words)) or (len(words) == 1 and words[0] in f)


def score_block(block: str, tema: str) -> int:
    f = fold(block)
    focus = fold((tema or "").split(":", 1)[-1])
    score = 0
    if focus and focus[: min(40, len(focus))] in f:
        score += 20
    for w in hint_tokens(tema):
        if w in f:
            score += 3
    if "domesticacao" in focus and "domesticacao" in f:
        score += 15
    if "nilo" in focus and "nilo" in f:
        score += 15
    if "egito" in focus and "egito" in f:
        score += 8
    if "egito" in focus and re.search(r"seculos\s+xvi|comercio triangular", f):
        score -= 25
    if "nilo" in focus and "rio nilo" in f:
        score += 12
    if "socioemocion" in focus and "adaptabilidade" in f:
        score += 20
    if "socioemocion" in focus and re.search(r"grandes navegac|comercio triangular", f):
        score -= 30
    return score


def locate_block(full_text: str, tema: str) -> str:
    lower = fold(full_text)
    focus_fold = fold((tema or "").split(":", 1)[-1])
    banned = (
        "folha de respostas",
        "candidato",
        "desclassificado",
        "equipamento eletronico",
    )
    focus = (tema or "").split(":", 1)[-1].strip()
    needles = [focus] if len(focus) >= 10 else []
    needles.extend(hint_tokens(tema))
    needles = [n for n in needles if len(n) >= 6]
    candidates: list[tuple[int, str]] = []
    if "nilo" in focus_fold:
        for anchor in ("considerando as caracter", "rio nilo funcionou", "alto egito"):
            pos = lower.find(anchor)
            if pos < 0:
                continue
            chunk = full_text[pos : min(len(full_text), pos + 4200)]
            chunk_low = fold(chunk)
            if any(b in chunk_low for b in banned):
                continue
            if len(parse_alternatives(chunk)) >= 5 and "embarcac" in chunk_low:
                return chunk
    for needle in needles:
        nfold = fold(needle)
        start = 0
        key = nfold[: min(48, len(nfold))]
        while key:
            pos = lower.find(key, start)
            if pos < 0:
                break
            start = pos + 8
            chunk = full_text[max(0, pos - 1400) : min(len(full_text), pos + 3800)]
            chunk_low = fold(chunk)
            if any(b in chunk_low for b in banned):
                continue
            if not re.search(r"\([A]\)", chunk, flags=re.I):
                continue
            if len(parse_alternatives(chunk)) < 5:
                continue
            candidates.append((score_block(chunk, tema), chunk))
    if not candidates:
        return ""
    return max(candidates, key=lambda x: x[0])[1]


def split_by_markers(raw: str) -> dict[int, str]:
    pattern = re.compile(r"(?i)quest[aã\uFFFD]o\s*0*(\d{1,2})\b")
    matches = list(pattern.finditer(raw))
    by_num: dict[int, list[str]] = {}
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        chunk = raw[m.end() : end]
        chunk = re.sub(r"(?i)^\s*quest[aã\uFFFD]o\s*0*\d{1,2}\s*", "", chunk.strip())
        if re.search(r"(?i)quest[aã\uFFFD]o\s*0*\d{1,2}", chunk[:160]):
            continue
        if len(chunk) < 80:
            continue
        num = int(m.group(1))
        by_num.setdefault(num, []).append(chunk)
    out: dict[int, str] = {}
    for num, chunks in by_num.items():
        best = max(chunks, key=lambda c: len(parse_alternatives(c)))
        if len(parse_alternatives(best)) >= 5:
            out[num] = best
    return out


def anchor_block_1sem_2026(full_text: str, n: int) -> str:
    lower = fold(full_text)
    if n == 10:
        pos = lower.find("pronome eles")
        if pos < 0:
            return ""
        return full_text[max(0, pos - 2400) : pos + 480]
    if n == 33:
        m = re.search(r"correto\s+afirmar\s+que\s+a\s+til", full_text, flags=re.I)
        if not m:
            return ""
        pos = m.start()
        read_start = lower.find("o brasil e o quarto maior produtor")
        if read_start < 0:
            return full_text[max(0, pos - 800) : pos + 680]
        return full_text[read_start : pos + 680]
    if n == 41:
        pos = lower.find("durante a idade media, os mapas")
        if pos < 0:
            return ""
        return full_text[pos : pos + 2400]
    return ""


def special_tema_block(full_text: str, tema: str) -> str:
    focus_fold = fold((tema or "").split(":", 1)[-1])
    lower = fold(full_text)
    if "socioemocion" not in focus_fold and "adaptabilidade" not in focus_fold:
        return ""
    pos = lower.find("muitas vezes, a realizacao de um projeto")
    if pos < 0:
        return ""
    body = full_text[pos : min(len(full_text), pos + 2200)]
    cl = fold(body)
    if "impedir que o individuo" not in cl or len(parse_alternatives(body)) < 5:
        return ""
    intro = full_text[max(0, pos - 2200) : pos]
    m = re.search(
        r"(Estima-se que o trecho.+?Adaptado\.)",
        intro,
        flags=re.I | re.S,
    )
    if m:
        return m.group(1) + "\n\n" + body
    return body


def pick_block(raw: str, marked: dict[int, str], n: int, tema: str) -> str:
    anchored = anchor_block_1sem_2026(raw, n)
    if anchored and len(parse_alternatives(anchored)) >= 5:
        return anchored
    special = special_tema_block(raw, tema)
    if special:
        return special
    if tema:
        located = locate_block(raw, tema)
        if located and len(parse_alternatives(located)) >= 5:
            return located
    marked_block = marked.get(n)
    if marked_block and len(parse_alternatives(marked_block)) >= 5:
        if not tema or block_matches_tema(marked_block, tema):
            return marked_block
    return locate_block(raw, tema) or marked_block or ""


def load_csv_hints() -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    if not CSV_PATH.is_file():
        return out
    with CSV_PATH.open(encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    current_prova = "prova 2026 1 sem"
    for row in rows:
        if len(row) < 4:
            continue
        prova_cell = (row[3] or "").strip()
        if re.search(r"prova\s+\d+", prova_cell, re.I):
            current_prova = prova_cell
        code = (row[0] or "").strip()
        if not code or code == "Código BNCC relacionado" or code.startswith("-"):
            continue
        tema = (row[1] or "").strip()
        questao = (row[2] or "").strip()
        if not questao.isdigit():
            continue
        out.setdefault(current_prova, {})[questao] = tema
    return out


def build_prova(prova_key: str, pdf_path: Path, hints: dict[str, str], meta: dict) -> dict:
    raw = extract_text(pdf_path)
    marked = split_by_markers(raw)
    letters = GABARITO.get(prova_key, [])
    questions = {}
    for n in range(1, 51):
        tema = hints.get(str(n), "")
        block = pick_block(raw, marked, n, tema)
        answers = parse_alternatives(block) if block else []
        reading, enunciado = split_reading_enunciado(block) if block else ("", "")
        fallback = (
            f"Consulte a questão {n} no caderno oficial do Vestibulinho ({prova_key}). "
            f"Tema da Missão ETEC: {tema or '—'}."
        )
        if len(answers) < 5:
            answers = [f"(Alternativa {L} — ver caderno oficial)" for L in "ABCDE"]
            enunciado = fallback
            reading = ""
        elif not enunciado or len(enunciado) < 12:
            enunciado = fallback
        letter = letters[n - 1] if n - 1 < len(letters) else "A"
        questions[str(n)] = {
            "tema": tema,
            "reading": reading,
            "enunciado": enunciado,
            "stem": enunciado,
            "answers": answers[:5],
            "correct": LETTER_INDEX.get(letter, 0),
            "gabarito": letter,
            "cadernoUrl": meta["caderno"],
            "gabaritoUrl": meta["gabarito"],
        }
    return {
        "prova": prova_key,
        "source": pdf_path.name,
        "cadernoUrl": meta["caderno"],
        "gabaritoUrl": meta["gabarito"],
        "questions": questions,
    }


def main() -> None:
    import urllib.request

    cache = DATA / "cache"
    cache.mkdir(parents=True, exist_ok=True)
    hints = load_csv_hints()
    bank = {}
    for key, meta in PROVA_SOURCES.items():
        path = cache / meta["file"]
        urllib.request.urlretrieve(meta["caderno"], path)
        bank[key] = build_prova(key, path, hints.get(key, {}), meta)
        ok = sum(
            1
            for q in bank[key]["questions"].values()
            if not q["answers"][0].startswith("(Alternativa")
        )
        print(f"{key}: {ok}/50 parsed")

    out = DATA / "etec-provas.json"
    out.write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
