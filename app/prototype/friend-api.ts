import { accountRequest } from './account-api';
import type { CandidateResult } from './scoring';
import type { Recommendation } from './recommendation';
export type FriendResponse = {
  id: string;
  nickname: string | null;
  result: CandidateResult;
  presentation: Recommendation;
  createdAt: string;
};
export type FriendInvite = {
  token: string;
  subjectName: string;
  createdAt: string;
  responses: FriendResponse[];
};
export const listFriendInvites = () =>
  accountRequest<{ invites: FriendInvite[] }>('/api/friend-invites');
export const createFriendInvite = (subjectName: string) =>
  accountRequest<{
    invite: Pick<FriendInvite, 'token' | 'subjectName' | 'createdAt'>;
  }>('/api/friend-invites', { subjectName });
export const readFriendInvite = (token: string) =>
  fetch(`/api/friend-invites/${encodeURIComponent(token)}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  }).then(async (r) => {
    if (!r.ok) throw new Error('邀请链接暂时不可用。');
    return r.json() as Promise<{
      invite: Pick<FriendInvite, 'token' | 'subjectName' | 'createdAt'>;
    }>;
  });
export const saveFriendResponse = (
  token: string,
  body: { nickname: string; result: CandidateResult; submissionId: string },
) =>
  accountRequest<{ response: FriendResponse }>(
    `/api/friend-invites/${encodeURIComponent(token)}/responses`,
    body,
  );
export const removeFriendInvite = (token: string) =>
  accountRequest<void>(
    `/api/friend-invites/${encodeURIComponent(token)}`,
    {},
    'DELETE',
  );
