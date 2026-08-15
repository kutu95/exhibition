export const wrapTextWithLink = (
  text: string,
  start: number,
  end: number,
  url: string,
  label?: string,
): { text: string; cursor: number } => {
  const from = Math.max(0, Math.min(start, end, text.length));
  const to = Math.min(text.length, Math.max(from, Math.max(start, end)));
  const selected = text.slice(from, to);
  const linkLabel = (label ?? selected).trim() || "link text";
  const markup = `[${linkLabel}](${url.trim()})`;
  return {
    text: `${text.slice(0, from)}${markup}${text.slice(to)}`,
    cursor: from + markup.length,
  };
};

export const looksLikeLinkTarget = (value: string): boolean => {
  const trimmed = value.trim();
  return (
    /^https?:\/\//i.test(trimmed) ||
    /^mailto:/i.test(trimmed) ||
    trimmed.startsWith("/") ||
    /^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed)
  );
};
