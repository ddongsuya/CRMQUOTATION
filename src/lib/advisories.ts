/**
 * 시험설계 어드바이저리(Advisory) — 계획(plan) 기반 자동 경고/안내.
 *
 * 목적: 영업이 시험 패키지를 구성할 때 "가이드라인상 빠지기 쉬운 항목·조건부 규칙"을
 *       자동으로 짚어준다. 근거(별표·조문)가 매우 중요하므로 각 advisory 는
 *       _mfds_design_rules.json / _modality_guidelines.json 의 실제 원문을 basis 로 들고 나온다.
 *       → 규칙을 코드에 박지 않고, 단일 진실원천(지식 JSON)에서 파생한다.
 *
 * 이 레이어는 suggest.ts 의 finder(어떤 시험을 매칭할지)와 분리되어 있다.
 * finder = "무엇을 담을까", advisory = "무엇을 빠뜨렸거나 확인해야 할까".
 */
import type { Plan, Duration } from './store';
import { loadKnowledge, type DesignRule, type ModalityGuideline } from './knowledge';
import { getModalityConfig } from './modality-config';

export type AdvisorySeverity = '필수' | '권장' | '정보';

export type Advisory = {
  id: string;
  severity: AdvisorySeverity;
  message: string;
  /** 근거 — 별표/가이드라인 원문 (왜 이 안내가 나오는지) */
  basis: string;
};

export type ModalityBasis = {
  상위분류: string;
  모달리티: string;
  하위분류: string;
  규제근거: string[];
  필수시험구성: string;
  상태: string;
};

const REPEAT_DURATIONS: Duration[] = ['W4', 'W13', 'W26', 'W39', 'W52'];
const LONG_DURATIONS: Duration[] = ['W13', 'W26', 'W39', 'W52'];

function findRule(rules: DesignRule[], 시험substr: string): DesignRule | undefined {
  return rules.find(r => typeof r.시험 === 'string' && r.시험.includes(시험substr));
}

/** 설계규칙의 한 필드를 "별표X · 시험명 — 원문" 형태의 근거 문자열로 만든다. */
function basisOf(r: DesignRule | undefined, field: keyof DesignRule, fallback = ''): string {
  if (!r) return fallback;
  const txt = String(r[field] ?? '').trim();
  if (!txt) return fallback;
  const head = [r.별표, r.시험].filter(Boolean).join(' · ');
  return head ? `${head} — ${txt}` : txt;
}

function isDrugLike(modality: string): boolean {
  return getModalityConfig(modality).mode === 'drug';
}

/** 한글 입력 정규화 불일치(NFC/NFD)로 매칭이 조용히 실패하는 것을 방지 */
function nfc(s: string): string {
  return typeof s === 'string' ? s.normalize('NFC') : '';
}

/** 선택된 모달리티의 규제근거(법적 근거 + 필수 시험구성)를 지식 JSON 에서 찾아준다. */
export function getModalityBasis(modality: string): ModalityBasis | null {
  if (!modality) return null;
  const key = nfc(modality);
  const { modalities } = loadKnowledge();
  const m: ModalityGuideline | undefined =
    modalities.find(x => nfc(x.모달리티) === key) ??
    modalities.find(x => x.모달리티 && key.includes(nfc(x.모달리티))) ??
    modalities.find(x => nfc(x.상위분류 || '').includes(key));
  if (!m) return null;
  return {
    상위분류: m.상위분류,
    모달리티: m.모달리티,
    하위분류: m.하위분류,
    규제근거: Array.isArray(m.규제근거) ? m.규제근거 : [],
    필수시험구성: m.필수시험구성,
    상태: m.상태,
  };
}

/**
 * 계획(plan)을 검사해 누락·조건부 규칙을 advisory 로 반환.
 * 각 규칙은 데이터(지식 JSON)에서 근거를 끌어온다.
 */
export function buildAdvisories(modality: string, plan: Plan | undefined): Advisory[] {
  if (!modality || !plan) return [];
  const mod = nfc(modality);
  const { designRules } = loadKnowledge();
  const out: Advisory[] = [];

  const durs: Duration[] = Array.isArray(plan.durations) ? plan.durations : [];
  const addons: Record<string, boolean> = plan.addons ?? {};
  const route = nfc(plan.route ?? '');
  const drugLike = isDrugLike(modality);
  const hasRepeat = durs.some(d => REPEAT_DURATIONS.includes(d));
  const hasLong = durs.some(d => LONG_DURATIONS.includes(d));
  // 모달리티 설정이 제공하는 애드온만 점검 대상 (예: 세포치료제는 DRF 개념이 없음)
  const availableAddons = new Set(getModalityConfig(modality).addons.map(a => a.id));

  // 1) 13주 이상 반복인데 DRF 미포함 → 선행 DRF 권장 (별표2 ★규칙)
  //    DRF 가 표준 옵션인 모달리티에서만 (세포치료제 등 DRF 비표준 모달리티는 제외)
  if (drugLike && hasLong && availableAddons.has('drf') && !addons.drf) {
    out.push({
      id: 'drf-missing',
      severity: '권장',
      message: '13주 이상 반복독성시험에는 선행 DRF(용량설정 예비시험)가 필요합니다. 현재 DRF가 포함되지 않았습니다.',
      basis: basisOf(findRule(designRules, '반복투여'), '선후행_조건부'),
    });
  }

  // 2) 반복시험인데 회복군 미포함 → 회복군 권장 (별표2)
  if (drugLike && hasRepeat && availableAddons.has('recovery') && !addons.recovery) {
    out.push({
      id: 'recovery-missing',
      severity: '정보',
      message: '반복투여독성시험에 회복군 추가를 권장합니다 (독성의 가역성·지연독성 평가).',
      basis: basisOf(findRule(designRules, '반복투여'), '선후행_조건부'),
    });
  }

  // 3) 임상경로가 정맥 + 단회 선택 → 단회는 정맥 1경로로 단순화 가능 (별표1 ★규칙)
  if (route === '정맥' && durs.includes('SINGLE')) {
    out.push({
      id: 'iv-single-route',
      severity: '정보',
      message: '임상경로가 정맥이면 단회투여독성시험을 정맥 1경로만으로 수행할 수 있습니다 (그 외 경로 시험 불필요).',
      basis: basisOf(findRule(designRules, '단회투여'), '투여경로'),
    });
  }

  // 4) 유전독성 포함 → in vivo 추가시험·전신노출 증명 조건 안내 (별표4 표준조합)
  if (addons.genotox) {
    out.push({
      id: 'genotox-invivo',
      severity: '정보',
      message: '유전독성은 표준조합상 체내(in vivo) 시험이 포함되어야 하며, in vitro 양성/판정곤란 시 추가 in vivo 시험이 필요합니다. in vivo 음성 결과는 전신노출 증명이 요구됩니다.',
      basis: basisOf(findRule(designRules, '유전독성'), '선후행_조건부'),
    });
  }

  // 5) 세포치료제 종양원성 → 관찰기간 규칙 (성체 26주 / ESC·iPSC 52주, 회사 실무 기준)
  if (mod === '세포치료제' && addons.tumorigenicity) {
    out.push({
      id: 'stemcell-tumor-duration',
      severity: '정보',
      message: '줄기세포치료제 종양원성 관찰기간 — 성체 유래 26주 / ESC·iPSC 유래 52주 (코아스템켐온 실무 기준).',
      basis: basisOf(
        findRule(designRules, '종양원성'),
        '선후행_조건부',
        '줄기세포치료제 종양원성 평가 가이드라인 (첨단바이오 품목허가심사규정 제17조제1항제3호라목)',
      ),
    });
  }

  // 6) 백신 → 가임기 대상이면 생식발생독성(DART) 별도 필요
  if (mod === '백신') {
    out.push({
      id: 'vaccine-dart',
      severity: '정보',
      message: '가임기 여성을 대상으로 하는 백신은 생식발생독성시험(DART)이 별도로 필요합니다.',
      basis: basisOf(
        findRule(designRules, '백신'),
        '선후행_조건부',
        '생물의약품 비임상시험 가이드라인 (식약처 2018) 백신 4.1장',
      ),
    });
  }

  // 7) 장기 투여(52주) 또는 NDA 단계 → 발암성시험 필요 여부 검토 (별표7)
  if (drugLike && (durs.includes('W52') || plan.phase === 'NDA')) {
    out.push({
      id: 'carcinogenicity-review',
      severity: '정보',
      message: '투여기간이 길거나 품목허가(NDA) 단계인 경우 발암성시험(별표7) 필요 여부를 검토하세요.',
      basis: basisOf(findRule(designRules, '발암'), '선후행_조건부'),
    });
  }

  return out;
}
