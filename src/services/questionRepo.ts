// QUESTIONS — repositório do banco de questões (somente leitura no app).
// O banco é gerado a partir das provas pelo pipeline em tools/ e publicado em
// /public/banco/*.json. Para um backend, basta implementar a mesma interface.
import type { BankIndex, ExamMeta, Question } from '../types';
import { estimateDifficulty, subtopicFor } from '../engine/classify';

export interface QuestionRepository {
  loadAll(): Promise<{ questions: Question[]; exams: ExamMeta[] }>;
}

const BASE = import.meta.env.BASE_URL + 'banco/';

/** Questões ainda sem anotação: estima subtema e dificuldade. */
function autoClassify(q: Question): Question {
  if (q.difficultySource !== 'auto') return q;
  const all = q.text + ' ' + Object.values(q.alternatives).join(' ');
  return {
    ...q,
    subtopic: q.subtopic && q.subtopic !== 'Geral' ? q.subtopic : subtopicFor(all, q.category),
    difficulty: estimateDifficulty(q.text, Object.values(q.alternatives) as string[]),
  };
}

export class StaticQuestionRepository implements QuestionRepository {
  async loadAll() {
    const index: BankIndex = await fetch(BASE + 'index.json').then((r) => r.json());
    const files = await Promise.all(index.exams.map((e) => fetch(BASE + e.file).then((r) => r.json() as Promise<{ questions: Question[] }>)));
    const questions = files.flatMap((f) => f.questions.map(autoClassify));
    return { questions, exams: index.exams };
  }
}

export const questionRepo: QuestionRepository = new StaticQuestionRepository();
