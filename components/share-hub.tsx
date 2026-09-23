'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Check, Clipboard, ExternalLink, ImageDown, Share2, Sparkles, Users, Wallpaper } from 'lucide-react';
import { useI18n } from '@/app/i18n/provider';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { isWechatBrowser, setWechatShareSelection, subscribeWechatShareStatus, wechatShareStatus, type WechatShareCard, type WechatShareStatus } from './wechat-share';
import { IdentityCard, identityCopy } from '@/app/prototype/identity-card';
import { characterPath } from '@/app/prototype/navigation';
import { readAccount } from '@/app/prototype/account-api';
import { readLocalResult } from '@/app/prototype/local-result';
import { recommendRoles } from '@/app/prototype/recommendation';
import type { CandidateResult } from '@/app/prototype/scoring';
import './share-hub.css';

type Detail = 'site' | 'identity' | 'theater' | null;
const copy = {
  trigger: { zh: '分享', en: 'Share' }, title: { zh: '把喜欢的部分带走', en: 'Take a favorite part with you' }, lead: { zh: '发给朋友，一起看看彼此的另一面。', en: 'Send it to a friend and explore each other’s other side.' },
  site: { zh: '分享这个网站', en: 'Share this site' }, siteLead: { zh: '邀请朋友也来测一测，看看TA的暗影画像。', en: 'Invite a friend to take the assessment and discover their shadow profile.' }, siteShareTitle: { zh: '16暗影｜看看你的另一面', en: '16 Shades | Explore your other side' }, copyLink: { zh: '复制链接', en: 'Copy link' }, copied: { zh: '已复制', en: 'Copied' }, systemShare: { zh: '系统分享', en: 'Share with system' },
  friend: { zh: '测测朋友眼中的我', en: 'How friends see me' }, friendLead: { zh: '让朋友按对你的印象答48题；登录创建邀请，保存朋友的印象反馈。', en: 'Invite a friend to answer 48 questions from their impression of you; sign in to create an invite and save their feedback.' }, friendCta: { zh: '让TA猜', en: 'Invite a friend' },
  identity: { zh: '我的人物卡', en: 'My character card' }, identityLead: { zh: '用本次真实结果生成并保存人物卡。', en: 'Generate and save a character card from this result.' }, identityNone: { zh: '先完成一次测评，或登录找回已保存的结果。', en: 'Complete an assessment first, or sign in to recover a saved result.' }, quiz: { zh: '先测一次', en: 'Take the assessment' }, recover: { zh: '登录找回', en: 'Sign in to recover' }, identityShare: { zh: '分享人物卡', en: 'Share character card' }, identityLink: { zh: '查看人物页', en: 'Open character page' }, unclear: { zh: '暂无明确画像', en: 'No clear character match yet' }, unclearLead: { zh: '这次结果的各个方向较为接近，可以先查看完整画像。', en: 'The directions in this result are close. You can view the full profile first.' }, fullProfile: { zh: '查看完整画像', en: 'View full profile' },
  types: { zh: '人物与组合卡', en: 'Character and combination cards' }, typesLead: { zh: '选一位人物后，保存或分享人物与组合卡。', en: 'Choose a character, then save or share character and combination cards.' }, typesCta: { zh: '选人物', en: 'Choose a character' },
  wallpapers: { zh: '人物壁纸', en: 'Character wallpapers' }, wallpapersLead: { zh: '浏览精选主题与16位人物标准壁纸。', en: 'Browse curated themes and standard wallpapers for all 16 characters.' }, wallpapersCta: { zh: '挑选壁纸', en: 'Choose wallpapers' },
  theater: { zh: '小剧场', en: 'Mini theater' }, theaterLead: { zh: '复制小剧场全集入口，或先去挑一期看看。', en: 'Copy the mini theater collection link, or choose an episode to explore.' }, theaterShareTitle: { zh: '16暗影小剧场', en: '16 Shades Mini Theater' }, theaterCta: { zh: '挑一期看看', en: 'Choose an episode' }, theaterShare: { zh: '分享小剧场', en: 'Share mini theater' },
  close: { zh: '关闭', en: 'Close' }, failed: { zh: '复制没有完成，可手动复制下方文字。', en: 'Copy did not complete. You can copy the text below.' }, back: { zh: '返回全部方式', en: 'Back to all options' },
  wechatHint: { zh: '点微信右上角 ···，选择「发送给朋友」或「分享到朋友圈」。', en: 'Tap ··· at the top right of WeChat, then choose Send to Chat or Share to Moments.' },
  wechatGuide: { zh: '微信分享指引', en: 'How to share in WeChat' },
  wechatStepOne: { zh: '保持这个弹窗打开，点屏幕右上角的 ···。', en: 'Keep this panel open and tap ··· at the top right of the screen.' },
  wechatStepTwo: { zh: '选择「发送给朋友」，在微信发送窗口确认分享内容。', en: 'Choose Send to Chat and review the content in WeChat’s send window.' },
  wechatPending: { zh: '正在准备微信分享卡，请稍候。', en: 'Preparing the WeChat share card. Please wait.' },
  wechatUnavailable: { zh: '微信分享卡暂不可用。可以复制下方链接发送给朋友。', en: 'The WeChat share card is unavailable. You can copy the link below to send it to a friend.' },
};
type Key = keyof typeof copy;
function label(key: Key, locale: 'zh' | 'en') { return copy[key][locale]; }
// Inside WeChat the page cannot post a message for the visitor, so the panel
// points at the menu WeChat actually reads instead of promising a send.
function WechatNotice({ locale, status }: { locale: 'zh' | 'en'; status: WechatShareStatus }) {
  const [showGuide, setShowGuide] = useState(false);
  const message = status === 'ready' ? label('wechatHint', locale) : status === 'pending' ? label('wechatPending', locale) : label('wechatUnavailable', locale);
  return <div className="share-hub-wechat"><p>{message}</p>{status === 'ready' && <><button type="button" className="share-hub-wechat-guide-button" aria-expanded={showGuide} onClick={() => setShowGuide(!showGuide)}><Share2 size={17}/>{label('wechatGuide', locale)} ↗</button>{showGuide && <ol className="share-hub-wechat-steps"><li>{label('wechatStepOne', locale)}</li><li>{label('wechatStepTwo', locale)}</li></ol>}</>}</div>;
}
function shareUrl(path: string) { return new URL(path, window.location.origin).toString(); }
function supportsSystemShare() { return typeof (navigator as Navigator & { share?: unknown }).share === 'function'; }
// The user agent never changes while the page is open, so there is nothing to
// subscribe to; the client snapshot is read once after hydration.
function subscribeNothing() { return () => undefined; }

export function ShareHub({ result }: { result?: CandidateResult | null }) {
  const { locale, href } = useI18n();
  const [open, setOpen] = useState(false); const [detail, setDetail] = useState<Detail>(null); const [stored, setStored] = useState<CandidateResult | null>(null); const [copied, setCopied] = useState(false); const [fallback, setFallback] = useState('');
  // The browser check is read on the client only, after hydration, so the
  // server-rendered markup and the first client render still agree.
  const wechat = useSyncExternalStore(subscribeNothing, isWechatBrowser, () => false);
  const wechatStatus = useSyncExternalStore<WechatShareStatus>(subscribeWechatShareStatus, wechatShareStatus, () => 'off');
  const siteUrl = typeof window === 'undefined' ? '' : shareUrl(href('/prototype'));
  useEffect(() => {
    if (!open || result) return;
    setStored(readLocalResult()?.result ?? null);
    let active = true;
    void readAccount().then((account) => { if (active && account.saved?.result) setStored((current) => current ?? account.saved!.result); }).catch(() => undefined);
    return () => { active = false; };
  }, [open, result]);
  const actual = result ?? stored;
  const recommendation = useMemo(() => actual ? recommendRoles(actual) : null, [actual]);
  const roleId = recommendation && recommendation.coverage > 0 && recommendation.tied.length < 16 ? recommendation.recommended : null;
  useEffect(() => {
    if (!open || !detail || !wechat) {
      setWechatShareSelection(null);
      return;
    }
    const card = detail === 'site'
      ? { kind: 'site', title: label('siteShareTitle', locale), description: label('siteLead', locale), image: shareUrl('/share/site.png'), link: siteUrl }
      : detail === 'theater'
        ? { kind: 'theater', title: label('theaterShareTitle', locale), description: label('theaterLead', locale), image: shareUrl('/share/theater.png'), link: shareUrl(href('/theater')) }
        : roleId
          ? { kind: 'character', title: locale === 'zh' ? `16暗影｜${identityCopy(roleId, null, locale).identity}` : `${identityCopy(roleId, null, locale).identity} | 16 Shades`, description: label('identityLead', locale), image: shareUrl(`/characters/${roleId.toLowerCase()}.jpg`), link: shareUrl(href(characterPath(roleId))) }
          : null;
    setWechatShareSelection(card satisfies WechatShareCard | null);
    return () => setWechatShareSelection(null);
  }, [detail, href, locale, open, roleId, siteUrl, wechat]);
  const systemShare = async (title: string, text: string, url: string) => {
    if (!supportsSystemShare()) return;
    try { await navigator.share({ title, text, url }); } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setFallback(url); }
  };
  const copyUrl = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setFallback(''); window.setTimeout(() => setCopied(false), 1800); } catch { setFallback(url); }
  };
  const resetDetail = (next: Detail = null) => { setDetail(next); setCopied(false); setFallback(''); };
  const cards = [
    { id: 'site' as const, icon: Share2, title: label('site', locale), lead: label('siteLead', locale), action: () => resetDetail('site') },
    { id: 'friend', icon: Users, title: label('friend', locale), lead: label('friendLead', locale), href: href('/friends'), cta: label('friendCta', locale) },
    { id: 'identity' as const, icon: ImageDown, title: label('identity', locale), lead: label('identityLead', locale), action: () => resetDetail('identity') },
    { id: 'types', icon: Sparkles, title: label('types', locale), lead: label('typesLead', locale), href: href('/prototype?view=types'), cta: label('typesCta', locale) },
    { id: 'wallpapers', icon: Wallpaper, title: label('wallpapers', locale), lead: label('wallpapersLead', locale), href: href('/prototype?view=resources&collection=wallpapers'), cta: label('wallpapersCta', locale) },
    { id: 'theater' as const, icon: ExternalLink, title: label('theater', locale), lead: label('theaterLead', locale), action: () => resetDetail('theater') },
  ];
  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) resetDetail(); else resetDetail(); }}>
    <DialogTrigger render={<button type="button" className="share-hub-trigger" aria-label={label('trigger', locale)} title={label('trigger', locale)} />}><Share2 size={19} /></DialogTrigger>
    <DialogContent className="share-hub-dialog" aria-label={label('trigger', locale)} showCloseButton={false}>
      <DialogClose className="share-hub-close" aria-label={label('close', locale)}>×</DialogClose>
      {detail ? <section className="share-hub-detail"><button type="button" className="share-hub-back" onClick={() => resetDetail()}>← {label('back', locale)}</button>{detail === 'site' ? <LinkDetail title={label('site', locale)} shareTitle={label('siteShareTitle', locale)} lead={label('siteLead', locale)} url={siteUrl} locale={locale} copied={copied} onCopy={copyUrl} onShare={systemShare} wechat={wechat} wechatStatus={wechatStatus} /> : detail === 'theater' ? <TheaterDetail locale={locale} href={href} copied={copied} onCopy={copyUrl} onShare={systemShare} wechat={wechat} wechatStatus={wechatStatus} /> : <IdentityDetail locale={locale} href={href} actual={actual} roleId={roleId} copied={copied} onShare={systemShare} onCopy={copyUrl} wechat={wechat} wechatStatus={wechatStatus} />}{fallback && <label className="share-hub-fallback">{label('failed', locale)}<textarea readOnly value={fallback} onFocus={(event) => event.currentTarget.select()} /></label>}</section> : <section><DialogHeader><DialogTitle>{label('title', locale)}</DialogTitle><DialogDescription>{label('lead', locale)}</DialogDescription></DialogHeader>{wechat && <WechatNotice locale={locale} status={wechatStatus} />}<div className="share-hub-grid">{cards.map((card) => { const Icon = card.icon; return card.href ? <a key={card.id} className="share-hub-card" href={card.href}><Icon size={19} /><div><strong>{card.title}</strong><p>{card.lead}</p><span>{card.cta} →</span></div></a> : <button key={card.id} type="button" className={`share-hub-card${card.id === 'site' ? ' share-hub-card--featured' : ''}`} onClick={card.action}><Icon size={19} /><div><strong>{card.title}</strong><p>{card.lead}</p><span>{card.id === 'theater' ? label('theaterShare', locale) : label('trigger', locale)} →</span></div></button>; })}</div></section>}
    </DialogContent>
  </Dialog>;
}

function LinkDetail({ title, shareTitle, lead, url, locale, copied, onCopy, onShare, wechat = false, wechatStatus = 'off' }: { title: string; shareTitle: string; lead: string; url: string; locale: 'zh' | 'en'; copied: boolean; onCopy: (url: string) => Promise<void>; onShare: (title: string, text: string, url: string) => Promise<void>; wechat?: boolean; wechatStatus?: WechatShareStatus }) {
  return <><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{lead}</DialogDescription></DialogHeader>{wechat && <div className="share-hub-preview"><img src={url.includes('/theater') ? '/share/theater.png' : '/share/site.png'} alt=""/><div><strong>{shareTitle}</strong><p>{lead}</p></div></div>}{wechat && <WechatNotice locale={locale} status={wechatStatus} />}<code>{url}</code><div className="share-hub-actions"><button type="button" onClick={() => onCopy(url)}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? label('copied', locale) : label('copyLink', locale)}</button>{!wechat && typeof navigator !== 'undefined' && supportsSystemShare() && <button type="button" onClick={() => onShare(shareTitle, lead, url)}><Share2 size={16} />{label('systemShare', locale)}</button>}</div><output className="share-hub-status" aria-live="polite">{copied ? label('copied', locale) : ''}</output></>;
}

function TheaterDetail({ locale, href, copied, onCopy, onShare, wechat = false, wechatStatus = 'off' }: { locale: 'zh' | 'en'; href: (url: string) => string; copied: boolean; onCopy: (url: string) => Promise<void>; onShare: (title: string, text: string, url: string) => Promise<void>; wechat?: boolean; wechatStatus?: WechatShareStatus }) {
  const url = shareUrl(href('/theater'));
  return <><LinkDetail title={label('theater', locale)} shareTitle={label('theaterShareTitle', locale)} lead={label('theaterLead', locale)} url={url} locale={locale} copied={copied} onCopy={onCopy} onShare={onShare} wechat={wechat} wechatStatus={wechatStatus} /><a className="share-hub-primary-link" href={href('/theater')}>{label('theaterCta', locale)} →</a></>;
}

function IdentityDetail({ locale, href, actual, roleId, copied, onShare, onCopy, wechat = false, wechatStatus = 'off' }: { locale: 'zh' | 'en'; href: (url: string) => string; actual: CandidateResult | null; roleId: string | null; copied: boolean; onShare: (title: string, text: string, url: string) => Promise<void>; onCopy: (url: string) => Promise<void>; wechat?: boolean; wechatStatus?: WechatShareStatus }) {
  if (!actual) return <><DialogHeader><DialogTitle>{label('identity', locale)}</DialogTitle><DialogDescription>{label('identityNone', locale)}</DialogDescription></DialogHeader><div className="share-hub-actions"><a href={href('/quiz')}>{label('quiz', locale)}</a><a href={href('/prototype?account=1')}>{label('recover', locale)}</a></div></>;
  if (!roleId) return <><DialogHeader><DialogTitle>{label('unclear', locale)}</DialogTitle><DialogDescription>{label('unclearLead', locale)}</DialogDescription></DialogHeader><a className="share-hub-primary-link" href={href('/prototype?view=result')}>{label('fullProfile', locale)} →</a></>;
  const pageUrl = shareUrl(href(characterPath(roleId)));
  const shareTitle = locale === 'zh' ? `16暗影｜${identityCopy(roleId, null, locale).identity}` : `${identityCopy(roleId, null, locale).identity} | 16 Shades`;
  return <><DialogHeader><DialogTitle>{label('identity', locale)}</DialogTitle><DialogDescription>{label('identityLead', locale)}</DialogDescription></DialogHeader><div className="share-hub-identity"><IdentityCard roleId={roleId} mbti={null} /></div>{wechat && <WechatNotice locale={locale} status={wechatStatus} />}<div className="share-hub-actions">{!wechat && typeof navigator !== 'undefined' && supportsSystemShare() && <button type="button" onClick={() => onShare(shareTitle, label('identityLead', locale), pageUrl)}><Share2 size={16} />{label('identityShare', locale)}</button>}<button type="button" onClick={() => onCopy(pageUrl)}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? label('copied', locale) : label('copyLink', locale)}</button><a href={pageUrl}>{label('identityLink', locale)} <ExternalLink size={15} /></a></div><output className="share-hub-status" aria-live="polite">{copied ? label('copied', locale) : ''}</output></>;
}
