'use client';
import { useI18n } from '@/app/i18n/provider';


import { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Share2 } from 'lucide-react';

import { axes, type AxisLetter, type AxisResult, type Character } from '@/app/data';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';

type StoredResult = {
  characterId: string;
  axisResults: AxisResult[];
};

function structureAxes(character: Character): AxisResult[] {
  return axes.map((axis, index) => ({
    ...axis,
    winner: character.structure[index] as AxisLetter,
    leftScore: 0,
    rightScore: 0,
    position: 50,
    isBoundary: false,
  }));
}

export function ResultView({ character }: { character: Character }) {
  const { t, tn, asset, href } = useI18n();

  const [storedAxes, setStoredAxes] = useState<AxisResult[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('shadow16-last-result');
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as StoredResult;
      if (stored.characterId === character.id && stored.axisResults?.length === 4) {
        setStoredAxes(stored.axisResults);
      }
    } catch {
      sessionStorage.removeItem('shadow16-last-result');
    }
  }, [character.id]);

  const axisResults = useMemo(() => storedAxes ?? structureAxes(character), [storedAxes, character]);
  const boundaryCount = axisResults.filter((axis) => axis.isBoundary).length;

  const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // HTTP pages may expose the API but reject writes; use the legacy fallback below.
      }
    }

    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copiedSuccessfully = document.execCommand('copy');
    field.remove();
    if (!copiedSuccessfully) throw new Error('浏览器未允许复制');
  };

  const share = async () => {
    const url = window.location.href;
    const text = t(`我在“16暗面”里测出了「${character.name}」：${character.quote} 你会是哪一型？`);
    if (navigator.share) {
      try {
        await navigator.share({ title: t(`${character.name}｜16暗面`), text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await copyText(`${text}\n${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('请复制下面的分享文字：', `${text}\n${url}`);
    }
  };

  return (
    <main className="app-shell">
      <SiteHeader />
      <section className="result-layout">
        <article className="result-hero">
          <div className="result-image-wrap">
            <img src={asset(character.image)} alt={t(`${character.name}人物造型`)} />
            <span className="result-id">{tn(character.id)}</span>
          </div>
          <div className="result-copy">
            <p className="eyebrow">{t("你的本次结果")}</p>
            <div className="result-tags"><span>{tn(character.family)}</span><span>{tn(character.structure)}</span></div>
            <h1>{tn(character.name)}</h1>
            <blockquote>“{tn(character.quote)}”</blockquote>
            {(boundaryCount > 0 && storedAxes && (
              <p className="boundary-note">{t("其中 ")}{tn(boundaryCount)} {t(" 条轴接近正中间，本结果按固定规则作临界判定。")}</p>
            ))}
            <p className="result-disclaimer">
              {t("这个名字描述的是倾向在压力下被放大的样子，不代表你做过对应行为，也不评价你是不是好人。 ")}</p>
            <div className="result-buttons">
              <Button className="share-button" size="lg" onClick={share}>
                {(copied ? <Check /> : <Share2 />)} {tn(copied ? '链接已复制' : '分享结果')}
              </Button>
              <Button className="secondary-button" size="lg" variant="outline" render={<a href={href("/quiz/")} aria-label={t('重新测试')} />}>
                <RotateCcw /> {t(" 重新测试 ")}</Button>
            </div>
          </div>
        </article>

        <section className="analysis-section">
          <div className="section-heading"><p>{t("四轴画像")}</p><h2>{t("你更自然的处理方向")}</h2></div>
          <div className="axis-grid">
            {(axisResults.map((axis) => (
              <article className="axis-card" key={axis.key}>
                <div className="axis-title"><span>{tn(axis.title)}</span><strong>{tn(axis.winner)}</strong></div>
                <div className="axis-labels"><span>{tn(axis.left)}</span><span>{tn(axis.right)}</span></div>
                <div className={`axis-track ${storedAxes ? '' : 'axis-track--shared'}`}>
                  <span style={{ left: `${axis.position}%` }} />
                </div>
                <p>{tn(axis.copy[axis.winner])}</p>
              </article>
            )))}
          </div>
        </section>

        <section className="reflection-grid">
          <article className="reflection-card reflection-card--light">
            <p className="card-kicker">{t("正常的一面")}</p>
            <h2>{t("这些倾向也能成为你的工具")}</h2>
            <ul>{(axisResults.map((axis) => <li key={axis.key}>{tn(axis.copy[axis.winner])}</li>))}</ul>
          </article>
          <article className="reflection-card reflection-card--dark">
            <p className="card-kicker">{t("压力下的提醒")}</p>
            <h2>{tn(character.description)}</h2>
            <ul>{(axisResults.map((axis) => <li key={axis.key}>{tn(axis.caution[axis.winner])}</li>))}</ul>
          </article>
        </section>

        <footer className="result-footer">
          {t("本测试用于娱乐性自我观察，不是心理诊断，也不声称具有临床、招聘或选拔测评效度。 ")}</footer>
      </section>
    </main>
  );
}
