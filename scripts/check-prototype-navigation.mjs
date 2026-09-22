import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { characters } from '../app/data.ts';
import release from '../release.json' with { type: 'json' };
import socialContent from '../app/prototype/social-content.json' with { type: 'json' };
import { characterSearchTitle } from '../app/search/titles.mjs';
import { absoluteUrl } from '../app/search/policy.mjs';
import {
  characterPath,
  combinationPath,
  prototypePath,
  prototypeSearch,
} from '../app/prototype/navigation.ts';

const publicOrigin = new URL(release.publicOrigin);
assert.equal(publicOrigin.protocol, 'https:', 'public sharing requires HTTPS');
assert.equal(
  publicOrigin.origin,
  release.publicOrigin,
  'publicOrigin must not include a path or trailing slash',
);

for (const character of characters) {
  const path = `/prototype/types/${character.slug}`;
  assert.equal(characterPath(character.id), path);
  assert.equal(prototypePath('type', character.id), path);
  for (const pathname of [path, `${path}/`]) {
    // A direct character URL cannot turn into a personal result via query parameters.
    assert.equal(
      prototypeSearch({ pathname, search: '?view=result&answers=private' }),
      `?type=${character.slug}`,
    );
  }
  const html = readFileSync(`dist/client${path}/index.html`, 'utf8');
  const head = html.split('</head>')[0];
  assert.ok(
    head.includes(`<title>${characterSearchTitle(character.name, 'zh')}</title>`),
    `${path}: title`,
  );
  assert.ok(
    head.includes(
      `property="og:title" content="${character.name}｜16暗影人物卡"`,
    ),
    `${path}: share title`,
  );
  assert.ok(
    head.includes(
      `property="og:image" content="${new URL(character.image, publicOrigin).href}"`,
    ),
    `${path}: share image`,
  );
  assert.ok(
    head.includes(
      `property="og:url" content="${new URL(path, publicOrigin).href}"`,
    ),
    `${path}: share URL`,
  );
  assert.ok(
    head.includes(`rel="canonical" href="${absoluteUrl(path)}"`),
    `${path}: canonical URL`,
  );
  assert.ok(
    !head.includes('shadow16-test.zhangtianlei.chatgpt.site'),
    `${path}: no stale sharing origin`,
  );
  assert.equal(
    html.match(/<h1(?:\s[^>]*)?>([^<]*)<\/h1>/)?.[1],
    character.name,
    `${path}: first render`,
  );
  assert.ok(!html.includes('角色匹配占比'), `${path}: no personal score`);
  assert.ok(!html.includes('你还有，'), `${path}: no guessed homepage`);
}

for (const id of [
  'T00',
  'T17',
  '../result',
  'https://example.com',
  't01?answers=private',
]) {
  assert.throws(() => characterPath(id));
}
assert.equal(prototypePath('home'), '/prototype');
assert.equal(prototypePath('quiz'), '/prototype?view=quiz');
assert.equal(prototypePath('knowledge'), '/prototype?view=knowledge');
assert.equal(prototypePath('relationships'), '/prototype?view=relationships');
assert.equal(prototypePath('result'), '/prototype?view=result');
assert.equal(prototypePath('types'), '/prototype?view=types');
assert.equal(prototypePath('resources'), '/prototype?view=resources');
assert.equal(prototypePath('principles'), '/prototype?view=principles');
assert.equal(
  prototypePath('example', 'T12'),
  '/prototype?view=example&type=t12',
);
assert.equal(
  prototypeSearch({ pathname: '/prototype', search: '?type=t12' }),
  '?type=t12',
);
const mbtiTypes = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
assert.equal(socialContent.shareCards.cards.length, 256);
assert.equal(new Set(socialContent.shareCards.cards.map((card) => card.line)).size, 256);
const escapeAttribute = (text) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
for (const mbti of mbtiTypes) for (const character of characters) {
  const path = `/prototype/combinations/${mbti.toLowerCase()}/${character.slug}`;
  assert.equal(combinationPath(character.id, mbti), path);
  for (const pathname of [path, `${path}/`]) assert.equal(
    prototypeSearch({ pathname, search: '?view=result&answers=private&mbti=XXXX' }),
    `?view=shared&type=${character.slug}&mbti=${mbti}`,
  );
  const html = readFileSync(`dist/client${path}/index.html`, 'utf8');
  const head = html.split('</head>')[0];
  const title = `${mbti} × ${character.name}｜16暗影组合卡`;
  const copy = socialContent.shareCards.cards.find((card) => card.mbti === mbti && card.roleId === character.id);
  assert.ok(copy, `${path}: dedicated share copy exists`);
  const description = escapeAttribute(copy.line);
  for (const attribute of ['name="description"', 'property="og:description"', 'name="twitter:description"']) {
    assert.ok(head.includes(`${attribute} content="${description}"`), `${path}: unique share description ${attribute}`);
  }
  assert.ok(head.includes(`<title>${title}</title>`), `${path}: title`);
  assert.ok(head.includes(`property="og:title" content="${title}"`), `${path}: OG title`);
  assert.ok(head.includes(`property="og:url" content="${new URL(path, publicOrigin).href}"`), `${path}: OG URL`);
  assert.ok(head.includes(`rel="canonical" href="${new URL(path, publicOrigin).href}"`), `${path}: canonical`);
  assert.ok(head.includes(`property="og:image" content="${new URL(`/downloads/portraits/${character.slug}.png`, publicOrigin).href}"`), `${path}: own character thumbnail`);
  assert.ok(html.includes(`${mbti} × ${character.name}</h1>`), `${path}: SSR identity`);
  assert.ok(html.includes('朋友分享的双身份'), `${path}: shared landing`);
  assert.ok(!html.includes('角色匹配占比'), `${path}: no personal score`);
}
for (const mbti of ['XXXX', 'ENFP-A', 'enfp?answers=private', '../result']) assert.throws(() => combinationPath('T03', mbti));
for (const id of ['T00', 'T17', '../result']) assert.throws(() => combinationPath(id, 'ENFP'));
console.log(
  'Passed: 16 character + 256 combination pages, matching metadata, score-free sharing, legacy query compatibility, and invalid IDs.',
);
