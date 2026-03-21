/** Pending cell output text to append on next send (debugging workflow). */
let pending: string | undefined;

export function setPendingAttachment(text: string | undefined): void {
  pending = text;
}

export function takePendingAttachment(): string | undefined {
  const t = pending;
  pending = undefined;
  return t;
}

export function peekPendingAttachment(): string | undefined {
  return pending;
}
