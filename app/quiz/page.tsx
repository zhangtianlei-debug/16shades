'use client';
import { useI18n } from '@/app/i18n/provider';


import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SiteHeader } from '@/components/site-header';
import { options, questions, scoreAnswers } from '@/app/data';

export default function QuizPage() {
  const { t, tn, href } = useI18n();

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(16).fill(null));
  const selected = answers[current];
  const completed = answers.filter((answer) => answer !== null).length;

  useEffect(() => {
    const context = (document as Document & {
      modelContext?: {
        registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void>;
      };
    }).modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'complete_shadow16_quiz',
          title: t('完成16暗面测试'),
          description: t('提交16个五档文字选项对应的1至5整数，并在页面中打开自动计算后的角色结果。'),
          inputSchema: {
            type: 'object',
            properties: {
              answers: {
                type: 'array',
                minItems: 16,
                maxItems: 16,
                items: { type: 'integer', minimum: 1, maximum: 5 },
              },
            },
            required: ['answers'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: unknown) {
            const submitted = (input as { answers?: unknown })?.answers;
            if (!Array.isArray(submitted) || submitted.length !== 16 || submitted.some((value) => !Number.isInteger(value) || Number(value) < 1 || Number(value) > 5)) {
              throw new Error(t('answers必须包含16个1至5之间的整数'));
            }
            const result = scoreAnswers(submitted as number[]);
            sessionStorage.setItem('shadow16-last-result', JSON.stringify({ characterId: result.character.id, axisResults: result.axisResults }));
            setAnswers(submitted as number[]);
            window.location.assign(href(`/result/${result.character.slug}/`));
            return { character: t(result.character.name), structure: t(result.character.structure), url: href(`/result/${result.character.slug}/`) };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);

    return () => lifecycle.abort();
  }, [href, t]);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const previous = () => {
    if (current === 0) window.location.assign(href('/'));
    else setCurrent((value) => value - 1);
    scrollTop();
  };

  const next = () => {
    if (selected === null) return;
    if (current < questions.length - 1) {
      setCurrent((value) => value + 1);
      scrollTop();
      return;
    }

    const result = scoreAnswers(answers as number[]);
    sessionStorage.setItem(
      'shadow16-last-result',
      JSON.stringify({ characterId: result.character.id, axisResults: result.axisResults }),
    );
    window.location.assign(href(`/result/${result.character.slug}/`));
  };

  return (
    <main className="app-shell">
      <SiteHeader />
      <section className="quiz-layout">
        <div className="quiz-meta">
          <button type="button" onClick={previous} className="back-link">
            <ArrowLeft size={17} /> {tn(current === 0 ? '返回说明' : '上一题')}
          </button>
          <span>{t("已回答 ")}{tn(completed)} / 16</span>
        </div>
        <Progress className="quiz-progress" value={((current + 1) / 16) * 100} />

        <article className="question-card">
          <p className="question-number">QUESTION {tn(String(current + 1).padStart(2, '0'))}</p>
          <h1>{tn(questions[current])}</h1>
          <RadioGroup
            className="answer-list"
            value={selected?.toString() ?? ''}
            onValueChange={(value) => {
              const nextAnswers = [...answers];
              nextAnswers[current] = Number(value);
              setAnswers(nextAnswers);
            }}
            aria-label={t(`第 ${current + 1} 题选项`)}
          >
            {(options.map((option) => {
              const isSelected = selected === option.value;
              return (
                <label className={`answer-option ${isSelected ? 'is-selected' : ''}`} key={option.value}>
                  <RadioGroupItem value={option.value.toString()} />
                  <span>{tn(option.label)}</span>
                  <Check className="answer-check" size={18} aria-hidden="true" />
                </label>
              );
            }))}
          </RadioGroup>

          <div className="question-actions">
            <p>{t("没有标准答案，按第一反应即可。")}</p>
            <Button className="primary-button" size="lg" disabled={selected === null} onClick={next}>
              {tn(current === questions.length - 1 ? '查看结果' : '下一题')} <ArrowRight />
            </Button>
          </div>
        </article>
      </section>
    </main>
  );
}
