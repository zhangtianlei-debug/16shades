'use client';
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Menu,
  Network,
  Search,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { characters } from '../data';
import { href, useI18n } from '@/app/i18n/provider';
import {
  useContentIndex,
  useSearchIndex,
  useWikiArticle,
} from '@/app/content-client/hooks';
import type { TheorySource, WikiArticle, WikiSummary } from '@/app/content-client/types';
import { CharacterAvatar } from './character-avatar';
import './knowledge.css';

type Props = {
  slug?: string;
  onNavigate: (slug?: string) => void;
  onOpenType: (id: string) => void;
  onOpenTypes: () => void;
  onOpenRelationships: () => void;
};
const text = {
  zh: {
    loading: '正在加载知识库…',
    retry: '重新加载',
    stale: '正在显示最近一次可用内容。',
    unavailable: '这篇文章暂时不可用。',
    search: '搜索概念、情境或全文',
    more: '加载更多',
    home: '知识库首页',
    directory: '阅读目录',
    result: '搜索结果',
    noResult: '没有找到相关条目。',
    failed: '知识库暂时无法加载，请重试。',
    updated: '项目知识库 · 更新于 ',
  },
  en: {
    loading: 'Loading the library…',
    retry: 'Retry',
    stale: 'Showing the most recently available content.',
    unavailable: 'This article is currently unavailable.',
    search: 'Search concepts, situations, or full text',
    more: 'Load more',
    home: 'Library home',
    directory: 'Reading directory',
    result: 'Search results',
    noResult: 'No matching entry.',
    failed: 'The library could not be loaded. Please retry.',
    updated: 'Project library · Updated ',
  },
};
const local = (value: { zh: string; en: string }, locale: 'zh' | 'en') =>
  value[locale];
const heading = /^(#{1,6})\s+(.+)$/;
function headings(body: string) {
  return body.split('\n').flatMap((line, lineNo) => {
    const found = line.match(heading);
    return found
      ? [
          {
            line: lineNo,
            level: found[1].length,
            text: found[2],
            id: `section-${lineNo}`,
          },
        ]
      : [];
  });
}
function Inline({
  value,
  onNavigate,
}: {
  value: string;
  onNavigate: (slug: string) => void;
}) {
  return (
    <>
      {value
        .split(/(\[[^\]]+\]\([^)]*\)|\*\*[^*]+\*\*|`[^`]+`)/g)
        .map((part, i) => {
          const link = part.match(/^\[([^\]]+)\]\(([^)]*)\)$/);
          if (link) {
            const target = link[2];
            let decoded = target;
            try { decoded = decodeURIComponent(target); } catch { /* Keep malformed legacy links observable. */ }
            if (/^https?:/.test(target))
              return (
                <a
                  className="knowledge-inline-link"
                  href={target}
                  target="_blank"
                  rel="noreferrer"
                  key={i}
                >
                  {link[1]} <ArrowUpRight size={12} />
                </a>
              );
            if (target.startsWith('#'))
              return (
                <a className="knowledge-inline-link" href={target} key={i}>
                  {link[1]}
                </a>
              );
            return (
              <button
                className="knowledge-inline-link"
                key={i}
                onClick={() => onNavigate(decoded === '01_心理学底层.md' ? 'theory-sources' : decoded.replace(/^.*\//, '').replace(/^knowledge\//, ''))}
              >
                {link[1]}
              </button>
            );
          }
          if (part.startsWith('**'))
            return <strong key={i}>{part.slice(2, -2)}</strong>;
          if (part.startsWith('`'))
            return <code key={i}>{part.slice(1, -1)}</code>;
          return part;
        })}
    </>
  );
}
function Markdown({
  body,
  onNavigate,
}: {
  body: string;
  onNavigate: (slug: string) => void;
}) {
  const lines = body.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || /^<a\s+id=/.test(line) || /^---+$/.test(line)) {
      i++;
      continue;
    }
    const h = line.match(heading);
    if (h) {
      const Tag = `h${h[1].length}` as 'h2';
      blocks.push(
        <Tag id={`section-${i}`} key={i}>
          <Inline value={h[2]} onNavigate={onNavigate} />
        </Tag>,
      );
      i++;
      continue;
    }
    if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      const ordered = /^\d/.test(line),
        pattern = ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/,
        items: string[] = [];
      while (i < lines.length && pattern.test(lines[i]))
        items.push(lines[i++].replace(pattern, ''));
      const Tag = ordered ? 'ol' : 'ul';
      blocks.push(
        <Tag key={i}>
          {items.map((x, n) => (
            <li key={n}>
              <Inline value={x} onNavigate={onNavigate} />
            </li>
          ))}
        </Tag>,
      );
      continue;
    }
    if (line.startsWith('|') && (lines[i + 1] ?? '').startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|?\s*:?-{3,}/.test(lines[i]))
          rows.push(
            lines[i]
              .split('|')
              .slice(1, -1)
              .map((x) => x.trim()),
          );
        i++;
      }
      const [head, ...rest] = rows;
      blocks.push(
        <div className="knowledge-table-wrap" key={i}>
          <table>
            <thead>
              <tr>
                {head?.map((x, n) => (
                  <th key={n}>
                    <Inline value={x} onNavigate={onNavigate} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rest.map((row, n) => (
                <tr key={n}>
                  {row.map((x, m) => (
                    <td key={m}>
                      <Inline value={x} onNavigate={onNavigate} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const para = [lines[i++]];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|\||[-*]\s|\d+[.)]\s|<a\s)/.test(lines[i])
    )
      para.push(lines[i++]);
    blocks.push(
      <p key={i}>
        <Inline value={para.join(' ')} onNavigate={onNavigate} />
      </p>,
    );
  }
  return <>{blocks}</>;
}
function Status({
  loading,
  error,
  cached,
  retry,
}: {
  loading: boolean;
  error: string | null;
  cached: boolean;
  retry: () => void;
}) {
  const { locale } = useI18n();
  const c = text[locale];
  if (!loading && !error && !cached) return null;
  return (
    <output className="knowledge-status">
      {loading && <span>{c.loading}</span>}
      {cached && <span>{c.stale}</span>}
      {error && (
        <>
          <span>{c.failed}</span>
          <button onClick={retry}>{c.retry}</button>
        </>
      )}
    </output>
  );
}
export function Knowledge({
  slug,
  onNavigate,
  onOpenType,
  onOpenTypes,
  onOpenRelationships,
}: Props) {
  const { locale, t } = useI18n();
  const c = text[locale],
    index = useContentIndex();
  const target = index.value?.wiki.articles.find((a) => a.slug === slug);
  const detail = useWikiArticle(slug ? target?.url : undefined, index.value?.revision);
  const [query, setQuery] = useState(''),
    [drawer, setDrawer] = useState(false),
    [visible, setVisible] = useState(24);
  const search = useSearchIndex(
    query.trim() ? index.value?.wiki.search[locale] : undefined,
    index.value?.revision,
    locale,
  );
  const articles = index.value?.wiki.articles ?? [];
  const results = useMemo(
    () =>
      !query.trim()
        ? []
        : ((search.value?.entries ?? [])
            .filter((x) =>
              x.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
            )
            .map((x) => articles.find((a) => a.slug === x.slug))
            .filter(Boolean) as WikiSummary[]),
    [query, search.value, articles],
  );
  const go = (next?: string) => {
    setDrawer(false);
    onNavigate(next);
  };
  const directory = (
    <nav className="knowledge-directory" aria-label={c.directory}>
      <p>{c.directory}</p>
      <button className={!slug ? 'active' : ''} onClick={() => go()}>
        {c.home}
        <ChevronRight size={14} />
      </button>
      {(index.value?.wiki.directory ?? []).map((id) => {
        const item = articles.find((article) => article.slug === id);
        return item ? <button type="button" className={slug === id ? 'active' : ''} key={id} onClick={() => go(id)}>{local(item.title, locale)}<ChevronRight size={14} /></button> : null;
      })}
      <hr />
      <button onClick={onOpenTypes}>
        {t('人物图鉴 ')}
        <ArrowUpRight size={14} />
      </button>
      <button onClick={onOpenRelationships}>
        {t('探索人物关系 ')}
        <ArrowUpRight size={14} />
      </button>
    </nav>
  );
  return (
    <section className="knowledge-shell">
      <button
        className="knowledge-mobile-menu"
        onClick={() => setDrawer(true)}
        aria-label={t('打开目录')}
      >
        <Menu size={19} />
        {t('目录 ')}
      </button>
      {drawer && (
        <div className="knowledge-drawer">
          <button
            className="knowledge-drawer-close"
            onClick={() => setDrawer(false)}
          >
            <X size={18} />
            {t('关闭 ')}
          </button>
          {directory}
        </div>
      )}
      <aside className="knowledge-fog knowledge-left">{directory}</aside>
      <div className="knowledge-main">
        <Status {...index} />
        {slug ? (
          <ArticleView
            target={target}
            detail={detail}
            onNavigate={go}
            onOpenType={onOpenType}
          />
        ) : (
          <Home
            articles={articles}
            categories={index.value?.wiki.categories ?? []}
            featured={index.value?.wiki.featured ?? []}
            query={query}
            setQuery={(value) => { setQuery(value); setVisible(24); }}
            results={results}
            visible={visible}
            more={() => setVisible((n) => n + 24)}
            onNavigate={go}
            onOpenType={onOpenType}
            locale={locale}
          />
        )}
      </div>
      {slug && detail.value ? (
        <ArticleRail
          article={detail.value}
          articles={articles}
          onNavigate={go}
          locale={locale}
        />
      ) : (
        <HomeRail count={articles.length} onNavigate={go} />
      )}
    </section>
  );
}
function Home({
  articles,
  categories,
  featured,
  query,
  setQuery,
  results,
  visible,
  more,
  onNavigate,
  onOpenType,
  locale,
}: {
  articles: WikiSummary[];
  categories: {
    id: string;
    label: { zh: string; en: string };
    order: number;
  }[];
  featured: string[];
  query: string;
  setQuery: (s: string) => void;
  results: WikiSummary[];
  visible: number;
  more: () => void;
  onNavigate: (s: string) => void;
  onOpenType: (s: string) => void;
  locale: 'zh' | 'en';
}) {
  const { t } = useI18n();
  const c = text[locale],
    list = query ? results : articles,
    groups = categories
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((x) => [x, articles.filter((a) => a.category === x.id)] as const);
  let remaining = visible;
  const pagedGroups = groups.map(([category, items]) => {
    const shown = items.slice(0, Math.max(0, remaining));
    remaining -= shown.length;
    return [category, shown] as const;
  });
  return (
    <>
      <section className="knowledge-card knowledge-hero">
        <p className="knowledge-eyebrow">16 SHADES / LIBRARY</p>
        <h1>
          {locale === 'zh' ? (
            <>
              人物背后的
              <br />
              <em>规则。</em>
            </>
          ) : (
            <>
              Rules behind
              <br />
              <em>the characters.</em>
            </>
          )}
        </h1>
        <p>
          {locale === 'zh'
            ? '这里解释16型怎样划分、结果怎样计算，以及这些说法有哪些依据。'
            : 'How the 16 types are defined, how results work, and what supports these claims.'}
        </p>
        <label className="knowledge-search">
          <Search size={19} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={c.search}
          />
        </label>
      </section>
      {query ? (
        <ArticleSection
          title={c.result}
          list={list.slice(0, visible)}
          onNavigate={onNavigate}
        />
      ) : (
        <>
          <section className="knowledge-card knowledge-section">
            <div className="knowledge-section-heading">
              <div>
                <p className="knowledge-eyebrow">
                  {locale === 'zh' ? '知识网络' : 'THE KNOWLEDGE NETWORK'}
                </p>
                <h2>
                  {locale === 'zh'
                    ? '从模型出发，连接到关系与人物。'
                    : 'From the model to relationships and characters.'}
                </h2>
              </div>
            </div>
            <div className="knowledge-network">
              <button onClick={() => onNavigate('relationships-overview')}>
                <Network size={19} />
                <small>{locale === 'zh' ? '互动与情境' : 'INTERACTIONS'}</small>
                <strong>
                  {locale === 'zh'
                    ? '两个人，一个局面'
                    : 'Two people, one scene'}
                </strong>
              </button>
              <div className="knowledge-network-center">
                <BookOpen size={20} />
                <strong>{locale === 'zh' ? '四轴定型' : 'Four axes'}</strong>
              </div>
              <button onClick={() => onNavigate('type-families')}>
                <small>{locale === 'zh' ? '人物与结构' : 'CHARACTERS'}</small>
                <strong>
                  {locale === 'zh' ? '16种不同的画像' : '16 distinct profiles'}
                </strong>
              </button>
            </div>
          </section>
          <ArticleSection
            title={locale === 'zh' ? '从这里开始读' : 'Start reading here'}
            list={
              featured
                .map((s) => articles.find((a) => a.slug === s))
                .filter(Boolean) as WikiSummary[]
            }
            onNavigate={onNavigate}
          />
          <section className="knowledge-card knowledge-section">
            <h2>{locale === 'zh' ? '16型人物' : 'The 16 characters'}</h2>
            <div className="knowledge-type-row">
              {characters.slice(0, 8).map((type) => (
                <button onClick={() => onOpenType(type.id)} key={type.id}>
                  <CharacterAvatar id={type.id} alt={t(type.name)} size={48} />
                  <span>{t(type.name)}</span>
                </button>
              ))}
              <button
                className="knowledge-more"
                onClick={() => onNavigate('type-families')}
              >
                {locale === 'zh' ? '查看全部16型' : 'View all 16'}
                <ArrowUpRight size={15} />
              </button>
            </div>
          </section>
          {pagedGroups.map(([category, items]) => (
            <ArticleSection
              id={`category-${category.id}`}
              key={category.id}
              title={local(category.label, locale)}
              list={items.slice(0, visible)}
              onNavigate={onNavigate}
            />
          ))}
        </>
      )}
      {list.length > visible && (
        <button className="knowledge-load-more" onClick={more}>
          {c.more}
        </button>
      )}
    </>
  );
}
function ArticleSection({
  title,
  list,
  onNavigate,
  id,
}: {
  title: string;
  list: WikiSummary[];
  onNavigate: (s: string) => void;
  id?: string;
}) {
  return (
    <section className="knowledge-card knowledge-section" id={id}>
      <h2>{title}</h2>
      {list.length ? (
        <div className="knowledge-entry-grid">
          {list.map((item) => (
            <Entry key={item.slug} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      ) : (
        <p className="knowledge-empty">—</p>
      )}
    </section>
  );
}
function Entry({
  item,
  onNavigate,
}: {
  item: WikiSummary;
  onNavigate: (s: string) => void;
}) {
  const { locale } = useI18n();
  return (
    <a
      className="knowledge-entry"
      href={href(`/knowledge/${item.slug}`)}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(item.slug);
      }}
    >
      <span>{local(item.kind, locale)}</span>
      <h3>{local(item.title, locale)}</h3>
      <p>{local(item.summary, locale)}</p>
      <ChevronRight size={17} />
    </a>
  );
}
function ArticleView({
  target,
  detail,
  onNavigate,
  onOpenType,
}: {
  target?: WikiSummary;
  detail: ReturnType<typeof useWikiArticle>;
  onNavigate: (s?: string) => void;
  onOpenType: (s: string) => void;
}) {
  const { locale, t } = useI18n(),
    c = text[locale];
  if (!target)
    return (
      <section className="knowledge-card knowledge-section">
        <p>{c.unavailable}</p>
      </section>
    );
  if (!detail.value)
    return (
      <section className="knowledge-card knowledge-section">
        <Status {...detail} />
      </section>
    );
  const article = detail.value;
  return (
    <article className="knowledge-card knowledge-article">
      <Status {...detail} />
      <nav className="proto-breadcrumb">
        <button onClick={() => onNavigate()}>{c.home}</button>
        <ChevronRight size={14} />
        <span>{local(article.title, locale)}</span>
      </nav>
      <p className="knowledge-eyebrow">{local(article.kind, locale)}</p>
      <h1>{local(article.title, locale)}</h1>
      <p className="knowledge-lead">{local(article.summary, locale)}</p>
      {article.slug === 'type-families' && (
        <div className="knowledge-type-directory">
          {characters.map((type) => (
            <button onClick={() => onOpenType(type.id)} key={type.id}>
              <CharacterAvatar id={type.id} alt={t(type.name)} size={52} />
              <span>
                <small>{t(type.structure)}</small>
                {t(type.name)}
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>
      )}
      <AxisOverview slug={article.slug} />
      <div className="knowledge-prose">
        <Markdown
          body={local(article.body, locale)}
          onNavigate={(s) => onNavigate(s)}
        />
      </div>
      {article.slug === 'theory-sources' && (
        <SourceList sources={article.sources} locale={locale} />
      )}
      <p className="knowledge-version">
        {c.updated}
        {article.updatedAt}
      </p>
    </article>
  );
}
function SourceList({
  sources,
  locale,
}: {
  sources?: TheorySource[];
  locale: 'zh' | 'en';
}) {
  if (!sources?.length) return null;
  return (
    <section className="knowledge-source-list">
      <h2>
        {locale === 'zh'
          ? '人物关系的理论参照'
          : 'Theory references for relationships'}
      </h2>
      <p>
        {locale === 'zh'
          ? '下列来源支撑相关问题的讨论；不代表已验证本项目的16型配对。'
          : 'These sources inform the discussion; they do not validate this project’s type pairings.'}
      </p>
      {sources.map((source) => (
        <article key={source.id} id={source.id}>
          <small>
            {source.id} · {local(source.kind, locale)}
            {source.year ? ` · ${source.year}` : ''}
          </small>
          <h3>
            <a href={source.url} target="_blank" rel="noreferrer">
              {local(source.title, locale)}
              <ArrowUpRight size={15} />
            </a>
          </h3>
          {source.authors && <p>{source.authors}</p>}
          <h4>{locale === 'zh' ? '研究结论' : 'Findings'}</h4>
          <ul>{source.findings[locale].map((finding) => <li key={finding}>{finding}</li>)}</ul>
          <p><strong>{locale === 'zh' ? '适用边界：' : 'Limits: '}</strong>{source.limits[locale].join(' ')}</p>
          {source.open_access_url && (
            <a
              className="knowledge-inline-link"
              href={source.open_access_url}
              target="_blank"
              rel="noreferrer"
            >
              {locale === 'zh' ? '查看开放版本' : 'Open-access version'}{' '}
              <ArrowUpRight size={12} />
            </a>
          )}
        </article>
      ))}
    </section>
  );
}
function ArticleRail({
  article,
  articles,
  onNavigate,
  locale,
}: {
  article: WikiArticle;
  articles: WikiSummary[];
  onNavigate: (s: string) => void;
  locale: 'zh' | 'en';
}) {
  const toc = headings(local(article.body, locale)).filter(
    (x) => x.level === 2,
  );
  return (
    <aside className="knowledge-fog knowledge-right">
      <section>
        <p>{locale === 'zh' ? '本页目录' : 'ON THIS PAGE'}</p>
        {toc.map((item) => (
          <a href={`#${item.id}`} key={item.id}>
            {item.text}
          </a>
        ))}
      </section>
      <section>
        <p>{locale === 'zh' ? '继续阅读' : 'KEEP READING'}</p>
        {article.related
          .map((id) => articles.find((a) => a.slug === id))
          .filter(Boolean)
          .map((item) => (
            <button key={item!.slug} onClick={() => onNavigate(item!.slug)}>
              {local(item!.title, locale)}
              <ChevronRight size={14} />
            </button>
          ))}
      </section>
    </aside>
  );
}
function HomeRail({ count, onNavigate }: { count: number; onNavigate: (slug: string) => void }) {
  const { locale, t } = useI18n();
  return (
    <aside className="knowledge-fog knowledge-right knowledge-home-rail">
      <section>
        <p>{t('开始你的阅读路径')}</p>
        <h3>{t('先认识四条轴')}</h3>
        <span>{t('从最想保住什么开始，再看看行动路径、冲突和规则。')}</span>
        <button type="button" onClick={() => onNavigate('model-overview')}>
          {t('了解四轴与16型 ')}<ArrowUpRight size={14} />
        </button>
      </section>
      <section>
        <p>{locale === 'zh' ? '知识库里有什么' : 'IN THE LIBRARY'}</p>
        <div className="knowledge-counts">
          <strong>
            {count}
            <small>{locale === 'zh' ? '知识条目' : 'entries'}</small>
          </strong>
          <strong>
            16<small>{locale === 'zh' ? '人物档案' : 'characters'}</small>
          </strong>
        </div>
        <span>{t('项目定义、外部理论参照与人物演绎，均在条目中标出。')}</span>
      </section>
      <section>
        <p>{t('常被问起')}</p>
        <button type="button" onClick={() => onNavigate('type-share-estimation')}>
          {t('类型在人群里占多少？ ')}<ChevronRight size={14} />
        </button>
        <button type="button" onClick={() => onNavigate('relationships-method')}>
          {t('人物关系怎样整理？ ')}<ChevronRight size={14} />
        </button>
        <button type="button" onClick={() => onNavigate('theory-sources')}>
          {t('这些说法有什么依据？ ')}<ChevronRight size={14} />
        </button>
      </section>
    </aside>
  );
}
function AxisOverview({ slug }: { slug: string }) {
  const { locale, t } = useI18n(),
    axes: Record<string, [string, string, string, string]> = {
      goal: ['利', '实际所得', '权', '决定权'],
      method: ['谋', '安排信息与选项', '压', '直接设置条件'],
      conflict: ['用', '伤害服务于目标', '惩', '付出代价本身有价值'],
      norm: ['饰', '借规范与体面包装', '蔑', '较少依赖规范认可'],
    },
    axis = axes[slug];
  return axis ? (
    <div className="knowledge-axis-visual">
      <div>
        <strong>{t(axis[0])}</strong>
        <span>{t(axis[1])}</span>
      </div>
      <i>{locale === 'zh' ? '相对优先' : 'relative priority'}</i>
      <div>
        <strong>{t(axis[2])}</strong>
        <span>{t(axis[3])}</span>
      </div>
    </div>
  ) : null;
}
