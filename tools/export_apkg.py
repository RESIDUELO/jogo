"""Gera baralhos do Anki (.apkg) para download no site: um arquivo para cada pasta
(todos, cada área, cada subtema), com subdecks "Residuelo::Área::Subtema::Baralho".

A estrutura do banco do Anki (tabelas e modelo de nota "Pergunta/Resposta") é copiada
de um dos .apkg de origem, então o arquivo gerado abre em qualquer Anki que abre o original.
"""
import hashlib
import html
import io
import json
import os
import re
import sqlite3
import tempfile
import unicodedata
import zipfile

AREA_NAMES = {"GO": "Ginecologia e Obstetrícia", "CLI": "Clínica Médica", "CIR": "Cirurgia", "PRE": "Medicina Preventiva", "PED": "Pediatria"}
ROOT_DECK = "Residuelo"
STAMP = 1_700_000_000  # datas fixas: o mesmo conteúdo gera o mesmo arquivo
ZIP_DATE = (2024, 1, 1, 0, 0, 0)


def slug(key):
    if not key:
        return "residuelo-todos"
    s = unicodedata.normalize("NFKD", key).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:70].strip("-")
    return f"residuelo-{s}-{hashlib.sha1(key.encode()).hexdigest()[:6]}"


def load_template(apkg_bytes):
    """Estrutura das tabelas + linha da coleção (modelos, opções) de um .apkg real."""
    z = zipfile.ZipFile(io.BytesIO(apkg_bytes))
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp.write(z.read("collection.anki2"))
    try:
        db = sqlite3.connect(tmp.name)
        schema = [r[0] for r in db.execute("select sql from sqlite_master where sql is not null and name not like 'sqlite_%' order by type desc, name")]
        cols = [d[1] for d in db.execute("pragma table_info(col)")]
        row = dict(zip(cols, db.execute("select * from col").fetchone()))
        db.close()
    finally:
        os.unlink(tmp.name)
    models = json.loads(row["models"])
    mid, model = next((k, m) for k, m in models.items() if len(m["flds"]) >= 2)
    decks = json.loads(row["decks"])
    deck_tpl = next((d for k, d in decks.items() if k != "1"), decks["1"])
    return {"schema": schema, "row": row, "mid": int(mid), "model": model, "deck_tpl": deck_tpl, "default": decks["1"]}


def to_html(text):
    return html.escape(text, quote=False).replace("\n", "<br>")


def deck_id(name):
    return 1_000_000_000_000 + int(hashlib.sha1(name.encode()).hexdigest()[:9], 16)


def build_apkg(tpl, cards, images_dir):
    """cards: lista de dicts do deck.json. Retorna os bytes do .apkg."""
    names = {}
    for c in cards:
        names.setdefault(c["id"], "::".join([ROOT_DECK, AREA_NAMES[c["area"]], *c["path"]]))
    # decks (inclui os "pais" de cada subdeck)
    all_decks = set()
    for n in names.values():
        parts = n.split("::")
        for i in range(1, len(parts) + 1):
            all_decks.add("::".join(parts[:i]))
    decks = {"1": tpl["default"]}
    for n in sorted(all_decks):
        d = dict(tpl["deck_tpl"])
        did = deck_id(n)
        d.update({"id": did, "name": n, "mod": STAMP, "usn": -1, "desc": ""})
        decks[str(did)] = d
    model = dict(tpl["model"])
    model.update({"mod": STAMP, "usn": -1, "did": deck_id(ROOT_DECK)})
    row = dict(tpl["row"])
    row.update({"crt": STAMP, "mod": STAMP * 1000, "scm": STAMP * 1000, "ls": 0, "usn": 0, "decks": json.dumps(decks, ensure_ascii=False), "models": json.dumps({str(tpl["mid"]): model}, ensure_ascii=False), "tags": "{}"})

    media, media_map = {}, {}
    fd, path = tempfile.mkstemp(suffix=".anki2")
    os.close(fd)
    try:
        db = sqlite3.connect(path)
        for sql in tpl["schema"]:
            db.execute(sql)
        db.execute(f"insert into col ({','.join(row)}) values ({','.join('?' * len(row))})", list(row.values()))
        nf = len(model["flds"])
        for i, c in enumerate(cards):
            nid = 1_600_000_000_000 + i
            back = to_html(c["back"]) + (("<br><br>" + to_html(c["extra"])) if c.get("extra") else "")
            for img in c.get("images", []):
                p = os.path.join(images_dir, img)
                if os.path.exists(p):
                    if img not in media_map:
                        media_map[img] = str(len(media_map))
                        media[media_map[img]] = open(p, "rb").read()
                    back += f'<br><img src="{img}">'
            flds = [to_html(c["front"]), back] + [""] * (nf - 2)
            sfld = re.sub(r"<[^>]+>", "", flds[0])
            csum = int(hashlib.sha1(sfld.encode()).hexdigest()[:8], 16)
            guid = hashlib.sha1(("residuelo" + c["id"]).encode()).hexdigest()[:10]
            tags = " ".join(c.get("tags", []))
            db.execute(
                "insert into notes (id,guid,mid,mod,usn,tags,flds,sfld,csum,flags,data) values (?,?,?,?,?,?,?,?,?,?,?)",
                (nid, guid, tpl["mid"], STAMP, -1, f" {tags} " if tags else "", "\x1f".join(flds), sfld, csum, 0, ""),
            )
            db.execute(
                "insert into cards (id,nid,did,ord,mod,usn,type,queue,due,ivl,factor,reps,lapses,left,odue,odid,flags,data) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (nid, nid, deck_id(names[c["id"]]), 0, STAMP, -1, 0, 0, i + 1, 0, 0, 0, 0, 0, 0, 0, 0, ""),
            )
        db.commit()
        db.execute("vacuum")
        db.close()
        data = open(path, "rb").read()
    finally:
        os.unlink(path)

    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        def put(name, content):
            z.writestr(zipfile.ZipInfo(name, ZIP_DATE), content, compress_type=zipfile.ZIP_DEFLATED)
        put("collection.anki2", data)
        put("media", json.dumps({v: k for k, v in media_map.items()}))
        for k, v in media.items():
            put(k, v)
    return out.getvalue()


def export_all(tpl, cards, out_dir, images_dir):
    """Um .apkg por pasta da árvore. Retorna {chave_da_pasta: nome_do_arquivo} ('' = todos)."""
    groups = {"": cards}
    for c in cards:
        parts = [c["area"], *c["path"]]
        for i in range(1, len(parts) + 1):
            groups.setdefault("|".join(parts[:i]), []).append(c)
    os.makedirs(out_dir, exist_ok=True)
    index = {}
    for key, group in groups.items():
        name = slug(key) + ".apkg"
        data = build_apkg(tpl, group, images_dir)
        p = os.path.join(out_dir, name)
        if not os.path.exists(p) or open(p, "rb").read() != data:
            with open(p, "wb") as f:
                f.write(data)
        index[key] = name
    for f in os.listdir(out_dir):  # remove arquivos de pastas que não existem mais
        if f not in index.values():
            os.remove(os.path.join(out_dir, f))
    return index
