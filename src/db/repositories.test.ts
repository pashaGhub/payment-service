import { getDb } from './connection';
import { findEnabledProjectPsp, findProjectByApiKeyHash, getPaymentById, hashApiKey } from './repositories';

afterAll(async () => {
    (await getDb()).close();
});

describe('repositories (against seeded test db)', () => {
    it('resolves a project by hashed api key', async () => {
        const project = await findProjectByApiKeyHash(hashApiKey('pk_test_projectA'));
        expect(project?.id).toBe('proj_a');
    });

    it('returns undefined for an unknown api key', async () => {
        expect(await findProjectByApiKeyHash(hashApiKey('nope'))).toBeUndefined();
    });

    it('scopes enabled PSPs to the project', async () => {
        // Project A has no wallet; Project B does.
        expect(await findEnabledProjectPsp('proj_a', 'mock_wallet')).toBeUndefined();
        expect((await findEnabledProjectPsp('proj_b', 'mock_wallet'))?.pspCode).toBe('mock_wallet');
    });

    it('does not return a payment outside the project scope', async () => {
        expect(await getPaymentById('proj_a', 'pay_missing')).toBeUndefined();
    });
});
