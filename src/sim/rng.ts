/**
 * 실타래 역학은 절대 Math.random()을 직접 쓰지 않는다 — 3단계(헤드리스 몬테카를로 하네스)가
 * 같은 시드로 같은 인생을 재현할 수 있어야 튜닝/회귀 테스트가 의미 있다. 모든 tick/확률
 * 판정 함수는 이 Rng를 인자로 받는다.
 */
export type Rng = () => number; // [0, 1)

/** mulberry32 — 암호학적 강도는 필요 없고, 빠르고 작고 동일 시드 재현이 보장되면 충분하다. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomIntWithRng(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
