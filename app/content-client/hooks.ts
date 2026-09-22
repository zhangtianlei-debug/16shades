'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { contentApi } from './client';
import type {
  ContentIndex,
  Locale,
  SearchIndex,
  TheaterStory,
  WikiArticle,
} from './types';

type State<T> = {
  value: T | null;
  loading: boolean;
  error: string | null;
  cached: boolean;
};
function useLoad<T>(
  load: (signal: AbortSignal) => Promise<{ value: T; cached: boolean }>,
  deps: unknown[],
) {
  const [state, setState] = useState<State<T>>({
    value: null,
    loading: true,
    error: null,
    cached: false,
  });
  const serial = useRef(0);
  const retry = useCallback(() => {
    serial.current++;
    setState({ value: null, cached: false, loading: true, error: null });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const version = serial.current;
    setState({ value: null, cached: false, loading: true, error: null });
    load(controller.signal)
      .then(({ value, cached }) => {
        if (!controller.signal.aborted && version === serial.current)
          setState({ value, cached, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (error.name !== 'AbortError' && !controller.signal.aborted && version === serial.current)
          setState((s) => ({ ...s, loading: false, error: error.message }));
      });
    return () => controller.abort(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, serial.current]);
  return { ...state, retry };
}
export const useContentIndex = () =>
  useLoad<ContentIndex>((signal) => contentApi.index(signal), []);
export const useWikiArticle = (url?: string, revision?: string) =>
  useLoad<WikiArticle>(
    (signal) =>
      url && revision
        ? contentApi.wiki(url, revision, signal)
        : Promise.reject(new Error('Article unavailable.')),
    [url, revision],
  );
export const useTheaterStory = (url?: string, revision?: string) =>
  useLoad<TheaterStory>(
    (signal) =>
      url && revision
        ? contentApi.theater(url, revision, signal)
        : Promise.reject(new Error('Episode unavailable.')),
    [url, revision],
  );
export const useSearchIndex = (url?: string, revision?: string, locale?: Locale) =>
  useLoad<SearchIndex>(
    (signal) =>
      url && revision && locale
        ? contentApi.search(url, revision, locale, signal)
        : Promise.reject(new Error('Search unavailable.')),
    [url, revision, locale],
  );
