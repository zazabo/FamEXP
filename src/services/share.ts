export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'needs-tap';

/**
 * Hand a generated file to the phone's share sheet (Save to Files, Mail, WhatsApp, Print…).
 * Falls back to a normal download where file sharing is not supported (desktop browsers).
 * Browsers only allow sharing right after a tap: if the tap "expired" while the file was
 * being generated, returns `needs-tap` so the UI can offer a Share button.
 */
export async function shareOrDownload(file: File, title: string): Promise<ShareOutcome> {
  const canShareFiles = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  if (canShareFiles) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'AbortError') return 'cancelled';
      if (name === 'NotAllowedError') return 'needs-tap';
      throw err;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
