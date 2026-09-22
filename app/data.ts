export const questions = [
  '合作方案各有利弊时，我通常会很快注意到自己的时间、资源或机会是否划算。',
  '我很想推动一个方案时，通常会先调整沟通顺序和呈现方式，让别人更容易理解和接受。',
  '分歧中的实际问题解决、需要的补救完成后，我通常愿意把这件事翻篇。',
  '做一个可能影响他人的决定前，我会想清楚它能否用一套一致、公平的理由说明。',
  '即使结果对我不错，如果自己几乎没有参与决定，我仍会明显不舒服。',
  '意见不一致时，我更愿意尽早把自己的需求、底线和不能接受的情况直接说清楚。',
  '如果有人明显越过我的边界，即使已经补救，我仍希望对方明确承认并承担相应责任。',
  '只要我愿意承担结果，旁人是否赞同通常不会左右我的决定。',
  '在做主权和实际便利不能兼得时，我通常更愿意让别人做主，换取更合适的实际结果。',
  '需要改变别人看法时，我更习惯先了解对方在意什么，再选择合适的切入点，而不是当场硬碰硬。',
  '处理冲突时，我更看重问题是否停止、损失是否得到修复，而不是最后谁输谁赢。',
  '即使决定已经不会改变，我仍希望把理由和标准讲清楚，让它经得起公开说明。',
  '在共同任务里，即使需要多花一点时间，我也会因为自己掌握关键决定而更安心。',
  '讨论长时间没有进展时，我会提出明确选项和截止点，推动大家作出决定。',
  '即使确认问题已经解决、以后也不会再发生，我仍会在意这次越界是否留下了明确后果，而不是像没发生过一样。',
  '当通行做法与具体情况冲突时，我更愿意按自己的判断行动，而不是先找到一套大家都接受的说法。',
];

export const options = [
  { value: 1, label: '非常不符合' },
  { value: 2, label: '比较不符合' },
  { value: 3, label: '看情况／没有明显倾向／不适用' },
  { value: 4, label: '比较符合' },
  { value: 5, label: '非常符合' },
];

export type AxisLetter = '利' | '权' | '谋' | '压' | '用' | '惩' | '饰' | '蔑';

export type Character = {
  id: string;
  slug: string;
  image: string;
  name: string;
  family: string;
  structure: string;
  quote: string;
  description: string;
};

export const characters: Character[] = [
  { id: 'T01', slug: 't01', image: '/characters/t01.jpg', name: '掮客', family: '利谋·猎手系', structure: '利谋用饰', quote: '别谈感情，谈感情得加价。', description: '他把人情当通道，把通道变成收益。合作总是体面，分配却未必对等。' },
  { id: 'T02', slug: 't02', image: '/characters/t02.jpg', name: '投机客', family: '利谋·猎手系', structure: '利谋用蔑', quote: '规则没写不行，那就是我的入口。', description: '他不研究规则为什么存在，只研究哪里没堵上。好处先拿到，秩序留给别人维护。' },
  { id: 'T03', slug: 't03', image: '/characters/t03.jpg', name: '笑面客', family: '利谋·猎手系', structure: '利谋惩饰', quote: '我当然不记仇，我只记得特别清楚。', description: '面上维持友好，心里另开一本账。冲突过去不代表结束，只是报复换了更体面的包装。' },
  { id: 'T04', slug: 't04', image: '/characters/t04.jpg', name: '追猎者', family: '利谋·猎手系', structure: '利谋惩蔑', quote: '你可以跑，我又没答应停。', description: '他把线索变成猎物，把拒绝变成新目标。收益与报复绑在一起，越界之后仍不肯停。' },
  { id: 'T05', slug: 't05', image: '/characters/t05.jpg', name: '收割者', family: '利压·掠夺系', structure: '利压用饰', quote: '我没少给，只是重算了“该给多少”。', description: '他不必抢，只要握住合同、工资或解释权，就能把选择一点点压窄，直到让步看起来像自愿。' },
  { id: 'T06', slug: 't06', image: '/characters/t06.jpg?v=20260916-slanted-brows', name: '掠夺者', family: '利压·掠夺系', structure: '利压用蔑', quote: '谁先抱走，东西就是谁的。', description: '想要就拿，挡路就推开。伤害服务于占有；东西到手以后，他也懒得再解释。' },
  { id: 'T07', slug: 't07', image: '/characters/t07.jpg', name: '清算者', family: '利压·掠夺系', structure: '利压惩饰', quote: '账结清了，教训还没结清。', description: '他把利益要求写进程序，也把不配合记进清单。规定动作做完，还要多拿一点当作教训。' },
  { id: 'T08', slug: 't08', image: '/characters/t08.jpg', name: '悍客', family: '利压·掠夺系', structure: '利压惩蔑', quote: '钱留下，态度也放低。', description: '利益到手还不够，对方必须服软。损失与羞辱一起发生，公开越界本身就是威慑。' },
  { id: 'T09', slug: 't09', image: '/characters/t09.jpg', name: '操盘手', family: '权谋·操盘系', structure: '权谋用饰', quote: '你们自由选择，我只负责摆好选项。', description: '他不站在台前，却决定舞台怎样转。信息、关系和选项都被设计过，自由选择只是观众视角。' },
  { id: 'T10', slug: 't10', image: '/characters/t10.jpg', name: '煽动家', family: '权谋·操盘系', structure: '权谋用蔑', quote: '我没点火，我只是让风站了队。', description: '先划出“我们”和“他们”，再把情绪推到临界点。他要的不是共识，而是人群朝同一方向移动。' },
  { id: 'T11', slug: 't11', image: '/characters/t11.jpg', name: '权术家', family: '权谋·操盘系', structure: '权谋惩饰', quote: '规则一视同仁，只是我负责解释“一视”。', description: '他喜欢规则，因为规则可以选择性生效。表面讲秩序，暗中用双标奖忠罚逆。' },
  { id: 'T12', slug: 't12', image: '/characters/t12.jpg', name: '教主', family: '权谋·操盘系', structure: '权谋惩蔑', quote: '别急着相信我，先只信我这一次。', description: '他用理解与归属换取忠诚，再把忠诚升级成服从。离开被视作背叛，质疑也要付代价。' },
  { id: 'T13', slug: 't13', image: '/characters/t13.jpg', name: '铁腕者', family: '权压·霸主系', structure: '权压用饰', quote: '意见我听到了，决定不用改。', description: '他把强制称作必要，把沉默解释为秩序。行动直接、边界清楚，却不为异议留下协商空间。' },
  { id: 'T14', slug: 't14', image: '/characters/t14.jpg', name: '定局者', family: '权压·霸主系', structure: '权压用蔑', quote: '会可以开，结论我已经盖章了。', description: '权力必须被看见，胜负必须当场确认。他用力量与速度结束讨论，也不太在意别人怎样评价。' },
  { id: 'T15', slug: 't15', image: '/characters/t15.jpg', name: '裁决者', family: '权压·霸主系', structure: '权压惩饰', quote: '没人封你的嘴，只是没人再听见。', description: '每一步都有手续，每一份异议都会消失。惩罚被包装成整顿，个人意志藏进制度。' },
  { id: 'T16', slug: 't16', image: '/characters/t16.jpg', name: '暴君', family: '权压·霸主系', structure: '权压惩蔑', quote: '你可以反对，名单正好还缺一个名字。', description: '他要的不只是服从，还要挑战者后悔。权力、强制、惩罚与对规则的轻蔑同时被推到最直接的位置。' },
];

export type AxisDefinition = {
  key: string;
  title: string;
  left: AxisLetter;
  right: AxisLetter;
  leftQuestions: number[];
  rightQuestions: number[];
  anchors: [number, number];
  fallback: AxisLetter;
  copy: Partial<Record<AxisLetter, string>>;
  caution: Partial<Record<AxisLetter, string>>;
};

export type AxisResult = AxisDefinition & {
  winner: AxisLetter;
  leftScore: number;
  rightScore: number;
  position: number;
  isBoundary: boolean;
};

export const axes: AxisDefinition[] = [
  { key: 'target', title: '目标取向', left: '利', right: '权', leftQuestions: [0, 8], rightQuestions: [4, 12], anchors: [8, 12], fallback: '利', copy: { 利: '更快注意现实结果、时间与资源是否划算。', 权: '更在意自己是否参与决定、是否掌握关键方向。' }, caution: { 利: '别让效率和收益遮住关系中的公平。', 权: '别把解决问题变成必须由自己说了算。' } },
  { key: 'method', title: '推进方式', left: '谋', right: '压', leftQuestions: [1, 9], rightQuestions: [5, 13], anchors: [9, 13], fallback: '谋', copy: { 谋: '习惯先理解局势与对方，再选择沟通路径。', 压: '习惯直接说明要求、底线和作出决定的时点。' }, caution: { 谋: '策略感可能变成信息不对称和隐性操控。', 压: '清晰直接可能收窄别人真实的选择空间。' } },
  { key: 'conflict', title: '冲突落点', left: '用', right: '惩', leftQuestions: [2, 10], rightQuestions: [6, 14], anchors: [10, 14], fallback: '用', copy: { 用: '更关注问题是否停止、损失是否得到修复。', 惩: '更关注责任是否被承认、越界是否留下后果。' }, caution: { 用: '过快翻篇可能忽略仍未被看见的感受。', 惩: '合理追责可能继续升级成追加代价。' } },
  { key: 'rule', title: '规则态度', left: '饰', right: '蔑', leftQuestions: [3, 11], rightQuestions: [7, 15], anchors: [11, 15], fallback: '饰', copy: { 饰: '重视一套能够公开说明、前后一致的标准。', 蔑: '更相信独立判断，也愿意承担不被认可的结果。' }, caution: { 饰: '漂亮理由可能替明显偏向自己的选择遮掩。', 蔑: '独立判断可能滑向不解释也不受约束。' } },
];

export function scoreAnswers(answers: number[]) {
  const axisResults: AxisResult[] = axes.map((axis) => {
    const leftScore = axis.leftQuestions.reduce((sum, index) => sum + answers[index], 0);
    const rightScore = axis.rightQuestions.reduce((sum, index) => sum + answers[index], 0);
    const [leftAnchor, rightAnchor] = axis.anchors;
    let winner = axis.fallback;
    let isBoundary = false;

    if (leftScore > rightScore) winner = axis.left;
    if (rightScore > leftScore) winner = axis.right;
    if (leftScore === rightScore) {
      if (answers[leftAnchor] > answers[rightAnchor]) winner = axis.left;
      else if (answers[rightAnchor] > answers[leftAnchor]) winner = axis.right;
      else isBoundary = true;
    }

    return {
      ...axis,
      winner,
      leftScore,
      rightScore,
      position: Math.max(0, Math.min(100, 50 + ((leftScore - rightScore) / 8) * 50)),
      isBoundary,
    };
  });

  const structure = axisResults.map((axis) => axis.winner).join('');
  const character = characters.find((item) => item.structure === structure) ?? characters[0];
  return { character, axisResults };
}
