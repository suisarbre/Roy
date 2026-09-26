import type { NpcId } from '../../game/types';
import type { ThreadEvent } from '../threads/board';

/**
 * 실타래 충돌 감지 — 설계 문서의 "NPC도 각자 살아가고, 그들의 삶이 Roy와 충돌하는 곳에서
 * 드라마가 나오게" 항목. NPC의 독립된 삶(catchUpNpc가 만들어내는 이벤트)에서 눈에 띄는 일이
 * 생겼을 때, 그게 Roy의 세계와 부딪히는 순간을 골라낸다 — "감지"까지만이 4단계 범위이고,
 * 그걸 실제로 장면화할지/어떻게 엮을지는 5~7단계(현저성/스토리텔러) 몫이다.
 *
 * close/foreground로 승격된 NPC는 이미 "Roy가 신경 쓰는 사람"이라는 뜻이라, 그 사람 보드에서
 * 난 사건 자체가 원칙적으로 다 후보다 — 여기선 현저성 문턱으로만 1차 필터링한다. 거기에
 * 더해, 같은 달 Roy 쪽에도 현저한 사건이 있었으면 "타이밍이 겹쳤다"는 신호를 같이 붙인다
 * (예: Roy가 재판을 앞둔 달에 배우자가 해고당함 — 둘 다 필요로 하는 게 Roy의 한정된 관심).
 */
export const COLLISION_SALIENCE_THRESHOLD = 0.5;

export interface NpcCollisionCandidate {
  npcId: NpcId;
  npcEvent: ThreadEvent;
  /** 같은 달 Roy 쪽에서도 현저한 사건이 있었으면 그 이벤트 — 없으면 undefined(그래도
   *  후보이긴 하다: NPC 혼자만의 사건도 "Roy가 신경 쓰는 사람에게 일어난 큰 일"이라 여전히
   *  장면화 후보). */
  collidesWithRoyEvent?: ThreadEvent;
}

export function detectNpcCollisions(
  npcId: NpcId,
  npcEvents: readonly ThreadEvent[],
  royEvents: readonly ThreadEvent[],
  threshold = COLLISION_SALIENCE_THRESHOLD,
): NpcCollisionCandidate[] {
  const salientRoyEvent = royEvents.find((event) => event.salience >= threshold);
  return npcEvents
    .filter((event) => event.salience >= threshold)
    .map((npcEvent) => ({ npcId, npcEvent, collidesWithRoyEvent: salientRoyEvent }));
}
