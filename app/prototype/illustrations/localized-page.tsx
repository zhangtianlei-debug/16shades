'use client';
import { useEffect } from 'react';
import { LanguageSwitcher, useI18n } from '@/app/i18n/provider';


import Link from 'next/link';
import Image from 'next/image';
import { candidateForm } from '../scoring';
import {
  questionIllustrationSrc,
  questionIllustrationStyle,
  sharedIllustrationSrc,
} from '../question-illustrations';
import './review.css';

export default function IllustrationReview() {
  const { t, tn, asset, href } = useI18n();
  useEffect(() => { document.title = t('16暗影｜答题插图总览'); }, [t]);

  return (
    <main className="illustration-review">
      <header>
        <div>
          <p>{t("16 暗影 · 2026.09.08")}</p>
          <h1>{t("品牌 Logo 与答题插图")}</h1>
        </div>
        <Link href={href("/prototype")}>
          {t("进入答题页 ")}<span aria-hidden="true">↗</span>
        </Link>
      <LanguageSwitcher />
      </header>
      <section
        className="illustration-brand-review"
        aria-label={t("Logo 标准版与雾面版")}
      >
        <article>
          <span className="illustration-review-number">{t("标准 Logo · 首版")}</span>
          <div className="illustration-review-picture">
            <Image
              unoptimized
              src={asset("/brand/logo-standard-v1.webp")}
              alt={t("16暗影标准 Logo")}
              width={900}
              height={900}
            />
          </div>
        </article>
        <article>
          <span className="illustration-review-number">{t("雾面 Logo · 备用图")}</span>
          <div className="illustration-review-picture">
            <Image
              unoptimized
              src={asset(sharedIllustrationSrc)}
              alt={t("16暗影低饱和雾面 Logo")}
              width={900}
              height={900}
            />
          </div>
        </article>
      </section>
      {([
        { title: '基础16题 · 情境插图', start: 0, end: 16 },
        { title: '扩展32题 · 情境插图', start: 16, end: 48 },
      ].map((group) => (
        <section className="illustration-question-group" key={group.title}>
          <h2 className="illustration-review-section-title">{tn(group.title)}</h2>
          <div className="illustration-review-grid">
            {(candidateForm.items
              .slice(group.start, group.end)
              .map((item, index) => (
                <article key={item.id}>
                  <span className="illustration-review-number">
                    {tn(String(group.start + index + 1).padStart(2, '0'))}
                  </span>
                  <div className="illustration-review-picture">
                    <Image
                      unoptimized
                      src={asset(questionIllustrationSrc(item.id))}
                      style={questionIllustrationStyle(
                        questionIllustrationSrc(item.id),
                        true,
                      )}
                      alt={t(`第${group.start + index + 1}题情境插图`)}
                      width={900}
                      height={900}
                    />
                  </div>
                  <p>{tn(item.text)}</p>
                </article>
              )))}
          </div>
        </section>
      )))}
    </main>
  );
}
