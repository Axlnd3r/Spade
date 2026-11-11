/** An X (Twitter) post intent with `text` and a link. */
export function shareUrl(text: string, url: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

/** Absolute link to a hash route of this app, e.g. "#/case/3". */
export function appUrl(hashPath: string): string {
  return `${location.origin}${location.pathname}#${hashPath}`;
}
