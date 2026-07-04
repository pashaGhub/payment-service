import createError from 'http-errors';
import { MockCardAdapter } from './mockCard';
import { MockWalletAdapter } from './mockWallet';
import type { PspAdapter } from './types';

/** Resolves a `PspAdapter` by code — the single seam between services and PSPs. */
export class PspRegistry {
    private readonly adapters = new Map<string, PspAdapter>();

    constructor(adapters: PspAdapter[]) {
        for (const adapter of adapters) {
            this.adapters.set(adapter.code, adapter);
        }
    }

    resolve(code: string): PspAdapter {
        const adapter = this.adapters.get(code);
        if (!adapter) {
            throw createError(400, `Unknown PSP: ${code}`);
        }
        return adapter;
    }

    has(code: string): boolean {
        return this.adapters.has(code);
    }

    list(): PspAdapter[] {
        return [...this.adapters.values()];
    }
}

// Composition root: the one place concrete adapters are instantiated/named.
export const pspRegistry = new PspRegistry([new MockCardAdapter(), new MockWalletAdapter()]);
