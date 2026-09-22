'use client';
import { LanguageSwitcher, useI18n } from '@/app/i18n/provider';

import { ShieldCheck } from 'lucide-react';

export function SiteHeader() {
  const { t, href } = useI18n();

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="brand-link" href={href("/")} aria-label={t("返回欢迎页")}>
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>
            <span className="brand-name">{t("16暗面")}</span>
            <span className="brand-note">{t("SIXTEEN SHADES · 内测版")}</span>
          </span>
        </a>
        <span className="privacy-pill"><ShieldCheck size={15} /> {t(" 本地计算")}</span>
      <LanguageSwitcher />
      </div>
    </header>
  );
}
