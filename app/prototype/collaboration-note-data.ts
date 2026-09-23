import { readingState, type ReadingState } from './personal-report-model';
import type { AxisKey, CandidateResult } from './scoring';

export type Locale = 'zh' | 'en';
type Pair = { zh: string; en: string };
type Field = { id: 'rush' | 'remind' | 'ahead' | 'conflict'; axis: AxisKey; label: Pair; values: Record<ReadingState, Pair>; chips: Pair[] };
const pair = (zh: string, en: string): Pair => ({ zh, en });

const fields: Field[] = [
  { id: 'rush', axis: 'M', label: pair('我赶时间时容易怎样', 'When I’m rushed, I tend to…'), values: {
    negative: pair('我赶时间时会先安静处理，之后补充说明。', 'When I’m rushed, I tend to work quietly first, then add context.'),
    positive: pair('我赶时间时会直接说我现在有点急，并说明下一步。', 'When I’m rushed, I say plainly that I’m under time pressure and name the next step.'),
    boundary: pair('我赶时间时会先说清当前状态，再确认下一步。', 'When I’m rushed, I state where things stand, then confirm the next step.'),
    unavailable: pair('我赶时间时会先说清当前状态，再确认下一步。', 'When I’m rushed, I state where things stand, then confirm the next step.'),
  }, chips: [pair('我赶时间时会先安静处理，之后补充说明。', 'When I’m rushed, I tend to work quietly first, then add context.'), pair('我赶时间时会把事情拆小后逐项确认。', 'When I’m rushed, I break the work into smaller steps and confirm them one by one.'), pair('我赶时间时会直接说我现在有点急。', 'When I’m rushed, I say plainly that I’m under time pressure.')] },
  { id: 'remind', axis: 'N', label: pair('哪种提醒对我有效', 'What reminders work for me'), values: {
    negative: pair('提前给我一个时间点，会帮助我更好安排。', 'Giving me a time point in advance helps me plan.'),
    positive: pair('请用一句话说清优先级和你需要我决定的事。', 'Please state the priority and the decision you need from me in one clear sentence.'),
    boundary: pair('提前给我时间点，也请说清需要我决定的事。', 'Give me a time point in advance, and say clearly what you need me to decide.'),
    unavailable: pair('提前给我时间点，也请说清需要我决定的事。', 'Give me a time point in advance, and say clearly what you need me to decide.'),
  }, chips: [pair('提前给我一个时间点，会帮助我更好安排。', 'Giving me a time point in advance helps me plan.'), pair('请用一句话说清优先级。', 'Please state the priority in one clear sentence.'), pair('请在关键节点再提醒我一次。', 'Please remind me once more at a key point.')] },
  { id: 'ahead', axis: 'G', label: pair('哪些事最好提前说', 'What is best said in advance'), values: {
    negative: pair('范围、截止时间和资源变化最好提前说。', 'Changes to scope, deadlines, and resources are best said early.'),
    positive: pair('需要我参与决定的地方最好提前说。', 'Places where you need me involved in a decision are best said early.'),
    boundary: pair('范围变化和需要我参与决定的地方最好提前说。', 'Changes in scope and places where you need me involved in a decision are best said early.'),
    unavailable: pair('范围变化和需要我参与决定的地方最好提前说。', 'Changes in scope and places where you need me involved in a decision are best said early.'),
  }, chips: [pair('范围或截止时间有变化时，最好提前说。', 'A change in scope or deadline is best said in advance.'), pair('需要我临时接手的事，最好提前说。', 'Something you need me to take on at short notice is best said in advance.'), pair('需要我做决定的地方，最好提前说。', 'Where you need a decision from me is best said in advance.')] },
  { id: 'conflict', axis: 'H', label: pair('我希望怎样处理分歧', 'How I prefer to handle disagreement'), values: {
    negative: pair('我希望先把具体问题和下一步说清，再回看感受。', 'I prefer to clarify the specific issue and next step first, then return to feelings.'),
    positive: pair('我希望把影响、补救和需要回应的部分都说清。', 'I prefer to name the impact, repair, and the response I need.'),
    boundary: pair('我希望先讲具体问题，再留一点时间想一想。', 'I prefer to start with the specific issue, then leave a little time to think.'),
    unavailable: pair('我希望先讲具体问题，再留一点时间想一想。', 'I prefer to start with the specific issue, then leave a little time to think.'),
  }, chips: [pair('我希望先讲具体问题，再讲感受。', 'I prefer to start with the specific issue, then feelings.'), pair('我希望先留一点时间想一想。', 'I prefer a little time to think first.'), pair('我希望当面或语音把分歧说清楚。', 'I prefer to talk disagreement through in person or by voice.')] },
];

export function collaborationSuggestions(result: CandidateResult, locale: Locale) {
  return fields.map((field) => {
    const state = readingState(result, field.axis);
    return { id: field.id, label: field.label[locale], value: field.values[state][locale], chips: field.chips.map((chip) => chip[locale]) };
  });
}
