import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { shareMetaFor } from './share-meta.mjs';

const origin = 'https://shades16.com';
const roles = [
  { id: 'T01', name: '掮客', description: '他把人情当通道，把通道变成收益。合作总是体面，分配却未必对等。' },
  { id: 'T03', name: '笑面客', description: '面上维持友好，心里另开一本账。' },
  { id: 'T05', name: 'Harvester', description: 'He holds the contract and narrows every option.' },
];
const enRoles = [{ id: 'T03', name: 'Smiler', description: 'Friendly on the surface, a second ledger underneath.' }];
const resolve = (href, locale = 'zh', list = roles) => shareMetaFor({ href, origin, locale, roles: list });
const episodes = [{
  id: '001',
  title: { zh: '封面争夺战', en: 'The Cover Battle' },
  summary: { zh: '一张封面，四个主意。', en: 'One cover. Four opinions.' },
  cover: { zh: '/content/v1/releases/test/assets/001/zh/cover.jpg', en: '/content/v1/releases/test/assets/001/en/cover.jpg' },
}];

test('the home page shares the site entry, not the live query string', () => {
  const meta = resolve('https://shades16.com/prototype?view=result');
  assert.equal(meta.kind, 'site');
  assert.equal(meta.image, 'https://shades16.com/share/site.png');
  assert.equal(meta.link, 'https://shades16.com/prototype');
  assert.ok(meta.title && meta.description);
});

test('every image and link is an absolute public URL', () => {
  for (const path of ['/prototype', '/prototype?view=types', '/prototype?view=resources&collection=wallpapers', '/theater', '/friends', '/knowledge/goal']) {
    const meta = resolve(`https://shades16.com${path}`);
    assert.match(meta.image, /^https:\/\/shades16\.com\/share\/[a-z]+\.png$/, path);
    assert.match(meta.link, /^https:\/\/shades16\.com\//, path);
  }
});

test('a character card uses the character picture and that character page', () => {
  for (const href of [
    'https://shades16.com/prototype?type=t01',
    'https://shades16.com/prototype/types/T01',
    'https://shades16.com/prototype?view=quiz&type=t01',
  ]) {
    const meta = resolve(href);
    assert.equal(meta.kind, 'character', href);
    assert.equal(meta.image, 'https://shades16.com/characters/t01.jpg');
    assert.equal(meta.link, 'https://shades16.com/prototype/types/t01');
    assert.match(meta.title, /掮客/);
  }
});

test('a combination card keeps both the character and the MBTI code', () => {
  const meta = resolve('https://shades16.com/prototype/combinations/INFP/t03');
  assert.equal(meta.kind, 'combination');
  assert.equal(meta.image, 'https://shades16.com/characters/t03.jpg');
  assert.equal(meta.link, 'https://shades16.com/prototype/combinations/infp/t03');
  assert.match(meta.title, /笑面客/);
  assert.match(meta.title, /INFP/);
  const legacy = resolve('https://shades16.com/prototype?view=shared&type=t03&mbti=INFP');
  assert.equal(legacy.link, 'https://shades16.com/prototype/combinations/infp/t03');
});

test('an invitation card keeps its token and uses the invitation picture', () => {
  const token = 'A'.repeat(43);
  const meta = resolve(`https://shades16.com/friends?invite=${token}`);
  assert.equal(meta.kind, 'invite');
  assert.equal(meta.image, 'https://shades16.com/share/invite.png');
  // The token is what makes the link a personal invitation; it must survive.
  assert.equal(meta.link, `https://shades16.com/friends?invite=${token}`);
  const malformed = resolve('https://shades16.com/friends?invite=short');
  assert.equal(malformed.kind, 'friends');
  assert.equal(malformed.link, 'https://shades16.com/friends');
});

test('the English site resolves English titles and /en links', () => {
  const home = resolve('https://shades16.com/en/prototype', 'en', enRoles);
  assert.equal(home.link, 'https://shades16.com/en/prototype');
  assert.match(home.title, /16 Shades/);
  const role = resolve('https://shades16.com/en/prototype?type=t03', 'en', enRoles);
  assert.equal(role.title, 'Smiler | 16 Shades');
  assert.equal(role.link, 'https://shades16.com/en/prototype/types/t03');
  assert.equal(role.image, 'https://shades16.com/characters/t03.jpg');
  const invite = resolve(`https://shades16.com/en/friends?invite=${'B'.repeat(43)}`, 'en');
  assert.match(invite.title, /Guess how you see me/);
  assert.match(invite.link, /\/en\/friends\?invite=/);
});

test('theater, wallpapers, wiki and relationship entries each get their own card', () => {
  assert.equal(resolve('https://shades16.com/theater').image, 'https://shades16.com/share/theater.png');
  assert.equal(resolve('https://shades16.com/prototype?view=resources&collection=wallpapers').image, 'https://shades16.com/share/wallpapers.png');
  assert.equal(resolve('https://shades16.com/prototype?view=types').image, 'https://shades16.com/share/types.png');
  const article = resolve('https://shades16.com/knowledge/goal');
  assert.equal(article.kind, 'knowledge');
  assert.equal(article.link, 'https://shades16.com/knowledge/goal');
  assert.equal(article.image, 'https://shades16.com/share/site.png');
});

test('a valid theater episode keeps its link and uses its published localized cover', () => {
  const zh = shareMetaFor({ href: `${origin}/theater?episode=001`, origin, locale: 'zh', episodes });
  assert.equal(zh.kind, 'theater-episode');
  assert.equal(zh.title, '16暗影小剧场｜封面争夺战');
  assert.equal(zh.image, `${origin}/content/v1/releases/test/assets/001/zh/cover.jpg`);
  assert.equal(zh.link, `${origin}/theater?episode=001`);
  const en = shareMetaFor({ href: `${origin}/en/theater?episode=001`, origin, locale: 'en', episodes });
  assert.equal(en.title, 'The Cover Battle | 16 Shades mini theater');
  assert.equal(en.image, `${origin}/content/v1/releases/test/assets/001/en/cover.jpg`);
  assert.equal(en.link, `${origin}/en/theater?episode=001`);
  const invalid = shareMetaFor({ href: `${origin}/theater?episode=999`, origin, locale: 'zh', episodes });
  assert.equal(invalid.kind, 'theater');
  assert.equal(invalid.link, `${origin}/theater`);
});

test('the Play ideas view is not labelled as the mini theater', () => {
  // /prototype?view=play is the "Play ideas" section. The mini theater is a
  // separate page, so the two must never share a card or a landing address.
  const play = resolve('https://shades16.com/prototype?view=play');
  assert.equal(play.image, 'https://shades16.com/share/site.png');
  assert.equal(play.link, 'https://shades16.com/prototype?view=play');
  const theater = resolve('https://shades16.com/theater');
  assert.equal(theater.image, 'https://shades16.com/share/theater.png');
  assert.equal(theater.link, 'https://shades16.com/theater');
});

test('a view card lands on that view, not on the home screen', () => {
  const landings = {
    '/prototype?view=types': 'https://shades16.com/prototype?view=types',
    '/prototype?view=resources&collection=wallpapers':
      'https://shades16.com/prototype?view=resources&collection=wallpapers',
    '/prototype?view=resources': 'https://shades16.com/prototype?view=resources',
    '/prototype?view=knowledge': 'https://shades16.com/prototype?view=knowledge',
    '/prototype?view=relationships':
      'https://shades16.com/prototype?view=relationships',
    '/prototype?view=quiz': 'https://shades16.com/prototype?view=quiz',
    '/quiz': 'https://shades16.com/quiz',
  };
  for (const [path, link] of Object.entries(landings))
    assert.equal(resolve(`https://shades16.com${path}`).link, link, path);
  assert.equal(
    resolve('https://shades16.com/en/prototype?view=types', 'en', enRoles).link,
    'https://shades16.com/en/prototype?view=types',
  );
});

test('unknown or malformed addresses still produce a usable brand card', () => {
  for (const href of ['', 'not a url', 'https://shades16.com/about', 'https://shades16.com/prototype?view=example']) {
    const meta = resolve(href);
    assert.equal(meta.image, 'https://shades16.com/share/site.png', href);
    assert.ok(meta.title.length > 0);
    assert.ok(meta.description.length > 0);
    assert.match(meta.link, /^https:\/\/shades16\.com\//);
  }
});
