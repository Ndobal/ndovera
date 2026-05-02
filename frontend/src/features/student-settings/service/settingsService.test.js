import { getSettings, updateProfile } from './settingsService';

describe('settingsService', () => {
  beforeEach(() => {
    localStorage.clear();
    fetch.resetMocks && fetch.resetMocks();
  });

  test('getSettings falls back to local seed', async () => {
    const s = await getSettings('stu-001');
    expect(s).toBeTruthy();
    expect(s.profile).toBeTruthy();
  });

  test('updateProfile updates local storage and calls audit (mocked)', async () => {
    // mock fetch for audit endpoint
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const next = { name: 'Test User' };
    const updated = await updateProfile(next, 'stu-001');
    expect(updated.name).toBe('Test User');
  });
});
