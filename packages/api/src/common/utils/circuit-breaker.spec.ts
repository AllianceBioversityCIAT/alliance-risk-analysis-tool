import {
  CircuitBreaker,
  CircuitOpenError,
  CircuitState,
} from './circuit-breaker';

describe('CircuitBreaker', () => {
  it('should start in CLOSED state', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it('should execute function successfully in CLOSED state', async () => {
    const cb = new CircuitBreaker();
    const result = await cb.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('should propagate errors without opening circuit below threshold', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });

    await expect(
      cb.execute(() => Promise.reject(new Error('fail'))),
    ).rejects.toThrow('fail');

    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it('should open circuit after reaching failure threshold', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 });

    for (let i = 0; i < 2; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    }

    expect(cb.getState()).toBe(CircuitState.OPEN);
  });

  it('should throw CircuitOpenError when circuit is open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    expect(cb.getState()).toBe(CircuitState.OPEN);

    await expect(
      cb.execute(() => Promise.resolve('ok')),
    ).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('should transition to HALF_OPEN after resetTimeout', async () => {
    jest.useFakeTimers();
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
    });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    expect(cb.getState()).toBe(CircuitState.OPEN);

    jest.advanceTimersByTime(1000);

    // Next call should transition to HALF_OPEN and execute
    const result = await cb.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(cb.getState()).toBe(CircuitState.HALF_OPEN);

    jest.useRealTimers();
  });

  it('should close circuit after successThreshold in HALF_OPEN', async () => {
    jest.useFakeTimers();
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
      successThreshold: 2,
    });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    jest.advanceTimersByTime(1000);

    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getState()).toBe(CircuitState.HALF_OPEN);

    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getState()).toBe(CircuitState.CLOSED);

    jest.useRealTimers();
  });

  it('should reopen circuit on failure in HALF_OPEN', async () => {
    jest.useFakeTimers();
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
    });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    jest.advanceTimersByTime(1000);

    // Transition to HALF_OPEN with a successful probe is needed first
    // Actually, the transition happens on the next execute call
    await cb
      .execute(() => Promise.reject(new Error('fail again')))
      .catch(() => {});

    expect(cb.getState()).toBe(CircuitState.OPEN);

    jest.useRealTimers();
  });

  it('should call onStateChange callback on transitions', async () => {
    const onStateChange = jest.fn();
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      onStateChange,
    });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

    expect(onStateChange).toHaveBeenCalledWith(
      CircuitState.CLOSED,
      CircuitState.OPEN,
    );
  });

  it('should reset to CLOSED state', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    expect(cb.getState()).toBe(CircuitState.OPEN);

    cb.reset();
    expect(cb.getState()).toBe(CircuitState.CLOSED);

    // Should work again after reset
    const result = await cb.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });
});
