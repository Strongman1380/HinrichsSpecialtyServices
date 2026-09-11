import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../HSP CRM/src/firebase-auth', () => ({ auth: { currentUser: { uid: 'test-admin', getIdToken: async () => 'local-test-token' } } }));
let request;
beforeEach(async () => {
  vi.resetModules(); sessionStorage.clear(); vi.mocked(fetch).mockReset();
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  request = (await import('../../HSP CRM/src/api')).adminRequest;
});
describe('interrupted administrative saves', () => {
  it('replays the original receipt and treats confirmed recovery as success', async () => {
    fetch.mockRejectedValueOnce(new Error('Connection interrupted'));
    await expect(request('/api/finance', { action: 'invoice.save', data: { clientName: 'Original' } })).rejects.toThrow();
    const original = JSON.parse(fetch.mock.calls[0][1].body);
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'confirmed-invoice', version: 1 }) });
    const saved = await request('/api/finance', { action: 'invoice.save', data: { clientName: 'Changed' } });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(original);
    expect(saved.id).toBe('confirmed-invoice');
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('newer edits were not applied'));
    expect(sessionStorage.length).toBe(0);
  });
  it('does not substitute another campaign after an interrupted send', async () => {
    fetch.mockRejectedValueOnce(new Error('Connection interrupted'));
    await expect(request('/api/send-campaign', { campaignId: 'campaign-a', expectedVersion: 1 })).rejects.toThrow();
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'campaign-b', status: 'accepted' }) });
    await request('/api/send-campaign', { campaignId: 'campaign-b', expectedVersion: 1 });
    expect(JSON.parse(fetch.mock.calls[1][1].body).campaignId).toBe('campaign-b');
  });
});
