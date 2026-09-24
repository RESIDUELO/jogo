"""Monta o banco de questões do jogo (public/banco/*.json).

Entrada:
  tools/raw/<prova>.json            -> questões extraídas do PDF (extract_unoeste.py)
  tools/annotations/<prova>.txt     -> anotações pedagógicas (categoria, subtema,
                                        dificuldade, explicações, divergências)
  tools/exams.json                  -> metadados das provas

Formato das anotações (um bloco por questão):
  #12 CLI | Hipertensão arterial | 2
  S: explicação curta (aparece logo após responder)
  F: explicação completa (modal "ver explicação completa")
  R: referência (opcional)
  D: nota de divergência -> status "divergente" (opcional)

Categoria: GO, CLI, CIR, PRE, PED. Dificuldade: 1 fácil, 2 média, 3 difícil, 4 muito difícil.
Uso: python3 tools/build_bank.py
"""
import json
import os
import re
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "tools", "raw")
ANN = os.path.join(ROOT, "tools", "annotations")
OUT = os.path.join(ROOT, "public", "banco")
CATS = {"GO", "CLI", "CIR", "PRE", "PED"}


def parse_annotations(path):
    ann = {}
    if not os.path.exists(path):
        return ann
    cur = None
    key = None
    for line in open(path, encoding="utf-8"):
        line = line.rstrip("\n")
        m = re.match(r"^#(\d+)\s+(\w+)\s*\|\s*(.*?)\s*\|\s*([1-4])\s*$", line)
        if m:
            n = int(m.group(1))
            cat = m.group(2).upper()
            assert cat in CATS, f"{path}: categoria inválida em #{n}: {cat}"
            cur = ann[n] = {"category": cat, "subtopic": m.group(3), "difficulty": int(m.group(4))}
            key = None
            continue
        m = re.match(r"^([SFRD]):\s?(.*)$", line)
        if m and cur is not None:
            key = {"S": "explanation", "F": "explanationFull", "R": "reference", "D": "divergence"}[m.group(1)]
            cur[key] = m.group(2).strip()
            continue
        if line.strip() and cur is not None and key:
            cur[key] += "\n" + line.strip()  # continuação
    return ann


def range_category(meta, n):
    for r in meta.get("ranges", []):
        if r["from"] <= n <= r["to"]:
            return r["cat"]
    return "CLI"


def main():
    exams = json.load(open(os.path.join(ROOT, "tools", "exams.json"), encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    index = {"version": 1, "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "exams": []}
    report = []
    for meta in exams:
        raw = json.load(open(os.path.join(RAW, meta["raw"]), encoding="utf-8"))
        ann = parse_annotations(os.path.join(ANN, meta["id"].lower() + ".txt"))
        qs = []
        for r in raw:
            n = r["number"]
            a = ann.get(n, {})
            status = "ativa"
            note = None
            if r["annulled"]:
                status = "anulada"
                note = "Questão ANULADA no gabarito oficial da prova. Não aparece em partidas normais."
            elif a.get("divergence"):
                status = "divergente"
                note = a["divergence"]
            if not r["answer"] and not r["annulled"]:
                status = "rascunho"
            expl = a.get("explanation") or ("Gabarito oficial da prova. Explicação ainda não cadastrada." if r["answer"] else "Questão anulada pela banca.")
            q = {
                "id": f"{meta['id']}-{n:03d}",
                "number": n,
                "text": r["stem"],
                "alternatives": r["alternatives"],
                "answer": r["answer"],
                "category": a.get("category", range_category(meta, n)),
                # sem anotação: subtema/dificuldade são estimados no app (engine/classify.ts)
                "subtopic": a.get("subtopic", "Geral"),
                "difficulty": a.get("difficulty", 2),
                "difficultySource": "manual" if a else "auto",
                "examId": meta["id"],
                "exam": meta["title"],
                "institution": meta["institution"],
                "year": meta["year"],
                "explanation": expl,
                "explanationSource": "gerada" if a.get("explanation") else None,
                "status": status,
            }
            if a.get("explanationFull"):
                q["explanationFull"] = a["explanationFull"]
            if a.get("reference"):
                q["reference"] = a["reference"]
            if r["images"]:
                q["images"] = r["images"]
            if r.get("original"):
                q["original"] = r["original"]  # recorte da página do PDF (fidelidade)
            if note:
                q["statusNote"] = note
            q = {k: v for k, v in q.items() if v is not None}
            qs.append(q)
        missing = [r["number"] for r in raw if r["number"] not in ann]
        report.append(f"{meta['id']}: {len(qs)} questões, {len(ann)} anotadas" + (f", sem anotação: {missing}" if missing else ""))
        fname = meta["id"].lower() + ".json"
        exam_meta = {k: meta[k] for k in ("id", "title", "institution", "year")}
        exam_meta["source"] = meta.get("source", "")
        with open(os.path.join(OUT, fname), "w", encoding="utf-8") as f:
            json.dump({"exam": exam_meta, "questions": qs}, f, ensure_ascii=False, indent=1)
        index["exams"].append({**exam_meta, "file": fname, "count": len(qs)})
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    print("\n".join(report))


if __name__ == "__main__":
    main()
