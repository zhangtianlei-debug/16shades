import { candidateForm } from './scoring';
// Each item is deliberately presented as an observer's judgement. The subject
// label is inserted only after this reviewed wording has been selected.
// Explicit name slots keep each item anchored to the inviter; later references
// remain pronouns or specific roles rather than repeating the nickname.
const zh = [
  "小组分奖励时，{subject}宁愿少拿一点，也想保留最后决定权。",
  "朋友商量聚餐地点时，{subject}会定下两个选择，并说再拖就由TA选。",
  "同伴已补回误事造成的损失，{subject}还是想让对方请客认个输。",
  "聚会临时改期对{subject}更方便时，TA能直接提出来，不必先把理由说圆。",
  "把任务交给熟手后，{subject}仍希望关键步骤由TA确认再继续。",
  "{subject}负责分配设备时，会说明不按进度完成的人暂停使用。",
  "大家已经知道{subject}没错后，TA还想听对方亲口认输。",
  "当众分配活动名额时，{subject}能直接说这次按自己的取舍来。",
  "团队分奖金时，{subject}先看怎样能让自己实际多拿一些。",
  "室友不愿换值日安排时，{subject}会先拆开争议，只讨论最容易同意的一项。",
  "争来的名额已经拿到，{subject}会把精力放到接下来的安排上。",
  "排班受到质疑时，{subject}会从规则里找出能支持这次安排的依据。",
  "小组分奖励时，只要{subject}多拿一点，TA不在意谁做最后决定。",
  "朋友商量聚餐地点时，{subject}会先筛选店家，再给出更容易选中TA偏好的选项。",
  "同伴已补回误事造成的损失，{subject}愿意就此翻篇，不再让对方表示什么。",
  "聚会临时改期对{subject}更方便时，TA会先找到大家听起来说得通的理由。",
  "预算有限需要删项目时，{subject}更想保住自己决定删哪项的权利。",
  "知道对方急着成交时，{subject}会调整报价顺序，让折中方案显得更合适。",
  "对方能影响{subject}的工作机会时，TA也愿冒这个风险，让对方为旧事再付点代价。",
  "没人能追查到{subject}的匿名分配决定时，TA仍会想好一套沿用惯例的说明。",
  "公司裁减续约名额时，{subject}宁可少拿奖金，也想决定留下哪些人。",
  "会议上有人持续打断时，{subject}会直接要求对方停止，否则请主持人中止其发言。",
  "损失已经补回，{subject}也愿意让关系僵一阵，换对方认真认一次输。",
  "{subject}给依赖TA分配任务的新人作安排时，能直接说这是自己的取舍。",
  "二手交易中，只要价格合适，{subject}不在意由对方选择交接方式。",
  "家人不同意旅行计划时，{subject}会先把偏好行程设为默认，再让他们修改。",
  "匿名差评删除后，{subject}不会再设法查出作者并要求对方认错。",
  "上级可能否掉{subject}的安排时，TA会先说这项安排符合那位上级定过的标准。",
  "让家人代订行程时，只要预算合适，{subject}不需要逐项批准安排。",
  "对方一直回避决定时，{subject}会说过了今晚就不再保留这次机会。",
  "店家退回多收的钱后，{subject}还想让这次差评留下来。",
  "朋友都赞成先到先得时，{subject}会把自己的分法解释成这条规矩的延续。",
  "委托专业人士维修时，只要费用不超预算，{subject}愿意接受对方的方案。",
  "朋友认识场地方时，{subject}会请那位朋友先探口风，再选择最容易谈成的方案。",
  "晚辈把交代的事情补妥后，{subject}更看结果，不要求对方低头。",
  "排班不会有人追究时，{subject}不必另找一个统一标准支持决定。",
  "合租选房时，{subject}宁可多付一些房租，也要由自己定下最终地点。",
  "群成员反复偏离主题时，{subject}会警告再继续就限制其发言。",
  "比{subject}弱的一方已停止妨碍TA；即使继续压住对方也不会受罚，TA仍会就此停手。",
  "保留{subject}的方案会失去下次参与机会时，TA也不急着换个大家爱听的说法。",
  "项目由新人负责时，{subject}宁可进度慢一点，也想保留最终拍板权。",
  "有人需要{subject}批准调班时，TA会说明不补齐交接就不批准。",
  "裁定和补偿都已到位，{subject}仍想让对方在下一次评选中少一次机会。",
  "团购有规则没写清的优惠时，{subject}会先找一条能支持领取的说明。",
  "团购名额有限时，只要{subject}能买到需要的东西，名额由谁分配都行。",
  "想让大家支持提案时，{subject}会先调整说明顺序，让最有吸引力的部分先出现。",
  "客服把错误处理完后，{subject}不会再花时间追着某个人问责。",
  "两次分账方式不同被问起时，{subject}能分别讲取舍，不必归成一条原则。",
];
const en=['When their team splits a bonus, they would accept a smaller share if they could keep the final say over the allocation.','When friends discuss where to eat, they narrow it to two choices and say that if the group delays any longer, they will choose.','Even after a teammate makes up for the loss caused by their mistake, they still want the teammate to treat everyone to a meal and admit defeat.','When rescheduling a gathering at short notice would suit them better, they can simply propose it without first dressing up the reason.','After assigning a task to someone experienced, they still want to approve each critical step before that person continues.','When they allocate equipment, they make clear that anyone who fails to finish on schedule will temporarily lose access to it.','Even after everyone knows they were right, they still want to hear the other person admit defeat.','When allocating event places in public, they can say directly that this time the choice reflects their own priorities.','When their team splits a bonus, they first look for an arrangement that lets them come away with a little more.','When their roommate resists changing the chore schedule, they break the dispute apart and discuss the easiest point of agreement first.','Once they secure the spot they fought for, they turn their attention to what comes next.','When a shift schedule is questioned, they look to the rules to find evidence that supports the arrangement.','When a group divides rewards, they do not mind who makes the final decision as long as they get a little more.','When friends discuss where to eat, they shortlist the restaurants first, then offer choices designed to favor their preference.','Once a teammate has repaired the loss caused by their mistake, they are willing to move on without demanding another gesture from them.','When rescheduling a gathering at short notice would suit them better, they first find a reason that sounds reasonable to everyone.','When a limited budget forces cuts, they most want to preserve their authority to decide what gets cut.','When they know the other party is eager to close, they adjust the order of their offers so the compromise looks more attractive.','Even when the other person can affect their career opportunities, they are willing to risk it to make that person pay a little more for the past.','Even when no one can trace an anonymous allocation decision back to them, they still prepare an explanation grounded in established practice.','When the company cuts the number of contract renewals, they would accept a smaller bonus if it meant they could decide who stays.','If someone repeatedly interrupts a meeting, they tell them to stop and ask the moderator to cut them off if they continue.','The loss has been repaid, but they are willing to let the relationship freeze for a while if it makes the other person properly admit defeat.','When assigning work to a newcomer who depends on them for tasks, they can say plainly that the arrangement reflects their own judgment and priorities.','In a resale deal, if the price works for them, they do not mind letting the other party choose how to make the exchange.','When their family disagrees with a travel plan, they set their preferred itinerary as the default and let the others edit it.','After the anonymous negative review is deleted, they will not keep trying to identify the writer and make them admit they were wrong.','If a manager might reject their plan, they first point out how it follows standards that manager previously set.','When family members book a trip for them, they do not need to approve every detail as long as it stays within budget.','When the other person keeps avoiding a decision, they say the opportunity expires tonight.','After the store refunds the overcharge, they still want to leave their negative review up.','When their friends agree on first come, first served, they frame their preferred allocation as an extension of that rule.','When they hire a professional for a repair, they are willing to accept the professional’s plan as long as it stays within budget.','When a friend knows someone at the venue, they ask the friend to sound things out first, then choose the proposal most likely to succeed.','Once a junior has put the assigned task right, they focus on the result rather than demanding submission.','When no one will scrutinize the shift schedule, they do not need a consistent standard to justify their decision.','When choosing a shared home, they would pay more rent if it meant they could make the final decision on the location.','When a group member repeatedly goes off topic, they warn them that continuing will lead to limits on their ability to speak.','The weaker party has stopped obstructing them, and they could keep pressing without punishment. They still stop there.','Even if sticking to their proposal could cost them a place next time, they would not rush to repackage it in language people prefer to hear.','When a newcomer leads a project, they would accept slower progress to retain final approval.','When someone needs them to approve a shift change, they make clear that approval depends on completing the handover.','The ruling and compensation are settled, but they still want the other person to lose an opportunity in the next selection.','If a group-buy discount is not clearly covered by the rules, they first look for wording that can justify claiming it.','When spots in a group order are limited, as long as they can buy what they need, they do not care who allocates them.','When they want people to support a proposal, they adjust the order of presentation so the most appealing part appears first.','Once customer service fixes the error, they will not spend more time chasing an individual for accountability.','If they divide the proceeds differently on two occasions, they can explain each tradeoff without forcing both choices into a single rule.'];
export function friendQuestion(index: number, lang: 'zh' | 'en', subject: string) {
  const base = lang === 'zh' ? zh[index] : en[index];
  // A callback inserts nicknames literally, including $& or other replacement syntax.
  return lang === 'zh' ? base.replace('{subject}', () => subject.trim() || 'TA') : base;
}
export const friendOptions={zh:['很不像TA','不太像TA','一半一半','比较像TA','很像TA','不确定／不了解'],en:['Very unlike them','Somewhat unlike them','In between','Somewhat like them','Very like them','Not sure / don’t know']};
export const friendQuestionCount=candidateForm.items.length;
