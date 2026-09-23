'use client';
import { useEffect, useState } from 'react';
import { Copy, Link2, Unlink } from 'lucide-react';
import { useI18n } from '@/app/i18n/provider';
import { accountRequest } from './account-api';
import './account-link-panel.css';
type LinkState = { websiteUsername: string; linkedAt: string } | null;
export function AccountLinkPanel() {
  const { locale } = useI18n();
  const en = locale === 'en';
  const [link, setLink] = useState<LinkState>(null);
  const [code, setCode] = useState(''), [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false), [message, setMessage] = useState('');
  const say = (zh: string, english: string) => en ? english : zh;
  useEffect(() => {
    let current = true;
    void accountRequest<{ link: LinkState }>('/api/account/link').then(x => { if(current) { setLink(x.link); setLoaded(true); } }).catch(() => { if(current) setMessage(en ? 'Could not read link status. Reopen account settings to retry.' : '暂时无法读取关联状态，请重新打开账号设置。'); });
    return () => { current = false; };
  }, [en]);
  async function create() {
    setBusy(true); setMessage('');
    try { const r = await accountRequest<{ code: string; expiresAt: string }>('/api/account/link/code', {}); setCode(r.code); setExpires(r.expiresAt); }
    catch { setMessage(say('暂时无法生成关联码，请重试。若已在小程序关联，请重新打开账号设置。', 'Could not generate a code. Retry, or reopen settings if you have already linked in the mini program.')); }
    finally { setBusy(false); }
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(code); setMessage(say('关联码已复制。', 'Link code copied.')); }
    catch { setMessage(say('请手动复制关联码。', 'Please copy the code manually.')); }
  }
  async function unlink() {
    setBusy(true); setMessage('');
    try { await accountRequest('/api/account/link', {}, 'DELETE'); setLink(null); setCode(''); setMessage(say('已解除关联。两端已有摘要和邀请保留。', 'Unlinked. Existing summaries and invitations remain on both sides.')); }
    catch { setMessage(say('暂时无法解除关联，请重试。', 'Could not unlink. Please retry.')); }
    finally { setBusy(false); }
  }
  return <section className="account-link-panel">
    <h3><Link2 size={17}/>{say('关联微信小程序', 'Link the WeChat mini program')}</h3>
    {link ? <>
      <p>{say('此网站账号已关联微信小程序。两端共享最近一份本人结果。', 'This website account is linked to the mini program. Both share your latest personal result.')}</p>
      <p>{say('解除关联后，两端已有结果、邀请和朋友反馈会保留。', 'Unlinking keeps existing results, invitations and friend feedback on both sides.')}</p>
      <button type="button" disabled={busy} onClick={() => void unlink()}><Unlink size={16}/>{say('解除关联', 'Unlink')}</button>
    </> : <>
      <p>{say('生成一次性关联码后，在小程序「隐私与数据管理 → 关联网站账号」中输入。先预览两份结果，再选择保留哪份。邀请和朋友反馈保持独立。', 'Generate a one-time code, then enter it in the mini program under Privacy and data → Link website account. Preview both results and choose which to keep. Invitations and friend feedback stay separate.')}</p>
      {code && <div className="account-link-code"><code>{code}</code><small>{say('有效至 ', 'Valid until ')}{new Date(expires).toLocaleTimeString(en ? 'en-US' : 'zh-CN')}</small><button type="button" disabled={busy} onClick={() => void copyCode()}><Copy size={16}/>{say('复制关联码', 'Copy code')}</button></div>}
      <button type="button" disabled={busy || !loaded} onClick={() => void create()}><Link2 size={16}/>{code ? say('重新生成关联码', 'Generate a new code') : say('生成关联码', 'Generate code')}</button>
    </>}
    {message && <p className="account-link-message" role="status">{message}</p>}
  </section>;
}
