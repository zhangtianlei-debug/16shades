'use client';
import { normalizeLanguagePath, useI18n } from '@/app/i18n/provider';
import { SharedHeader } from '@/components/shared-header';


import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ChevronDown,
  Play,
  Plus,
  RotateCcw,
  Share2,
} from 'lucide-react';
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { characters } from '@/app/data';
import { siteContact } from '@/app/site-contact';
import { characterSearchTitle, homeSearchTitle } from '@/app/search/titles.mjs';
import release from '@/release.json';
import { AnimatedCharacter } from './animated-character';
import { resultSilhouettes } from './result-presentation';
import { PersonalReport } from './personal-report';
import { RoleStory } from './role-story';
import { characterArtworkSrc } from './character-artwork';
import './personal-report.css';
import './interaction-motion.css';
import { Resources } from './resources';
import { AccountDialog } from './account-dialog';
import {
  AccountError,
  accountRequest,
  readAccount,
  watchAccountChanges,
  trackEvent,
  type AccountUser,
  type SavedResult,
} from './account-api';
import { CharacterAvatar } from './character-avatar';
import { rememberCharacterEntry } from './character-entry';
import { QuestionIllustration } from './question-illustration';
import { questionIllustrationSrc } from './question-illustrations';
import { choiceLabels } from './content';
import {
  axisKeys,
  candidateForm,
  exampleResult,
  scoreCandidate,
  type Answer,
  type CandidateResult,
  type Stage,
} from './scoring';
import {
  recommendRoles,
  showPercent,
  type Recommendation,
} from './recommendation';
import { familyClass, TypeCard, TypeLibrary } from './library';
import { Knowledge } from './knowledge';
import { MbtiExperience, OfficialPlay } from './mbti-experience';
import { IdentityCard, identityCopy } from './identity-card';
import {
  getCommunicationRole,
  readMbti,
  type MbtiType,
} from './social-content';
import './mbti-experience.css';
import './social-experience.css';
import {
  Relationships,
  RelationshipPreview,
  readRelationshipMode,
  type RelationshipMode,
} from './relationships';
import { PopulationEstimate, SCENARIO_ID } from './population-estimate';
import { hasCompletedVisit } from './visit-state';
import {
  readLocalResult,
  writeLocalResult,
  localResultKey,
  localResultPreferenceKey,
  localResultChanged,
} from './local-result';
import { subscribePrototypeHistory } from './history-bridge';
import {
  characterPath,
  combinationPath,
  prototypePath,
  prototypeSearch,
  type PrototypeView as View,
} from './navigation';

const hasPersonalResult = (candidate: CandidateResult | null | undefined) =>
  !!candidate && axisKeys.some((axis) => candidate.axes[axis].validCount > 0);

const typeName = (id: string) =>
  characters.find((item) => item.id === id)!.name;
const motionPreference = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? ('instant' as const)
    : ('smooth' as const);

function syncReadingLayout(root: HTMLElement | null, card: HTMLElement | null, view: View | null) {
  if (!root) return;
  const cardTop =
    card?.getBoundingClientRect().top ?? window.innerHeight;
  const cardStart = card?.offsetTop ?? window.innerHeight;
  const headerHeight =
    Number.parseFloat(
      getComputedStyle(root!).getPropertyValue(
        '--header-height',
      ),
    ) || 72;
  const progress = Math.max(
    0,
    Math.min(
      1,
      (cardStart - cardTop) / Math.max(1, cardStart - headerHeight - 16),
    ),
  );
  root?.style.setProperty('--reveal', String(progress));
  // Keep the result portrait at full contrast until the reading card covers
  // it. Clip at the card edge instead of fading on every scroll/resize.
  if (view === 'result') {
    root?.style.setProperty(
      '--result-hero-visible-height',
      `${Math.max(0, cardTop - headerHeight)}px`,
    );
  }
  const hintProgress = Math.min(1, Math.max(0, window.scrollY) / 64);
  root?.style.setProperty(
    '--hint-progress',
    String(hintProgress),
  );
  if (root) {
    root.dataset.expanded = String(
      view === 'result' ? cardTop <= headerHeight : progress > 0.96,
    );
    root.dataset.hintHidden = String(hintProgress === 1);
  }
}

function MatchList({
  recommendation,
  openType,
}: {
  recommendation: Recommendation;
  openType: (id: string) => void;
}) {
  const { t, tn } = useI18n();

  const row = (match: Recommendation['shares'][number], index: number) => (
    <button
      className="proto-match-row"
      type="button"
      key={match.id}
      onClick={() => openType(match.id)}
      aria-label={t(`查看${typeName(match.id)}，匹配约${showPercent(match.percent)}`)}
    >
      <span className="proto-match-index">
        {tn(String(index + 1).padStart(2, '0'))}
      </span>
      <CharacterAvatar id={match.id} size={60} alt={t("")} />
      <span className="proto-match-name">
        <strong>{tn(typeName(match.id))}</strong>
        <span className="proto-match-track">
          <i style={{ width: `${match.percent}%` }} />
        </span>
      </span>
      <span className="proto-match-percent">{tn(showPercent(match.percent))}</span>
      <ArrowRight size={16} />
    </button>
  );
  return (
    <section className="proto-match-list">
      <div className="proto-section-heading">
        <h3>
          {tn(recommendation.tied.length === recommendation.shares.length
            ? '16型暂时没有明显差别'
            : '也看看这些可能')}
        </h3>
        <span>{t("相对匹配 · 约")}</span>
      </div>
      <div className="proto-match-preview">
        {tn(recommendation.shares
          .slice(1, 3)
          .map((match, index) => row(match, index + 1)))}
      </div>
      <details className="proto-match-more">
        <summary>
          {t("查看完整16型分布 ")}<ChevronDown size={16} />
        </summary>
        {tn(recommendation.shares.map(row))}
      </details>
      <p className="proto-quiet">
        {t("这是由四条倾向读数组合得到的相对匹配，用于比较本次回答与各型的贴合程度；不是类型概率或准确率。相同比例按角色编号排列。 ")}</p>
    </section>
  );
}

export function Prototype({
  initialType,
  initialCombination,
}: {
  initialType?: string;
  initialCombination?: { roleId: string; mbti: MbtiType };
} = {}) {
  const { locale, t, tn, asset, href } = useI18n();
  const homeHeading = t('你还有，\n另一面。').split('\n');

  // The default document contains the real homepage for search readers.
  // The early history bootstrap hides query views until their route is read.
  const [route, setRoute] = useState<{
    search: string;
    scroll: number | null;
  } | null>(
    initialCombination
      ? {
          search: `?view=shared&type=${initialCombination.roleId.toLowerCase()}&mbti=${initialCombination.mbti}`,
          scroll: null,
        }
      : initialType
        ? { search: `?type=${initialType.toLowerCase()}`, scroll: null }
        : { search: '', scroll: null },
  );
  const params = useMemo(
    () => new URLSearchParams(route?.search),
    [route?.search],
  );
  const routeType = params.get('type')?.toUpperCase();
  const viewedCharacter = characters.find((item) => item.id === routeType);
  const requestedView = params.get('view');
  const [current, setCurrent] = useState(0);
  const [questionDirection, setQuestionDirection] = useState<
    'forward' | 'backward' | null
  >(null);
  const [stage, setStage] = useState<Stage>('basic');
  const [answers, setAnswers] = useState<(Answer | undefined)[]>(
    Array(48).fill(undefined),
  );
  const [testResult, setTestResult] = useState<CandidateResult | null>(null);
  const localResultActive = useRef(false);
  const [localExpiresAt, setLocalExpiresAt] = useState<number | null>(null);
  const [completedBefore, setCompletedBefore] = useState(false);
  const [relationshipPreviewModes, setRelationshipPreviewModes] = useState<
    Record<string, RelationshipMode>
  >({});
  const [retaking, setRetaking] = useState(false);
  const [modal, setModal] = useState<
    'account' | 'share' | 'feedback' | null
  >(null);
  useEffect(() => {
    if (params.get('account') !== '1') return;
    setModal('account');
    const next = new URLSearchParams(route?.search);
    next.delete('account');
    const search = next.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
    setRoute((previous) => previous ? { ...previous, search: search ? `?${search}` : '' } : previous);
  }, [params, route?.search]);
  useEffect(() => {
    // Preserve links to the former footer dialog.
    const openAbout = () => {
      if (window.location.hash === '#about') window.location.replace(href('/about'));
    };
    openAbout();
    window.addEventListener('hashchange', openAbout);
    return () => window.removeEventListener('hashchange', openAbout);
  }, [href]);
  const [toast, setToast] = useState('');
  const [personalMbti, setPersonalMbti] = useState<MbtiType | null>(null);
  const [sharedMbti, setSharedMbti] = useState<MbtiType | null>(null);
  const [shareCardKind, setShareCardKind] = useState<'basic' | 'mbti'>('basic');
  const [sharedType, setSharedType] = useState<string | null>(null);
  const [shareHint, setShareHint] = useState('');
  const [systemShareAvailable, setSystemShareAvailable] = useState(false);
  const [account, setAccount] = useState<AccountUser | null>(null);
  const signedIn = !!account;
  const [saved, setSaved] = useState<SavedResult | null>(null);
  const [savedPresentation, setSavedPresentation] =
    useState<Recommendation | null>(null);
  const [analyticsAvailable, setAnalyticsAvailable] = useState(false);
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [feedback, setFeedback] = useState('');
  const startedTest = useRef(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const saveRequest = useRef(false);
  const [resultNotice, setResultNotice] = useState('');
  const [resultSettling, setResultSettling] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const quizScroll = useRef(0);
  const resultScroll = useRef(0);
  const previousRecommended = useRef<string | null>(null);
  const completedTest =
    completedBefore ||
    hasPersonalResult(saved?.result) ||
    hasPersonalResult(testResult);
  const view: View | null =
    route === null || (requestedView === 'result' && !accountLoaded)
      ? null
      : requestedView === 'types' ||
          requestedView === 'principles' ||
          requestedView === 'resources' ||
          requestedView === 'knowledge' ||
          requestedView === 'relationships' ||
          requestedView === 'combo' ||
          requestedView === 'play' ||
          requestedView === 'quiz'
        ? requestedView
        : requestedView === 'shared' &&
            viewedCharacter &&
            readMbti(params.get('mbti'))
          ? 'shared'
          : requestedView === 'example'
            ? 'example'
            : viewedCharacter
              ? 'type'
              : requestedView === 'result' && testResult
                ? 'result'
                : 'home';
  const result = useMemo(
    () =>
      view === 'example'
        ? exampleResult(viewedCharacter?.id ?? 'T01')
        : testResult,
    [view, viewedCharacter?.id, testResult],
  );
  const recommendation = useMemo(
    () =>
      result
        ? view === 'result' && savedPresentation
          ? savedPresentation
          : recommendRoles(result)
        : null,
    [result, view, savedPresentation],
  );
  const character = characters.find(
    (item) => item.id === recommendation?.recommended,
  );
  const selected = answers[current];
  const illustration = questionIllustrationSrc(candidateForm.items[current].id);
  const upcomingIllustrations = useMemo(
    () =>
      candidateForm.items
        .slice(current + 1, current + 3)
        .map((item) => questionIllustrationSrc(item.id)),
    [current],
  );
  const canContinue = answers
    .slice(0, 16)
    .every((answer) => answer !== undefined);
  const isResult = view === 'result' || view === 'example';
  const isUnansweredResult = recommendation?.coverage === 0;
  const isAllTypesTied =
    !!recommendation &&
    recommendation.coverage > 0 &&
    recommendation.tied.length === recommendation.shares.length;
  const silhouettes = result && recommendation ? resultSilhouettes(result, recommendation) : [];
  const firstVisitHome = view === 'home' && !completedTest;
  const returningHome = view === 'home' && completedTest;
  const isStage = firstVisitHome || isResult;
  const latestResult = hasPersonalResult(testResult)
    ? testResult
    : hasPersonalResult(saved?.result)
      ? (saved?.result ?? null)
      : null;
  const latestCharacter = characters.find(
    (item) =>
      item.id ===
      (testResult && hasPersonalResult(testResult)
        ? recommendRoles(testResult).recommended
        : saved?.presentation.recommended),
  );
  const articleSlug = params.get('article') ?? undefined;
  const relationshipFirst =
    characters.find((item) => item.id === params.get('first')?.toUpperCase())
      ?.id ??
    latestCharacter?.id ??
    'T01';
  const relationshipSecond =
    characters.find((item) => item.id === params.get('second')?.toUpperCase())
      ?.id ?? 'T09';
  const relationshipMode = readRelationshipMode(params.get('mode'));
  const activeFamily =
    view === 'type'
      ? viewedCharacter?.id
      : isResult
        ? character?.id
        : undefined;
  const sharedCharacter = characters.find((item) => item.id === sharedType);
  const effectiveShareMbti = shareCardKind === 'mbti' ? sharedMbti : null;
  const sharedPath = sharedType
    ? effectiveShareMbti
      ? combinationPath(sharedType, effectiveShareMbti)
      : characterPath(sharedType)
    : '';
  const sharedLink =
    sharedPath && typeof window !== 'undefined'
      ? new URL(sharedPath, window.location.origin).href
      : '';
  const sharedCopy = sharedType
    ? identityCopy(sharedType, effectiveShareMbti)
    : null;
  const roleCommunication = character
    ? getCommunicationRole(character.id)
    : null;
  const browsingCombo = !!viewedCharacter;
  const comboRoleId = viewedCharacter?.id ?? latestCharacter?.id ?? 'T03';
  const comboPersonalized = !browsingCombo && !!latestResult;
  const comboMbti = browsingCombo ? readMbti(params.get('mbti')) : personalMbti;
  const worldView =
    view === 'types' ||
    view === 'type' ||
    view === 'relationships' ||
    view === 'resources' ||
    view === 'play';
  const currentResultSaved =
    !!account &&
    !!saved &&
    !!result &&
    JSON.stringify(saved.result) === JSON.stringify(result);
  const hasUnavailableSavedBasicResult =
    result?.stage === 'basic' && !canContinue;

  useEffect(() => {
    const restore = () => {
      const local = readLocalResult();
      localResultActive.current = !!local;
      if (local) setTestResult(local.result);
      setLocalExpiresAt(local?.expiresAt ?? null);
      setCompletedBefore(!!local);
    };
    restore();
    const sync = () => {
      const local = readLocalResult();
      setLocalExpiresAt(local?.expiresAt ?? null);
      setCompletedBefore(!!local);
      if (localResultActive.current) {
        setTestResult(local?.result ?? null);
        setSavedPresentation(null);
        localResultActive.current = !!local;
      }
    };
    const storage = (event: StorageEvent) => {
      if (
        event.key === null ||
        [localResultKey, localResultPreferenceKey].includes(event.key)
      )
        sync();
    };
    const visible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    window.addEventListener('storage', storage);
    window.addEventListener(localResultChanged, sync);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('storage', storage);
      window.removeEventListener(localResultChanged, sync);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);

  useEffect(() => {
    if (!localExpiresAt) return;
    const timer = window.setTimeout(
      () => {
        const local = readLocalResult();
        setLocalExpiresAt(local?.expiresAt ?? null);
        if (!local) {
          setCompletedBefore(false);
          if (localResultActive.current) {
            localResultActive.current = false;
            setTestResult(null);
            setSavedPresentation(null);
          }
        }
      },
      Math.max(0, localExpiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [localExpiresAt]);

  const refreshAccount = useEffectEvent(
    async (reason: 'storage' | 'visible') => {
      const previousUser = account?.id ?? null;
      const wasSavedView = !!savedPresentation;
      if (reason === 'storage') {
        setAccount(null);
        setSaved(null);
        if (wasSavedView) {
          setTestResult(null);
          setSavedPresentation(null);
        }
        setModal((currentModal) =>
          currentModal === 'account' ? null : currentModal,
        );
        setAccountLoaded(false);
      }
      try {
        const data = await readAccount();
        const identityChanged = (data.user?.id ?? null) !== previousUser;
        setAccount(data.user);
        setSaved(data.saved);
        if (hasPersonalResult(data.saved?.result)) {
          setCompletedBefore(true);
        }
        if (wasSavedView) {
          if (!identityChanged && data.saved) {
            setTestResult(data.saved.result);
            setSavedPresentation(data.saved.presentation);
          } else {
            setTestResult(null);
            setSavedPresentation(null);
          }
        }
        if (identityChanged)
          setModal((currentModal) =>
            currentModal === 'account' ? null : currentModal,
          );
      } catch {
        /* Storage-triggered changes already cleared old private account data. */
      } finally {
        setAccountLoaded(true);
      }
    },
  );
  useEffect(
    () =>
      watchAccountChanges((reason) => {
        void refreshAccount(reason);
      }),
    [],
  );

  useEffect(() => {
    let live = true;
    void readAccount()
      .then((data) => {
        if (!live) return;
        setAccount(data.user);
        setSaved(data.saved);
        if (hasPersonalResult(data.saved?.result)) {
          setCompletedBefore(true);
        }
        setAnalyticsAvailable(data.config.analyticsEnabled);
        if (
          new URLSearchParams(window.location.search).get('view') ===
            'result' &&
          data.saved &&
          !localResultActive.current
        ) {
          setTestResult(data.saved.result);
          setSavedPresentation(data.saved.presentation);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (live) setAccountLoaded(true);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (view && ['quiz', 'types', 'type', 'principles'].includes(view))
      trackEvent(
        `page_${view}` as
          | 'page_quiz'
          | 'page_types'
          | 'page_type'
          | 'page_principles',
      );
  }, [view, analyticsAvailable]);

  useLayoutEffect(() => {
    const historyOwner = window.crypto.randomUUID();
    window.history.replaceState(
      { ...window.history.state, shadow16Prototype: historyOwner },
      '',
    );
    const syncRoute = (event?: PopStateEvent) => {
      if (event) {
        const isPrototypePath =
          /^\/(?:en\/)?prototype(?:\/types\/t(?:0[1-9]|1[0-6])|\/combinations\/[ie][ns][tf][jp]\/t(?:0[1-9]|1[0-6]))?\/?$/i.test(
            window.location.pathname,
          );
        if (!isPrototypePath || typeof event.state?.shadow16Prototype !== 'string')
          return;
        // A reload creates a new document owner. Earlier Prototype entries still
        // describe views this component can restore without a framework remount.
        // Normalize before stopping propagation: the generic language listener
        // does not receive these same-document history events.
        normalizeLanguagePath();
        // These entries belong to this mounted document. A framework route
        // restore would remount the quiz and discard its in-memory result.
        event.stopImmediatePropagation();
      }
      setCompletedBefore(hasCompletedVisit());
      setRoute({ search: prototypeSearch(window.location), scroll: null });
    };
    syncRoute();
    return subscribePrototypeHistory(syncRoute);
  }, []);

  useEffect(() => {
    if (!view) return;
    if (view === 'type' && viewedCharacter) {
      document.title = characterSearchTitle(t(viewedCharacter.name), locale);
      return;
    }
    if (view === 'home') {
      document.title = homeSearchTitle(locale);
      return;
    }
    if (view === 'combo') {
      document.title = t('MBTI组合｜16暗影');
      return;
    }
    if (view === 'play') {
      document.title = t('玩法灵感｜16暗影');
      return;
    }
    if (view === 'shared' && viewedCharacter) {
      document.title = t(`${readMbti(params.get('mbti'))} × ${viewedCharacter.name}｜16暗影组合卡`);
      return;
    }
    document.title = t(
      view === 'types'
          ? '16型图鉴｜16暗影'
          : view === 'resources'
            ? '资源下载｜16暗影'
            : view === 'principles' || view === 'knowledge'
              ? '知识库｜16暗影'
              : view === 'relationships'
                ? '人物关系｜16暗影'
                : isResult && character
                  ? `${character.name}｜16暗影${view === 'example' ? '结果样例' : '我的画像'}`
                  : '16暗影｜认识自己的另一面');
  }, [view, viewedCharacter, isResult, character, params, t, locale]);

  useLayoutEffect(() => {
    if (!route) return;
    if (route.search === prototypeSearch(window.location))
      document.documentElement.removeAttribute('data-prototype-pending');
    if (route.scroll !== null)
      window.scrollTo({ top: route.scroll, behavior: 'instant' });
    let frame = 0;
    const update = () => {
      frame = 0;
      syncReadingLayout(rootRef.current, cardRef.current, view);
    };
    const queue = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
    };
  }, [route, view]);

  // The English copy can occupy more lines. Size the mobile hero from its
  // actual children so the reading card never covers the continuation action.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!isResult || !root) return;
    const children = [...root.querySelectorAll<HTMLElement>('.proto-result-hero .proto-hero-copy > *, .proto-result-character')];
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (window.innerWidth > 700) {
        root.style.removeProperty('--report-min-height');
        syncReadingLayout(root, cardRef.current, view);
        return;
      }
      const bottom = Math.max(...children.map((child) => child.getBoundingClientRect().bottom));
      const height = Math.ceil(bottom + 28);
      if (root.style.getPropertyValue('--report-min-height') !== `${height}px`) {
        root.style.setProperty('--report-min-height', `${height}px`);
        syncReadingLayout(root, cardRef.current, view);
      }
    };
    const queue = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    const observer = new ResizeObserver(queue);
    children.forEach((child) => observer.observe(child));
    window.addEventListener('resize', queue);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', queue);
      root.style.removeProperty('--report-min-height');
    };
  }, [isResult, locale, result?.stage, character?.id, resultNotice, view]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!resultSettling) return;
    const timer = window.setTimeout(() => setResultSettling(false), 210);
    return () => window.clearTimeout(timer);
  }, [resultSettling]);

  const moveTo = (
    destination: View,
    id?: string,
    scroll?: number,
    extras?: Record<string, string>,
    replace = false,
  ) => {
    if (view === 'quiz' || firstVisitHome) quizScroll.current = window.scrollY;
    if (view === 'result') resultScroll.current = window.scrollY;
    const next = new URL(
      prototypePath(destination, id),
      window.location.origin,
    );
    for (const [key, value] of Object.entries(extras ?? {}))
      next.searchParams.set(key, value);
    const nextScroll =
      scroll ??
      (destination === 'quiz'
        ? quizScroll.current
        : destination === 'result'
          ? resultScroll.current
          : 0);
    const nextPath = `${next.pathname}${next.search}`;
    if (replace)
      window.history.replaceState(window.history.state, '', nextPath);
    else if (
      nextPath !== `${window.location.pathname}${window.location.search}`
    )
      window.history.pushState(window.history.state, '', nextPath);
    setRoute({ search: prototypeSearch(next), scroll: nextScroll });
  };
  const openType = (id: string) => {
    rememberCharacterEntry(id);
    moveTo('type', id);
  };
  const returnToTest = () => {
    if (!completedTest) moveTo('home');
    else if (
      retaking ||
      stage === 'full' ||
      (!canContinue && answers.some((answer) => answer !== undefined))
    )
      moveTo('quiz');
    else reset();
  };
  const openKnowledge = (slug?: string) =>
    moveTo('knowledge', undefined, 0, slug ? { article: slug } : {});
  const browseCombination = (id: string, mbti: MbtiType | null) =>
    moveTo('combo', id, 0, mbti ? { mbti } : {});
  const openPersonalCombination = () => moveTo('combo', undefined, 0);
  const openRelationship = (
    first: string,
    second: string,
    mode: RelationshipMode = 'cp',
  ) =>
    moveTo('relationships', undefined, 0, {
      first: first.toLowerCase(),
      second: second.toLowerCase(),
      mode,
    });
  const updateRelationship = (
    first: string,
    second: string,
    mode: RelationshipMode,
  ) =>
    moveTo(
      'relationships',
      undefined,
      window.scrollY,
      { first: first.toLowerCase(), second: second.toLowerCase(), mode },
      true,
    );
  const openLatestResult = () => {
    if (!hasPersonalResult(testResult) && saved) {
      localResultActive.current = false;
      setTestResult(saved.result);
      setSavedPresentation(saved.presentation);
    }
    if (latestResult) moveTo('result');
    else setModal('account');
  };
  const focusQuestion = () =>
    window.requestAnimationFrame(() =>
      questionRef.current?.focus({ preventScroll: true }),
    );
  const expandCard = () => {
    if (!cardRef.current || !rootRef.current) return;
    const header = Number.parseFloat(
      getComputedStyle(rootRef.current).getPropertyValue('--header-height'),
    );
    const target =
      window.scrollY +
      cardRef.current.getBoundingClientRect().top -
      header -
      14;
    window.scrollTo({ top: target, behavior: motionPreference() });
  };
  const reset = () => {
    setAnswers(Array(48).fill(undefined));
    setCurrent(0);
    setQuestionDirection(null);
    setStage('basic');
    setResultNotice('');
    setResultSettling(false);
    setRetaking(true);
    startedTest.current = false;
    previousRecommended.current = null;
    quizScroll.current = 0;
    resultScroll.current = 0;
    moveTo('quiz', undefined, 0);
  };
  const saveCurrent = async () => {
    if (
      !result ||
      view !== 'result' ||
      saveRequest.current ||
      currentResultSaved
    )
      return;
    trackEvent('save_intent');
    if (!account) {
      setPendingSave(true);
      setModal('account');
      return;
    }
    saveRequest.current = true;
    setSavingResult(true);
    try {
      const response = await accountRequest<{ saved: SavedResult }>(
        '/api/results/latest',
        { result, expectedRevision: saved?.revision ?? null },
        'PUT',
      );
      setSaved(response.saved);
      setToast('已保存到「我的结果」。');
    } catch (err) {
      if (
        err instanceof AccountError &&
        ['RESULT_CONFLICT', 'SIGN_IN_REQUIRED'].includes(err.code)
      ) {
        if (err.code === 'SIGN_IN_REQUIRED') {
          setAccount(null);
          setSaved(null);
        } else setSaved(err.saved ?? null);
        setPendingSave(true);
        setModal('account');
      } else
        setToast(
          err instanceof Error ? err.message : '暂时没保存成功，请重试。',
        );
    } finally {
      saveRequest.current = false;
      setSavingResult(false);
    }
  };
  const next = (skip = false) => {
    if (!skip && selected === undefined) return;
    if (!startedTest.current) {
      trackEvent('test_start');
      startedTest.current = true;
    }
    const updated = [...answers];
    if (skip) updated[current] = null;
    setAnswers(updated);
    const end = stage === 'basic' ? 16 : 48;
    if (current + 1 < end) {
      setQuestionDirection('forward');
      setCurrent((value) => value + 1);
      focusQuestion();
      return;
    }
    const calculated = scoreCandidate(
      updated.slice(0, end).map((value) => value ?? null),
      stage,
    );
    const recommended = recommendRoles(calculated).recommended;
    if (
      updated
        .slice(0, end)
        .some((answer) => answer !== null && answer !== undefined)
    ) {
      setCompletedBefore(true);
    }
    setResultNotice(
      stage === 'full' && previousRecommended.current !== recommended
        ? '结合更多情境，你的主要推荐已更新。'
        : '',
    );
    if (stage === 'basic') previousRecommended.current = recommended;
    setTestResult(calculated);
    const local = writeLocalResult(calculated);
    localResultActive.current = !!local;
    setLocalExpiresAt(local?.expiresAt ?? null);
    setRetaking(false);
    setSavedPresentation(null);
    setResultSettling(true);
    trackEvent(stage === 'basic' ? 'complete_basic' : 'complete_full');
    if (stage === 'full' || !hasPersonalResult(calculated)) {
      setAnswers(Array(48).fill(undefined));
      setCurrent(0);
      setStage('basic');
    }
    moveTo('result', undefined, 0);
    if (stage === 'full') quizScroll.current = 0;
  };
  const share = (id: string, mbti: MbtiType | null = null) => {
    setSharedType(id);
    setSharedMbti(mbti);
    setShareCardKind(mbti ? 'mbti' : 'basic');
    setShareHint('');
    setSystemShareAvailable(typeof navigator.share === 'function');
    setModal('share');
  };
  const copySharedLink = async () => {
    try {
      await navigator.clipboard.writeText(sharedLink);
      setShareHint('卡片链接已复制。');
      trackEvent('share_link_copied');
    } catch {
      setShareHint('长按或选中下方链接，即可手动复制。');
    }
  };
  const shareWithSystem = async () => {
    if (!sharedCharacter || !navigator.share) return;
    try {
      await navigator.share({
        title: t(`${sharedCopy?.identity ?? sharedCharacter.name}｜16暗影${effectiveShareMbti ? '组合卡' : '人物卡'}`),
        text: t(sharedCopy?.line ?? sharedCharacter.quote),
        url: sharedLink,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setShareHint('也可以复制下方链接来分享。');
    }
  };
  const continueQuiz = () => {
    setRetaking(true);
    trackEvent('start_extended');
    setStage('full');
    const firstUnanswered = answers.findIndex(
      (answer, index) => index >= 16 && answer === undefined,
    );
    setCurrent(firstUnanswered < 16 ? 16 : firstUnanswered);
    setQuestionDirection('forward');
    moveTo('quiz', undefined, 0);
    window.requestAnimationFrame(() => {
      expandCard();
      focusQuestion();
    });
  };
  const modalClose = () => {
    setModal(null);
    setPendingSave(false);
  };

  return (
    <main
      ref={rootRef}
      data-view={view ?? 'loading'}
      data-visit={completedTest ? 'returning' : 'first'}
      className={`prototype-shell ${isStage ? 'proto-stage-shell' : 'proto-reading-shell'} ${returningHome ? 'prototype-shell--returning' : ''} ${view === 'quiz' ? 'prototype-shell--fullscreen-quiz' : ''} ${isResult ? 'prototype-shell--result' : ''} ${resultSettling && view === 'result' ? 'proto-result-settling' : ''} ${isResult && isAllTypesTied ? 'prototype-shell--all-tied-result' : ''} ${activeFamily ? familyClass(activeFamily) : ''}`}
    >
      {(view === 'quiz' ? (
        <header className="proto-header">
          <Link
            prefetch={false}
            className="proto-brand"
            href={href("/prototype")}
            onClick={(event) => {
              event.preventDefault();
              if (latestResult) openLatestResult();
              else moveTo('home', undefined, 0);
            }}
            aria-label={t(latestResult ? '16暗影，回到我的画像' : '16暗影，回到测试')}
          ><span>16</span><strong>{t("暗影")}</strong></Link>
          <button
            className="proto-text-button"
            type="button"
            onClick={() => moveTo('home', undefined, 0)}
          >
            <ArrowLeft size={16} /> {t(" 返回首页 ")}</button>
        </header>
      ) : <SharedHeader
        current={worldView ? 'types' : view === 'combo' || view === 'shared' ? 'combo' : view === 'knowledge' || view === 'principles' ? 'knowledge' : undefined}
        onNavigate={(destination) => {
          const handlers: Record<'types' | 'combo' | 'knowledge', () => void> = { types: () => moveTo('types'), combo: openPersonalCombination, knowledge: () => openKnowledge() };
          handlers[destination]();
        }}
        onAccount={() => setModal('account')}
        className="proto-header"
        brandClassName="proto-brand"
        brandHref={href('/prototype')}
        brandLabel={t(latestResult ? '16暗影，回到我的画像' : '16暗影，回到测试')}
        onBrandClick={(event) => { event.preventDefault(); if (latestResult) openLatestResult(); else moveTo('home', undefined, 0); }}
      />)}

      {(worldView && (
        <nav className="proto-world-nav" aria-label={t("人物世界栏目")}>
          {((
            [
              ['types', '16型图鉴', 'Types'],
              ['relationships', '人物关系', 'Relationships'],
              ['play', '玩法灵感', 'Play'],
              ['resources', '素材收藏', 'Downloads'],
            ] as const
          ).map(([destination, label, compactLabel]) => (
            <Link
              key={destination}
              href={href(prototypePath(destination))}
              prefetch={false}
              aria-current={
                view === destination ||
                (destination === 'types' && view === 'type')
                  ? 'page'
                  : undefined
              }
              onClick={(event) => {
                event.preventDefault();
                if (destination === 'relationships')
                  openRelationship(latestCharacter?.id ?? 'T01', 'T09');
                else moveTo(destination);
              }}
            >
              <span className="proto-nav-full">{tn(label)}</span>
              <span className="proto-nav-short" aria-hidden="true">{locale === 'en' ? compactLabel : tn(label)}</span>
            </Link>
          )))}
        </nav>
      ))}

      {((view === 'home' || view === 'quiz') && (
        <>
          {(view === 'home' && (
            <section className="proto-hero" aria-label={t("欢迎来到16暗影")}>
              <div className="proto-hero-content">
                <div className="proto-hero-copy">
                  <p className="proto-kicker">
                    {tn(returningHome
                      ? '欢迎回来，继续认识另一面。'
                      : '认识自己，也包括另一面。')}
                  </p>
                  <h1>
                    {homeHeading[0]}<br />
                    <em>{homeHeading[1]}</em>
                  </h1>
                  <p className="proto-lead">
                    {t("看看你在分歧、利益与规则面前， ")}<br />
                    {t("会怎样选择。 ")}</p>
                  <div className="proto-hero-note">
                    <span>{t("完整解读免费")}</span>
                    <i />
                    {t("无需注册")}</div>
                  {(returningHome && (
                    <div className="proto-returning-actions">
                      <button
                        type="button"
                        className="proto-primary"
                        onClick={latestResult ? openLatestResult : reset}
                      >
                        {tn(latestResult
                          ? `回看${latestCharacter?.name ?? '我的'}画像`
                          : '重新开始')}
                        <ArrowRight size={17} />
                      </button>
                      {(latestResult && (
                        <button
                          type="button"
                          className="proto-outline"
                          onClick={
                            retaking
                              ? () => moveTo('quiz', undefined, 0)
                              : reset
                          }
                        >
                          <RotateCcw size={16} />
                          {tn(retaking ? '继续答题' : '重新答题')}
                        </button>
                      ))}
                    </div>
                  ))}
                  {(returningHome && !latestResult && accountLoaded && (
                    <p className="proto-returning-note">
                      {t("此浏览器中没有可回看的画像。你可以重新测试，或登录查看此前保存到账号的结果。 ")}</p>
                  ))}
                </div>
                <div className="proto-cast proto-cast--solo">
                  <div className="proto-cast-ring" />
                  <div className="proto-mascot">
                    <AnimatedCharacter id="T01" mode="welcome" name="掮客" />
                    <span className="proto-speech">{t("「见面礼。别客气。」")}</span>
                  </div>
                  <button className="proto-replay" type="button">
                    <Play size={12} />
                    {t("再打个招呼 ")}</button>
                </div>
              </div>
            </section>
          ))}
          {(returningHome ? (
            <section className="proto-home-explore" aria-label={t("继续探索")}>
              <button
                type="button"
                onClick={() =>
                  openRelationship(latestCharacter?.id ?? 'T01', 'T09')
                }
              >
                <small>{t("人物关系")}</small>
                <strong>{t("换一个搭档，会发生什么？")}</strong>
                <span>
                  {t("从两个人物开始，探索合作、对抗与亲密故事。 ")}<ArrowRight size={18} />
                </span>
              </button>
              <button type="button" onClick={() => moveTo('types')}>
                <small>{t("16型图鉴")}</small>
                <strong>{t("认识完整的16种人物")}</strong>
                <span>
                  {t("沿着形象、四轴与人物故事继续看。 ")}<ArrowRight size={18} />
                </span>
              </button>
              <button type="button" onClick={() => openKnowledge()}>
                <small>{t("知识库")}</small>
                <strong>{t("读懂人物背后的线索")}</strong>
                <span>
                  {t("从一个日常问题，走进整套模型。 ")}<ArrowRight size={18} />
                </span>
              </button>
            </section>
          ) : (
            <section className="proto-lift-zone proto-quiz-zone">
              {(view !== 'quiz' && (
                <button
                  className="proto-scroll-hint"
                  type="button"
                  onClick={expandCard}
                >
                  <ArrowDown size={16} />
                  {tn(current === 0
                    ? '上滑开始答题'
                    : '上滑继续答题')}
                </button>
              ))}
              <article
                ref={cardRef}
                className="proto-question-card"
                id="question-card"
                aria-label={t("答题卡片")}
              >
                <div className="proto-question-meta">
                  <div className="proto-card-handle" />
                  <div className="proto-question-top">
                    <span className="proto-kicker">
                      {tn(stage === 'basic' ? '基础画像' : '补充更多情境')}
                    </span>
                    <span>
                      {tn(String(current + 1).padStart(2, '0'))}{tn(' ')}
                      <span className="proto-muted">
                        / {tn(stage === 'basic' ? 16 : 48)}
                      </span>
                    </span>
                  </div>
                  <progress
                    className="proto-progress"
                    aria-label={t("答题进度")}
                    value={current + 1}
                    max={stage === 'basic' ? 16 : 48}
                  />
                </div>
                <section
                  className="proto-question-prompt is-illustrated"
                  aria-label={t("题目内容")}
                  data-motion-direction={questionDirection ?? undefined}
                >
                  <div className="proto-question-copy" key={`${stage}-${current}-copy`}>
                    <h2 ref={questionRef} tabIndex={-1}>
                      {tn(candidateForm.items[current].text)}
                    </h2>
                    <p className="proto-question-help">
                      {t("选更像你会怎么做的答案。 ")}</p>
                  </div>
                  <QuestionIllustration
                    key={`${stage}-${current}-illustration`}
                    src={asset(illustration)}
                    upcoming={upcomingIllustrations}
                  />
                </section>
                <RadioGroup
                  className="proto-answers"
                  value={selected?.toString() ?? ''}
                  onValueChange={(value) =>
                    setAnswers((previous) =>
                      previous.map((answer, index) =>
                        index === current ? Number(value) : answer,
                      ),
                    )
                  }
                  aria-label={t(`第${current + 1}题`)}
                >
                  <div className="proto-answer-labels">
                    <span>{t("很不像我")}</span>
                    <span>{t("很像我")}</span>
                  </div>
                  <div className="proto-answer-dots">
                    {([1, 2, 3, 4, 5].map((value, index) => (
                      <label
                        className={`proto-answer ${selected === value ? 'is-selected' : ''}`}
                        key={value}
                      >
                        <RadioGroupItem
                          value={String(value)}
                          aria-label={t(choiceLabels[index])}
                        />
                        <span>
                          {
                            tn(['很不像', '不太像', '一半一半', '比较像', '很像'][
                              index
                            ])
                          }
                        </span>
                      </label>
                    )))}
                  </div>
                </RadioGroup>
                <div className="proto-question-actions">
                  <div className="proto-previous-actions">
                    <button
                      type="button"
                      className="proto-text-button proto-previous"
                      disabled={current === 0}
                      onClick={() => {
                        setQuestionDirection('backward');
                        setCurrent((value) => value - 1);
                        focusQuestion();
                      }}
                      aria-label={t("上一题")}
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <button
                      className="proto-text-button"
                      type="button"
                      onClick={() => next(true)}
                    >
                      {t("这题先跳过 ")}</button>
                  </div>
                  <button
                    type="button"
                    className="proto-primary"
                    disabled={selected === undefined}
                    onClick={() => next()}
                  >
                    {tn(current === (stage === 'basic' ? 15 : 47)
                      ? '查看画像'
                      : '下一题')}
                    <ArrowRight size={18} />
                  </button>
                </div>
                <p className="proto-data-note">
                  {t("刷新会清空尚未完成的答题进度。 ")}</p>
              </article>
            </section>
          ))}
        </>
      ))}

      {(isResult && result && recommendation && character && (
        <>
          <section
            className={`proto-hero proto-result-hero${isAllTypesTied ? ' proto-result-hero--all-tied' : ''}`}
          >
            <div className="proto-hero-content">
              <div className="proto-hero-copy">
                <p className="proto-kicker">
                  {tn(view === 'example'
                    ? '结果样例 · 演示回答'
                    : isUnansweredResult
                      ? '16型人物导览'
                      : result.stage === 'basic'
                        ? '你的初步画像'
                        : '你的完整画像')}
                </p>
                <div className="proto-result-title-block">
                  <h1>
                    <small>
                      {tn(isUnansweredResult
                        ? '先从这位认识16型'
                        : isAllTypesTied
                          ? '先浏览一张人物卡'
                          : recommendation.tied.length > 1
                            ? '这次浮现的一道暗影'
                            : recommendation.openAxes.length > 0 ? '先从这个人物读起' : '这次浮现的暗影')}
                    </small>
                    <em>
                      {(isAllTypesTied ? (
                        <>
                          <span>{t("尚无")}</span>
                          <span>{t("明显倾向")}</span>
                        </>
                      ) : (
                        tn(character.name)
                      ))}
                    </em>
                  </h1>
                  {isAllTypesTied && (
                    <p className="proto-result-browse-role">{t('先浏览：')}{tn(character.name)}</p>
                  )}
                  <button className="proto-result-type-link" type="button" onClick={() => openType(character.id)}>
                    <span>{t('查看完整人物卡')}</span><ArrowRight size={14} />
                  </button>
                </div>
                {(!isAllTypesTied && (
                  <>
                    <p className="proto-social-tagline">
                      {tn(roleCommunication?.tagline)}
                    </p>
                    <p className="proto-result-quote">
                      “{tn(roleCommunication?.quote ?? character.quote)}”
                    </p>
                  </>
                ))}
                {(isUnansweredResult ? (
                  <p className="proto-result-unanswered">{t("本轮题目全部跳过")}</p>
                ) : null)}
                <p className="proto-result-boundary">
                  {tn(isUnansweredResult
                    ? '本轮还没有作答。先认识人物，再从一个日常选择开始。'
                    : isAllTypesTied
                      ? '几种暗影还没有分出明显方向。先看看这次回答留下的线索。'
                      : result.stage === 'full'
                        ? '你的暗影，不止这一面。往下看看，你与这个人物有哪些相似和不同。'
                        : view === 'result' && !canContinue
                          ? '这份初步画像可以回看。重新探索，可以补上更多细节。'
                          : silhouettes.length
                            ? '还有一些暗影，尚未完全显现。继续回答，看看你的画像会更接近哪一面。'
                            : '先看见一种方向。继续回答，补上更完整的细节。')}
                </p>
                {(resultNotice && !isUnansweredResult && <p className="proto-result-update">{tn(resultNotice)}</p>)}
                <div className="proto-result-hero-actions">
                  {(view === 'result' && (result.stage === 'basic' || isUnansweredResult)) ? <button
                    className="proto-primary" type="button"
                    onClick={!isUnansweredResult && canContinue ? continueQuiz : reset}
                  >{tn(isUnansweredResult ? '开始答题 · 16题' : canContinue ? '继续探索 · 32题' : '重新开始 · 16题')}<ArrowRight size={17} /></button> : null}
                  <button className="proto-text-button personal-report-scroll" type="button" onClick={expandCard}>
                    <ArrowDown size={16} />{tn(isUnansweredResult ? '往下认识这个人物' : result.stage === 'full' ? '往下读完整报告' : '往下看初步线索')}
                  </button>
                </div>
              </div>
              <div className={`proto-result-character${silhouettes.length ? ' has-silhouettes' : ''}`}>
                <div className="proto-result-halo" />
                <div className="proto-result-shadows" aria-hidden="true">
                  {silhouettes.map((id, index) => <span key={id} className={`proto-result-shadow proto-result-shadow--${index + 1}`} style={{ maskImage: `url("${asset(characterArtworkSrc(id))}")`, WebkitMaskImage: `url("${asset(characterArtworkSrc(id))}")` }} />)}
                </div>
                <AnimatedCharacter
                  key={`${character.id}-${view}`}
                  id={character.id}
                  name={character.name}
                  mode="result"
                />
              </div>
            </div>
          </section>
          <section className="proto-lift-zone proto-result-zone">
            <article ref={cardRef} className="proto-insight-card">
              <div className="proto-card-handle" />
              {isUnansweredResult ? <div className="personal-report-opening">
                <p className="proto-kicker">{t('人物导览 · 先认识这一型')}</p>
                <h2>{tn(character.name)}</h2>
                <p>{tn(character.description)}</p>
              </div> : <PersonalReport result={result} recommendation={recommendation} character={character} canContinue={canContinue} />}
              {!isUnansweredResult && !isAllTypesTied && <RoleStory key={`story-${character.id}`} roleId={character.id} collapsible={false} />}
              {(view === 'result' &&
                (result.stage === 'basic' || isUnansweredResult) && (
                  <div className="proto-continue-block">
                    <div>
                      <span>
                        {tn(isUnansweredResult ? '从一个日常选择开始' : '16 → 48')}
                      </span>
                      <h3>
                        {tn(isUnansweredResult
                          ? '开始回答，探索你的类型。'
                          : recommendation.close
                            ? '继续探索，让类型更清晰。'
                            : '再深入一点，看看完整画像。')}
                      </h3>
                      <p>
                        {tn(isUnansweredResult
                          ? '先回答16个情境，看看与你最接近的人物和其他可能。'
                          : canContinue
                            ? '再回答32个情境，帮助进一步区分接近的类型，形成更清晰的判断。'
                            : hasUnavailableSavedBasicResult
                              ? '这份16题画像可以回看，逐题答案已清除。要补充32题，请先重新完成16题。'
                              : '从第一题开始一次新的探索，形成新的完整画像。')}
                      </p>
                    </div>
                    <button
                      className="proto-primary"
                      type="button"
                      onClick={
                        !isUnansweredResult && canContinue
                          ? continueQuiz
                          : reset
                      }
                    >
                      {tn(isUnansweredResult
                        ? '开始答题 · 16题'
                        : canContinue
                          ? '继续探索 · 32题'
                          : hasUnavailableSavedBasicResult
                            ? '重新开始 · 16题'
                            : '开始新的探索')}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                ))}
              <div className="personal-report-tools">
                  <button
                    className="proto-outline"
                    type="button"
                    onClick={() =>
                      share(
                        character.id,
                        view === 'result' ? personalMbti : null,
                      )
                    }
                  >
                    <Share2 size={16} />
                    {t("保存图片 / 分享 ")}</button>
                  {(!isUnansweredResult && (
                    <button
                      className="proto-outline"
                      type="button"
                      onClick={() =>
                        view === 'result'
                          ? openPersonalCombination()
                          : browseCombination(character.id, null)
                      }
                    >
                      {t("加上我的 MBTI ")}</button>
                  ))}
                  {(isUnansweredResult ? (
                    <button
                      className="proto-text-button"
                      onClick={reset}
                      type="button"
                    >
                      {t("开始答题 ")}<ArrowRight size={16} />
                    </button>
                  ) : view === 'result' ? (
                    <button
                      className="proto-text-button proto-save-result"
                      onClick={() => void saveCurrent()}
                      disabled={savingResult || currentResultSaved}
                      aria-busy={savingResult || undefined}
                      type="button"
                    >
                      {(currentResultSaved ? (
                        <Check size={16} />
                      ) : (
                        <Plus size={16} />
                      ))}
                      {tn(savingResult
                        ? '正在保存…'
                        : currentResultSaved
                          ? '已存到账号'
                          : saved
                            ? '更新保存的结果'
                            : '存到账号')}
                    </button>
                  ) : (
                    <button
                      className="proto-text-button"
                      onClick={returnToTest}
                      type="button"
                    >
                      {t("测测我自己 ")}<ArrowRight size={16} />
                    </button>
                  ))}
                </div>
              <div className="personal-report-character-link">
                <button className="proto-text-button" onClick={() => openType(character.id)} type="button">
                  {t('认识人物原型：')}{tn(character.name)}<ArrowRight size={16} />
                </button>
              </div>
              {!isUnansweredResult && <details className="personal-report-extra">
                <summary>{t('更多人物与匹配信息')}<ChevronDown size={16} /></summary>
                <MatchList recommendation={recommendation} openType={openType} />
                <PopulationEstimate characterId={character.id} onOpenMethod={() => moveTo('knowledge', undefined, 0, { article: 'type-share-estimation', scenario: SCENARIO_ID })} />
                <RelationshipPreview characterId={character.id} selectedModes={relationshipPreviewModes}
                  onModeChange={(pairId, mode) => setRelationshipPreviewModes((previous) => ({ ...previous, [pairId]: mode }))}
                  onOpenPair={openRelationship} />
              </details>}
              <button className="proto-principles-link" type="button" onClick={() => openKnowledge()}>
                <span><small>{t('知识库')}</small>{t('看看四条轴与16型如何组成 ')}</span><ArrowRight size={18} />
              </button>
              <div className="proto-result-end">
                <button className="proto-outline" onClick={reset} type="button">
                  <RotateCcw size={16} />
                  {t("重新探索 ")}</button>
                <button
                  className="proto-text-button"
                  onClick={() => moveTo('types')}
                  type="button"
                >
                  {t("认识全部16型 ")}<ArrowRight size={16} />
                </button>
              </div>
            </article>
          </section>
        </>
      ))}

      {(view === 'types' && (
        <TypeLibrary openType={openType} returnToTest={returnToTest} />
      ))}
      {(view === 'type' && viewedCharacter && (
        <TypeCard
          character={viewedCharacter}
          openType={openType}
          openLibrary={() => moveTo('types')}
          openPrinciples={() => openKnowledge()}
          returnToTest={returnToTest}
          share={() => share(viewedCharacter.id)}
        />
      ))}
      {(view === 'resources' && <Resources />)}
      {(view === 'play' && (
        <OfficialPlay onBrowse={browseCombination} onOpenType={openType} />
      ))}
      {(view === 'combo' && (
        <MbtiExperience
          roleId={comboRoleId}
          mbti={comboMbti}
          personalized={comboPersonalized}
          hasResult={!!latestResult}
          onChangeMbti={(value) => {
            if (browsingCombo)
              moveTo(
                'combo',
                comboRoleId,
                window.scrollY,
                value ? { mbti: value } : {},
                true,
              );
            else setPersonalMbti(value);
          }}
          onBrowse={browseCombination}
          onShare={share}
          onOpenKnowledge={() => openKnowledge('mbti-connection')}
          onReturn={() => (latestResult ? openLatestResult() : moveTo('home'))}
        />
      ))}
      {(view === 'shared' &&
        viewedCharacter &&
        (() => {
          const mbti = readMbti(params.get('mbti'))!;
          const copy = identityCopy(viewedCharacter.id, mbti);
          return (
            <section className="proto-shared-landing">
              <p className="proto-kicker">{t("朋友分享的双身份")}</p>
              <h1>{tn(copy.identity)}</h1>
              <IdentityCard
                roleId={viewedCharacter.id}
                mbti={mbti}
                previewOnly
              />
              <div className="proto-shared-actions">
                <button
                  className="proto-primary"
                  type="button"
                  onClick={returnToTest}
                >
                  {t("测测我的16暗影型 ")}<ArrowRight size={16} />
                </button>
                <button
                  className="proto-outline"
                  type="button"
                  onClick={() => share(viewedCharacter.id, mbti)}
                >
                  <Share2 size={16} />
                  {t("保存 / 再次分享 ")}</button>
                <button
                  className="proto-text-button"
                  type="button"
                  onClick={() => browseCombination(viewedCharacter.id, mbti)}
                >
                  {t("看看其他组合 ")}</button>
              </div>
              <p className="proto-quiet">
                {t("这是朋友分享的角色组合，不是你的测试结果。MBTI联动为创作表达。 ")}</p>
            </section>
          );
        })())}
      {((view === 'principles' || view === 'knowledge') && (
        <Knowledge
          slug={articleSlug}
          onNavigate={openKnowledge}
          onOpenType={openType}
          onOpenTypes={() => moveTo('types')}
          onOpenRelationships={() =>
            openRelationship(latestCharacter?.id ?? 'T01', 'T09')
          }
        />
      ))}
      {(view === 'relationships' && (
        <Relationships
          key={`${relationshipFirst}-${relationshipSecond}`}
          first={relationshipFirst}
          second={relationshipSecond}
          mode={relationshipMode}
          onChange={updateRelationship}
          onModeChange={(mode) =>
            updateRelationship(relationshipFirst, relationshipSecond, mode)
          }
          onOpenType={openType}
          onOpenKnowledge={openKnowledge}
        />
      ))}
      {(route !== null && view !== 'quiz' && (
        <footer className="proto-footer">
          <a href={href("/privacy")} target="_blank" rel="noopener">
            {t("隐私政策与设置 ")}</a>
          <button type="button" onClick={() => setModal('feedback')}>
            {t("反馈体验 ")}</button>
          <a href={siteContact.icp.href} target="_blank" rel="noreferrer">
            {siteContact.icp.label}
          </a>
          <span className="proto-version">{t("内测版 · ")}{tn(release.version)}</span>
        </footer>
      ))}
      {(toast && (
        <output className="proto-toast" aria-live="polite">
          <Check size={16} />
          {tn(toast)}
        </output>
      ))}
      {(modal === 'account' && (
        <AccountDialog
          open={modal === 'account'}
          onClose={modalClose}
          user={account}
          saved={saved}
          pendingResult={pendingSave ? result : null}
          onAccount={(user, snapshot) => {
            if (account && user?.id !== account.id && savedPresentation) {
              setTestResult(null);
              setSavedPresentation(null);
            }
            setAccount(user);
            setSaved(snapshot);
            if (hasPersonalResult(snapshot?.result)) {
              setCompletedBefore(true);
            }
          }}
          onSaved={() => setToast('已保存到「我的结果」。')}
          onOpenResult={(snapshot) => {
            localResultActive.current = false;
            setTestResult(snapshot.result);
            setSavedPresentation(snapshot.presentation);
            setResultNotice('这是你之前保存的画像。');
            modalClose();
            moveTo('result', undefined, 0);
          }}
        />
      ))}
      <Dialog
        open={modal !== null && modal !== 'account'}
        onOpenChange={(open) => {
          if (!open) modalClose();
        }}
      >
        <DialogContent className="proto-dialog">
          <DialogHeader>
            <DialogTitle>
              {tn(modal === 'share'
                ? '带走我的另一面'
                : '反馈体验')}
            </DialogTitle>
            <DialogDescription>
              {tn(modal === 'share'
                ? '保存这张人物卡，或发给朋友看看。'
                : '遇到问题或有建议，欢迎告诉我们。复制反馈后，可以发到下面的联系邮箱。')}
            </DialogDescription>
          </DialogHeader>
          {(modal === 'feedback' && (
            <div className="account-form">
              <label className="account-field">
                <span>{t("问题或建议")}</span>
                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  maxLength={1000}
                  rows={5}
                  placeholder={t("例如：在哪一步遇到了什么情况？")}
                />
              </label>
              <p className="account-help">
                {t("版本：")}{tn(release.version)}
                {t("。复制内容只包含你的反馈、版本和页面位置。 ")}</p>
              <p className="account-help">
                {t("联系邮箱")}：<a className="account-inline-link" href={`mailto:${siteContact.email}?subject=${encodeURIComponent(t('16暗影体验反馈'))}&body=${encodeURIComponent(feedback)}`}>{siteContact.email}</a>
              </p>
              <button
                type="button"
                className="proto-primary"
                disabled={!feedback.trim()}
                onClick={() =>
                  void navigator.clipboard
                    .writeText(
                      `${t('16暗影体验反馈')}\n${t('版本：')}${release.version}\n${t('页面：')}${window.location.pathname}${window.location.search}\n${t('反馈：')}${feedback}`,
                    )
                    .then(() => setToast('反馈已复制，可以发到联系邮箱。'))
                    .catch(() => setToast('请长按选择文字复制。'))
                }
              >
                {t("复制反馈 ")}<Copy size={16} />
              </button>
            </div>
          ))}
          {(modal === 'share' && (
            <div className="proto-share-fallback">
              {(sharedMbti && (
                <div className="proto-identity-tabs" aria-label={t("分享卡内容")}>
                  <button
                    type="button"
                    aria-pressed={shareCardKind === 'basic'}
                    onClick={() => {
                      setShareCardKind('basic');
                      setShareHint('');
                    }}
                  >
                    {t("基础身份卡 ")}</button>
                  <button
                    type="button"
                    aria-pressed={shareCardKind === 'mbti'}
                    onClick={() => {
                      setShareCardKind('mbti');
                      setShareHint('');
                    }}
                  >
                    {t("MBTI组合卡 ")}</button>
                </div>
              ))}
              {(sharedCharacter && (
                <IdentityCard
                  roleId={sharedCharacter.id}
                  mbti={effectiveShareMbti}
                />
              ))}
              <div className="proto-share-actions">
                <button
                  type="button"
                  className="proto-primary proto-copy-link"
                  onClick={copySharedLink}
                >
                  <Copy size={17} />
                  {t("复制卡片链接 ")}</button>
                {(systemShareAvailable && (
                  <button
                    type="button"
                    className="proto-outline"
                    onClick={shareWithSystem}
                  >
                    <Share2 size={17} />
                    {t("更多分享方式 ")}</button>
                ))}
              </div>
              <label htmlFor="share-link">
                {tn(effectiveShareMbti ? '组合卡链接' : '人物卡链接')}
              </label>
              <input
                id="share-link"
                value={sharedLink}
                readOnly
                onFocus={(event) => event.target.select()}
              />
              <output className="proto-share-status" aria-live="polite">
                {tn(shareHint ||
                  (effectiveShareMbti
                    ? '朋友打开后会看到这张双身份卡；链接不包含个人答案和匹配占比。'
                    : '朋友打开后会看到人物介绍；链接不包含个人答案和匹配占比。'))}
              </output>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </main>
  );
}
