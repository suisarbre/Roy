import { CALIBRATED_PARAMS, CALIBRATED_WOMEN_PARAMS } from '../marriage/calibratedParams';
import { INITIAL_PARAMS, INITIAL_WOMEN_PARAMS } from '../marriage/params';
import { CALIBRATED_WORLD_MARRIAGE, CALIBRATED_WORLD_PARAMS } from './calibratedParams';
import type { WorldConfig } from './engine';
import { INITIAL_WORLD_PARAMS } from './params';

/** 지금 보정된 세계 설정(세계 + 결혼 + 여성 노동). 모듈 단독 보정·NPC 이야기·CLI가 공유한다. */
export function defaultWorldConfig(): WorldConfig {
  return {
    world: { ...INITIAL_WORLD_PARAMS, ...CALIBRATED_WORLD_PARAMS },
    marriage: { ...INITIAL_PARAMS, ...CALIBRATED_PARAMS, ...CALIBRATED_WORLD_MARRIAGE },
    women: { ...INITIAL_WOMEN_PARAMS, ...CALIBRATED_WOMEN_PARAMS },
  };
}
