import { INPUT_FIXTURES } from './fixtures';
import { interpretInput } from './interpret';
import { computeReadiness } from './readiness';
import type { ThreadOperation } from './types';

/**
 * `npm run sim:input` — fixtures.ts의 상황+입력→기대 연산을 interpretInput에 돌려서
 * 정확도를 잰다. 실제 캐스케이드(interpret.ts)와 픽스처가 둘 다 맞아야 통과하므로,
 * 캐스케이드 로직을 고칠 때마다 이걸 돌려서 회귀를 잡는다. readiness.ts는 별도
 * 픽스처 형식을 만들 만큼 크지 않아서 여기 몇 가지 sanity check로 같이 확인한다.
 */

function operationsEqual(a: ThreadOperation, b: ThreadOperation): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function checkReadiness(): { pass: boolean; failures: string[] } {
  const failures: string[] = [];

  const highMatch = computeReadiness('결혼식 준비', ['결혼식 준비를 착실히 해왔다', '오늘 날씨가 맑다']);
  if (highMatch < 0.3) failures.push(`관련 기억이 있는데 준비도가 너무 낮음: ${highMatch.toFixed(2)}`);

  const noMemory = computeReadiness('결혼식 준비', []);
  if (noMemory !== 0) failures.push(`기억이 아예 없는데 준비도가 0이 아님: ${noMemory}`);

  const irrelevant = computeReadiness('결혼식 준비', ['오늘 저녁 메뉴는 뭘까', '버스가 늦게 왔다']);
  if (irrelevant > highMatch) failures.push(`무관한 기억의 준비도(${irrelevant.toFixed(2)})가 관련 기억(${highMatch.toFixed(2)})보다 높음`);

  return { pass: failures.length === 0, failures };
}

function main(): void {
  let pass = 0;
  const failures: string[] = [];
  const stageCounts: Record<string, number> = {};

  for (const fixture of INPUT_FIXTURES) {
    const result = interpretInput(fixture.input, fixture.context, { askLlmMultipleChoice: fixture.askLlmMultipleChoice });
    stageCounts[result.stage] = (stageCounts[result.stage] ?? 0) + 1;

    if (operationsEqual(result.operation, fixture.expected)) {
      pass += 1;
    } else {
      failures.push(
        `[${fixture.id}] "${fixture.situationLabel}"\n  입력: "${fixture.input}"\n  기대: ${JSON.stringify(fixture.expected)}\n  실제: ${JSON.stringify(result.operation)} (단계: ${result.stage})`,
      );
    }
  }

  const total = INPUT_FIXTURES.length;
  console.log(`입력 해석기 회귀 테스트 — ${pass}/${total} 통과\n`);
  console.log('단계별 도달 횟수:', stageCounts);

  if (failures.length > 0) {
    console.log(`\n실패한 ${failures.length}건:\n`);
    console.log(failures.join('\n\n'));
  }

  const readiness = checkReadiness();
  console.log(`\nreadiness.ts sanity check: ${readiness.pass ? 'PASS' : 'FAIL'}`);
  if (!readiness.pass) console.log(readiness.failures.join('\n'));

  process.exit(failures.length === 0 && readiness.pass ? 0 : 1);
}

main();
