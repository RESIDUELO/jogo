"""Extrai questões das provas UNOESTE/HRPP (R1 Acesso Direto) em PDF.

Uso:  python3 tools/extract_unoeste.py <pdf...> --out tools/raw
Gera, por prova, um JSON bruto com enunciado, alternativas, gabarito oficial,
status de anulação e imagens (salvas em public/banco/img/).
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
            items.append(("img", b["bbox"][1], b))
        else:
            for l in b["lines"]:
                t = "".join(s["text"] for s in l["spans"]).strip()
                if t:
                    items.append(("txt", l["bbox"][1], t))
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


def join_lines(lines):
    out = ""
    for l in lines:
        if out.endswith("-") and not out.endswith(" -"):
            out = out + l  # hifenização
        else:
            out = (out + " " + l) if out else l
    out = re.sub(r"\s+", " ", out).strip()
    # hifenização de quebra de linha que virou "Labo- ratorialmente"
    return re.sub(r"(\w)- ([a-zà-ú])", r"\1\2", out)


def extract(pdf, img_dir, year):
    doc = pymupdf.open(pdf)
    gab_text = doc[-1].get_text()
    gab = parse_gabarito(gab_text)
    questions = []
    cur = None
    expect = 1
    part = None  # 'stem' | letter
    kept = {}
    for pno in range(1, len(doc) - 1):
        for kind, _, obj in page_items(doc[pno]):
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
                cur = {"number": expect, "stem": [m.group(2)] if m.group(2) else [], "alts": {}, "images": []}
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
        a = gab.get(q["number"])
        out.append({
            "number": q["number"],
            "stem": join_lines(q["stem"]),
            "alternatives": {k: join_lines(v) for k, v in q["alts"].items()},
            "answer": None if a in (None, "X") else a,
            "annulled": a == "X",
            "images": q["images"],
        })
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("pdfs", nargs="+")
    ap.add_argument("--out", default="tools/raw")
    ap.add_argument("--img", default="public/banco/img")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    os.makedirs(a.img, exist_ok=True)
    for pdf in a.pdfs:
        year = int(re.search(r"(20\d\d)", os.path.basename(pdf)).group(1))
        qs = extract(pdf, a.img, year)
        bad = [q["number"] for q in qs if len(q["alternatives"]) != 5]
        print(year, len(qs), "questões; anuladas:", [q["number"] for q in qs if q["annulled"]],
              "; alternativas incompletas:", bad, file=sys.stderr)
        with open(os.path.join(a.out, f"unoeste-{year}.json"), "w") as f:
            json.dump(qs, f, ensure_ascii=False, indent=1)
