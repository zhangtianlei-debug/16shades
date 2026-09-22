import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const data = JSON.parse(readFileSync('app/theater/episodes.json', 'utf8'));
const ui = JSON.parse(readFileSync('app/theater/ui.json', 'utf8'));
assert.equal(data.schemaVersion, 1);
assert.equal(typeof data.demoMode, 'boolean');
assert.ok(Number.isInteger(data.pageSize) && data.pageSize > 0);
assert.ok(data.stories.length > 0 && data.episodes.length > 0);
assert.deepEqual(Object.keys(ui.zh).sort(), Object.keys(ui.en).sort());
for (const [key, value] of Object.entries(ui.en)) assert.ok(!/\p{Script=Han}/u.test(value), `English UI: ${key}`);
const ids = new Set();
const imagePaths = new Set();
function bilingual(value, key) {
  for (const locale of ['zh', 'en']) assert.ok(typeof value?.[locale] === 'string' && value[locale].trim(), `${key}.${locale}`);
  assert.ok(!/\p{Script=Han}/u.test(value.en), `English content: ${key}`);
}
for (const story of data.stories) {
  assert.ok(story.id && !ids.has(story.id)); ids.add(story.id);
  bilingual(story.title, `${story.id}.title`); bilingual(story.summary, `${story.id}.summary`);
  assert.ok(story.panels.length > 0);
  assert.equal(new Set(story.panels.map(p => p.id)).size, story.panels.length);
  for (const id of story.cast) assert.match(id, /^T(0[1-9]|1[0-6])$/);
  for (const panel of story.panels) {
    bilingual(panel.title, `${story.id}/${panel.id}.title`); bilingual(panel.alt, `${story.id}/${panel.id}.alt`);
    assert.ok(panel.width > 0 && panel.height > 0);
    assert.notEqual(panel.src.zh, panel.src.en, 'Lettered artwork needs its own language edition.');
    for (const locale of ['zh', 'en']) {
      assert.ok(Array.isArray(panel.lines[locale]) && panel.lines[locale].length > 0);
      if (locale === 'en') assert.ok(panel.lines.en.every(line => !/\p{Script=Han}/u.test(line)));
      const url = panel.src[locale];
      assert.match(url, /^\/theater\/.+\.(webp|png|jpg)$/);
      const file = resolve('public', `.${url}`);
      assert.ok(file.startsWith(resolve('public/theater') + '/'));
      assert.ok(statSync(file).size > 1000, `Missing/empty image: ${url}`);
      imagePaths.add(url);
    }
  }
}
ids.clear();
for (const episode of data.episodes) {
  assert.ok(episode.id && !ids.has(episode.id)); ids.add(episode.id);
  assert.equal(typeof episode.demo, 'boolean');
  assert.ok(Number.isInteger(episode.number) && episode.number > 0);
  const story = data.stories.find(story => story.id === episode.storyId);
  assert.ok(story, `Unknown story: ${episode.storyId}`);
  assert.ok(story.panels[episode.coverPanel], `Invalid cover: ${episode.id}`);
}
console.log(`Passed: ${data.episodes.length} episodes, ${data.stories.length} stories, ${imagePaths.size} bilingual image assets, matching UI keys and dialogue.`);
