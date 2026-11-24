const DEFAULT_GITHUB_OWNER = "DontAskMeWhy0507";
const DEFAULT_GITHUB_REPO = "quenti-media";

/**
 * Resolves an automatic backup mirror URL when a primary media CDN fails to load.
 * - S3 (Tigris / Cloudflare R2) `/anki/imports/...` or `/ielts/...` -> GitHub jsDelivr CDN
 * - GitHub jsDelivr CDN -> raw.githubusercontent.com mirror
 */
export function getAnkiFallbackMediaUrl(src: string): string | null {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) {
    return null;
  }

  // 1. If jsDelivr failed -> fall back to raw.githubusercontent.com
  const jsdMatch = src.match(
    /^https?:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^/@]+)@([^/]+)\/(.+)$/i,
  );
  if (jsdMatch) {
    const [, owner, repo, branch, relPath] = jsdMatch;
    if (owner && repo && branch && relPath) {
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${relPath}`;
    }
  }

  // 2. If primary external storage (Tigris / R2 / custom S3) failed -> try GitHub backup repo jsDelivr mirror
  if (
    /^https?:\/\//i.test(src) &&
    !src.includes("cdn.jsdelivr.net") &&
    !src.includes("raw.githubusercontent.com")
  ) {
    const relMatch = src.match(/\/((?:anki\/imports|ielts)\/.+)$/);
    if (relMatch?.[1]) {
      return `https://cdn.jsdelivr.net/gh/${DEFAULT_GITHUB_OWNER}/${DEFAULT_GITHUB_REPO}@main/${relMatch[1]}`;
    }
  }

  return null;
}
