'use client';
import { useI18n } from '@/app/i18n/provider';

import populationData from './population-estimate-data.json';
import './relationships.css';

export const SCENARIO_ID = populationData.scenario_id;
export function PopulationEstimate({
  characterId,
  onOpenMethod,
}: {
  characterId: string;
  onOpenMethod: () => void;
}) {
  const { t, tn, href } = useI18n();

  const type = populationData.types.find((item) => item.id === characterId);
  if (!type) return null;
  return (
    <section className="population-estimate" aria-label={t("人群占比模型估算")}>
      <div>
        <p>{t("人群占比（模型估算）")}</p>
        <strong>{t("约")}{tn(type.percent_display)}%</strong>
        <span>{t("示范情景 · 基于公开假设，真实比例未知")}</span>
      </div>
      <a
        href={href(`/prototype?view=knowledge&article=type-share-estimation&scenario=${encodeURIComponent(SCENARIO_ID)}`)}
        onClick={(event) => {
          event.preventDefault();
          onOpenMethod();
        }}
        aria-label={t("查看人群占比的估算方法")}
      >
        ?
      </a>
    </section>
  );
}
