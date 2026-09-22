'use client';
import { useI18n } from '@/app/i18n/provider';


import { useEffect, useState } from 'react';
import {
  clearLocalResult,
  localResultEnabled,
  readLocalResult,
  setLocalResultEnabled,
  localResultChanged,
  localResultKey,
  localResultPreferenceKey,
} from '../prototype/local-result';
import {
  analyticsPreference,
  setAnalyticsPreference,
} from '../prototype/account-api';

export function PrivacyControls() {
  const { t, tn } = useI18n();

  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const update = () => {
      setEnabled(localResultEnabled());
      setAnalytics(analyticsPreference());
      setHasResult(!!readLocalResult());
      setLoaded(true);
    };
    update();
    const storage = (event: StorageEvent) => {
      if (
        event.key === null ||
        [
          localResultKey,
          localResultPreferenceKey,
          'shadow16-analytics-choice',
        ].includes(event.key)
      )
        update();
    };
    window.addEventListener('storage', storage);
    window.addEventListener(localResultChanged, update);
    return () => {
      window.removeEventListener('storage', storage);
      window.removeEventListener(localResultChanged, update);
    };
  }, []);
  return (
    <div className="privacy-controls">
      <label
        className="privacy-choice"
        htmlFor="local-results-enabled"
        aria-label={t("在此浏览器保留最近一次结果")}
      >
        <input
          id="local-results-enabled"
          type="checkbox"
          checked={enabled}
          disabled={!loaded}
          onChange={(event) => {
            const allowed = event.target.checked;
            if (setLocalResultEnabled(allowed)) {
              setEnabled(allowed);
              setMessage(
                allowed
                  ? '之后完成的结果将自动在本机保留3天。'
                  : '已关闭本地保存，并清除本地结果。',
              );
            } else
              setMessage(
                '浏览器未允许修改本地存储。你也可以在浏览器设置中清除本站数据。',
              );
          }}
        />
        <span>
          <strong>{t("在此浏览器保留最近一次结果")}</strong>
          <small>{t("有效期3天。关闭后清除本地结果，不影响账号中的结果。")}</small>
        </span>
      </label>
      <button
        type="button"
        className="privacy-clear"
        disabled={!loaded || !hasResult}
        onClick={() => {
          setMessage(
            clearLocalResult()
              ? '已清除此浏览器中的结果。'
              : '暂时无法清除，请在浏览器设置中清除本站数据。',
          );
        }}
      >
        {t("清除本地结果 ")}</button>
      <label
        className="privacy-choice"
        htmlFor="analytics-enabled"
        aria-label={t("允许可选访问统计")}
      >
        <input
          id="analytics-enabled"
          type="checkbox"
          checked={analytics}
          disabled={!loaded}
          onChange={(event) => {
            setAnalytics(event.target.checked);
            setAnalyticsPreference(event.target.checked);
            setMessage(
              event.target.checked
                ? '已允许可选访问统计。'
                : '已关闭后续访问统计。请刷新其他已打开的本站页面，以停止其中已加载的第三方统计脚本。',
            );
          }}
        />
        <span>
          <strong>{t("允许可选访问统计")}</strong>
          <small>
            {t("帮助我们了解页面和操作的使用情况。不包含逐题答案和测试结果。 ")}</small>
        </span>
      </label>
      <output className="privacy-control-status" aria-live="polite">
        {tn(message ||
          (loaded && !hasResult ? '此浏览器中没有有效的本地结果。' : '\u00a0'))}
      </output>
    </div>
  );
}
