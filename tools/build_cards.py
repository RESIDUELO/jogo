"""Monta o baralho do jogo (public/cards/deck.json) a partir dos flashcards do Anki.

Entrada:
  flashcards/*.apkg  (ou *.colpkg / *.zip com .apkg dentro) -> baralhos exportados do Anki
Saída: public/cards/deck.json (jogo) e public/cards/apkg/*.apkg (downloads por pasta)
  tools/cards-map.json                                      -> em que área/subtema cada baralho aparece

Cada nota vira um cartão: 1º campo = frente (pergunta), 2º = verso (resposta),
3º em diante (se houver) = comentário extra. HTML é limpo; imagens vão para public/cards/img/.
Baralhos com subdecks no formato "CLI::Cardiologia::Arritmias" são mapeados sozinhos.

Uso: python3 tools/build_cards.py
"""
import glob
import hashlib
import html
import io
import json
import os
import re
import sqlite3
import sys
import tempfile
import unicodedata
import zipfile
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from export_apkg import export_all, load_template  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "flashcards")
OUT = os.path.join(ROOT, "public", "cards")
IMG = os.path.join(OUT, "img")
AREAS = {"GO", "CLI", "CIR", "PRE", "PED"}


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[\s_]+", " ", s.lower()).strip()


def load_map():
    rules = []
    for r in json.load(open(os.path.join(ROOT, "tools", "cards-map.json"), encoding="utf-8"))["decks"]:
        assert r["path"][0] in AREAS, f"cards-map.json: área inválida em {r}"
        pat = re.compile(r"(?<![a-z0-9])" + re.escape(norm(r["match"])) + r"(?![a-z0-9])")
        rules.append((pat, r))
    return rules


def clean_html(s, media, used):
    """HTML do Anki -> texto puro (com quebras de linha) + lista de imagens."""
    imgs = []

    def img(m):
        src = html.unescape(m.group(1))
        if src in media:
            name = hashlib.sha1(media[src]).hexdigest()[:12] + os.path.splitext(src)[1].lower()
            used[name] = media[src]
            imgs.append(name)
        return " "

    s = re.sub(r"<img[^>]*src=[\"']([^\"']+)[\"'][^>]*>", img, s, flags=re.I)
    s = re.sub(r"\[sound:[^\]]*\]", "", s)
    s = re.sub(r"<br\s*/?>|</(p|div|li|tr|h\d)>", "\n", s, flags=re.I)
    s = re.sub(r"<li[^>]*>", "• ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", l).strip() for l in s.split("\n")]
    s = "\n".join(lines)
    s = re.sub(r"\n{3,}", "\n\n", s).strip()
    return s, imgs


def read_apkg(data, label):
    """Devolve [(nome_do_deck, campos, tags)] e o dicionário de mídia."""
    z = zipfile.ZipFile(io.BytesIO(data))
    names = z.namelist()
    col = next((n for n in ("collection.anki21", "collection.anki2") if n in names), None)
    if not col:
        print(f"  ! {label}: formato não suportado (exporte no Anki marcando 'compatibilidade com versões antigas')")
        return [], {}
    media = {}
    if "media" in names:
        try:
            for k, v in json.loads(z.read("media") or b"{}").items():
                if k in names:
                    media[v] = z.read(k)
        except ValueError:
            pass
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp.write(z.read(col))
    try:
        db = sqlite3.connect(tmp.name)
        decks = {int(k): v["name"] for k, v in json.loads(db.execute("select decks from col").fetchone()[0]).items()}
        rows = db.execute("select n.flds, n.tags, min(c.did) from notes n join cards c on c.nid = n.id group by n.id order by n.id").fetchall()
        db.close()
    finally:
        os.unlink(tmp.name)
    return [(decks.get(did, "Default"), flds.split("\x1f"), tags.split()) for flds, tags, did in rows], media


def sources():
    for p in sorted(glob.glob(os.path.join(SRC, "**", "*"), recursive=True)):
        ext = os.path.splitext(p)[1].lower()
        if ext in (".apkg", ".colpkg"):
            yield os.path.relpath(p, SRC), open(p, "rb").read()
        elif ext == ".zip":
            z = zipfile.ZipFile(p)
            for n in sorted(z.namelist()):
                if n.lower().endswith((".apkg", ".colpkg")):
                    yield os.path.basename(n), z.read(n)


def place(deck, rules):
    """Nome do deck -> (área, [subtemas...])."""
    parts = [p.strip() for p in deck.split("::") if p.strip()]
    if parts and parts[0].upper() in AREAS and len(parts) > 1:
        return parts[0].upper(), parts[1:]
    leaf = parts[-1] if parts else deck
    key = norm(leaf)
    for pat, r in rules:
        if pat.search(key):
            return r["path"][0], r["path"][1:] + [r.get("label") or tidy(leaf)]
    return None, [tidy(leaf)]


def tidy(name):
    name = re.sub(r"\s+", " ", name).strip().rstrip(".").strip()
    return name[:1].upper() + name[1:]


def main():
    rules = load_map()
    cards, seen, used = [], set(), {}
    report, unmapped = [], []
    template = None
    for label, data in sources():
        if template is None:
            try:
                template = load_template(data)
            except (KeyError, StopIteration, sqlite3.Error):
                pass
        notes, media = read_apkg(data, label)
        per = {}
        for deck, flds, tags in notes:
            if deck == "Default" and len({d for d, _, _ in notes}) > 1:
                continue
            if len(flds) < 2:
                continue
            front, fimg = clean_html(flds[0], media, used)
            back, bimg = clean_html(flds[1], media, used)
            extra = "\n".join(t for t in (clean_html(f, media, used)[0] for f in flds[2:]) if t)
            if not (front or fimg) or not (back or bimg):
                continue
            area, path = place(deck, rules)
            if not area:
                unmapped.append(deck)
                continue
            k = norm(front) + "\x1f" + norm(back)
            if k in seen:
                continue
            seen.add(k)
            c = {"id": "c" + hashlib.sha1(k.encode()).hexdigest()[:10], "front": front, "back": back, "area": area, "path": path}
            if extra:
                c["extra"] = extra
            tags = [t for t in tags if t.lower() not in ("leech", "marked")]
            if tags:
                c["tags"] = tags
            if fimg or bimg:
                c["images"] = fimg + bimg
            cards.append(c)
            per[" › ".join([area] + path)] = per.get(" › ".join([area] + path), 0) + 1
        for p, n in per.items():
            report.append(f"{n:4d}  {p}")
    os.makedirs(IMG, exist_ok=True)
    for name, data in used.items():
        with open(os.path.join(IMG, name), "wb") as f:
            f.write(data)
    cards.sort(key=lambda c: (c["area"], c["path"], c["id"]))
    apkg = export_all(template, cards, os.path.join(OUT, "apkg"), IMG) if template else {}
    out = {"version": 1, "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "cards": cards, "apkg": apkg}
    path = os.path.join(OUT, "deck.json")
    try:  # mantém a data se nada mudou (evita commits vazios no CI)
        old = json.load(open(path, encoding="utf-8"))
        if old.get("cards") == cards and old.get("apkg") == apkg:
            out["generatedAt"] = old.get("generatedAt", out["generatedAt"])
    except (OSError, ValueError):
        pass
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("\n".join(sorted(report)))
    print(f"\n{len(cards)} cartões, {len(used)} imagens, {len(apkg)} baralhos .apkg -> public/cards/")
    if unmapped:
        print("\nBaralhos SEM área (adicione em tools/cards-map.json):")
        for d in sorted(set(unmapped)):
            print("  -", d)
        sys.exit(1)


if __name__ == "__main__":
    main()
