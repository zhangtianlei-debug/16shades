'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n/provider';
import { AccountDialog } from './account-dialog';
import {
  readAccount,
  watchAccountChanges,
  type AccountUser,
  type SavedResult,
} from './account-api';
import {
  candidateForm,
  scoreCandidate,
  type Answer,
  type CandidateResult,
} from './scoring';
import { recommendRoles, type Recommendation } from './recommendation';
import { characters } from '@/app/data';
import {
  createFriendInvite,
  listFriendInvites,
  readFriendInvite,
  removeFriendInvite,
  saveFriendResponse,
  type FriendInvite,
} from './friend-api';
import { friendOptions, friendQuestion } from './friend-question-copy';
import './friend-impressions.css';
type Lang = 'zh' | 'en';
const copy = (lang: Lang, zh: string, en: string) => (lang === 'zh' ? zh : en);
const token = (invite: string) => {
  const key = `16shades-friend-submission:${invite}`;
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }
  return value;
};
const clearToken = (invite: string) =>
  sessionStorage.removeItem(`16shades-friend-submission:${invite}`);
const englishNames: Record<string, string> = {
  T01: 'Broker',
  T02: 'Opportunist',
  T03: 'Smiler',
  T04: 'Pursuer',
  T05: 'Harvester',
  T06: 'Raider',
  T07: 'Collector',
  T08: 'Bruiser',
  T09: 'Puppet Master',
  T10: 'Agitator',
  T11: 'Power Broker',
  T12: 'Cult Leader',
  T13: 'Enforcer',
  T14: 'Decider',
  T15: 'Arbiter',
  T16: 'Tyrant',
};
export function FriendImpressions(_props: { lang: Lang }) {
  const { locale: lang } = useI18n();
  const [user, setUser] = useState<AccountUser | null>(null),
    [saved, setSaved] = useState<SavedResult | null>(null),
    [dialog, setDialog] = useState(false),
    [invites, setInvites] = useState<FriendInvite[]>([]),
    [subject, setSubject] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [invite, setInvite] = useState<{
    token: string;
    subjectName: string;
  } | null>(null);
  const [nickname, setNickname] = useState('');
  const [answers, setAnswers] = useState<Answer[]>(Array(48).fill(null));
  const [step, setStep] = useState(0),
    [submitted, setSubmitted] = useState<{
      result: CandidateResult;
      presentation: Recommendation;
    } | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [answered, setAnswered] = useState<boolean[]>(Array(48).fill(false));
  const refresh = async () => {
    setInvites([]);
    try {
      const account = await readAccount();
      setUser(account.user);
      setSaved(account.saved);
      if (account.user) {
        const data = await listFriendInvites();
        setInvites(data.invites);
      }
    } catch {
      setUser(null);
      setSaved(null);
    }
  };
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('invite');
    setInviteToken(value);
    void readAccount()
      .then((data) => {
        setUser(data.user);
        setSaved(data.saved);
      })
      .catch(() => undefined);
    if (!value) void refresh();
    const stop = watchAccountChanges(() => void refresh());
    return stop;
  }, []);
  useEffect(() => {
    setAnswers(Array(48).fill(null));
    setAnswered(Array(48).fill(false));
    setStep(0);
    setSubmitted(null);
    setNickname('');
    if (inviteToken)
      readFriendInvite(inviteToken)
        .then((x) => setInvite(x.invite))
        .catch(() => setNotice(copy(lang,'邀请已失效或暂时无法打开，请向朋友确认链接。','This invitation has expired or could not be opened. Check the link with your friend.')));
  }, [inviteToken]);
  const makeInvite = async () => {
    if (!user) {
      setDialog(true);
      return;
    }
    if (!subject.trim()) return;
    setBusy(true);
    try {
      await createFriendInvite(subject.trim());
      setSubject('');
      await refresh();
      setNotice(copy(lang, '邀请已创建。', 'Invitation created.'));
    } catch {
      setNotice(
        copy(lang, '暂时无法创建邀请。', 'Could not create the invitation.'),
      );
    } finally {
      setBusy(false);
    }
  };
  const share = async (tokenValue: string) => {
    const path = lang === 'en' ? '/en/friends' : '/friends';
    const url = `${location.origin}${path}?invite=${encodeURIComponent(tokenValue)}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice(copy(lang, '邀请链接已复制。', 'Invitation link copied.'));
    } catch {
      setNotice(url);
    }
  };
  const submit = async () => {
    if (!inviteToken || !invite || answers.length !== 48) return;
    const result = scoreCandidate(answers, 'full');
    setBusy(true);
    try {
      await readAccount();
      const data = await saveFriendResponse(inviteToken, {
        nickname: nickname.trim(),
        result,
        submissionId: token(inviteToken),
      });
      clearToken(inviteToken);
      setSubmitted({
        result: data.response.result,
        presentation: data.response.presentation,
      });
      setNotice(
        copy(lang, '已保存到邀请者账号。', 'Saved to the inviter’s account.'),
      );
    } catch {
      setNotice(
        copy(
          lang,
          '暂时无法保存回应，请稍后重试。',
          'Your response could not be saved yet.',
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  if (inviteToken)
    return (
      <main className="friend-page">
        <header>
          <a
            className="friend-back"
            href={
              lang === 'en' ? '/en/prototype?view=play' : '/prototype?view=play'
            }
          >
            {copy(lang, '← 返回人物世界', '← Back to Characters')}
          </a>
          <p className="eyebrow">16 SHADES</p>
          <h1>{copy(lang, '朋友眼中的我', 'How a friend sees me')}</h1>
          <p>
            {invite
              ? copy(
                  lang,
                  `${invite.subjectName} 邀请你完成这份印象测评。结果会保存到邀请者账号，并展示你的昵称。`,
                  `${invite.subjectName} invited you to share an impression. Your result will be saved to their account with your nickname.`,
                )
              : notice || copy(lang, '正在读取邀请…', 'Loading invitation…')}
          </p>
        </header>
        {submitted ? (
          <Result lang={lang} data={submitted} />
        ) : (
          <section className="friend-card">
            {step === 0 ? (
              <label>
                {copy(lang, '你的昵称（可选）', 'Your name (optional)')}
                <input
                  maxLength={36}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={copy(lang, '例如：小林', 'For example: Alex')}
                />
              </label>
            ) : (
              <>
                <p className="friend-progress">{step} / 48</p>
                <h2>
                  {friendQuestion(
                    step - 1,
                    lang,
                    invite?.subjectName || copy(lang, 'TA', 'them'),
                  )}
                </h2>
                <div className="friend-options">
                  {friendOptions[lang].map((label, i) => (
                    <button
                      key={label}
                      className={
                        answered[step - 1] &&
                        answers[step - 1] === (i === 5 ? null : i + 1)
                          ? 'active'
                          : ''
                      }
                      onClick={() => {
                        const next = [...answers],
                          seen = [...answered];
                        next[step - 1] = i === 5 ? null : i + 1;
                        seen[step - 1] = true;
                        setAnswers(next);
                        setAnswered(seen);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <footer>
              {step > 0 && (
                <button onClick={() => setStep(step - 1)}>
                  {copy(lang, '上一题', 'Back')}
                </button>
              )}
              {step === 0 ? (
                <button
                  className="primary"
                  onClick={() => setStep(1)}
                  disabled={!invite}
                >
                  {copy(lang, '开始 48 题', 'Start 48 questions')}
                </button>
              ) : step < 48 ? (
                <button
                  className="primary"
                  disabled={!answered[step - 1]}
                  onClick={() => setStep(step + 1)}
                >
                  {copy(lang, '下一题', 'Next')}
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={busy || !answered.every(Boolean)}
                  onClick={() => void submit()}
                >
                  {copy(lang, '提交给邀请者', 'Send to inviter')}
                </button>
              )}
            </footer>
          </section>
        )}
        <p className="friend-notice">{notice}</p>
      </main>
    );
  return (
    <main className="friend-page">
      <header>
        <a
          className="friend-back"
          href={
            lang === 'en' ? '/en/prototype?view=play' : '/prototype?view=play'
          }
        >
          {copy(lang, '← 返回人物世界', '← Back to Characters')}
        </a>
        <p className="eyebrow">16 SHADES</p>
        <h1>{copy(lang, '朋友眼中的我', 'How friends see me')}</h1>
        <p>
          {copy(
            lang,
            '邀请朋友完成同一套 48 题，看看他们对你的印象。',
            'Invite friends to answer the same 48 questions and see their impression of you.',
          )}
        </p>
      </header>
      <section className="friend-card">
        {user && (
          <button className="friend-account" onClick={() => setDialog(true)}>
            {copy(lang, '当前账号：', 'Account: ')}
            {user.username}
          </button>
        )}
        <label>
          {copy(lang, '你在邀请中显示的昵称', 'Your name on this invitation')}
          <input
            maxLength={48}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={copy(
              lang,
              '例如：小林（朋友会看到这个名字）',
              'For example: Alex (shown to friends)',
            )}
          />
        </label>
        <button
          className="primary"
          disabled={busy || (!!user && !subject.trim())}
          onClick={() => void makeInvite()}
        >
          {user
            ? copy(lang, '让TA猜', 'Let them guess')
            : copy(lang, '登录后创建邀请', 'Sign in to create an invite')}
        </button>
      </section>
      <section className="friend-invites">
        <h2>{copy(lang, '已保存的邀请', 'Saved invitations')}</h2>
        {invites.map((item) => (
          <article key={item.token}>
            <div>
              <b>{item.subjectName}</b>
              <small>
                {item.responses.length} {copy(lang, '份回应', 'responses')}
              </small>
            </div>
            <div>
              <button onClick={() => void share(item.token)}>
                {copy(lang, '复制链接', 'Copy link')}
              </button>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      copy(
                        lang,
                        '删除这份邀请及其所有回应？',
                        'Delete this invitation and all its responses?',
                      ),
                    )
                  )
                    void removeFriendInvite(item.token)
                      .then(refresh)
                      .catch(() =>
                        setNotice(
                          copy(
                            lang,
                            '删除未完成，请重试。',
                            'Could not delete. Please retry.',
                          ),
                        ),
                      );
                }}
              >
                {copy(lang, '删除', 'Delete')}
              </button>
            </div>
            {item.responses.map((r) => (
              <details key={r.id}>
                <summary>
                  {r.nickname || copy(lang, '一位朋友', 'A friend')} ·{' '}
                  {new Date(r.createdAt).toLocaleDateString(
                    lang === 'zh' ? 'zh-CN' : 'en-US',
                  )}{' '}
                  · {copy(lang, '查看印象', 'View impression')}
                </summary>
                <Result
                  lang={lang}
                  data={r}
                  nickname={r.nickname}
                  createdAt={r.createdAt}
                />
              </details>
            ))}
          </article>
        ))}
      </section>
      <p className="friend-notice">{notice}</p>
      <AccountDialog
        open={dialog}
        onClose={() => setDialog(false)}
        user={user}
        saved={saved}
        pendingResult={null}
        onAccount={(u, s) => {
          setUser(u);
          setSaved(s);
          setInvites([]);
          void refresh();
        }}
        onOpenResult={() => {}}
        onSaved={() => void refresh()}
      />
    </main>
  );
}
function Result({
  lang,
  data,
  nickname,
  createdAt,
}: {
  lang: Lang;
  data: { result: CandidateResult; presentation: Recommendation };
  nickname?: string | null;
  createdAt?: string;
}) {
  const uncertain = Object.values(data.result.axes).every(axis => axis.percent === null) || data.presentation.tied.length === 16;
  const c = characters.find((x) => x.id === data.presentation.recommended);
  const title =
    lang === 'en' ? englishNames[data.presentation.recommended] : c?.name;
  return (
    <section className="friend-card friend-result">
      {c && !uncertain && <img src={c.image} alt={title} />}
      <div>
        <p>
          {nickname?.trim() || copy(lang, '一位朋友', 'A friend')} ·{' '}
          {uncertain ? copy(lang, '留下的印象', 'shared this impression') : copy(lang, '印象更接近', 'is closest to')}
        </p>
        <h2>{uncertain ? copy(lang,'这次印象还没有形成明确方向','No clear direction in this impression yet') : title || data.presentation.recommended}</h2>
        <p>
          {copy(
            lang,
            '这是朋友视角的印象，不替代本人测评或对人的定论。',
            'This is one friend’s impression; it does not replace a self-assessment or define a person.',
          )}
        </p>
        <small>{copy(lang, '下方数值表示两端之间的位置：0 为左端，100 为右端。', 'The values below show position between the two ends: 0 is left and 100 is right.')}</small>
        <ul>
          {Object.entries(data.result.axes).map(([axis, value]) => (
            <li key={axis}>
              {
                (
                  {
                    G: copy(
                      lang,
                      '目标 · 利益 ↔ 决定权',
                      'Goals · Benefit ↔ Control',
                    ),
                    M: copy(
                      lang,
                      '方式 · 布局 ↔ 施压',
                      'Approach · Strategy ↔ Pressure',
                    ),
                    H: copy(
                      lang,
                      '冲突 · 达成目的 ↔ 让对方付代价',
                      'Conflict · Instrumental ↔ Punitive',
                    ),
                    N: copy(
                      lang,
                      '规范 · 维持体面 ↔ 直接行动',
                      'Norms · Appearance ↔ Defiance',
                    ),
                  } as Record<string, string>
                )[axis]
              }{' '}
              ·{' '}
              {value.percent === null
                ? copy(lang, '了解不足', 'Not enough information')
                : `${value.percent} / 100`}
            </li>
          ))}
        </ul>
        {createdAt && (
          <small>
            {new Date(createdAt).toLocaleDateString(
              lang === 'zh' ? 'zh-CN' : 'en-US',
            )}
          </small>
        )}
        <p>
          {copy(
            lang,
            '结果已保存给邀请者。',
            'The result has been saved for the inviter.',
          )}
        </p>
      </div>
    </section>
  );
}
