import api from './auth';

export interface LineLoginStatus {
  enabled: boolean;
  ready: boolean;
  liffId: string | null;
  channelId: string | null;
  message?: string;
}

export async function getLineLoginStatus(): Promise<LineLoginStatus> {
  const response = await api.get('/auth-recovery-line-status');
  return response.data;
}

export interface LineAccountLink {
  lineDisplayName: string | null;
  pictureUrl: string | null;
  linkedAt: string;
  updatedAt: string;
  lineUserIdMasked: string | null;
}

export interface LineAccountStatus {
  enabled: boolean;
  ready: boolean;
  liffId: string | null;
  channelId: string | null;
  loginEnabled: boolean;
  linked: boolean;
  link: LineAccountLink | null;
  message?: string;
}

export async function getLineAccountStatus(): Promise<LineAccountStatus> {
  const response = await api.get('/employee-line-account');
  return response.data;
}

export async function linkLineAccount(lineIdToken: string): Promise<LineAccountStatus> {
  const response = await api.post('/employee-line-account', {
    line_id_token: lineIdToken,
  });
  return response.data;
}

export async function unlinkLineAccount(): Promise<LineAccountStatus> {
  const response = await api.delete('/employee-line-account');
  return response.data;
}
