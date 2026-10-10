import { submitAssignment } from './classroomService';
import { enqueue } from '../../shared/offline/outbox';

jest.mock('../../shared/offline/outbox', () => ({
  enqueue: jest.fn(() => Promise.resolve({})),
  registerSender: jest.fn(),
  isRetryable: error => !error?.status || error.status >= 500,
}));

const reply = (status, body) => Promise.resolve({ status, ok: status < 300, text: () => Promise.resolve(JSON.stringify(body)) });

beforeEach(() => {
  enqueue.mockClear();
  global.fetch = jest.fn();
});

test('when Ndovera is down the submission is kept on the device, with when it was pressed', async () => {
  global.fetch.mockReturnValueOnce(reply(503, { success: false }));
  const result = await submitAssignment('a1', { answers: { q1: 'B' } });
  expect(result.success).toBe(true);
  expect(result.queued).toBe(true);
  expect(enqueue).toHaveBeenCalledTimes(1);
  const [kind, item] = enqueue.mock.calls[0];
  expect(kind).toBe('assignment-submit');
  expect(item.assignmentId).toBe('a1');
  expect(item.body.answers).toEqual({ q1: 'B' });
  expect(item.body.clientSubmissionId).toMatch(/^sub_/);
  expect(Date.parse(item.body.capturedAt)).toBeLessThanOrEqual(Date.now());
});

test('no network at all: queued too', async () => {
  global.fetch.mockReturnValueOnce(Promise.reject(new TypeError('Failed to fetch')));
  expect((await submitAssignment('a1', { answers: {} })).queued).toBe(true);
});

test('a refusal (closed, attempts used) is shown, never queued', async () => {
  global.fetch.mockReturnValueOnce(reply(409, { success: false, message: 'You have used all 1 attempt.' }));
  const result = await submitAssignment('a1', { answers: {} });
  expect(result.success).toBe(false);
  expect(result.message).toMatch(/attempt/);
  expect(enqueue).not.toHaveBeenCalled();
});
