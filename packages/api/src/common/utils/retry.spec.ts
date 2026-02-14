import { withRetry } from './retry';

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    const result = await withRetry(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { baseDelayMs: 0 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after maxAttempts exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 }),
    ).rejects.toThrow('always fails');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry when isRetryable returns false', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('not retryable'));

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 0,
        isRetryable: () => false,
      }),
    ).rejects.toThrow('not retryable');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry callback with error and attempt', async () => {
    const onRetry = jest.fn();
    const error = new Error('fail');
    const fn = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue('ok');

    await withRetry(fn, { baseDelayMs: 0, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(error, 1);
    expect(onRetry).toHaveBeenCalledWith(error, 2);
  });

  it('should throw if maxAttempts < 1', async () => {
    await expect(
      withRetry(jest.fn(), { maxAttempts: 0 }),
    ).rejects.toThrow('maxAttempts must be >= 1');
  });

  it('should cap delay at maxDelayMs', async () => {
    const sleepSpy = jest.spyOn(globalThis, 'setTimeout');
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    await withRetry(fn, {
      baseDelayMs: 10000,
      maxDelayMs: 100,
    });

    // Find the setTimeout call used for the retry delay
    const delayCalls = sleepSpy.mock.calls.filter(
      (call) => typeof call[1] === 'number' && call[1] > 0,
    );
    for (const call of delayCalls) {
      expect(call[1]).toBeLessThanOrEqual(100);
    }

    sleepSpy.mockRestore();
  });
});
