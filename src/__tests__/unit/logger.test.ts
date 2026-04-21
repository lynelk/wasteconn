import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';

describe('logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls console.error for the error level', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('test.event', { key: 'value' });
    expect(spy).toHaveBeenCalledTimes(1);
    const [output] = spy.mock.calls[0]!;
    expect(output).toContain('[error]');
    expect(output).toContain('test.event');
  });

  it('calls console.warn for the warn level', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('test.warn', { reason: 'low disk' });
    expect(spy).toHaveBeenCalledTimes(1);
    const [output] = spy.mock.calls[0]!;
    expect(output).toContain('[warn]');
    expect(output).toContain('test.warn');
  });

  it('calls console.info for the info level', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('test.info', { path: '/api/test' });
    expect(spy).toHaveBeenCalledTimes(1);
    const [output] = spy.mock.calls[0]!;
    expect(output).toContain('[info]');
    expect(output).toContain('test.info');
  });

  it('serializes meta into the output string', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('meta.test', { foo: 'bar' });
    const [output] = spy.mock.calls[0]!;
    expect(output).toContain('foo');
    expect(output).toContain('bar');
  });

  it('handles unserializable meta gracefully', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => logger.info('circular', circular)).not.toThrow();
    const [output] = spy.mock.calls[0]!;
    expect(output).toContain('[unserializable]');
  });
});

