export { sampleProfile, toWorker, toSpouse, DEFAULT_CAREER_PARAMS, type PersonProfile, type PersonTraits, type SampleProfileOptions } from './profile';
export { temperamentFromTraits, personalityPolicy, patienceFromTraits, describeTraits, domainAffinity, DOMAIN_TRAIT_WEIGHTS } from './temperament';
export { buildLifeStory, type LifeStory, type FamilyEvent, type FamilyEventKind, type LifeStoryOptions } from './lifeStory';
export {
  careerStatusAt,
  careerEventsBetween,
  familyEventsBetween,
  familyStatusAt,
  storyOptionsFor,
  describeFamilyEvent,
  FAMILY_EVENT_SALIENCE,
  type FamilyStatus,
  describeCareerEvent,
  describeCareerStatus,
  CAREER_EVENT_SALIENCE,
  OCCUPATION_LABEL_EN,
  type CareerEvent,
  type CareerStatus,
} from './careerTrack';
