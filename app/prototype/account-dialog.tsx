'use client';
import { useI18n } from '@/app/i18n/provider';

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
  type SubmitEvent,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  Settings2,
  UserRound,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { characters } from '@/app/data';
import { CharacterAvatar } from './character-avatar';
import {
  AccountError,
  accountRequest,
  readAccount,
  type AccountResponse,
  type AccountUser,
  type SavedResult,
} from './account-api';
import { recommendRoles } from './recommendation';
import type { CandidateResult } from './scoring';
import type { AltchaWidgetElement } from 'altcha';
import type {} from 'altcha/types/react';
import { AccountLinkPanel } from './account-link-panel';

export function DataNotice() {
  const { t, href } = useI18n();

  return (
    <div className="account-data-notice">
      <p>
        <strong>{t("保存什么")}</strong>
        <br />
        {t("账号只保留你最近保存的一份测试结果，包括测试阶段、时间、角色匹配和计算版本。逐题答案只在浏览器中参与计算。 最近一次完成的结果默认只在此浏览器保留3天，回看不延长有效期；逐题答案不作持久保存。本地结果不会自动上传到账号。 ")}</p>
      <p>
        <strong>{t("谁能看到")}</strong>
        <br />
        {t("账号中的结果仅登录后可见。本地结果可在同一浏览器直接回看，共用设备时可以在离开前清除。分享人物卡只分享人物介绍，不会公开你的账号或结果记录。 ")}</p>
      <p>
        <strong>{t("如何管理")}</strong>
        <br />
        {t("你可以在“隐私政策与设置”页清除本地结果，在账号设置中删除账号结果或注销账号。密码和找回码以不可直接读取的摘要保存；备份按最近7天的窗口定期清理。 ")}</p>
      <p>
        <strong>{t("访问统计")}</strong>
        <br />
        {t("是否允许匿名使用统计，由你在隐私设置中选择。统计不包含用户名、密码、逐题答案和个人结果。若启用百度统计，还会按其规则处理设备、网络和 Cookie 信息。 ")}</p>
      <p>
        <a href={href("/privacy")} target="_blank" rel="noopener">
          {t("隐私政策与设置 ")}</a>
      </p>
    </div>
  );
}

function PasswordField({
  name,
  label,
  autoComplete = 'new-password',
  minimum = false,
}: {
  name: string;
  label: string;
  autoComplete?: string;
  minimum?: boolean;
}) {
  const { t, tn, locale } = useI18n();

  const [visible, setVisible] = useState(false);
  return (
    <label className="account-field">
      <span>{tn(label)}</span>
      <span className="account-password">
        <input
          name={name}
          aria-label={t(label)}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={t(minimum ? '设置密码，至少8位' : '输入密码')}
          required
          minLength={minimum ? 8 : undefined}
          maxLength={128}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={t(`${visible ? '隐藏' : '显示'}${label}`)}
        >
          {(visible ? <EyeOff size={18} /> : <Eye size={18} />)}
        </button>
      </span>
    </label>
  );
}

// Verification runs after the user's submit gesture. It stays behind the
// primary action; the server still verifies an action-bound, single-use proof.
function Captcha({
  action,
  verifier,
  onReady,
  onError,
}: {
  action: 'register' | 'login' | 'recover';
  verifier: RefObject<AltchaWidgetElement | null>;
  onReady: (ready: boolean) => void;
  onError: (message: string) => void;
}) {
  const { locale } = useI18n();

  const [loaded, setLoaded] = useState(false);
  const reportReady = useEffectEvent(onReady);
  const reportError = useEffectEvent(onError);
  useEffect(() => {
    let live = true;
    reportReady(false);
    void (
      window.isSecureContext
        ? import('altcha').then(() => import('altcha/i18n/zh-cn'))
        : Promise.reject(new Error('请通过 HTTPS 地址重新打开。'))
    )
      .then(() => {
        if (live) setLoaded(true);
      })
      .catch(() => {
        if (live) reportError('暂时无法完成验证，请稍后重试。');
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (loaded) reportReady(true);
  }, [loaded]);
  return loaded ? (
    <altcha-widget
      ref={verifier}
      challenge={`/api/captcha?action=${action}`}
      language={locale === 'en' ? 'en' : 'zh-cn'}
      display="invisible"
      configuration={JSON.stringify({
        humanInteractionSignature: false,
        credentials: 'same-origin',
        hideFooter: true,
        hideLogo: true,
        minDuration: 0,
        timeout: 15000,
      })}
    />
  ) : null;
}

type Mode =
  | 'login'
  | 'register'
  | 'recover'
  | 'profile'
  | 'settings'
  | 'save'
  | 'password'
  | 'recovery'
  | 'delete'
  | 'code'
  | 'privacy';
type AuthReply = {
  user: AccountUser;
  saved: SavedResult | null;
  recoveryCode?: string;
};
const roleName = (snapshot: SavedResult) =>
  snapshot.presentation.coverage === 0
    ? '人物导览'
    : characters.find((item) => item.id === snapshot.presentation.recommended)
        ?.name;
const savedDate = (value: string) =>
  new Date(value).toLocaleString(document.documentElement.lang === 'en' ? 'en-US' : 'zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function AccountDialog({
  open,
  onClose,
  user,
  saved,
  pendingResult,
  onAccount,
  onOpenResult,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  user: AccountUser | null;
  saved: SavedResult | null;
  pendingResult: CandidateResult | null;
  onAccount: (user: AccountUser | null, saved: SavedResult | null) => void;
  onOpenResult: (saved: SavedResult) => void;
  onSaved: () => void;
}) {
  const { t, tn, locale } = useI18n();

  const [mode, setMode] = useState<Mode>(
    user ? (pendingResult ? 'save' : 'profile') : 'login',
  );
  const [ready, setReady] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('正在处理…');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [verifierReady, setVerifierReady] = useState(false);
  const [verifierFailed, setVerifierFailed] = useState(false);
  const verifier = useRef<AltchaWidgetElement>(null);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [codeNext, setCodeNext] = useState<Mode>('settings');
  const [privacyBack, setPrivacyBack] = useState<Mode>('login');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [accountName, setAccountName] = useState('');
  const requestRef = useRef(false);
  const accountReceived = useEffectEvent(onAccount);
  const initialAccountReceived = useEffectEvent((data: AccountResponse) => {
    accountReceived(data.user, data.saved);
    setMode(data.user ? (pendingResult ? 'save' : 'profile') : 'login');
    setReady(true);
  });
  const needsCaptcha =
    mode === 'register' ||
    mode === 'recover' ||
    (mode === 'login' && captchaRequired);
  const pendingMatch = pendingResult ? recommendRoles(pendingResult) : null;
  const pendingName =
    pendingMatch?.coverage === 0
      ? '人物导览'
      : characters.find((item) => item.id === pendingMatch?.recommended)?.name;

  useEffect(() => {
    let live = true;
    async function connect(allowStaleRetry = true) {
      try {
        const data = await readAccount();
        if (!live) return;
        initialAccountReceived(data);
      } catch (err) {
        if (!live) return;
        if (
          allowStaleRetry &&
          err instanceof AccountError &&
          err.code === 'SESSION_STALE'
        ) {
          await connect(false);
        } else setError('暂时连接不上，请重试。');
      }
    }
    void connect();
    return () => {
      live = false;
    };
  }, [connectionAttempt]);

  function switchMode(next: Mode) {
    if (busy) return;
    setMode(next);
    setError('');
    setNotice('');
    setCaptchaRequired(false);
    setCaptchaKey((n) => n + 1);
    setVerifierReady(false);
    setVerifierFailed(false);
    setConfirmRemove(false);
  }
  function showError(
    err: unknown,
    currentUser = user,
    resultAction: 'save' | 'remove' = 'save',
  ) {
    setError(err instanceof Error ? err.message : '暂时没成功，请重试。');
    if (err instanceof AccountError) {
      if (err.captchaRequired || err.code === 'CAPTCHA_REQUIRED')
        setCaptchaRequired(true);
      if (err.code === 'RESULT_CONFLICT') {
        onAccount(currentUser, err.saved ?? null);
        if (resultAction === 'remove') {
          setMode('settings');
          setConfirmRemove(false);
          setError('结果已在另一处更新。请查看最新结果，再决定是否删除。');
        } else {
          setMode('save');
          setError('你在另一处更新过结果，确认后可以保存这次结果。');
        }
      }
      if (err.code === 'SIGN_IN_REQUIRED') {
        onAccount(null, null);
        setMode('login');
      }
      if (err.code === 'CSRF_EXPIRED')
        void readAccount()
          .then((data) => onAccount(data.user, data.saved))
          .catch(() => undefined);
    }
    setCaptchaKey((n) => n + 1);
    setVerifierReady(false);
  }
  async function save(
    result: CandidateResult,
    currentSaved: SavedResult | null,
    currentUser: AccountUser,
  ) {
    setBusyLabel('正在保存…');
    const response = await accountRequest<{ saved: SavedResult }>(
      '/api/results/latest',
      { result, expectedRevision: currentSaved?.revision ?? null },
      'PUT',
    );
    onAccount(currentUser, response.saved);
    onSaved();
    onClose();
  }
  function showCode(code: string, next: Mode, name = user?.username ?? '') {
    setRecoveryCode(code);
    setRecoveryUsername(name);
    setCodeNext(next);
    setMode('code');
  }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current || !ready) return;
    // Browser validation bubbles follow the browser UI language, which can
    // differ from the language chosen on this page. Render our own message.
    const invalid = Array.from(event.currentTarget.elements).find(
      (field): field is HTMLInputElement => field instanceof HTMLInputElement && !field.validity.valid,
    );
    if (invalid) {
      setError(invalid.name === 'username'
        ? '账号使用4—24位字母、数字或下划线'
        : invalid.name === 'recoveryCode' ? '请填写找回码。'
        : invalid.validity.tooShort ? '密码至少需要8位。' : '请填写密码。');
      invalid.focus();
      return;
    }
    const values = Object.fromEntries(new FormData(event.currentTarget));
    requestRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      let captcha: string | undefined;
      if (needsCaptcha) {
        setBusyLabel('正在验证…');
        if (!verifierReady || !verifier.current)
          throw new Error('验证还在准备，请稍后重试。');
        verifier.current.reset();
        const proof = await verifier.current.verify();
        if (!proof?.payload) throw new Error('验证未完成，请再试一次。');
        captcha = proof.payload;
      }
      setBusyLabel(
        mode === 'register'
          ? '正在注册…'
          : mode === 'login'
            ? '正在登录…'
            : '正在处理…',
      );
      if (mode === 'login' || mode === 'register') {
        const response = await accountRequest<AuthReply>(`/api/auth/${mode}`, {
          username: values.username,
          password: values.password,
          remember: values.remember === 'on',
          ...(captcha ? { captcha } : {}),
          ...(mode === 'register' ? { acceptPrivacy: true } : {}),
        });
        onAccount(response.user, response.saved);
        // Recovery setup is available under Settings and never gates saving.
        setRecoveryCode(response.recoveryCode ?? '');
        setRecoveryUsername(response.user.username);
        if (pendingResult) {
          if (response.saved) setMode('save');
          else {
            try {
              await save(pendingResult, null, response.user);
            } catch (err) {
              setMode('save');
              showError(err, response.user);
            }
          }
        } else {
          setMode('profile');
          setNotice(mode === 'register' ? '注册成功' : '登录成功');
        }
      } else if (mode === 'recover') {
        const response = await accountRequest<{ recoveryCode: string }>(
          '/api/auth/recover',
          {
            username: values.username,
            recoveryCode: values.recoveryCode,
            password: values.password,
            captcha,
          },
        );
        onAccount(null, null);
        setNotice('密码已重设。记下新的找回码，以后需要时可以使用。');
        showCode(
          response.recoveryCode,
          'login',
          typeof values.username === 'string'
            ? values.username.toLowerCase()
            : '',
        );
      } else if (mode === 'password' || mode === 'recovery') {
        const response = await accountRequest<{ recoveryCode: string }>(
          mode === 'password'
            ? '/api/auth/password'
            : '/api/auth/recovery-code',
          {
            currentPassword: values.currentPassword,
            ...(mode === 'password' ? { password: values.password } : {}),
          },
        );
        setNotice(mode === 'password' ? '密码已更新。' : '找回码已更新。');
        showCode(response.recoveryCode, 'settings');
      } else if (mode === 'delete') {
        await accountRequest('/api/account', {
          currentPassword: values.currentPassword,
        });
        onAccount(null, null);
        onClose();
      }
    } catch (err) {
      showError(err);
    } finally {
      requestRef.current = false;
      setBusy(false);
    }
  }
  async function action(kind: 'save' | 'remove' | 'logout') {
    if (requestRef.current) return;
    requestRef.current = true;
    setBusy(true);
    setBusyLabel(kind === 'save' ? '正在保存…' : '正在处理…');
    setError('');
    try {
      if (kind === 'save' && pendingResult && user)
        await save(pendingResult, saved, user);
      if (kind === 'remove') {
        await accountRequest(
          '/api/results/latest',
          { expectedRevision: saved?.revision ?? null },
          'DELETE',
        );
        onAccount(user, null);
        setConfirmRemove(false);
        setNotice('已删除保存的结果。');
      }
      if (kind === 'logout') {
        await accountRequest('/api/auth/logout', {});
        onAccount(null, null);
        onClose();
      }
    } catch (err) {
      showError(err, user, kind === 'remove' ? 'remove' : 'save');
    } finally {
      requestRef.current = false;
      setBusy(false);
    }
  }
  function showPrivacy() {
    setPrivacyBack(mode);
    switchMode('privacy');
  }
  const titles: Record<Mode, string> = {
    login: pendingResult ? '登录后保存结果' : '登录16暗影',
    register: pendingResult ? '注册后保存结果' : '注册16暗影',
    recover: '找回密码',
    profile: '我的结果',
    settings: '账号设置',
    save: saved ? '更新保存的结果' : '保存这次结果',
    password: '修改密码',
    recovery: '设置找回码',
    delete: '注销账号',
    code: '你的账号找回码',
    privacy: '隐私说明',
  };
  const descriptions: Record<Mode, string> = {
    login: '不登录，也能看完整结果。账号只用于保存和回看结果。',
    register: '你不必注册。答题、看完整解读，都可以直接开始。想把结果留到下次，再建个账号。',
    recover: '用之前保存的找回码，设置新密码。',
    profile: '这里保留你最近保存的一份结果。',
    settings: user?.username ?? '',
    save: saved
      ? '每个账号保留最近保存的一份结果。'
      : '下次登录，就能在「我的结果」里找到。',
    password: '设置新密码后，其他设备需要重新登录。',
    recovery: '忘记密码时，可以用它找回账号。',
    delete: locale === 'en'
      ? 'Deleting this account removes its saved result and cannot be undone. If linked, the accounts will be unlinked; the other account and its summary remain.'
      : '注销后账号和已保存结果将被删除，无法找回。如已关联，将解除关联；另一端账号和摘要保留。',
    code: '复制或保存这串代码，忘记密码时用它找回。',
    privacy: '关于账号、结果保存和访问统计。',
  };
  const recoveryFile = () => {
    const blob = new Blob(
      [
        t(`16暗影账号找回码\n账号：${recoveryUsername}\n找回码：${recoveryCode}\n请勿分享给他人。生成新码后旧码失效。\n`),
      ],
      { type: 'text/plain;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = t('16暗影-账号找回码.txt');
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const formModes: Mode[] = [
    'login',
    'register',
    'recover',
    'password',
    'recovery',
    'delete',
  ];
  const authMode = mode === 'login' || mode === 'register';
  const backMode: Mode =
    mode === 'privacy'
      ? privacyBack
      : mode === 'recover'
        ? 'login'
        : mode === 'settings'
          ? 'profile'
          : mode === 'code'
            ? codeNext
            : 'settings';
  const showBack = [
    'settings',
    'recover',
    'password',
    'recovery',
    'delete',
    'privacy',
  ].includes(mode);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent
        className="proto-dialog account-dialog"
        showCloseButton={false}
      >
        {(!busy && (
          <DialogClose className="account-dialog-close" aria-label={t("关闭")}>
            <X size={18} />
          </DialogClose>
        ))}
        {(showBack && (
          <button
            type="button"
            className="account-back"
            onClick={() => switchMode(backMode)}
            disabled={busy}
          >
            <ArrowLeft size={16} /> {t(" 返回 ")}</button>
        ))}
        <DialogHeader>
          <DialogTitle>{tn(titles[mode])}</DialogTitle>
          <DialogDescription>{tn(descriptions[mode])}</DialogDescription>
        </DialogHeader>
        {(authMode && (
          <div className="account-tabs" aria-label={t("登录方式")}>
            <button
              type="button"
              aria-pressed={mode === 'login'}
              onClick={() => switchMode('login')}
            >
              {t("登录 ")}</button>
            <button
              type="button"
              aria-pressed={mode === 'register'}
              onClick={() => switchMode('register')}
            >
              {t("注册 ")}</button>
          </div>
        ))}
        {(error && (
          <p className="account-message account-message--error" role="alert">
            {tn(error)}
          </p>
        ))}
        {(!ready && error && (
          <button
            type="button"
            className="proto-outline"
            onClick={() => {
              setError('');
              setConnectionAttempt((attempt) => attempt + 1);
            }}
          >
            {t("重新连接 ")}</button>
        ))}
        {(notice && (
          <output className="account-message account-message--success">
            <Check size={16} />
            {tn(notice)}
          </output>
        ))}
        {(formModes.includes(mode) && (
          <form key={mode} className="account-form" onSubmit={submit} noValidate>
            {(['login', 'register', 'recover'].includes(mode) && (
              <label className="account-field">
                <span>{t("账号")}</span>
                <input
                  name="username"
                  aria-label={t("账号")}
                  placeholder={
                    t(mode === 'register'
                      ? '4—24位字母、数字或下划线'
                      : '输入账号')
                  }
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  pattern="[A-Za-z0-9_]{4,24}"
                  title={t("账号使用4—24位字母、数字或下划线")}
                  minLength={4}
                  maxLength={24}
                  required
                />
              </label>
            ))}
            {(mode === 'recover' && (
              <label className="account-field">
                <span>{t("找回码")}</span>
                <input
                  name="recoveryCode"
                  aria-label={t("找回码")}
                  placeholder={t("粘贴之前保存的找回码")}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={64}
                  required
                />
              </label>
            ))}
            {(['password', 'recovery', 'delete'].includes(mode) && (
              <PasswordField
                name="currentPassword"
                label="当前密码"
                autoComplete="current-password"
              />
            ))}
            {(['login', 'register', 'recover', 'password'].includes(mode) && (
              <PasswordField
                name="password"
                label={
                  mode === 'recover' || mode === 'password' ? '新密码' : '密码'
                }
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                minimum={mode !== 'login'}
              />
            ))}
            {(needsCaptcha && (
              <Captcha
                key={`${mode}-${captchaKey}`}
                action={mode as 'register' | 'login' | 'recover'}
                verifier={verifier}
                onReady={setVerifierReady}
                onError={(message) => {
                  setError(message);
                  setVerifierFailed(true);
                }}
              />
            ))}
            {(needsCaptcha && verifierFailed && (
              <button
                type="button"
                className="account-inline-link"
                onClick={() => {
                  setError('');
                  setVerifierFailed(false);
                  setVerifierReady(false);
                  setCaptchaKey((n) => n + 1);
                }}
              >
                {t("重新连接 ")}</button>
            ))}
            {(authMode && (
              <div className="account-login-options">
                <label className="account-check">
                  <input type="checkbox" name="remember" defaultChecked />
                  {t("记住登录状态 ")}</label>
                {(mode === 'login' && (
                  <button type="button" onClick={() => switchMode('recover')}>
                    {t("忘记密码？ ")}</button>
                ))}
              </div>
            ))}
            {(mode === 'register' && (
              <p className="account-consent">
                {t("点击注册，即表示你已阅读并同意 ")}<button type="button" onClick={showPrivacy}>
                  {t("《隐私说明》 ")}</button>
              </p>
            ))}
            {(mode === 'recovery' && (
              <p className="account-help">
                {t("生成后请自行保管；新码会替换旧码，并退出其他设备的登录。 ")}</p>
            ))}
            <button
              className="proto-primary account-submit"
              disabled={busy || !ready || (needsCaptcha && !verifierReady)}
              type="submit"
            >
              {tn(busy
                ? busyLabel
                : !ready
                  ? '正在连接…'
                  : (
                      {
                        login: pendingResult ? '登录并保存' : '登录',
                        register: pendingResult ? '注册并保存' : '注册',
                        recover: '重设密码',
                        password: '确认修改',
                        recovery: '生成找回码',
                        delete: '确认注销',
                      } as Record<string, string>
                    )[mode])}
            </button>
            {authMode && <button type="button" className="account-inline-link" onClick={onClose} disabled={busy}>
              {t('继续体验，无需登录')}
            </button>}
            {(mode === 'recover' && (
              <p className="account-help">
                {t("找回码也丢失了？可以 ")}<button
                  type="button"
                  className="account-inline-link"
                  onClick={() => switchMode('register')}
                >
                  {t("注册新账号 ")}</button>
                {t("继续体验。 ")}</p>
            ))}
          </form>
        ))}
        {(ready && mode === 'save' && user && pendingResult && (
          <div className="account-save-view">
            <div className="account-pending-card">
              <CharacterAvatar
                id={pendingMatch?.recommended ?? 'T01'}
                size={76}
                alt={t("")}
              />
              <div>
                <small>{t("这次的结果")}</small>
                <h3>{tn(pendingName)}</h3>
                <p>
                  {tn(pendingResult.stage === 'basic' ? '基础16题' : '完整48题')}
                </p>
              </div>
            </div>
            {(saved && (
              <p className="account-replace-note">
                {t("将替换 ")}{tn(savedDate(saved.savedAt))} {t(" 保存的「")}{tn(roleName(saved))}{t('」。')}
              </p>
            ))}
            <button
              className="proto-primary account-submit"
              type="button"
              disabled={busy}
              onClick={() => void action('save')}
            >
              {tn(busy ? busyLabel : '保存这次结果')}
            </button>
            <button
              className="account-secondary-action"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              {tn(saved ? '保留原结果' : '暂不保存')}
            </button>
          </div>
        ))}
        {(ready && mode === 'profile' && user && (
          <div className="account-profile">
            <div className="account-profile-name">
              <UserRound size={18} />
              <span>{tn(user.username)}</span>
            </div>
            {(saved ? (
              <button
                type="button"
                className="account-result-card"
                onClick={() => onOpenResult(saved)}
              >
                <CharacterAvatar
                  id={saved.presentation.recommended}
                  size={80}
                  alt={t("")}
                />
                <span>
                  <small>{t("最近保存")}</small>
                  <strong>{tn(roleName(saved))}</strong>
                  <small>
                    {tn(saved.result.stage === 'basic' ? '基础16题' : '完整48题')} ·{tn(' ')}
                    {tn(savedDate(saved.savedAt))}
                  </small>
                </span>
                <ChevronRight size={20} />
              </button>
            ) : (
              <div className="account-empty-result">
                <UserRound size={32} />
                <strong>{t("还没有保存的结果")}</strong>
                <p>{t("完成测试后，点一下「保存结果」就好。")}</p>
                <button
                  type="button"
                  className="proto-primary account-submit"
                  onClick={onClose}
                >
                  {t("继续探索 ")}<ArrowRight size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="account-settings-link"
              onClick={() => switchMode('settings')}
            >
              <Settings2 size={17} />
              {t("账号设置 ")}<ChevronRight size={17} />
            </button>
          </div>
        ))}
        {(ready && mode === 'settings' && user && (
          <div className="account-settings">
            <AccountLinkPanel />
            <div className="account-settings-group">
              <button type="button" onClick={() => switchMode('password')}>
                {t("修改密码 ")}<ChevronRight size={17} />
              </button>
              <button
                type="button"
                onClick={() =>
                  recoveryCode
                    ? showCode(recoveryCode, 'settings', user.username)
                    : switchMode('recovery')
                }
              >
                <span>
                  {t("账号找回码")}<small>{t("忘记密码时使用，建议保存一份")}</small>
                </span>
                <ChevronRight size={17} />
              </button>
              <button type="button" onClick={showPrivacy}>
                {t("隐私说明 ")}<ChevronRight size={17} />
              </button>
            </div>
            {(saved && (
              <div className="account-settings-group">
                {(confirmRemove ? (
                  <div className="account-remove-confirm">
                    <p>{t("删除已保存的结果？")}</p>
                    <p>{locale === 'en' ? 'If a WeChat mini program is linked, both cloud summaries will be deleted.' : '如已关联微信小程序，将同步删除两端的云端摘要。'}</p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void action('remove')}
                    >
                      {t("确认删除 ")}</button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                    >
                      {t("取消 ")}</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmRemove(true)}>
                    {t("删除已保存的结果 ")}<ChevronRight size={17} />
                  </button>
                ))}
              </div>
            ))}
            <button
              type="button"
              className="account-secondary-action"
              disabled={busy}
              onClick={() => void action('logout')}
            >
              {t("退出登录 ")}</button>
            <button
              type="button"
              className="account-delete-link"
              onClick={() => switchMode('delete')}
            >
              {t("注销账号 ")}</button>
          </div>
        ))}
        {(mode === 'code' && (
          <div className="account-code">
            <code>{tn(recoveryCode)}</code>
            <p className="account-help">
              {t("这串代码只在本次显示，请勿分享给他人。 ")}</p>
            <div>
              <button
                type="button"
                className="proto-outline"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(recoveryCode)
                    .then(() => setNotice('找回码已复制。'))
                    .catch(() => setError('请长按代码复制，或保存文件。'))
                }
              >
                <Copy size={16} />
                {t("复制找回码 ")}</button>
              <button
                type="button"
                className="proto-outline"
                onClick={recoveryFile}
              >
                <Download size={16} />
                {t("保存文件 ")}</button>
            </div>
            <button
              className="proto-primary account-submit"
              type="button"
              onClick={() => {
                setRecoveryCode('');
                switchMode(codeNext);
              }}
            >
              {t("完成 ")}</button>
          </div>
        ))}
        {(mode === 'privacy' && <DataNotice />)}
      </DialogContent>
    </Dialog>
  );
}
