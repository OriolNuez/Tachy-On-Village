import type { IpcMainInvokeEvent } from 'electron';

export function isTrustedRenderer(event: IpcMainInvokeEvent, windows: ReadonlyMap<number, string>): boolean {
  const expected = windows.get(event.sender.id);
  return !!expected && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === expected;
}
