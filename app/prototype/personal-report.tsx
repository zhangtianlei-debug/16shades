'use client';

import { Heart, BriefcaseBusiness, BookOpen, Users, Sunrise, ArrowDown } from 'lucide-react';
import { useI18n } from '@/app/i18n/provider';
import { axisContent } from './content';
import type { CandidateResult, AxisKey } from './scoring';
import { showPercent, type Recommendation } from './recommendation';
import { compareWithCharacter, readingState } from './personal-report-model';
import domainCopy from './personal-report-copy.json';

const domains = [
  { id: 'intimacy', axis: 'H', title: '亲密与感情', icon: Heart },
  { id: 'work', axis: 'M', title: '工作与协作', icon: BriefcaseBusiness },
  { id: 'learning', axis: 'G', title: '学习与成长', icon: BookOpen },
  { id: 'friends', axis: 'N', title: '朋友与家庭', icon: Users },
  { id: 'daily', axis: 'H', title: '日常生活与自我管理', icon: Sunrise },
] as const;

export function PersonalReport({ result, recommendation, character, canContinue }: {
  result: CandidateResult;
  canContinue: boolean;
  recommendation: Recommendation;
  character: { id: string; name: string };
}) {
  const { t, tn } = useI18n();
  const rows = compareWithCharacter(result, character.id);
  const known = rows.filter((row) => row.distance !== null);
  const common = rows.filter((row) => row.sameDirection);
  const allTied = recommendation.tied.length === 16;
  const match = recommendation.shares.find((item) => item.id === character.id);
  const full = result.stage === 'full';
  const largestDistance = Math.max(...known.map((row) => row.distance!));
  const differences = known.filter((row) => row.distance! > 0 && Math.abs(row.distance! - largestDistance) < 1e-12);
  const matchedLabel = (axis: AxisKey, positive: boolean) => positive ? axisContent[axis].right : axisContent[axis].left;

  return <div className="personal-report">
    <section className="personal-report-opening">
      <p className="proto-kicker">{tn(full ? '01 / 你的完整报告' : '01 / 先看见这些线索')}</p>
      <div className="personal-report-title">
        <h2>{tn(full ? '你与人物，相似而不同。' : '一个人物，一份初步线索。')}</h2>
        {match && known.length > 0 && !allTied && <div className="personal-report-match">
          <span>{t('与')}{tn(character.name)}{t('的相对匹配')}</span>
          <strong>{showPercent(match.percent)}</strong>
        </div>}
      </div>
      <p className="personal-report-intro">{tn(allTied
        ? '这次回答还没有分出明显方向。这个人物只作为阅读参照，不是对你的定型。'
        : known.length === 0
          ? '这次回答还不足以形成四轴读数。先把人物作为参照，暂不推断你的个人特点。'
          : full
            ? '人物是一种典型策略，你的回答有自己的轻重。往下看，这些差别可能怎样影响你的选择。'
            : canContinue ? '这些是前16题留下的线索。补充32题后，可以在这里继续读到人物差异和五个生活领域的解读。' : '这是此前16题留下的线索。逐题答案已清除，重新完成16题后可以继续补充。')}</p>
      {known.length > 0 && !allTied && <p className="personal-report-footnote">{t('匹配表示本次回答在16型之间的相对权重，不是“你有多少百分比属于这一型”，也不是准确率。')}</p>}
    </section>

    <section className="personal-report-section">
      <p className="proto-kicker">{tn(full ? '02 / 哪些像，哪些不同' : '02 / 这次回答的四个方向')}</p>
      <h3>{tn(full ? '你和这个人物有哪些不同？' : '先看四个方向。')}</h3>
      {full && <div className="personal-report-findings">
        <div><span>{t('相似之处')}</span><p>{tn(common.length
          ? '在这些方向上，你与人物站在同一侧：'
          : '目前还没有足够清晰的同向线索，可以先逐条对照。')}</p>
          {common.length > 0 && <div className="personal-report-chips">{common.map((row) => <span key={row.axis}>{tn(matchedLabel(row.axis, row.typicalPositive))}</span>)}</div>}
        </div>
        <div><span>{t('更值得留意的差别')}</span><p>{tn(!known.length
          ? '尚无足够读数，暂不比较差异大小。'
          : !differences.length
            ? '四条轴都接近人物的参照端点，仍可留意现实中的例外。'
            : differences.length > 1
              ? '这几个方向与人物参照的距离相同，可以一起看：'
              : '这一方向离人物参照更远，值得先看：')}</p>
          <div className="personal-report-chips">{differences.map((row) => <span key={row.axis}>{tn(axisContent[row.axis].title)}</span>)}</div>
        </div>
      </div>}
      <p className="personal-report-legend"><span><i className="personal-reading-key" />{t('你的回答')}</span><span><i className="personal-reference-key" />{t('人物参照')}</span></p>
      <div className="personal-report-axes">{rows.map((row) => {
        const copy = axisContent[row.axis];
        const reading = result.axes[row.axis];
        return <section className="personal-report-axis" key={row.axis}>
          <div className="personal-axis-heading"><h4>{tn(copy.title)}</h4><span>{tn(row.state === 'unavailable' ? '线索不足' : row.state === 'boundary' ? '两侧接近' : reading.confidence === 'low' ? '初步倾向' : '本次倾向')}</span></div>
          <div className="personal-axis-labels"><span>{tn(copy.left)}</span><span>{tn(copy.right)}</span></div>
          <div className={`personal-axis-track${row.position === null ? ' personal-axis-track--empty' : ''}`} aria-hidden="true">
            <span className="personal-axis-reference" style={{ left: row.typicalPositive ? '100%' : '0%' }} />
            {row.position !== null && <span className="personal-axis-reading" style={{ left: `${row.position}%` }} />}
          </div>
          <p className="personal-axis-description">{tn(row.state === 'unavailable'
            ? '这一方向线索不足，暂不放置你的读数。'
            : row.state === 'boundary'
              ? '你的两侧线索接近，和人物偏向一端的设定有所不同。'
              : row.sameDirection
                ? row.distance === 0 ? '这一方向与人物参照端点一致。' : '你与人物偏向同一侧，但你的回答更靠近中间。'
                : '这次回答更偏向人物参照的另一侧。')}
            {row.state !== 'unavailable' && row.state !== 'boundary' && <> {reading.confidence === 'low' ? t('这只是初步线索，不必急着对自己下结论。') : tn(row.state === 'positive' ? copy.positive : copy.negative)}</>}
          </p>
        </section>;
      })}</div>
      <p className="personal-report-footnote">{t('人物参照来自四轴的类型设定，不是真实人群的平均值。读数只描述本次回答。')}</p>
    </section>

    {full && <>
      <section className="personal-report-section personal-life-section">
        <p className="proto-kicker">{t('03 / 放回你的生活里')}</p>
        <h3>{t('在生活中可能怎样表现？')}</h3>
        <p className="personal-report-intro">{t('以下是根据回答推测的可能情况，不代表你已经遇到。你可以只读与你有关的部分。')}</p>
        <div className="personal-life-list">{domains.map((domain, index) => {
          const state = readingState(result, domain.axis);
          const copy = domainCopy[domain.id][state];
          const Icon = domain.icon;
          return <section className="personal-life-domain" key={domain.id}>
            <div className="personal-life-heading"><span className="personal-life-icon"><Icon size={24} /></span><div><span className="personal-life-number">0{index + 1}</span><h4>{tn(domain.title)}</h4></div></div>
            <p className="personal-life-basis">{t('观察线索：')}{tn(axisContent[domain.axis].title)}<span> · {tn(state === 'unavailable' ? '线索不足' : state === 'boundary' ? '两侧接近' : result.axes[domain.axis].confidence === 'low' ? '初步倾向' : '本次倾向')}</span></p>
            {state !== 'unavailable' && state !== 'boundary' && result.axes[domain.axis].confidence === 'low' && <p className="personal-life-uncertain">{t('这一条只是初步线索。以下内容供你参考。')}</p>}
            <div className="personal-life-pair"><div><h5>{tn(state === 'unavailable' ? '暂不判断这一部分' : '可以发挥的优势')}</h5><p>{tn(copy.strength)}</p></div><div><h5>{tn(state === 'unavailable' ? '先保留一个问题' : '可能付出的代价')}</h5><p>{tn(copy.cost)}</p></div></div>
            <div className="personal-life-action"><ArrowDown size={16} /><div><h5>{tn(state === 'unavailable' ? '可以先不下结论' : '如果你想换种做法')}</h5><p>{tn(copy.action)}</p></div></div>
          </section>;
        })}</div>
      </section>
      <section className="personal-report-takeaway"><p className="proto-kicker">{t('04 / 留给你的空间')}</p><h3>{t('这份报告，只供你参考。')}</h3><p>{t('哪些地方贴近你的经验，哪些地方不贴近，都可以由你自己判断。')}</p><p className="personal-report-footnote">{t('人物只是参照，你可以保留不同看法。')}</p></section>
    </>}
  </div>;
}
