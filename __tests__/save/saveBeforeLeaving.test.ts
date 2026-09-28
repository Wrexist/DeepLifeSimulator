import { saveBeforeLeaving } from '@/utils/saveBeforeLeaving';

describe('saving before leaving the active life', () => {
  it('waits for durable completion before navigating', async () => {
    let finish!: (saved: boolean) => void;
    const save = jest.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
    const leave = jest.fn();
    const pending = saveBeforeLeaving(save, leave);
    expect(save).toHaveBeenCalledWith(true);
    expect(leave).not.toHaveBeenCalled();
    finish(true);
    await expect(pending).resolves.toBe(true);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('keeps the life open when the writer refuses', async () => {
    const leave = jest.fn();
    await expect(saveBeforeLeaving(async () => false, leave)).resolves.toBe(false);
    expect(leave).not.toHaveBeenCalled();
  });

  it('never navigates after a failed write', async () => {
    const leave = jest.fn();
    await expect(saveBeforeLeaving(async () => { throw new Error('disk full'); }, leave)).rejects.toThrow('disk full');
    expect(leave).not.toHaveBeenCalled();
  });

  it('does not navigate if the player dismissed Settings during the save', async () => {
    const leave = jest.fn();
    await expect(saveBeforeLeaving(async () => true, leave, () => false)).resolves.toBe(false);
    expect(leave).not.toHaveBeenCalled();
  });
});
