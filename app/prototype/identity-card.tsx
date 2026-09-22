'use client';
import { useI18n } from '@/app/i18n/provider';


import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { MbtiType } from './social-content';
import { Download, RotateCcw } from 'lucide-react';
import { createIdentityCard, identityCopy } from './identity-card-artwork';
export { identityCopy } from './identity-card-artwork';

export function IdentityCard({
  roleId,
  mbti,
  previewOnly = false,
}: {
  roleId: string;
  mbti: MbtiType | null;
  previewOnly?: boolean;
}) {
  const { t, tn, locale, asset, href } = useI18n();

  const [attempt, setAttempt] = useState(0);
  const [image, setImage] = useState<{ key: string; url: string } | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const key = `${locale}:${roleId}:${mbti ?? ''}:${attempt}`;
  const error = errorKey === key;
  const { identity, title, line, nickname } = identityCopy(roleId, mbti, locale);
  useEffect(() => {
    let active = true;
    void createIdentityCard(roleId, mbti, locale)
      .then((url) => {
        if (!active) return;
        setImage({ key, url });
      })
      .catch(() => {
        if (active) setErrorKey(key);
      });
    return () => {
      active = false;
    };
  }, [roleId, mbti, key, locale]);
  const ready = image?.key === key && !error;
  return (
    <div
      className={`identity-card-export${previewOnly ? ' identity-card-export--preview' : ''}`}
    >
      {(ready ? (
        <Image
          className="identity-card-image"
          src={asset(image.url)}
          alt={t(`${identity}${nickname ? `（${nickname}）` : ''}。${title}。${line}`)}
          width={1080}
          height={1440}
          onError={() => setErrorKey(key)}
          unoptimized
        />
      ) : (
        <output className="identity-card-loading">
          {tn(error ? '图片暂时没有生成成功。' : '正在准备你的身份卡…')}
        </output>
      ))}
      {(error ? (
        <button
          className="proto-outline"
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
        >
          <RotateCcw size={16} />
          {t("重新生成 ")}</button>
      ) : (
        ready &&
        !previewOnly && (
          <a
            className="proto-primary"
            href={href(image.url)}
            download={t(`16暗影-${identity}.png`)}
          >
            <Download size={16} />
            {t("保存图片 ")}</a>
        )
      ))}
      {(ready && !previewOnly && (
        <p className="proto-quiet">{t("也可以长按图片保存到相册。")}</p>
      ))}
    </div>
  );
}
