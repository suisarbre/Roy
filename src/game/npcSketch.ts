import { careerStatusAt, describeCareerStatus, familyStatusAt, storyOptionsFor } from '../sim/person/careerTrack';
import type { PersonProfile } from '../sim/person/profile';
import { describeTraits } from '../sim/person/temperament';
import type { GameDate, Npc } from './types';

/**
 * 장면 프롬프트에 넣을 인물 한 줄 — "LLM은 카메라": 이 사람이 어떤 사람이고 지금 뭘 하며 사는지는
 * 시뮬레이션이 정하고, LLM은 그걸 일관되게 연기만 한다. 프로필 없는 NPC(옛 저장)는 이름과 관계만.
 */

const SCHOOLING_EN: Record<PersonProfile['schooling'], string> = {
  lessThanHighSchool: 'high-school dropout',
  highSchool: 'high-school graduate',
  someCollege: 'some college',
  bachelorsOrMore: "bachelor's degree",
  masters: "master's degree",
  doctorate: 'PhD',
  professional: 'professional degree',
};

export function describeNpcForScene(npc: Npc, date: GameDate): string {
  const age = date.year - npc.birthYear;
  const head = `${npc.name} (${npc.relationType}, ${age})`;
  const profile = npc.profile;
  if (!profile) return head;
  const parts: string[] = [];
  const traits = describeTraits(profile.traits);
  if (traits.length) parts.push(traits.join('; '));
  const degree = profile.degree === 'law' ? 'law degree' : profile.degree === 'medicine' ? 'medical degree' : SCHOOLING_EN[profile.schooling];
  if (age >= 18) parts.push(degree);
  const storyOptions = storyOptionsFor(npc.relationType);
  const work = describeCareerStatus(careerStatusAt(profile, date, storyOptions));
  if (work) parts.push(work);
  if (npc.relationType !== 'spouse' && age >= 18) {
    const family = familyStatusAt(profile, date, storyOptions);
    const kids = family.children === 0 ? '' : family.children === 1 ? ', one child' : `, ${family.children} children`;
    const status = {
      never: 'never married',
      married: 'married',
      cohabiting: 'living with a partner',
      divorced: 'divorced',
      separated: 'recently split from a live-in partner',
      widowed: 'widowed',
    }[family.maritalStatus];
    parts.push(`${status}${kids}`);
  }
  return parts.length ? `${head}: ${parts.join('. ')}.` : head;
}
