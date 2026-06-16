/**
 * GET /api/review-questions                     — 22개 메타 질문 전체
 * GET /api/review-questions?priority=P0         — 우선순위 필터 (P0/P1/P2)
 * GET /api/review-questions?unanswered=1        — 미답변 질문만
 */
import { NextResponse } from 'next/server';
import {
  loadReviewQuestions,
  getReviewQuestionsByPriority,
  getUnansweredQuestions,
  type QuestionPriority,
} from '@/lib/rules-catalog';

const PRIORITY_MAP: Record<string, QuestionPriority> = {
  P0: '필수 (P0)',
  P1: '중요 (P1)',
  P2: '보통 (P2)',
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const priority = searchParams.get('priority');
  const unanswered = searchParams.get('unanswered') === '1';
  const summaryOnly = searchParams.get('summary') === '1';

  if (summaryOnly) {
    return NextResponse.json({
      metadata: loadReviewQuestions().metadata,
    });
  }

  let questions = unanswered
    ? getUnansweredQuestions()
    : loadReviewQuestions().review_questions;

  if (priority && PRIORITY_MAP[priority]) {
    questions = questions.filter(q => q.priority === PRIORITY_MAP[priority]);
  }

  return NextResponse.json({
    count: questions.length,
    questions,
  });
}
