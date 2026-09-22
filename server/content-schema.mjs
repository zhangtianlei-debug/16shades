import assert from 'node:assert/strict';

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function bilingual(value, field) {
  for (const locale of ['zh', 'en']) assert.ok(typeof value?.[locale] === 'string' && value[locale].trim(), `${field}.${locale} is required`);
  assert.ok(!/\p{Script=Han}/u.test(value.en), `${field}.en contains untranslated Chinese`);
}
export function validateContent({ settings, wiki, theater }) {
  assert.equal(settings.schemaVersion, 1, 'Unsupported content schema');
  const unique = (items, key, label) => {
    const ids = items.map(item => item[key]);
    assert.equal(new Set(ids).size, ids.length, `Duplicate ${label}`);
    ids.forEach(id => assert.ok(typeof id === 'string' && slugPattern.test(id), `Invalid ${label}: ${id}`));
    return new Set(ids);
  };
  const categories = unique(settings.categories, 'id', 'category');
  settings.categories.forEach(item => { bilingual(item.label, `category ${item.id}`); assert.ok(Number.isFinite(item.order), `category ${item.id}: invalid order`); });
  const wikiIds = unique(wiki, 'slug', 'article slug');
  const episodeIds = unique(theater, 'id', 'episode id');
  void episodeIds;
  const common = (item, name) => {
    assert.ok(['published', 'draft'].includes(item.status), `${name}: invalid status`);
    bilingual(item.title, `${name}.title`); bilingual(item.summary, `${name}.summary`);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(item.updatedAt) && !Number.isNaN(Date.parse(item.updatedAt)) && new Date(item.updatedAt).toISOString().slice(0,10) === item.updatedAt, `${name}: invalid date`);
    assert.equal(typeof item.indexable, 'boolean', `${name}.indexable required`);
  };
  for (const article of wiki) {
    common(article, article.slug); bilingual(article.kind, `${article.slug}.kind`); bilingual(article.body, `${article.slug}.body`);
    assert.ok(categories.has(article.category), `${article.slug}: unknown category`);
    assert.ok(Array.isArray(article.related), `${article.slug}: related must be an array`);
    article.related.forEach(id => assert.ok(wikiIds.has(id), `${article.slug}: unknown related ${id}`));
    if(article.sources!==undefined){
      assert.ok(Array.isArray(article.sources),'Sources must be an array');
      for(const source of article.sources){
        assert.ok(typeof source.id==='string'&&source.id,'Source id required');
        assert.ok(typeof source.authors==='string'&&source.authors.trim(),'Source authors required');
        assert.ok(Number.isInteger(source.year)&&source.year>0,'Source year required');
        assert.ok(typeof source.url==='string'&&/^https?:\/\//.test(source.url),'Source URL required');
        bilingual(source.title,`${source.id}.title`);bilingual(source.kind,`${source.id}.kind`);
        for(const key of ['findings','limits'])for(const locale of ['zh','en']){
          assert.ok(Array.isArray(source[key]?.[locale])&&source[key][locale].every(line=>typeof line==='string'&&line.trim()),`${source.id}.${key}.${locale} required`);
          if(locale==='en')assert.ok(source[key].en.every(line=>! /\p{Script=Han}/u.test(line)),`${source.id}.${key}.en contains untranslated Chinese`);
        }
        for(const url of [source.url,source.open_access_url].filter(Boolean))assert.ok(/^https?:\/\//.test(url),`${source.id}: invalid source URL`);
      }
    }
  }
  for (const key of ['featuredWiki', 'wikiDirectory']) {
    assert.ok(Array.isArray(settings[key]), `${key} required`);
    settings[key].forEach(id => assert.ok(wikiIds.has(id), `${key}: unknown ${id}`));
  }
  const numbers = new Set();
  for (const episode of theater) {
    common(episode, episode.id);
    assert.ok(Number.isSafeInteger(episode.number) && episode.number > 0 && !numbers.has(episode.number), `Invalid/duplicate episode number ${episode.number}`); numbers.add(episode.number);
    assert.ok(Array.isArray(episode.cast) && episode.cast.every(id => /^T(?:0[1-9]|1[0-6])$/.test(id)), `${episode.id}: invalid cast`);
    assert.ok(Array.isArray(episode.panels) && episode.panels.length, `${episode.id}: missing panels`);
    unique(episode.panels, 'id', 'panel id');
    assert.ok(Number.isSafeInteger(episode.coverPanel) && episode.panels[episode.coverPanel], `${episode.id}: invalid cover`);
    for (const panel of episode.panels) {
      for (const field of ['title', 'alt']) bilingual(panel[field], `${episode.id}/${panel.id}.${field}`);
      for (const locale of ['zh', 'en']) {
        assert.ok(typeof panel.src?.[locale] === 'string' && panel.src[locale].trim(), `${episode.id}/${panel.id}: missing asset path`);
        assert.ok(Array.isArray(panel.lines?.[locale]) && panel.lines[locale].length && panel.lines[locale].every(line => typeof line === 'string' && line.trim()), `${episode.id}/${panel.id}: missing ${locale} transcript`);
        if(locale === 'en')assert.ok(panel.lines.en.every(line=>! /\p{Script=Han}/u.test(line)), `${episode.id}/${panel.id}: untranslated English transcript`);
        assert.ok(!panel.src[locale].startsWith('/') && !panel.src[locale].split('/').includes('..') && !panel.src[locale].includes('\\'), 'Asset source must be a project-relative local path');
      }
      assert.ok(Number.isInteger(panel.width) && panel.width > 0 && Number.isInteger(panel.height) && panel.height > 0, 'Invalid image dimensions');
    }
  }
  // Publication cannot accidentally expose drafts through recommendations or related links.
  const published = new Set(wiki.filter(item => item.status === 'published').map(item => item.slug));
  return { wiki: wiki.filter(item => item.status === 'published').map(item => ({ ...item, related: item.related.filter(id => published.has(id)) })), theater: theater.filter(item => item.status === 'published'), settings: { ...settings, featuredWiki: settings.featuredWiki.filter(id => published.has(id)), wikiDirectory: settings.wikiDirectory.filter(id => published.has(id)) } };
}
