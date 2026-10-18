import { describe, expect, it } from 'vitest';
import { PartnerRequestScope } from '@/components/partner/partner-provider';

describe('partner request lifecycle', () => {
  it('lets a manual reload follow a newer focus refresh instead of reporting a false failure', async () => {
    const scope = new PartnerRequestScope();
    let finishFirst!: (value: string) => void;
    let finishSecond!: (value: string) => void;
    const firstResponse = new Promise<string>((resolve) => { finishFirst = resolve; });
    const secondResponse = new Promise<string>((resolve) => { finishSecond = resolve; });
    const first = scope.runRead(() => firstResponse, null);
    const second = scope.runRead(() => secondResponse, null);
    finishFirst('outdated');
    finishSecond('latest');
    expect(await first).toBe('latest');
    expect(await second).toBe('latest');
  });
  it('does not forward a new session response to a read invalidated by access loss', async () => {
    const scope = new PartnerRequestScope();
    let finish!: (value: string) => void;
    const response = new Promise<string>((resolve) => { finish = resolve; });
    const old = scope.runRead(() => response, null);
    scope.invalidate();
    const current = scope.runRead(async () => 'new session', null);
    finish('private old value');
    expect(await old).toBeNull();
    expect(await current).toBe('new session');
  });
  it('only accepts the latest read even if an aborted response resolves late', () => {
    const scope = new PartnerRequestScope();
    const first = scope.startRead()!;
    const second = scope.startRead()!;
    expect(first.controller.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });
  it('prevents duplicate writes while allowing a permissions refresh', () => {
    const scope = new PartnerRequestScope();
    const write = scope.startWrite()!;
    expect(scope.startWrite()).toBeNull();
    scope.startRead();
    scope.startRead();
    expect(write.isCurrent()).toBe(true);
    scope.finishWrite(write);
    expect(scope.startWrite()).not.toBeNull();
  });
  it('invalidates both pending reads and writes immediately on access loss', () => {
    const scope = new PartnerRequestScope();
    const read = scope.startRead()!;
    const write = scope.startWrite()!;
    scope.invalidate();
    expect(read.isCurrent()).toBe(false);
    expect(write.isCurrent()).toBe(false);
    expect(write.controller.signal.aborted).toBe(true);
    const nextWrite = scope.startWrite()!;
    scope.finishWrite(write);
    expect(nextWrite.isCurrent()).toBe(true);
    expect(scope.startWrite()).toBeNull();
  });
  it('ignores all old responses after unmount and strict-effect reactivation', () => {
    const scope = new PartnerRequestScope();
    const read = scope.startRead()!;
    const write = scope.startWrite()!;
    scope.dispose();
    expect(scope.startRead()).toBeNull();
    expect(scope.startWrite()).toBeNull();
    scope.activate();
    expect(read.isCurrent()).toBe(false);
    expect(write.isCurrent()).toBe(false);
    expect(scope.startRead()!.isCurrent()).toBe(true);
  });
});
