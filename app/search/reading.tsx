import { createElement, type ReactNode } from 'react';
import Image from 'next/image';
import { articles, articleBody, articleSummary, articleVersion, relationshipVersion, entries, pairs, roles, sources, text } from './catalog.mjs';
import { localizedPath } from './policy.mjs';
import { localizedAsset, type Locale } from '../i18n/core';
import { characterArtworkSrc } from '../prototype/character-artwork';
import { SharedHeader } from '@/components/shared-header';
import './reading.css';

const labels = {
  zh: { brand: '16暗影', home: '开始探索', directory: '内容目录', characters: '16个人物', knowledge: '知识与方法', relationships: '人物关系', intro: '从人物走近自己，从知识读懂关系。', lead: '选择一个人物、一篇文章，或一组你感兴趣的关系。每一条线索，都可以继续读下去。', article: '知识库', related: '继续阅读', examples: '相关关系实例', character: '查看人物', perspectives: '彼此眼中的对方', basis: '这组关系从哪里来', alliance: '盟友情境', rivalry: '对手情境', cp: '亲密情境', turning: '转折', brake: '停火与边界', mechanism: '相关关系机制', source: '内容来源', boundary: '人物关系来自本项目的情境创作，用于观察与讨论，不是配对预测。类型不决定真实关系。', modelBoundary: '这是本项目自定义的行为风格与阴影模式框架，未宣称经过心理测量学验证。类型不是坏度，也不是命运。', all: '探索全部关系', support: '更多基础说明', version: '内容版本', back: '返回内容目录', skip: '跳到正文', language: 'English', estimate: '占比是基于明确假设的估算情景，不是真实人群抽样统计。', framework: '框架与研究', privacy: '隐私政策与设置', about: '关于' },
  en: { brand: '16 Shades', home: 'Start exploring', directory: 'Content directory', characters: '16 characters', knowledge: 'Knowledge & methods', relationships: 'Character relationships', intro: 'Meet the characters. Understand the relationships.', lead: 'Start with a character, an article, or a relationship that interests you. Each offers another path to explore.', article: 'Wiki', related: 'Continue reading', examples: 'Related relationship examples', character: 'Meet the character', perspectives: 'How they see each other', basis: 'What this relationship builds on', alliance: 'An alliance', rivalry: 'A rivalry', cp: 'A close bond', turning: 'A turning point', brake: 'De-escalation & boundaries', mechanism: 'Related relationship mechanisms', source: 'Content source', boundary: 'These character relationships are fictional scenarios for observation and discussion, not compatibility predictions. Types do not determine real relationships.', modelBoundary: 'This is a project-defined framework for behavioral styles and shadow patterns. It does not claim psychometric validation. A type is neither a measure of badness nor a destiny.', all: 'Explore all relationships', support: 'More background', version: 'Content version', back: 'Back to the directory', skip: 'Skip to content', language: '中文', estimate: 'These proportions are scenarios based on explicit assumptions, not statistics from a representative population sample.', framework: 'Framework & research', privacy: 'Privacy & settings', about: 'About' },
};
const href = (path: string, locale: Locale) => localizedPath(path, locale);
function Frame({ locale, path, children }: { locale: Locale; path: string; children: ReactNode }) {
  const c = labels[locale];
  return <div className="reading-shell">
    <a className="reading-skip" href="#reading-main">{c.skip}</a>
    <SharedHeader />
    <main id="reading-main">{children}</main>
    <footer className="reading-footer"><a href={href('/about', locale)}>{c.about}</a><a href={href('/explore', locale)}>{c.back}</a><a href={href('/privacy', locale)}>{c.privacy}</a><span>{c.brand}</span></footer>
  </div>;
}
function localTarget(target: string, locale: Locale) {
  if (/^https?:\/\//.test(target)) return target;
  const code = target.match(/(?:#|^)([PM]\d{2})$/i)?.[1].toLowerCase();
  if (code) return href(`/knowledge/${code[0] === 'p' ? 'psychology' : 'mechanism'}-${code}`, locale);
  if (target === '01_心理学底层.md') return `${href('/explore', locale)}#knowledge`;
  if (target.startsWith('#')) return target;
  return null;
}
function inline(value: string, locale: Locale): ReactNode[] {
  return value.replace(/<[^>]*>/g, '').split(/(\[[^\]]+\]\((?:[^()]|\([^()]*\))*\)|\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    const link = part.match(/^\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)$/);
    if (link) { const target = localTarget(link[2], locale); return target ? <a key={i} href={target}>{link[1]}</a> : <span key={i}>{link[1]}</span>; }
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    return part;
  });
}
export function ReadingBody({ body, locale }: { body: string; locale: Locale }) {
  const lines = body.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0, section = 0;
  const isBlock = (line: string) => /^(?:#{1,6}\s|[-*]\s|\d+\.\s|\||```|<a\s|>\s)/.test(line);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || /^---+$/.test(line)) { i++; continue; }
    const anchor = line.match(/^<a\s+id="([^"]+)"[^>]*><\/a>$/);
    if (anchor) { blocks.push(<span id={anchor[1]} key={i++} />); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      // The page already has its own H1; omit the duplicated document title.
      if (heading[1].length > 1) blocks.push(createElement(`h${Math.min(heading[1].length, 4)}`, { key: i, id: `section-${++section}` }, inline(heading[2], locale)));
      i++; continue;
    }
    if (line.startsWith('```')) {
      const code: string[] = []; while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i]);
      blocks.push(<pre key={i++}><code>{code.join('\n')}</code></pre>); continue;
    }
    if (line.startsWith('|') && /^\|[\s:|-]+\|$/.test(lines[i+1] ?? '')) {
      const cells = (row: string) => row.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
      const heads = cells(line); i += 2; const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++]));
      blocks.push(<div className="reading-table" key={i}><table><thead><tr>{heads.map((cell, j) => <th key={j} scope="col">{inline(cell, locale)}</th>)}</tr></thead><tbody>{rows.map((row, k) => <tr key={k}>{row.map((cell, j) => <td key={j}>{inline(cell, locale)}</td>)}</tr>)}</tbody></table></div>); continue;
    }
    if (/^(?:[-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\d/.test(line), items: ReactNode[] = [];
      const pattern = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      while (i < lines.length && pattern.test(lines[i])) items.push(<li key={i}>{inline(lines[i++].replace(pattern, ''), locale)}</li>);
      blocks.push(createElement(ordered ? 'ol' : 'ul', { key: i }, items)); continue;
    }
    if (line.startsWith('> ')) { blocks.push(<blockquote key={i++}>{inline(line.slice(2), locale)}</blockquote>); continue; }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i].trim() && !isBlock(lines[i])) paragraph.push(lines[i++]);
    blocks.push(<p key={i}>{inline(paragraph.join('\n'), locale)}</p>);
  }
  return <div className="reading-body">{blocks}</div>;
}
export function ExplorePage({ locale }: { locale: Locale }) {
  const c = labels[locale], t = (value: string) => text(value, locale);
  return <Frame locale={locale} path="/explore">
    <section className="reading-hero"><p className="reading-eyebrow">{c.directory}</p><h1>{c.intro}</h1><p>{c.lead}</p><div className="reading-jumps"><a href="#characters">{c.characters}</a><a href="#knowledge">{c.knowledge}</a><a href="#relationships">{c.relationships}</a></div></section>
    <section className="reading-section" id="characters"><h2>{c.characters}</h2><div className="reading-characters">{roles.map((role) => <a key={role.id} href={href(`/prototype/types/${role.id.toLowerCase()}`, locale)}><Image unoptimized src={localizedAsset(characterArtworkSrc(role.id), locale)} width={140} height={160} alt="" loading="lazy" /><span>{role.id}</span><h3>{t(role.name)}</h3><p>{t(role.tagline)}</p></a>)}</div></section>
    <section className="reading-section" id="knowledge"><h2>{c.knowledge}</h2><p className="reading-note">{c.modelBoundary}</p><div className="reading-articles">{articles.filter((article) => entries.find((e) => e.id === article.slug)?.candidate).map((article) => <a key={article.slug} href={href(`/knowledge/${article.slug}`, locale)}><span>{t(article.kind)}</span><h3>{t(article.title)}</h3><p>{articleSummary(article, locale)}</p></a>)}</div><details className="reading-support"><summary>{c.support}</summary><ul>{articles.filter((article) => !entries.find((e) => e.id === article.slug)?.candidate).map((article) => <li key={article.slug}><a href={href(`/knowledge/${article.slug}`, locale)}>{t(article.title)}</a></li>)}</ul></details></section>
    <section className="reading-section" id="relationships"><h2>{c.relationships}</h2><p className="reading-note">{c.boundary}</p><div className="reading-articles">{pairs.map((pair) => <a key={pair.id} href={href(`/relationships/${pair.id.toLowerCase()}`, locale)}><span>{[pair.type_a, pair.type_b].map((id) => t(roles.find((role) => role.id === id)!.name)).join(' × ')}</span><h3>{t(pair.name)}</h3><p>{t(pair.hook)}</p></a>)}</div><a className="reading-more" href={href('/prototype?view=relationships', locale)}>{c.all} →</a></section>
  </Frame>;
}
export function KnowledgePage({ slug, locale }: { slug: string; locale: Locale }) {
  const article = articles.find((article) => article.slug === slug)!;
  const c = labels[locale], t = (value: string) => text(value, locale);
  return <Frame locale={locale} path={`/knowledge/${slug}`}><article className="reading-document">
    <header><p className="reading-eyebrow">{c.article} / {t(article.kind)}</p><h1>{t(article.title)}</h1><p className="reading-lead">{articleSummary(article, locale)}</p><p className="reading-meta">{c.source}: {c.brand} · {c.version}: {articleVersion(article)}</p></header>
    {slug === 'type-share-estimation' && <p className="reading-note">{c.estimate}</p>}
    <ReadingBody body={articleBody(article, locale)} locale={locale} />
    {(article as { relationshipExamples?: { id: string; label: { zh: string; en: string } }[] }).relationshipExamples?.length ? <aside className="reading-related"><h2>{c.examples}</h2><ul>{(article as { relationshipExamples: { id: string; label: { zh: string; en: string } }[] }).relationshipExamples.map((example) => <li key={example.id}><a href={href(`/relationships/${example.id}`, locale)}>{example.label[locale]}</a></li>)}</ul></aside> : null}
    {slug === 'theory-sources' && <TheorySources locale={locale} />}
    {slug.startsWith('mbti-') && <p className="reading-note"><a href="https://www.myersbriggs.org/unique-features-of-myers-briggs/type-dynamics-overview/">MBTI</a> · <a href="https://www.16personalities.com/articles/our-theory">16Personalities</a> · <a href="https://www.aptinternational.org/psychological-type/evolving-the-eight-function-model/">John Beebe</a></p>}
    <aside className="reading-related"><h2>{c.related}</h2><ul>{article.related.map((related) => { const other = articles.find((a) => a.slug === related); return other ? <li key={related}><a href={href(`/knowledge/${related}`, locale)}>{t(other.title)}</a></li> : null; })}</ul><a href={href('/explore', locale)}>{c.back} →</a></aside>
  </article></Frame>;
}
function TheorySources({ locale }: { locale: Locale }) {
  const heading = locale === 'zh' ? '参考来源' : 'References';
  const note = locale === 'zh' ? '这些来源用于讨论关系与行为机制，不直接验证本项目的类型配对。' : 'These sources inform discussion of relationship and behavioral mechanisms; they do not directly validate this project’s type pairings.';
  return <section className="reading-related"><h2>{heading}</h2><p className="reading-note">{note}</p><ul>{sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{text(source.title, locale)}</a><p className="reading-meta">{source.authors} · {source.year} · {text(source.kind, locale)}</p>{source.open_access_url && <a href={source.open_access_url} target="_blank" rel="noreferrer">{locale === 'zh' ? '开放全文' : 'Open-access text'}</a>}</li>)}</ul></section>;
}
export function RelationshipPage({ id, locale }: { id: string; locale: Locale }) {
  const pair = pairs.find((pair) => pair.id === id)!;
  const c = labels[locale], t = (value: string) => text(value, locale);
  const names = [pair.type_a, pair.type_b].map((id) => t(roles.find((role) => role.id === id)!.name));
  const narrative = (value: string) => t(value).replace(/\b[AB]\b/g, (letter: string) => `${names[letter === 'A' ? 0 : 1]}${pair.type_a === pair.type_b ? ` ${letter}` : ''}`);
  return <Frame locale={locale} path={`/relationships/${id.toLowerCase()}`}><article className="reading-document">
    <header><p className="reading-eyebrow">{c.relationships} / {names.join(' × ')}</p><h1>{t(pair.name)}</h1><p className="reading-lead">{t(pair.hook)}</p><p className="reading-meta">{c.source}: {c.brand} · {c.version}: {relationshipVersion}</p></header>
    <div className="reading-pair">{[pair.type_a, pair.type_b].map((id, i) => <a key={i} href={href(`/prototype/types/${id.toLowerCase()}`, locale)}><Image unoptimized src={localizedAsset(characterArtworkSrc(id), locale)} width={200} height={220} alt="" /><strong>{names[i]}{pair.type_a === pair.type_b ? ` ${i === 0 ? 'A' : 'B'}` : ''}</strong><span>{c.character} →</span></a>)}</div>
    <p className="reading-note">{c.boundary}</p><div className="reading-body"><h2>{c.basis}</h2><p>{narrative(pair.basis)}</p><h2>{c.perspectives}</h2><p>{narrative(pair.a_to_b)}</p><p>{narrative(pair.b_to_a)}</p>
      {(['alliance', 'rivalry', 'cp', 'turning_point', 'brake'] as const).map((key) => <section key={key}><h2>{c[key === 'turning_point' ? 'turning' : key]}</h2><p>{narrative(pair[key])}</p></section>)}
    </div><aside className="reading-related"><h2>{c.mechanism}</h2><ul>{pair.mechanism_ids.map((code) => { const slug = `mechanism-${code.toLowerCase()}`, article = articles.find((article) => article.slug === slug)!; return <li key={code}><a href={href(`/knowledge/${slug}`, locale)}>{t(article.title)}</a></li>; })}</ul><a href={href('/knowledge/relationships-method', locale)}>{c.framework} →</a></aside>
  </article></Frame>;
}
