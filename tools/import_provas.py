"""Importa provas em PDF para o banco de questões.

Uso rápido:  python3 tools/import_provas.py        (processa só os PDFs novos de provas/)
             python3 tools/import_provas.py --force (reprocessa todos)
             python3 tools/import_provas.py provas/UEL-2024.pdf  (arquivos específicos)

Nome do arquivo: INSTITUICAO-qualquer-coisa-ANO.pdf  (ex.: FAMERP-R1_Acesso_Direto-2024.pdf).
A instituição é a primeira palavra; o ano, o primeiro 20xx do nome.

Para cada prova gera tools/raw/<instituicao>-<ano>.json com enunciado, alternativas (4 ou 5),
gabarito oficial (X = anulada), imagens das questões (public/banco/img) e o recorte da
página original de cada questão (public/banco/orig). Depois rode tools/build_bank.py.
Requer: pip install pymupdf
"""
import argparse
import glob
import json
import os
import re
import sys
from collections import Counter

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Q_RE = re.compile(r"^(\d{1,3})\s*(?:\)|-|–|\.)\s*(.*)$")
ALT_RE = re.compile(r"^\(?([A-E])\s*(?:\)|-|–|\.)\s*(.*)$")


def exam_key(path):
    base = os.path.basename(path)
    inst = re.split(r"[-_ ]", base)[0].upper()
    year = re.search(r"(20\d\d)", base)
    if not inst or not year:
        raise ValueError(f"Nome de arquivo sem instituição/ano: {base} (use INSTITUICAO-...-ANO.pdf)")
    return inst, int(year.group(1))


def repeated_image_sizes(doc):
    """Logotipos/cabeçalhos aparecem em várias páginas: ignora esses tamanhos."""
    c = Counter()
    for p in doc:
        for b in p.get_text("dict")["blocks"]:
            if b["type"] == 1:
                c[(b.get("width"), b.get("height"))] += 1
    return {s for s, n in c.items() if n >= 3}


def page_items(page, skip):
    items = []
    d = page.get_text("dict", sort=True)
    for b in d["blocks"]:
        if b["type"] == 1:
            if (b.get("width"), b.get("height")) in skip:
                continue
            items.append(("img", b["bbox"][1], b, b["bbox"][3]))
        else:
            for l in b["lines"]:
                t = "".join(s["text"] for s in l["spans"]).strip()
                if t:
                    items.append(("txt", l["bbox"][1], t, l["bbox"][3]))
    items.sort(key=lambda x: x[1])
    return items


def parse_gabarito(text):
    """Gabarito em grade: k números em PA de razão 10 seguidos de k letras (qualquer k)."""
    toks = re.findall(r"\b(\d{1,3}|[A-EX])\b", text)
    ans = {}
    i = 0
    while i < len(toks):
        if toks[i].isdigit():
            j = i + 1
            while j < len(toks) and toks[j].isdigit() and int(toks[j]) == int(toks[j - 1]) + 10:
                j += 1
            k = j - i
            lets = toks[j:j + k]
            if k >= 2 and len(lets) == k and all(not x.isdigit() for x in lets):
                for n, l in zip(toks[i:j], lets):
                    ans[int(n)] = l
                i = j + k
                continue
        i += 1
    if not ans:  # formato em pares: "1-A 2-B" / "1) A"
        for n, l in re.findall(r"\b(\d{1,3})\s*[-–).:]?\s*([A-EX])\b", text):
            ans.setdefault(int(n), l)
    return ans


VOCAB = set()  # palavras inteiras vistas nas provas (para desfazer hifenização)
HYPHEN_PREFIXES = {"pós", "pré", "pró", "recém", "ex", "vice", "teca", "whiff", "sócio", "látero", "médio"}
ENCLITICS = {"se", "lo", "la", "los", "las", "lhe", "lhes", "me", "te", "nos", "o", "a", "os", "as"}


def build_vocab(text):
    for w in re.findall(r"(?<![-\w])([A-Za-zÀ-ÿ]+)(?![-\w])", text):
        VOCAB.add(w.lower())


def dehyphen(a, b):
    """Decide se 'a-' + 'b' (quebra de linha/hifenização do PDF) vira 'ab' ou 'a-b'."""
    m1 = re.search(r"([A-Za-zÀ-ÿ]+)$", a)
    m2 = re.match(r"([A-Za-zÀ-ÿ]+)", b)
    if not m1 or not m2:
        return a + b
    w1, w2 = m1.group(1).lower(), m2.group(1).lower()
    if w2 in ENCLITICS or w1 in HYPHEN_PREFIXES or (w1 in ("anti", "auto", "micro", "super", "sub", "inter") and w2[0] in "h" + w1[-1]):
        return a + "-" + b
    if m2.group(1)[0].isupper():  # siglas/nomes: SARS-CoV, Anti-HBs
        return a + "-" + b
    if (w1 + w2) in VOCAB:
        return a + b
    if w2 in VOCAB and len(w2) > 3:  # "anti-transglutaminase"
        return a + "-" + b
    if w1 in VOCAB and w2 in VOCAB and len(w1) > 3 and len(w2) > 3:
        return a + "-" + b
    return a + b


def join_lines(lines):
    out = ""
    for l in lines:
        if out.endswith("-") and not out.endswith(" -"):
            out = dehyphen(out[:-1], l)
        else:
            out = (out + " " + l) if out else l
    out = re.sub(r"\s+", " ", out).strip()
    # hifenização dentro da linha no PDF ("Labo- ratorialmente", "recém- nascido")
    while True:
        m = re.search(r"([A-Za-zÀ-ÿ])- ([a-zà-ÿ])", out)
        if not m:
            return out
        out = dehyphen(out[: m.start() + 1], out[m.end() - 1:])



def extract(pdf, prefix):
    doc = pymupdf.open(pdf)
    skip = repeated_image_sizes(doc)
    img_dir = os.path.join(ROOT, "public", "banco", "img")
    orig_dir = os.path.join(ROOT, "public", "banco", "orig")
    os.makedirs(img_dir, exist_ok=True)
    os.makedirs(orig_dir, exist_ok=True)
    # gabarito: última página que contém "GABARITO" (normalmente a última)
    gab_page = next((i for i in range(len(doc) - 1, -1, -1) if "GABARITO" in doc[i].get_text().upper()), len(doc) - 1)
    gab = parse_gabarito(doc[gab_page].get_text())
    questions, cur, expect, part, kept = [], None, 1, None, {}
    for pno in range(0, gab_page):
        for kind, y0, obj, y1 in page_items(doc[pno], skip):
            is_start = kind == "txt" and Q_RE.match(obj) and int(Q_RE.match(obj).group(1)) == expect
            if not is_start and cur is not None:
                reg = cur["regions"].setdefault(pno, [y0, y1])
                reg[0], reg[1] = min(reg[0], y0), max(reg[1], y1)
            if kind == "img":
                if cur is None:
                    continue
                r = pymupdf.Rect(obj["bbox"])
                if r.width < 40 or r.height < 30 or any(pymupdf.Rect(o).contains(r) for o in kept.get(pno, [])):
                    continue
                kept.setdefault(pno, []).append(r)
                name = f"{prefix}-q{cur['number']:03d}-{len(cur['images']) + 1}.jpg"
                doc[pno].get_pixmap(clip=r, dpi=130).save(os.path.join(img_dir, name), jpg_quality=78)
                cur["images"].append(name)
                continue
            if is_start:
                m = Q_RE.match(obj)
                cur = {"number": expect, "stem": [m.group(2)] if m.group(2) else [], "alts": {}, "images": [], "regions": {pno: [y0, y1]}}
                questions.append(cur)
                expect += 1
                part = "stem"
                continue
            if cur is None:
                continue
            m = ALT_RE.match(obj)
            nxt = "ABCDE"[len(cur["alts"])] if len(cur["alts"]) < 5 else None
            if m and m.group(1) == nxt and (part != "stem" or cur["stem"]):
                part = nxt
                cur["alts"][nxt] = [m.group(2)]
                continue
            (cur["stem"] if part == "stem" else cur["alts"][part]).append(obj)
    out = []
    for q in questions:
        orig = []
        for k, (pno, (y0, y1)) in enumerate(sorted(q["regions"].items()), 1):
            page = doc[pno]
            clip = pymupdf.Rect(28, max(0, y0 - 4), page.rect.width - 28, min(page.rect.height, y1 + 5))
            name = f"{prefix}-q{q['number']:03d}-{k}.jpg"
            page.get_pixmap(clip=clip, dpi=100, colorspace=pymupdf.csGRAY).save(os.path.join(orig_dir, name), jpg_quality=55)
            orig.append(name)
        a = gab.get(q["number"])
        alts = {k: join_lines(v) for k, v in q["alts"].items()}
        images = list(q["images"])
        alt_images = {}
        empty = [k for k, v in alts.items() if not v.strip()]
        if empty and len(images) >= len(empty):
            # alternativas em forma de imagem (tabelas, gráficos): as últimas imagens são as alternativas
            for k, img in zip(empty, images[-len(empty):]):
                alt_images[k] = img
            images = images[: len(images) - len(empty)]
        item = {
            "number": q["number"],
            "stem": join_lines(q["stem"]),
            "alternatives": alts,
            "answer": None if a in (None, "X") else a,
            "annulled": a == "X",
            "images": images,
            "original": orig,
        }
        if alt_images:
            item["altImages"] = alt_images
        out.append(item)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdfs", nargs="*")
    ap.add_argument("--force", action="store_true", help="reprocessa mesmo se já importada")
    a = ap.parse_args()
    all_pdfs = sorted(glob.glob(os.path.join(ROOT, "provas", "*.pdf")))
    pdfs = a.pdfs or all_pdfs
    raw_dir = os.path.join(ROOT, "tools", "raw")
    os.makedirs(raw_dir, exist_ok=True)
    todo = []
    for pdf in pdfs:
        inst, year = exam_key(pdf)
        raw = os.path.join(raw_dir, f"{inst.lower()}-{year}.json")
        if os.path.exists(raw) and not a.force and not a.pdfs:
            continue
        todo.append((pdf, inst, year, raw))
    if not todo:
        print("Nenhuma prova nova para importar.")
        return
    for pdf in set(all_pdfs) | set(pdfs):  # vocabulário comum (hifenização)
        build_vocab("\n".join(p.get_text() for p in pymupdf.open(pdf)))
    problems = 0
    for pdf, inst, year, raw in todo:
        qs = extract(pdf, f"{inst.lower()}-{year}")
        nalts = Counter(len(q["alternatives"]) for q in qs)
        sem_gab = [q["number"] for q in qs if not q["answer"] and not q["annulled"]]
        seq_ok = [q["number"] for q in qs] == list(range(1, len(qs) + 1))
        print(f"{inst} {year}: {len(qs)} questões | alternativas {dict(nalts)} | anuladas {[q['number'] for q in qs if q['annulled']]}"
              + (f" | SEM GABARITO: {sem_gab}" if sem_gab else "") + ("" if seq_ok else " | NUMERAÇÃO FALHOU"))
        if not qs or sem_gab or len(nalts) > 1:
            problems += 1
        with open(raw, "w", encoding="utf-8") as f:
            json.dump(qs, f, ensure_ascii=False, indent=1)
    if problems:
        print(f"⚠️  {problems} prova(s) com possíveis problemas — confira acima.", file=sys.stderr)


if __name__ == "__main__":
    main()
