/**
 * Resolves the WeChat link-card content for a page.
 *
 * WeChat reads the card from the share interfaces configured on the *current*
 * page, so this must be a pure function of the live URL: the same address the
 * visitor sees is the card every recipient gets. Nothing here reads storage,
 * cookies or in-memory app state, which keeps a previous page's picture from
 * leaking into the next card after an in-page view change.
 */

const SITE = '/prototype';
const IMAGE = {
  site: '/share/site.png',
  invite: '/share/invite.png',
  theater: '/share/theater.png',
  types: '/share/types.png',
  wallpapers: '/share/wallpapers.png',
};

const copy = {
  site: {
    zh: { title: '16暗影｜看看你的另一面', description: '16道日常情境题，看看你面对利益、分歧和规则时更自然的样子。' },
    en: { title: '16 Shades | Explore your other side', description: 'Sixteen everyday situations. See how you naturally respond to gain, disagreement and rules.' },
  },
  types: {
    zh: { title: '16暗影人物图鉴', description: '16个人物，16种策略画像。挑一位看看他面对选择时的反应。' },
    en: { title: 'The 16 Shades cast', description: 'Sixteen characters, sixteen strategy profiles. Pick one and see how they react to everyday choices.' },
  },
  wallpapers: {
    zh: { title: '16暗影人物壁纸', description: '16位人物的标准壁纸与精选主题，手机和电脑尺寸都有。' },
    en: { title: '16 Shades wallpapers', description: 'Standard wallpapers for all sixteen characters plus curated themes, sized for phone and desktop.' },
  },
  knowledge: {
    zh: { title: '16暗影 Wiki', description: '读四轴框架、关系研究与边界说明，了解16种画像怎么来的。' },
    en: { title: '16 Shades Wiki', description: 'The four-axis framework, relationship research and evidence limits behind the sixteen profiles.' },
  },
  relationships: {
    zh: { title: '16暗影关系地图', description: '从两个人的视角，看合作、冲突和转折会怎么发生。' },
    en: { title: '16 Shades relationship map', description: 'How cooperation, conflict and turning points play out between two characters.' },
  },
  quiz: {
    zh: { title: '16暗影测评', description: '16道日常情境题，做完就能看到自己的画像。' },
    en: { title: 'The 16 Shades assessment', description: 'Sixteen everyday situations, then your own profile.' },
  },
  theater: {
    zh: { title: '16暗影小剧场', description: '16个人物，把日常过成一出好戏。关灯，开场。' },
    en: { title: '16 Shades mini theater', description: 'Sixteen characters turn an ordinary day into a scene. Lights off, curtain up.' },
  },
  invite: {
    zh: { title: '来猜猜你眼中的我', description: '按你对我的印象做完一遍测评，结果只会回到发起人的账号里。' },
    en: { title: 'Guess how you see me', description: 'Take the assessment from your impression of me. The result goes only to the person who invited you.' },
  },
  friends: {
    zh: { title: '测测朋友眼中的我', description: '创建一条邀请，让朋友按对你的印象作答。' },
    en: { title: 'How friends see me', description: 'Create an invitation and let a friend answer from their impression of you.' },
  },
};

const character = {
  zh: (role) => ({ title: `16暗影｜${role.name}`, description: clip(role.description, 52) }),
  en: (role) => ({ title: `${role.name} | 16 Shades`, description: clip(role.description, 108) }),
};
const combination = {
  zh: (role, mbti) => ({ title: `16暗影｜${role.name} × ${mbti}`, description: clip(`${role.description} 看看这位人物的${mbti}组合。`, 52) }),
  en: (role, mbti) => ({ title: `${role.name} × ${mbti} | 16 Shades`, description: clip(`${role.description} See the ${mbti} combination for this character.`, 108) }),
};

// WeChat shows roughly two lines beside the thumbnail; a clipped blurb reads
// better than an ellipsis the client adds after the first sentence.
function clip(value, limit) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return Array.from(text).length <= limit ? text : `${Array.from(text).slice(0, limit).join('')}…`;
}

const typeId = /^t(0[1-9]|1[0-6])$/i;
const mbtiCode = /^[IE][NS][TF][JP]$/i;
const inviteToken = /^[A-Za-z0-9_-]{43}$/;

function absolute(origin, path) {
  return new URL(path, origin).toString();
}

function localePath(locale, path) {
  if (!path.startsWith('/')) return path;
  const plain = path.replace(/^\/en(?=\/|\?|#|$)/, '') || '/';
  if (plain.startsWith('/share/')) return plain;
  return locale === 'en' ? `/en${plain === '/' ? '' : plain}` : plain;
}

/**
 * @param {{ href: string, origin: string, locale?: 'zh' | 'en', roles?: Array<{ id: string, name: string, description: string }>, episodes?: Array<{ id: string, title: Record<string, string>, summary: Record<string, string>, cover: Record<string, string> }> }} input
 * @returns {{ kind: string, title: string, description: string, image: string, link: string }}
 */
export function shareMetaFor({ href, origin, locale = 'zh', roles = [], episodes = [] }) {
  const language = locale === 'en' ? 'en' : 'zh';
  const text = (key) => copy[key][language];
  const located = (path) => absolute(origin, localePath(language, path));
  const withImage = (key, meta, extra) => ({
    kind: key,
    title: meta.title,
    description: meta.description,
    image: absolute(origin, IMAGE[extra?.image ?? key] ?? IMAGE.site),
    link: extra?.link ?? located(SITE),
  });
  const role = (id) => roles.find((item) => item.id?.toUpperCase() === id?.toUpperCase());

  let path = '/';
  let search = '';
  try {
    const url = new URL(href, origin);
    path = url.pathname.replace(/^\/en(?=\/|$)/, '') || '/';
    search = url.search;
  } catch {
    return withImage('site', text('site'));
  }
  const params = new URLSearchParams(search);
  const pathType = path.match(/^\/prototype\/types\/(t\d{2})\/?$/i);
  const pathCombo = path.match(/^\/prototype\/combinations\/([a-z]{4})\/(t\d{2})\/?$/i);

  // A friend invitation is only an invitation while its token is in the URL.
  if (path === '/friends') {
    const token = params.get('invite') ?? '';
    if (inviteToken.test(token)) {
      const meta = text('invite');
      return {
        kind: 'invite',
        title: meta.title,
        description: meta.description,
        image: absolute(origin, IMAGE.invite),
        // Keep the token: dropping it would send recipients to a blank entry.
        link: located(`/friends?invite=${token}`),
      };
    }
    return withImage('friends', text('friends'), { image: 'invite', link: located('/friends') });
  }

  const comboTarget = pathCombo
    ? { id: pathCombo[2], mbti: pathCombo[1].toUpperCase() }
    : params.get('view') === 'shared' && params.get('type') && params.get('mbti')
      ? { id: params.get('type'), mbti: params.get('mbti').toUpperCase() }
      : null;
  if (comboTarget && typeId.test(comboTarget.id) && mbtiCode.test(comboTarget.mbti)) {
    const match = role(comboTarget.id);
    if (match) {
      const meta = combination[language](match, comboTarget.mbti);
      return {
        kind: 'combination',
        title: meta.title,
        description: meta.description,
        image: absolute(origin, `/characters/${match.id.toLowerCase()}.jpg`),
        link: located(`/prototype/combinations/${comboTarget.mbti.toLowerCase()}/${match.id.toLowerCase()}`),
      };
    }
  }

  const characterTarget = pathType ? pathType[1] : params.get('type');
  if ((path === SITE || pathType) && characterTarget && typeId.test(characterTarget)) {
    const match = role(characterTarget);
    if (match) {
      const meta = character[language](match);
      return {
        kind: 'character',
        title: meta.title,
        description: meta.description,
        image: absolute(origin, `/characters/${match.id.toLowerCase()}.jpg`),
        link: located(`/prototype/types/${match.id.toLowerCase()}`),
      };
    }
  }

  if (path === '/theater') {
    const episodeId = params.get('episode');
    const episode = episodeId && episodes.find((item) => item?.id === episodeId);
    if (
      episode &&
      typeof episode.title?.[language] === 'string' &&
      typeof episode.summary?.[language] === 'string' &&
      typeof episode.cover?.[language] === 'string' &&
      episode.cover[language].startsWith('/')
    ) {
      const title = language === 'zh'
        ? `16暗影小剧场｜${episode.title[language]}`
        : `${episode.title[language]} | 16 Shades mini theater`;
      return {
        kind: 'theater-episode',
        title,
        description: clip(episode.summary[language], language === 'zh' ? 52 : 108),
        image: absolute(origin, episode.cover[language]),
        link: located(`/theater?episode=${encodeURIComponent(episode.id)}`),
      };
    }
    return withImage('theater', text('theater'), { link: located('/theater') });
  }
  if (path === '/quiz')
    return withImage('quiz', text('quiz'), { link: located('/quiz') });
  if (path === '/knowledge' || path.startsWith('/knowledge/'))
    return withImage('knowledge', text('knowledge'), { link: located(path) });
  if (path === '/relationships' || path.startsWith('/relationships/'))
    return withImage('relationships', text('relationships'), { link: located(path) });
  if (!path.startsWith('/prototype'))
    // About, privacy, openness and the hub all carry the brand card.
    return withImage('site', text('site'), { link: located(path) });

  // The in-page state and its query address are the same view, so a card keeps
  // that address: the recipient opens the section the card advertised instead
  // of being dropped on the home screen.
  const view = params.get('view');
  if (view === 'types')
    return withImage('types', text('types'), { link: located('/prototype?view=types') });
  if (view === 'resources' && params.get('collection') === 'wallpapers')
    return withImage('wallpapers', text('wallpapers'), {
      link: located('/prototype?view=resources&collection=wallpapers'),
    });
  if (view === 'knowledge' || view === 'principles')
    return withImage('knowledge', text('knowledge'), {
      link: located(`/prototype?view=${view}`),
    });
  if (view === 'relationships')
    return withImage('relationships', text('relationships'), {
      link: located('/prototype?view=relationships'),
    });
  if (view === 'quiz')
    return withImage('quiz', text('quiz'), { link: located('/prototype?view=quiz') });
  if (view === 'combo' || view === 'resources' || view === 'play')
    // `play` here is the "Play ideas" page; the mini theater lives at /theater
    // and keeps its own card. These three get the brand card with their own
    // address rather than borrowing another section's copy.
    return withImage('site', text('site'), {
      link: located(`/prototype?view=${view}`),
    });

  // Home, and any private view such as a saved personal result: send the site
  // entry rather than a recipient's own blank state.
  return withImage('site', text('site'));
}
