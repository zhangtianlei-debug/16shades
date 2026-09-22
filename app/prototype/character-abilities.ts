export type CharacterAbility = {
  title: string;
  narrative: string;
};

// These are fictional character vignettes, not claims about a reader.
export const characterAbilities: Record<string, CharacterAbility> = {
  T01: {
    title: '空手分红',
    narrative: '撮合别人的交易时，他悄悄把大部分钱留在自己手里。',
  },
  T02: {
    title: '规则穿墙术',
    narrative: '正门的规则拦住别人，他找到漏洞，不按正常方式通过。',
  },
  T03: {
    title: '记仇保鲜术',
    narrative: '当面笑着承受冒犯，随后仍笑着，偷偷回敬同一个人。',
  },
  T04: {
    title: '甩不掉',
    narrative: '对方换路、躲藏、设阻拦，他仍紧追不放。',
  },
  T05: {
    title: '条款榨汁机',
    narrative: '凭手里的协议，他把本来该给对方的钱再挤走一部分。',
  },
  T06: {
    title: '整箱吸附',
    narrative: '他把对方的资源整批吸进自己的箱子，再抱着离开。',
  },
  T07: {
    title: '结案加页',
    narrative: '对方已按账单付清，他又展开附加账单，拿走最后的财物。',
  },
  T08: {
    title: '拍桌余震',
    narrative: '好处已经拿到，他仍拍桌震翻东西，让人害怕反抗。',
  },
  T09: {
    title: '选项包圆',
    narrative: '别人以为有三种独立选择，实际三种都受他控制。',
  },
  T10: {
    title: '小事升温术',
    narrative: '他几句话，就把两人的小分歧变成相互敌视。',
  },
  T11: {
    title: '终点漂移',
    narrative: '别人刚达到要求，他立刻抬高标准，让原本合格变成不合格。',
  },
  T12: {
    title: '自动护主',
    narrative: '他本人还在温和微笑，身边的人已替他围攻提出质疑者。',
  },
  T13: {
    title: '万物归队',
    narrative: '他一收紧约束，原本各行其是的人被迫排齐、动作一致。',
  },
  T14: {
    title: '一章定局',
    narrative: '自己的决定强行生效，其他人的方案同时被排除。',
  },
  T15: {
    title: '异议橡皮擦',
    narrative: '他把反对意见连同发声机会一起抹掉。',
  },
  T16: {
    title: '认输加时',
    narrative: '对方已经举白旗认输，他仍按按钮追加负担和惩罚。',
  },
};

export const abilityImagePath = (id: string, format: 'png' | 'webp') => {
  const source = `/character-abilities/${id.toLowerCase()}.${format}`;
  return id.toUpperCase() === 'T06' ? `${source}?v=20260916-blunt-fringe` : source;
};
