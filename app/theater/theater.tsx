'use client';
/* oxlint-disable next/no-img-element -- Remote comic panels keep their published dimensions. */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  LightbulbOff,
  Maximize,
  Minimize,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { SharedHeader } from '@/components/shared-header';
import { characters } from '../data';
import { useI18n } from '../i18n/provider';
import { inlineCharacterSvg } from '../prototype/svg-instance';
import { characterArtworkSrc } from '../prototype/character-artwork';
import tyrant from '../prototype/assets/t16-motion.svg?raw';
import { useContentIndex, useTheaterStory } from '@/app/content-client/hooks';
import type { TheaterEpisode, TheaterPanel, TheaterStory } from '@/app/content-client/types';
import copy from './ui.json';
import './theater.css';
const progressKey = 'shadow16-theater-reading-v1',
  pageSize = 3,
  inset = 20;
function LightKeeper({ active = false }: { active?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const markup = useMemo(
    () =>
      inlineCharacterSvg(
        tyrant
          .replace(
            /<title\b[^>]*>[\s\S]*?<\/title>|<desc\b[^>]*>[\s\S]*?<\/desc>|<metadata\b[^>]*\/>/g,
            '',
          )
          .replace(/aria-labelledby="[^"]*"/g, ''),
        id,
      ),
    [id],
  );
  return (
    <div
      className={`theater-keeper ${active ? 'is-acting' : ''}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
function ComicImage({
  panel,
  locale,
  eager = false,
}: {
  panel: TheaterPanel;
  locale: 'zh' | 'en';
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0),
    c = copy[locale];
  return (
    <div
      className="theater-image"
      style={{ aspectRatio: `${panel.width} / ${panel.height}` }}
    >
      {failed ? (
        <output className="theater-image-error">
          <p>{c.imageError}</p>
          <button
            onClick={() => {
              setFailed(false);
              setAttempt((x) => x + 1);
            }}
          >
            <RotateCcw size={16} />
            {c.retry}
          </button>
        </output>
      ) : (
        <img
          key={attempt}
          src={`${panel.src[locale]}${attempt ? `?retry=${attempt}` : ''}`}
          width={panel.width}
          height={panel.height}
          alt={panel.alt[locale]}
          loading={eager ? 'eager' : 'lazy'}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
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
  const { locale } = useI18n(),
    c = copy[locale];
  if (!loading && !error && !cached) return null;
  return (
    <output className="theater-content-status">
      {loading && (
        <span>{locale === 'zh' ? '正在加载剧集…' : 'Loading episodes…'}</span>
      )}
      {cached && (
        <span>
          {locale === 'zh'
            ? '正在显示最近一次可用内容。'
            : 'Showing the most recently available content.'}
        </span>
      )}
      {error && (
        <>
          <span>{locale === 'zh' ? '剧集暂时无法加载，请重试。' : 'Episodes could not be loaded. Please retry.'}</span>
          <button onClick={retry}>{c.retry}</button>
        </>
      )}
    </output>
  );
}
export default function Theater() {
  const { locale, href, asset, t } = useI18n(),
    c = copy[locale],
    index = useContentIndex();
  const episodes = index.value?.theater.episodes ?? [];
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<string | null>(null),
    [opening, setOpening] = useState(false),
    [light, setLight] = useState(false),
    [marks, setMarks] = useState<Record<string, number>>({}),
    [pageIndex, setPageIndex] = useState(0),
    [progress, setProgress] = useState(0),
    [full, setFull] = useState(false),
    [notice, setNotice] = useState(''),
    [shelf, setShelf] = useState(false),
    [zoomed, setZoomed] = useState(false),
    [readerSize, setReaderSize] = useState({ width: 0, height: 0, footer: 60 });
  const active = episodes.find((x) => x.id === selected),
    detail = useTheaterStory(active?.url, index.value?.revision);
  const story = detail.value;
  const readerRef = useRef<HTMLDialogElement>(null),
    scrollRef = useRef<HTMLDivElement>(null),
    columnRef = useRef<HTMLDivElement>(null),
    closeRef = useRef<HTMLButtonElement>(null),
    openerRef = useRef<HTMLElement | null>(null),
    pageRefs = useRef<(HTMLElement | null)[]>([]),
    markRef = useRef(marks),
    selectedRef = useRef(selected),
    indexRef = useRef(0),
    fullOwned = useRef(false);
  const total = Math.max(1, Math.ceil(episodes.length / pageSize)),
    first = episodes[0],
    fit =
      story && readerSize.width
        ? Math.min(
            1,
            (Math.max(1, readerSize.height - inset - readerSize.footer) *
              Math.min(...story.panels.map((x) => x.width / x.height))) /
              readerSize.width,
          )
        : 1,
    zoomPct = Math.round((zoomed ? 1 : fit) * 100);
  const featureDetail = useTheaterStory(first?.url, index.value?.revision);
  const remember = useCallback(() => {
    if (!selectedRef.current) return;
    const next = { ...markRef.current, [selectedRef.current]: indexRef.current };
    markRef.current = next;
    setMarks(next);
    try {
      sessionStorage.setItem(progressKey, JSON.stringify(next));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(progressKey) ?? '{}');
      if (saved && typeof saved === 'object') { markRef.current = saved; setMarks(saved); }
    } catch {}
    const url = new URL(window.location.href),
      id = url.searchParams.get('episode');
    if (id) {
      setSelected(id);
      setOpening(false);
    }
    const raw = Number(url.searchParams.get('page'));
    if (Number.isInteger(raw) && raw > 0) setPage(raw);
    const pop = () => {
      const next = new URL(window.location.href).searchParams.get('episode');
      setSelected(next);
      setOpening(false);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    selectedRef.current = selected;
    return () => remember();
  }, [selected, remember]);
  useEffect(() => {
    if (selected && episodes.length && !active) {
      setNotice(c.badEpisode);
      setSelected(null);
    }
  }, [selected, episodes.length, active, c.badEpisode]);
  const openEpisode = (
    id: string,
    animate = true,
    push = true,
    event?: React.MouseEvent<HTMLElement>,
  ) => {
    if (!episodes.some((x) => x.id === id)) {
      setNotice(c.badEpisode);
      return;
    }
    openerRef.current =
      event?.currentTarget ?? (document.activeElement as HTMLElement);
    setSelected(id);
    setShelf(false);
    setZoomed(false);
    indexRef.current = marks[id] ?? 0;
    setPageIndex(indexRef.current);
    setOpening(animate);
    const url = new URL(window.location.href);
    url.searchParams.set('episode', id);
    if (push)
      window.history.pushState(
        { ...window.history.state, theaterReader: true },
        '',
        url,
      );
  };
  const close = useCallback(() => {
    remember();
    setSelected(null);
    setShelf(false);
    if (fullOwned.current && document.fullscreenElement)
      document.exitFullscreen().catch(() => {});
    fullOwned.current = false;
    if (window.history.state?.theaterReader) window.history.back();
    else {
      const url = new URL(window.location.href);
      url.searchParams.delete('episode');
      window.history.replaceState(window.history.state, '', url);
    }
  }, [remember]);
  useEffect(() => {
    if (!opening) return;
    const timer = window.setTimeout(() => setOpening(false), 1850);
    return () => clearTimeout(timer);
  }, [opening]);
  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...(readerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select, a[href], summary, [tabindex="0"]') ?? [])].filter((node) => node.getClientRects().length && !node.closest('[inert]'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const fullscreenChange = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('keydown', keydown);
    document.addEventListener('fullscreenchange', fullscreenChange);
    window.addEventListener('pagehide', remember);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); document.removeEventListener('fullscreenchange', fullscreenChange); window.removeEventListener('pagehide', remember); openerRef.current?.focus({ preventScroll: true }); };
  }, [selected, close, remember]);
  useEffect(() => {
    // Async stories mount a new reading surface only after their content loads.
    const container = scrollRef.current,
      column = columnRef.current;
    if (!selected || !story || !container || !column) return;
    const measure = () =>
      setReaderSize({
        width: column.clientWidth,
        height: container.clientHeight,
        footer: container.clientWidth <= 960 ? 92 : 60,
      });
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(column);
    measure();
    return () => observer.disconnect();
  }, [selected, story]);
  const align = useCallback((n: number, smooth = false) => {
    const node = pageRefs.current[n],
      box = scrollRef.current;
    if (!node || !box) return;
    box.scrollTo({
      top:
        box.scrollTop +
        node.getBoundingClientRect().top -
        box.getBoundingClientRect().top -
        inset,
      behavior: smooth ? 'smooth' : 'instant',
    });
  }, []);
  useLayoutEffect(() => {
    if (selected && !opening && readerSize.width) align(indexRef.current);
  }, [selected, opening, readerSize, zoomed, align]);
  const track = () => {
    const box = scrollRef.current;
    if (!box || !story || opening) return;
    let current = 0;
    pageRefs.current.forEach((node, i) => {
      if (
        node &&
        node.getBoundingClientRect().top - box.getBoundingClientRect().top <
          box.clientHeight * 0.48
      )
        current = i;
    });
    indexRef.current = Math.min(current, story.panels.length - 1);
    setPageIndex(indexRef.current);
    setProgress(
      Math.min(
        100,
        (100 * box.scrollTop) /
          Math.max(1, box.scrollHeight - box.clientHeight),
      ),
    );
  };
  const change = (next: number) => {
    setPage(next);
    const url = new URL(window.location.href);
    next === 1
      ? url.searchParams.delete('page')
      : url.searchParams.set('page', String(next));
    window.history.pushState(window.history.state, '', url);
    requestAnimationFrame(() =>
      document
        .getElementById('theater-episodes')
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
    );
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await readerRef.current?.requestFullscreen(); fullOwned.current = true; }
    } catch {
      setNotice(c.fullscreenError);
    }
  };
  const currentList = episodes.slice((page - 1) * pageSize, page * pageSize),
    nextEpisode = active
      ? episodes[episodes.findIndex((x) => x.id === active.id) + 1]
      : undefined;
  return (
    <div className="theater-site">
      <div inert={selected ? true : undefined}>
        <SharedHeader current="theater" />
        <main className="theater-main">
          <Status {...index} />
          <section className="theater-intro">
            <div>
              <p className="theater-eyebrow">
                <span className="theater-live-dot" />
                {c.label}
                <span className="theater-intro-rule" />
              </p>
              <h1>
                {c.hero1}
                <br />
                <em>{c.hero2}</em>
              </h1>
              <p className="theater-lead">{c.intro}</p>
            </div>
            <div className="theater-stage-sign">
              <span>16</span>
              <span>
                SHADES
                <br />
                ON STAGE
              </span>
              <i>✳</i>
            </div>
          </section>
          {first && (
        <section className="theater-feature">
          <Feature episode={first} story={featureDetail.value} locale={locale} c={c} marks={marks} open={openEpisode} href={href} asset={asset} t={t} />
              <div className="theater-keeper-note">
                <span>{c.openingQuote}</span>
                <LightKeeper />
              </div>
            </section>
          )}
          <section className="theater-episode-section" id="theater-episodes">
            <div className="theater-section-heading">
              <div>
                <h2>
                  {c.all}
                  <span>{String(episodes.length).padStart(2, '0')}</span>
                </h2>
                <p>{c.listNote}</p>
              </div>
            </div>
            <div className="theater-episode-grid">
              {currentList.map((item) => (
                <button
                  className="theater-episode"
                  key={item.id}
                  onClick={(e) => openEpisode(item.id, true, true, e)}
                >
                  <span className="theater-episode-image">
                    <img src={item.cover[locale]} alt="" loading="lazy" />
                    <span className="theater-episode-number">{item.id}</span>
                    <span className="theater-episode-arrow">
                      <ArrowRight size={22} />
                    </span>
                  </span>
                  <span className="theater-episode-text">
                    <span className="theater-episode-title">
                      {item.title[locale]}
                    </span>
                    <span className="theater-meta">
                      <span>
                        {item.pageCount} {c.pages}
                      </span>
                      <span>
                        {marks[item.id] === item.pageCount - 1 ? (
                          <>
                            <Check size={12} />
                            {c.readComplete}
                          </>
                        ) : (
                          c.minutes
                        )}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {total > 1 && (
              <nav className="theater-pagination">
                {' '}
                <button disabled={page === 1} onClick={() => change(page - 1)}>
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: total }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => change(i + 1)}
                    aria-current={page === i + 1 ? 'page' : undefined}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  disabled={page === total}
                  onClick={() => change(page + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </nav>
            )}
          </section>
          <footer className="theater-footer">
            <span>{c.footer}</span>
            <a href={href('/prototype?view=types')}>
              {c.home}
              <ArrowRight size={15} />
            </a>
          </footer>
        </main>
      </div>
      {active && (
        <dialog
          open
          ref={readerRef}
          className={`theater-reader ${light ? 'lights-on' : ''}`}
          aria-modal="true"
          aria-label={c.readerLabel}
        >
          {!story ? (
            <div className="theater-reader-loading">
              <button ref={closeRef} className="theater-reader-close" aria-label={c.close} onClick={close}>
                <X size={20} />
              </button>
              <Status {...detail} />
            </div>
          ) : (
            <>
              <header className="theater-reader-bar">
                <div className="theater-reader-identity">
                  <button
                    ref={closeRef}
                    className="theater-reader-close"
                    onClick={close}
                    aria-label={c.close}
                  >
                    <X size={20} />
                  </button>
                  <span>
                    <small>
                      {c.label} / {active.id}
                    </small>
                    <strong>{story.title[locale]}</strong>
                  </span>
                </div>
                <nav className="theater-reader-tools">
                  <button
                    className="theater-zoom"
                    onClick={() => setZoomed((x) => !x)}
                    disabled={fit === 1}
                    aria-label={`${c.zoom}: ${zoomPct}%. ${zoomed || fit === 1 ? c.fitPage : c.zoomIn}`}
                  >
                    <>
                      {zoomed ? <ZoomOut size={17} /> : <ZoomIn size={17} />}
                      <span>{zoomPct}%</span>
                    </>
                  </button>
                  <button onClick={() => setShelf((x) => !x)}>
                    {c.chapter}
                  </button>
                  <button onClick={() => setLight((x) => !x)} aria-label={light ? c.lightsOff : c.lightsOn}>
                    {light ? (
                      <LightbulbOff size={19} />
                    ) : (
                      <Lightbulb size={19} />
                    )}
                  </button>
                  <button onClick={fullscreen} aria-label={full ? (locale === 'zh' ? '退出全屏' : 'Exit fullscreen') : (locale === 'zh' ? '全屏' : 'Enter fullscreen')}>
                    {full ? <Minimize size={19} /> : <Maximize size={19} />}
                  </button>
                </nav>
                <progress
                  className="theater-progress"
                  value={Math.round(progress)}
                  max={100}
                />
              </header>
              {shelf && (
                <nav className="theater-reader-shelf">
                  {episodes.map((e) => (
                    <button
                      key={e.id}
                      aria-current={e.id === active.id ? 'page' : undefined}
                      onClick={() => openEpisode(e.id, false, false)}
                    >
                      <span>{e.id}</span>
                      {e.title[locale]}
                    </button>
                  ))}
                </nav>
              )}
              {notice && (
                <output className="theater-reader-notice">{notice}</output>
              )}
              <div
                className="theater-reader-scroll"
                ref={scrollRef}
                onScroll={track}
                inert={opening ? true : undefined}
              >
                <div className="theater-reading-column" ref={columnRef}>
                  <div className="theater-reader-intro">
                    <p>
                      {c.episodeWord} {active.id} {c.issueUnit}
                    </p>
                    <h2>{story.title[locale]}</h2>
                    <span>
                      {c.scrollHint}
                      <ArrowDown size={15} />
                    </span>
                  </div>
                  {story.panels.map((panel, i) => (
                    <figure
                      className="theater-comic-page"
                      style={{ width: `${(zoomed ? 1 : fit) * 100}%` }}
                      key={panel.id}
                      ref={(node) => {
                        pageRefs.current[i] = node;
                      }}
                    >
                      <ComicImage panel={panel} locale={locale} eager={i < 2} />
                      <figcaption>
                        <span>
                          {String(i + 1).padStart(2, '0')} /{' '}
                          {String(story.panels.length).padStart(2, '0')}
                        </span>
                        <span>{panel.title[locale]}</span>
                        <details>
                          <summary>{c.transcript}</summary>
                          <div>
                            {panel.lines[locale].map((line) => (
                              <p key={line}>{line}</p>
                            ))}
                          </div>
                        </details>
                      </figcaption>
                    </figure>
                  ))}
                  <section className="theater-reader-ending">
                    <span className="theater-end-mark">✳</span>
                    <p>
                      {c.label} · {active.id}
                    </p>
                    <h2>{c.ending}</h2>
                    <div>
                      {nextEpisode ? (
                        <button
                          className="theater-primary"
                          onClick={() =>
                            openEpisode(nextEpisode.id, false, true)
                          }
                        >
                          {c.nextEpisode}
                          <ArrowRight size={17} />
                        </button>
                      ) : (
                        <p>{c.lastIssue}</p>
                      )}
                      <button
                        className="theater-ending-secondary"
                        onClick={close}
                      >
                        {c.backList}
                      </button>
                    </div>
                    <button
                      className="theater-replay"
                      onClick={() => align(0, true)}
                    >
                      <RotateCcw size={14} />
                      {c.again}
                    </button>
                  </section>
                </div>
              </div>
              <aside className="theater-page-rail">
                {story.panels.map((panel, i) => (
                  <button
                    key={panel.id}
                    onClick={() => align(i, true)}
                    aria-current={pageIndex === i ? 'page' : undefined}
                  >
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <i />
                  </button>
                ))}
              </aside>
              <div className="theater-page-counter">
                {String(pageIndex + 1).padStart(2, '0')}
                <span>/ {String(story.panels.length).padStart(2, '0')}</span>
              </div>
              {opening && (
                <output className="theater-opening">
                  <div className="theater-light-cone" />
                  <div className="theater-opening-actor">
                    <p>{c.openingQuote}</p>
                    <LightKeeper active />
                    <span>{c.tyrant}</span>
                  </div>
                </output>
              )}
            </>
          )}
        </dialog>
      )}
    </div>
  );
}
function Feature({
  episode,
  story,
  locale,
  c,
  marks,
  open,
  href,
  asset,
  t,
}: {
  episode: TheaterEpisode;
  story: TheaterStory | null;
  locale: 'zh' | 'en';
  c: typeof copy.zh;
  marks: Record<string, number>;
  open: (
    id: string,
    animate?: boolean,
    push?: boolean,
    event?: React.MouseEvent<HTMLElement>,
  ) => void;
  href: (url: string) => string;
  asset: (url: string) => string;
  t: (value: string) => string;
}) {
  const preview = story?.panels ?? [];
  return (
    <>
      <div className="theater-feature-copy">
        <p className="theater-eyebrow">
          {c.latest}
          <span className="theater-tiny-rule" />
          {episode.id}
        </p>
        <h2>{episode.title[locale]}</h2>
        <p className="theater-feature-summary">{episode.summary[locale]}</p>
        <p className="theater-meta">
          <span>
            {episode.pageCount} {c.pages}
          </span>
          <span>{c.minutes}</span>
        </p>
        <button
          className="theater-primary"
          onClick={(e) => open(episode.id, true, true, e)}
        >
          {marks[episode.id] > 0 ? c.resume : c.read}
          <ArrowRight size={19} />
        </button>
        <p className="theater-entry-note">{c.introNote}</p>
        <div className="theater-cast">
          <span>{c.cast}</span>
          <div>
            {episode.cast.map((id) => (
              <a
                href={href(`/prototype/types/${id.toLowerCase()}`)}
                key={id}
                title={t(characters.find((x) => x.id === id)?.name ?? id)}
              >
                <img
                  src={asset(characterArtworkSrc(id))}
                  alt={t(characters.find((x) => x.id === id)?.name ?? id)}
                />
              </a>
            ))}
          </div>
        </div>
      </div>
      <button
        className="theater-feature-art"
        onClick={(e) => open(episode.id, true, true, e)}
      >
        <span className="theater-art-orbit" />
        <span className="theater-paper theater-paper-back"><img src={preview[1]?.src[locale] ?? episode.cover[locale]} alt="" /></span>
        <span className="theater-paper theater-paper-front">
          <img src={preview[0]?.src[locale] ?? episode.cover[locale]} alt="" />
        </span>
        <span className="theater-issue-stamp">
          NO.<strong>{episode.id}</strong>
        </span>
      </button>
    </>
  );
}
