'use client';

import { UserRound } from 'lucide-react';
import { LanguageSwitcher, useI18n } from '@/app/i18n/provider';
import type { CandidateResult } from '@/app/prototype/scoring';
import { ShareHub } from './share-hub';
import './shared-header.css';

export type SharedHeaderDestination = 'theater' | 'types' | 'combo' | 'knowledge' | 'about';

type SharedHeaderProps = {
  current?: SharedHeaderDestination;
  onNavigate?: (destination: 'types' | 'combo' | 'knowledge') => void;
  onAccount?: () => void;
  shareResult?: CandidateResult | null;
  className?: string;
  brandClassName?: string;
  navClassName?: string;
  brandHref?: string;
  onBrandClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  brandLabel?: string;
};

const destinations: Array<{ id: SharedHeaderDestination; zh: string; en: string; href: string }> = [
  { id: 'theater', zh: '小剧场', en: 'Theater', href: '/theater' },
  { id: 'types', zh: '人物', en: 'Characters', href: '/prototype?view=types' },
  { id: 'combo', zh: 'MBTI', en: 'MBTI', href: '/prototype?view=combo' },
  { id: 'knowledge', zh: 'Wiki', en: 'Wiki', href: '/prototype?view=knowledge' },
  { id: 'about', zh: '关于', en: 'About', href: '/about' },
];

export function SharedHeader({ current, onNavigate, onAccount, shareResult, className = '', brandClassName = '', navClassName = '', brandHref, onBrandClick, brandLabel }: SharedHeaderProps) {
  const { locale, t, href } = useI18n();
  return <header className={`shared-header ${className}`.trim()}>
    <a className={`shared-header__brand ${brandClassName}`.trim()} href={brandHref ?? href('/prototype')} onClick={onBrandClick} aria-label={brandLabel ?? t('16暗影首页')}>
      <span>16</span><strong>{t('暗影')}</strong>
    </a>
    <nav className={`shared-header__nav ${navClassName}`.trim()} aria-label={t('主导航')}>
      {destinations.map((item) => <a key={item.id} className="shared-header__link" href={href(item.href)} aria-current={current === item.id ? 'page' : undefined} onClick={item.id === 'types' || item.id === 'combo' || item.id === 'knowledge' ? (onNavigate ? (event) => { event.preventDefault(); onNavigate(item.id as 'types' | 'combo' | 'knowledge'); } : undefined) : undefined}>
        {locale === 'en' ? item.en : item.zh}
      </a>)}
    </nav>
    <div className="shared-header__actions">
      <ShareHub result={shareResult} />
      {onAccount ? <button className="shared-header__utility" type="button" onClick={onAccount} aria-label={t('账号')}><UserRound size={18} aria-hidden="true" /></button> : <a className="shared-header__utility" href={href('/prototype?account=1')} aria-label={t('登录')}><UserRound size={18} aria-hidden="true" /></a>}
      <LanguageSwitcher />
    </div>
  </header>;
}
