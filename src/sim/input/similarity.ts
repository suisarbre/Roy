/**
 * 진짜 임베딩(설계 문서: transformers.js)이 들어갈 자리를 대신하는 값싼 근사. 의미가 아니라
 * 표면 형태(어절 겹침, 문자 n-그램)만 잡아내지만, "임베딩 단계"를 실제로 채워서 캐스케이드
 * (interpret.ts)와 준비도(readiness.ts)를 지금 당장 돌리고 회귀 테스트할 수 있게 하는 게
 * 목적이다. transformers.js로 교체할 때 아래 두 함수의 시그니처(text, text) => number(0~1)만
 * 유지하면 interpret.ts/readiness.ts는 손댈 필요 없다 — 그게 이 파일 하나로 분리해둔 이유.
 */

export function tokenize(text: string): string[] {
  return text.split(/[\s,.!?~"'()]+/).filter(Boolean);
}

/**
 * 어절 겹침 개수 — regex 단계의 "이 실타래를 말하는 게 확실한가" 판정에 쓴다. 정확히 같은
 * 어절이 아니라 서로 포함 관계(한쪽이 다른 쪽의 부분 문자열)면 겹친 걸로 친다 — 한국어는
 * 조사/어미가 명사에 그대로 붙으므로("신용카드값을", "공장일을") 정확히 일치해야만
 * 잡으면 거의 매번 실패한다. 2글자 미만 토큰은 무시한다 — 조사/어미 자체가 한두 글자라
 * 그대로 두면 아무 명사에나 우연히 겹쳐서 오탐이 난다.
 */
export function tokenOverlapCount(a: string, b: string): number {
  const tokensA = tokenize(a).filter((token) => token.length >= 2);
  const tokensB = tokenize(b).filter((token) => token.length >= 2);
  let count = 0;
  for (const tb of tokensB) {
    if (tokensA.some((ta) => ta.includes(tb) || tb.includes(ta))) count += 1;
  }
  return count;
}

function trigrams(text: string): Set<string> {
  const normalized = text.replace(/\s+/g, '');
  const grams = new Set<string>();
  if (normalized.length < 3) {
    if (normalized.length > 0) grams.add(normalized);
    return grams;
  }
  for (let i = 0; i <= normalized.length - 3; i++) grams.add(normalized.slice(i, i + 3));
  return grams;
}

/** 문자 3-그램 자카드 유사도(0~1) — regex보다 느슨하게(오타·일부 음절 변형) 잡아내는
 *  "임베딩 단계" 대역. */
export function trigramSimilarity(a: string, b: string): number {
  const gramsA = trigrams(a);
  const gramsB = trigrams(b);
  if (gramsA.size === 0 || gramsB.size === 0) return 0;

  let intersection = 0;
  for (const gram of gramsA) if (gramsB.has(gram)) intersection += 1;
  const union = gramsA.size + gramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 문장 전체가 아니라 어절 단위로 최고 유사도를 찾는다 — 긴 문장 대 짧은 라벨을 통째로
 * 비교하면(trigramSimilarity(문장, 라벨)) 나머지 단어들이 희석시켜서 핵심 단어 하나가
 * 겹쳐도 전체 유사도가 낮게 나온다. 캐스케이드(interpret.ts)의 임베딩 단계는 이 함수를
 * 쓴다 — "이 문장 안의 어떤 단어가 라벨과 가장 비슷한가"가 실제로 물어야 할 질문이다.
 */
export function bestTokenSimilarity(text: string, label: string): number {
  const textTokens = tokenize(text).filter((token) => token.length >= 2);
  const labelTokens = tokenize(label).filter((token) => token.length >= 2);
  let best = 0;
  for (const t of textTokens) {
    for (const l of labelTokens) {
      best = Math.max(best, trigramSimilarity(t, l));
    }
  }
  return best;
}
