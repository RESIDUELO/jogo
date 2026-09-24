"""Extrai questões das provas UNOESTE/HRPP (R1 Acesso Direto) em PDF.

Uso:  python3 tools/extract_unoeste.py <pdf...> --out tools/raw
Gera, por prova, um JSON bruto com enunciado, alternativas, gabarito oficial,
status de anulação, imagens (public/banco/img/) e um recorte da página
original de cada questão (public/banco/orig/) para conferência fiel.
Requer: pip install pymupdf
"""
import argparse, json, os, re, sys
import pymupdf

SKIP_SIZES = {(211, 73), (1785, 2526), (960, 240)}  # logo, capa, cabeçalho
Q_RE = re.compile(r"^(\d{1,3})\s*(?:\)|-|–)\s*(.*)$")
ALT_RE = re.compile(r"^([A-E])\)\s*(.*)$")


def page_items(page):
    """Linhas de texto e imagens da página, em ordem de leitura."""
    items = []
    d = page.get_text("dict", sort=True)
    for b in d["blocks"]:
        if b["type"] == 1:
            w, h = b.get("width"), b.get("height")
            if (w, h) in SKIP_SIZES:
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
    toks = re.findall(r"\b(\d{1,3}|[A-EX])\b", text)
    ans = {}
    i = 0
    while i < len(toks):
        if toks[i].isdigit() and i + 20 <= len(toks):
            nums = toks[i:i + 10]
            lets = toks[i + 10:i + 20]
            if all(n.isdigit() for n in nums) and all(not l.isdigit() for l in lets):
                n0 = [int(n) for n in nums]
                if all(n0[k] == n0[0] + 10 * k for k in range(10)):
                    for n, l in zip(n0, lets):
                        ans[n] = l
                    i += 20
                    continue
        i += 1
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
    if (w1 + w2) in VOCAB:
        return a + b
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


def extract(pdf, img_dir, year, orig_dir):
    doc = pymupdf.open(pdf)
    gab_text = doc[-1].get_text()
    gab = parse_gabarito(gab_text)
    questions = []
    cur = None
    expect = 1
    part = None  # 'stem' | letter
    kept = {}
    for pno in range(1, len(doc) - 1):
        for kind, y0, obj, y1 in page_items(doc[pno]):
            if kind == "txt" and Q_RE.match(obj) and int(Q_RE.match(obj).group(1)) == expect:
                pass  # início de questão: região registrada abaixo
            elif cur is not None:
                reg = cur["regions"].setdefault(pno, [y0, y1])
                reg[0] = min(reg[0], y0)
                reg[1] = max(reg[1], y1)
            if kind == "img":
                if cur is None:
                    continue
                # renderiza a região da página (lida com JPX, máscaras etc.)
                r = pymupdf.Rect(obj["bbox"])
                if r.width < 40 or r.height < 30:
                    continue
                # moldura + imagem: mantém só o retângulo externo
                if any(pymupdf.Rect(o).contains(r) for o in kept.get(pno, [])):
                    continue
                kept.setdefault(pno, []).append(r)
                k = len(cur["images"]) + 1
                name = f"{year}-q{cur['number']:03d}-{k}.jpg"
                doc[pno].get_pixmap(clip=r, dpi=130).save(os.path.join(img_dir, name), jpg_quality=78)
                cur["images"].append(name)
                continue
            t = obj
            m = Q_RE.match(t)
            if m and int(m.group(1)) == expect:
                cur = {"number": expect, "stem": [m.group(2)] if m.group(2) else [], "alts": {}, "images": [], "regions": {pno: [y0, y1]}}
                questions.append(cur)
                expect += 1
                part = "stem"
                continue
            if cur is None:
                continue
            m = ALT_RE.match(t)
            nxt = "ABCDE"[len(cur["alts"])] if len(cur["alts"]) < 5 else None
            if m and m.group(1) == nxt:
                part = nxt
                cur["alts"][nxt] = [m.group(2)]
                continue
            if part == "stem":
                cur["stem"].append(t)
            else:
                cur["alts"][part].append(t)
    out = []
    for q in questions:
        orig = []
        for k, (pno, (y0, y1)) in enumerate(sorted(q["regions"].items()), 1):
            page = doc[pno]
            clip = pymupdf.Rect(28, max(0, y0 - 4), page.rect.width - 28, min(page.rect.height, y1 + 5))
            name = f"{year}-q{q['number']:03d}-{k}.jpg"
            page.get_pixmap(clip=clip, dpi=100, colorspace=pymupdf.csGRAY).save(os.path.join(orig_dir, name), jpg_quality=55)
            orig.append(name)
        a = gab.get(q["number"])
        out.append({
            "number": q["number"],
            "stem": join_lines(q["stem"]),
            "alternatives": {k: join_lines(v) for k, v in q["alts"].items()},
            "answer": None if a in (None, "X") else a,
            "annulled": a == "X",
            "images": q["images"],
            "original": orig,
        })
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("pdfs", nargs="+")
    ap.add_argument("--out", default="tools/raw")
    ap.add_argument("--img", default="public/banco/img")
    ap.add_argument("--orig", default="public/banco/orig")
    a = ap.parse_args()
    os.makedirs(a.orig, exist_ok=True)
    for pdf in a.pdfs:  # vocabulário comum a todas as provas
        d = pymupdf.open(pdf)
        build_vocab("\n".join(p.get_text() for p in d))
    os.makedirs(a.out, exist_ok=True)
    os.makedirs(a.img, exist_ok=True)
    for pdf in a.pdfs:
        year = int(re.search(r"(20\d\d)", os.path.basename(pdf)).group(1))
        qs = extract(pdf, a.img, year, a.orig)
        bad = [q["number"] for q in qs if len(q["alternatives"]) != 5]
        print(year, len(qs), "questões; anuladas:", [q["number"] for q in qs if q["annulled"]],
              "; alternativas incompletas:", bad, file=sys.stderr)
        with open(os.path.join(a.out, f"unoeste-{year}.json"), "w") as f:
            json.dump(qs, f, ensure_ascii=False, indent=1)
