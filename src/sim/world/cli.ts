import { CALIBRATED_PARAMS, CALIBRATED_WOMEN_PARAMS } from '../marriage/calibratedParams';
import { INITIAL_PARAMS, INITIAL_WOMEN_PARAMS } from '../marriage/params';
import { sampleProfile } from '../person/profile';
import { CALIBRATED_WORLD_MARRIAGE, CALIBRATED_WORLD_PARAMS } from './calibratedParams';
import { World, type WorldPerson } from './engine';
import { buildWorldTargets, measureWorld, worldLoss } from './moments';
import { INITIAL_WORLD_PARAMS, type JointWorldParams } from './params';

/**
 * `npm run sim:world` — 공유 세계의 표본 외 검증(보정은 seed 1) + 이야기 감사(모순 세기) + 한 사람의 인생.
 */

const params: JointWorldParams = {
  world: { ...INITIAL_WORLD_PARAMS, ...CALIBRATED_WORLD_PARAMS },
  marriage: { ...INITIAL_PARAMS, ...CALIBRATED_PARAMS, ...CALIBRATED_WORLD_MARRIAGE },
  women: { ...INITIAL_WOMEN_PARAMS, ...CALIBRATED_WOMEN_PARAMS },
};
const n = Number(process.argv.find((a) => a.startsWith('--n='))?.split('=')[1] ?? 6000);
const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : 'NaN');
const ym = (t: number) => `${Math.floor(t / 12)}.${String((t % 12) + 1).padStart(2, '0')}`;

function validate(): { world: World; focal: WorldPerson[] } {
  const started = Date.now();
  const { values, world, focal } = measureWorld(params, { n, seed: 2 });
  const targets = buildWorldTargets();
  const tally = { PASS: 0, WARN: 0, FAIL: 0 };
  console.log(`=== 표본 외 검증 — 주인공 ${n}명(seed 2, 보정은 seed 1), ${((Date.now() - started) / 1000).toFixed(0)}초 ===`);
  for (const t of targets) {
    const x = values[t.key];
    const z = Math.abs((x - t.target) / t.tolerance);
    const verdict = !Number.isFinite(z) || z > 2 ? 'FAIL' : z > 1 ? 'WARN' : 'PASS';
    tally[verdict] += 1;
    console.log(`${verdict.padEnd(5)} ${t.label.padEnd(34)} 목표 ${fmt(t.target).padStart(7)}  모델 ${fmt(x).padStart(7)}  (±${t.tolerance})`);
  }
  console.log(`loss=${worldLoss(values, targets).toFixed(2)}  PASS ${tally.PASS} / WARN ${tally.WARN} / FAIL ${tally.FAIL}  · 평균 자녀 여 ${fmt(values.parity_mean)} / 남 ${fmt(values.kids_men)} · 둘 이상 상대와 출산: 어머니 ${fmt(values.mpf_mothers)}, 남 40세 ${fmt(values.mpf_men_by40)}(NSFG 15%, 과소 보고)`);
  console.log(`세계에 실체화된 사람 ${world.persons.size}명, 관계 선 ${world.unions.size}개`);
  return { world, focal };
}

/** 이야기 감사: 한 사람의 인생으로 읽었을 때 말이 안 되는 것들을 센다. */
function audit(world: World, focal: WorldPerson[]): void {
  const counts: Record<string, number> = {
    '16세 전 관계': 0,
    '15세 미만 또는 47세 이상 출산(어머니)': 0,
    '비밀 아닌 열린 관계가 동시에 둘': 0,
    '사망 뒤의 관계 사건': 0,
    '아버지 사망 10개월 뒤 출생': 0,
    '결혼 없이 이혼': 0,
  };
  for (const u of world.unions.values()) {
    const man = world.persons.get(u.manId)!;
    const woman = world.persons.get(u.womanId)!;
    if (u.startedAt - man.birthTotal < 16 * 12 || u.startedAt - woman.birthTotal < 16 * 12) counts['16세 전 관계'] += 1;
    for (const p of [man, woman]) if (p.diedAt !== undefined && u.startedAt > p.diedAt) counts['사망 뒤의 관계 사건'] += 1;
    if (u.endReason === 'divorce' && u.marriedAt === undefined) counts['결혼 없이 이혼'] += 1;
  }
  for (const p of world.persons.values()) {
    if (p.profile.sex === 'female') {
      for (const c of p.children) {
        const age = (c.bornAt - p.birthTotal) / 12;
        if (age < 15 || age >= 47) counts['15세 미만 또는 47세 이상 출산(어머니)'] += 1;
        const union = world.unions.get(c.unionId)!;
        const father = world.persons.get(union.manId)!;
        if (father.diedAt !== undefined && c.bornAt > father.diedAt + 10) counts['아버지 사망 10개월 뒤 출생'] += 1;
      }
    }
  }
  // 동시에 열린 비밀 아닌 관계(매년 1월 기준으로 주인공만).
  for (const p of focal) {
    for (let t = p.birthTotal + 16 * 12; t < p.birthTotal + 58 * 12; t += 12) {
      let open = 0;
      for (const id of p.unionIds) {
        const u = world.unions.get(id)!;
        if (u.startedAt <= t && (u.endedAt === undefined || u.endedAt > t) && !(u.secret || u.cheaterId !== undefined)) open += 1;
      }
      if (open > 1) {
        counts['비밀 아닌 열린 관계가 동시에 둘'] += 1;
        break;
      }
    }
  }
  console.log(`\n=== 이야기 감사(주인공 ${focal.length}명 + 실체화된 상대들) ===`);
  for (const [k, v] of Object.entries(counts)) console.log(`  ${v === 0 ? '✓' : '✗'} ${k}: ${v}`);
}

/** 한 사람(1962년생 LA 남성)의 인생을 세계에서. */
function story(seed: number): void {
  const world = new World(params, 1962 * 12 + 16 * 12);
  const roy = world.addPerson(sampleProfile(seed, { sex: 'male', birthYear: 1962, losAngeles: true }), true);
  world.runUntil(1962 * 12 + 70 * 12);
  const lines: [number, string][] = [];
  const name = (p: WorldPerson) => `${p.profile.sex === 'female' ? '여' : '남'}(${Math.floor(p.birthTotal / 12)}년생, ${p.profile.education})`;
  for (const id of roy.unionIds) {
    const u = world.unions.get(id)!;
    const other = world.persons.get(u.manId === roy.id ? u.womanId : u.manId)!;
    const tag = u.cheaterId === roy.id ? '외도 상대 ' : u.cheaterId !== undefined ? '(상대의 외도) ' : '';
    lines.push([u.startedAt, `${tag}${name(other)}을/를 만남 — ${u.channel === 'work' ? '직장' : u.channel === 'friends' ? '친구 소개' : u.channel === 'school' ? '학교' : '그 밖'}`]);
    if (u.cohabitedAt !== undefined && u.cohabitedAt !== u.marriedAt) lines.push([u.cohabitedAt, '동거 시작']);
    if (u.marriedAt !== undefined) lines.push([u.marriedAt, '결혼']);
    if (u.endedAt !== undefined) lines.push([u.endedAt, { breakup: '헤어짐', divorce: '이혼', widowed: '사별', discovered: '외도가 들켜 끝남' }[u.endReason!]]);
  }
  for (const c of roy.children) lines.push([c.bornAt, `아이가 태어남(${c.marital ? '결혼 중' : c.cohabiting ? '동거 중' : '결혼 밖'})`]);
  if (roy.diedAt !== undefined) lines.push([roy.diedAt, '사망']);
  if (roy.cheatedWhileMarried) lines.push([roy.birthTotal + 70 * 12, '(결혼 중 외도 경험 있음)']);
  lines.sort((a, b) => a[0] - b[0]);
  console.log(`\n--- 1962년생 LA 남성, 시드 ${seed} (${roy.profile.education}) ---`);
  for (const [t, s] of lines) console.log(`  ${ym(t)} (${Math.floor((t - roy.birthTotal) / 12)}세) ${s}`);
}

const { world, focal } = validate();
audit(world, focal);
for (const seed of [11, 12, 13]) story(seed);
