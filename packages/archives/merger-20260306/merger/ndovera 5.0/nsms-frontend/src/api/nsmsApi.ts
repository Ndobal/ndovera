export const NSMS_API_BASE = import.meta.env.VITE_NSMS_API_BASE || 'http://localhost:5000/api';

export interface LoginResponse {
  token: string;
}
function getAuthHeaders() {
  const token = localStorage.getItem('nsms_token');
  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

export interface School {
  id: string;
  name: string;
  level: string | null;
  owner_id: string | null;
  hos_id: string | null;
  template: string | null;
  language: string | null;
  is_active: number;
}

export interface HosApproval {
  id: string;
  type: string;
  requested_by: string;
  school_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${NSMS_API_BASE}/users/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error('Failed to login');
  }

  return res.json();
}

export async function fetchOwnerSchools(ownerId: string): Promise<School[]> {
  const url = new URL(`${NSMS_API_BASE}/schools`);
  url.searchParams.set('owner_id', ownerId);
  const res = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) throw new Error('Failed to load schools');
  return res.json();
}

export async function fetchHosApprovals(schoolId: string): Promise<HosApproval[]> {
  const url = new URL(`${NSMS_API_BASE}/hos/approvals`);
  url.searchParams.set('school_id', schoolId);
  const res = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) throw new Error('Failed to load approvals');
  return res.json();
}
