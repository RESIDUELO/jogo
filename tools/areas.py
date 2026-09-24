"""Detecção automática das áreas (CLI, CIR, GO, PED, PRE) de uma prova.

Provas de residência costumam vir em blocos contíguos por área, em ordem variável.
Cada questão recebe uma pontuação por área (palavras-chave de src/engine/classify.ts)
e uma programação dinâmica escolhe a ordem dos 5 blocos e os limites que melhor explicam
a prova inteira. Se a prova não for em blocos, use as faixas em tools/provas.json.
"""
import itertools
import os
import re
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATS = ["CLI", "CIR", "GO", "PED", "PRE"]


def norm(s):
    return unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode()


def load_rules():
    """Lê as palavras-chave direto do classificador do app (fonte única)."""
    ts = open(os.path.join(ROOT, "src", "engine", "classify.ts"), encoding="utf-8").read()
    rules = []
    for m in re.finditer(r"\{\s*cat:\s*'(\w+)',\s*sub:\s*'([^']+)',\s*kw:\s*\[([^\]]*)\]\s*\}", ts):
        kws = re.findall(r"'([^']*)'", m.group(3))
        rules.append((m.group(1), m.group(2), kws))
    return rules


RULES = load_rules()
EXTRA = {
    "PED": [r"\b(lactente|pre-escolar|escolar|crianca|menino|menina|adolescente|recem-nascido|puericultura|neonat)"],
    "GO": [r"\b(gestante|gestacao|primigesta|secundigesta|puerpera|g\d|gesta|parto|menstrua|colpocitologia|mama|ovario|utero)"],
    "PRE": [r"\b(sus|ubs|unidade basica|vigilancia|notificacao|trabalhador|epidemiolog|estudo|incidencia|prevalencia|ministerio da saude|portaria|nr-?\d)"],
    "CIR": [r"\b(trauma|vitima|ferimento|acidente|cirurgi|operatorio|laparotomia|hernia|apendic|colecist|fratura)"],
    "CLI": [r"\b(emergencia|hipertens|diabet|insuficiencia|pneumonia|renal|cardi|anemia|convuls)"],
}


def scores(text):
    t = " " + norm(text) + " "
    sc = dict.fromkeys(CATS, 0.0)
    for cat, _sub, kws in RULES:
        for k in kws:
            if k in t:
                sc[cat] += 2 if len(k) > 6 else 1
    for cat, pats in EXTRA.items():
        for p in pats:
            sc[cat] += 1.5 * len(re.findall(p, t))
    tot = sum(sc.values()) or 1
    return {c: v / tot for c, v in sc.items()}  # normalizado: cada questão "vota" com peso 1


def subtopic(text, cat):
    t = " " + norm(text) + " "
    best, hits = "Geral", 0
    for c, sub, kws in RULES:
        if c != cat:
            continue
        h = sum(1 for k in kws if k in t)
        if h > hits:
            best, hits = sub, h
    return best


def segment(texts, min_block=6, balance=0.08):
    """Melhor divisão em 5 blocos contíguos (uma área por bloco). Retorna lista de áreas por questão."""
    n = len(texts)
    sc = [scores(t) for t in texts]
    pref = {c: [0.0] for c in CATS}
    for s in sc:
        for c in CATS:
            pref[c].append(pref[c][-1] + s[c])
    seg = lambda c, a, b: pref[c][b] - pref[c][a]  # questões [a, b)
    best = (-1.0, None)
    for order in itertools.permutations(CATS):
        # dp[k][i] = melhor soma usando os k primeiros blocos cobrindo [0, i)
        dp = [[-1e9] * (n + 1) for _ in range(6)]
        back = [[0] * (n + 1) for _ in range(6)]
        dp[0][0] = 0
        for k in range(1, 6):
            for i in range(k * min_block, n + 1):
                for j in range((k - 1) * min_block, i - min_block + 1):
                    # bancas costumam ter blocos de tamanho igual: penaliza desvio de n/5
                    v = dp[k - 1][j] + seg(order[k - 1], j, i) - balance * abs((i - j) - n / 5)
                    if v > dp[k][i]:
                        dp[k][i], back[k][i] = v, j
        if dp[5][n] > best[0]:
            cuts, i = [], n
            for k in range(5, 0, -1):
                j = back[k][i]
                cuts.append((order[k - 1], j, i))
                i = j
            best = (dp[5][n], list(reversed(cuts)))
    out = [None] * n
    for cat, a, b in best[1]:
        for q in range(a, b):
            out[q] = cat
    return out, best[1]


def describe(blocks):
    return "; ".join(f"{a + 1}-{b} {c}" for c, a, b in blocks)
