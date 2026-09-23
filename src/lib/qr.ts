/** Pull a Syriasan code from a bare code or a Syriasan address URL. */
export function extractSyriasanCode(raw: string): string | null {
  const text = raw.trim();
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (!/^(?:www\.)?syriasan\.com$/i.test(url.hostname) && url.hostname !== "localhost") return null;
      const parts = url.pathname.split("/").filter(Boolean);
      const addressIndex = parts.findIndex((part) => ["a", "d", "e"].includes(part.toLowerCase()));
      const segment = addressIndex >= 0 ? parts[addressIndex + 1] : null;
      return segment && /^SY-[A-Z]{2,4}-[A-Z0-9]{3,8}(?:-[A-Z0-9]{2,3})?$/i.test(segment)
        ? segment.toUpperCase()
        : null;
    } catch {
      return null;
    }
  }
  const direct = text.match(/SY-[A-Z]{2,4}-[A-Z0-9]{3,8}(?:-[A-Z0-9]{2,3})?/i);
  if (direct) return direct[0].toUpperCase();
  return null;
}