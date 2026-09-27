import type { Rng } from './rng';

/** 표준정규 난수(Box–Muller). */
export function gaussian(rng: Rng): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** 두 정수를 섞는 해시(splitmix32식) — 달마다 난수열을 새로 시작하는 데 쓴다(공통 난수 강화). */
export function mixSeed(a: number, b: number): number {
  let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
