// QUESTIONS — repositório do banco de questões.
// Hoje: banco base em /public/banco/*.json (gerado a partir das provas) +
// edições/adições do admin no IndexedDB. Amanhã: basta implementar a mesma
// interface com Supabase/Firebase/PostgreSQL.
import type { BankIndex, ExamMeta, Question } from '../types';
import { estimateDifficulty, subtopicFor } from '../engine/classify';
import { idb, STORES } from './idb';

export interface QuestionRepository {
  loadAll(): Promise<{ questions: Question[]; exams: ExamMeta[] }>;
  save(q: Question): Promise<void>;
  saveMany(qs: Question[]): Promise<void>;
  remove(id: string): Promise<void>;
  resetToBase(): Promise<void>;
}

const BASE = import.meta.env.BASE_URL + 'banco/';
const DELETED_KEY = 'deleted-ids';

/** Questões do banco base ainda sem anotação: estima subtema e dificuldade (editáveis no Admin). */
function autoClassify(q: Question): Question {
  if (q.difficultySource !== 'auto') return q;
  const all = q.text + ' ' + Object.values(q.alternatives).join(' ');
  return {
    ...q,
    subtopic: q.subtopic && q.subtopic !== 'Geral' ? q.subtopic : subtopicFor(all, q.category),
    difficulty: estimateDifficulty(q.text, Object.values(q.alternatives) as string[]),
  };
}

export class LocalQuestionRepository implements QuestionRepository {
  private baseIds = new Set<string>();

  async loadAll() {
    const index: BankIndex = await fetch(BASE + 'index.json').then((r) => r.json());
    const files = await Promise.all(
      index.exams.map((e) =>
        fetch(BASE + e.file)
          .then((r) => r.json() as Promise<{ questions: Question[] }>)
          .catch(() => ({ questions: [] as Question[] })),
      ),
    );
    const byId = new Map<string, Question>();
    files.forEach((f) => f.questions.forEach((q) => byId.set(q.id, autoClassify(q))));
    this.baseIds = new Set(byId.keys());
    let overrides: Question[] = [];
    let deleted: string[] = [];
    try {
      overrides = await idb.getAll<Question>(STORES.questions);
      deleted = (await idb.get<string[]>(STORES.meta, DELETED_KEY)) ?? [];
    } catch {
      /* IndexedDB indisponível: usa só o banco base */
    }
    overrides.forEach((q) => byId.set(q.id, q));
    deleted.forEach((id) => byId.delete(id));
    const questions = [...byId.values()];
    // provas adicionadas pelo admin (não estão no index.json)
    const exams = [...index.exams];
    const known = new Set(exams.map((e) => e.id));
    for (const q of questions) {
      if (!known.has(q.examId)) {
        known.add(q.examId);
        exams.push({ id: q.examId, title: q.exam, institution: q.institution, year: q.year, file: '', count: 0, source: 'importada' });
      }
    }
    exams.forEach((e) => (e.count = questions.filter((q) => q.examId === e.id).length));
    return { questions, exams };
  }

  async save(q: Question) {
    await idb.put(STORES.questions, { ...q, updatedAt: Date.now() });
    await this.undelete([q.id]);
  }

  async saveMany(qs: Question[]) {
    const now = Date.now();
    await idb.putMany(STORES.questions, qs.map((q) => ({ ...q, updatedAt: now })));
    await this.undelete(qs.map((q) => q.id));
  }

  async remove(id: string) {
    await idb.del(STORES.questions, id);
    if (this.baseIds.has(id)) {
      const deleted = (await idb.get<string[]>(STORES.meta, DELETED_KEY)) ?? [];
      if (!deleted.includes(id)) await idb.put(STORES.meta, [...deleted, id], DELETED_KEY);
    }
  }

  async resetToBase() {
    await idb.clear(STORES.questions);
    await idb.put(STORES.meta, [], DELETED_KEY);
  }

  private async undelete(ids: string[]) {
    const deleted = (await idb.get<string[]>(STORES.meta, DELETED_KEY)) ?? [];
    const next = deleted.filter((d) => !ids.includes(d));
    if (next.length !== deleted.length) await idb.put(STORES.meta, next, DELETED_KEY);
  }
}

export const questionRepo: QuestionRepository = new LocalQuestionRepository();
