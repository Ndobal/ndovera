/**
 * Help request validation shared by the future support API route.
 * This module intentionally does not accept client-supplied tenant, user,
 * assignee or status fields. Those must come from verified auth context.
 */
export const HELP_REQUEST_LIMITS = Object.freeze({
  subject: 160,
  description: 4000,
  category: 64,
  page: 240,
});

export type HelpRequestInput = {
  subject: string;
  description: string;
  category?: string;
  page?: string;
};

export type HelpRequestActor = {
  userId: string;
  tenantId: string;
  role: string;
};

export function validateHelpRequestInput(value: unknown): HelpRequestInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid support request.');
  }
  const input = value as Record<string, unknown>;
  const required = (key: 'subject' | 'description') => {
    if (typeof input[key] !== 'string') throw new Error(`A valid ${key} is required.`);
    const result = input[key].trim();
    if (!result || result.length > HELP_REQUEST_LIMITS[key]) throw new Error(`The ${key} must be between 1 and ${HELP_REQUEST_LIMITS[key]} characters.`);
    return result;
  };
  const optional = (key: 'category' | 'page') => {
    if (input[key] == null) return '';
    if (typeof input[key] !== 'string') throw new Error(`Invalid ${key}.`);
    const result = input[key].trim();
    if (result.length > HELP_REQUEST_LIMITS[key]) throw new Error(`The ${key} is too long.`);
    return result;
  };
  const page = optional('page');
  if (page && !/^\/roles\/[a-z-]+(?:\/[a-z0-9/_-]+)*$/i.test(page)) {
    throw new Error('Invalid dashboard page.');
  }
  return {
    subject: required('subject'),
    description: required('description'),
    category: optional('category'),
    page,
  };
}

export function validateHelpActor(actor: HelpRequestActor): HelpRequestActor {
  if (!actor || !actor.userId?.trim() || !actor.tenantId?.trim() || !actor.role?.trim()) {
    throw new Error('Authenticated user and tenant are required.');
  }
  return actor;
}
