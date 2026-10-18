// Pure caption logic, shared by publishing and the preview so what you preview is what is sent.
// Keep this file free of server-only imports: client components use it too.

/** Instagram's documented limits for a feed post caption. */
export const CAPTION_MAX_LENGTH = 2200;
export const CAPTION_MAX_HASHTAGS = 30;
export const CAPTION_MAX_MENTIONS = 20;
/** Roughly where the feed cuts a caption and shows "… more". */
export const CAPTION_FEED_PREVIEW_LENGTH = 125;

/** Caption with credit to the original poster. AI captions will replace this later. */
export function buildCaption(post: { title: string; author: string | null; subreddit: string }) {
  // memes the admin uploaded themselves have no one to credit
  if (post.subreddit === "manual") return post.title;
  const credit = post.author
    ? `Credit: u/${post.author} on Reddit (r/${post.subreddit})`
    : `Source: r/${post.subreddit} on Reddit`;
  return `${post.title}\n\n${credit}`;
}

/** The caption that is actually sent: the edited one, or the default when it is empty. */
export function pickCaption(custom: string, fallback: string) {
  return custom.trim() ? custom : fallback;
}

export type CaptionIssue = { level: "error" | "warn"; text: string };

export type CaptionAnalysis = {
  length: number;
  hashtags: number;
  mentions: number;
  /** Text shown before "… more" in the feed, or null when the caption fits. */
  feedCut: { shown: string } | null;
  issues: CaptionIssue[];
};

const HASHTAG_RE = /(^|[^\p{L}\p{N}_&])#[\p{L}\p{N}_]+/gu;
const MENTION_RE = /(^|[^\p{L}\p{N}_.])@[A-Za-z0-9_.]+/gu;

/** Counts and the problems Instagram would reject or that look surprising in the feed. */
export function analyzeCaption(caption: string): CaptionAnalysis {
  const hashtags = caption.match(HASHTAG_RE)?.length ?? 0;
  const mentions = caption.match(MENTION_RE)?.length ?? 0;
  const issues: CaptionIssue[] = [];
  if (caption.length > CAPTION_MAX_LENGTH) {
    issues.push({ level: "error", text: `Instagram rejects captions over ${CAPTION_MAX_LENGTH.toLocaleString("en-US")} characters. This one is ${caption.length.toLocaleString("en-US")}.` });
  }
  if (hashtags > CAPTION_MAX_HASHTAGS) {
    issues.push({ level: "error", text: `Instagram allows at most ${CAPTION_MAX_HASHTAGS} hashtags. This caption has ${hashtags}.` });
  }
  if (mentions > CAPTION_MAX_MENTIONS) {
    issues.push({ level: "warn", text: `Instagram allows at most ${CAPTION_MAX_MENTIONS} @mentions. This caption has ${mentions}.` });
  }
  // the feed cuts long captions after about 125 characters; show where, on a word boundary
  let feedCut: CaptionAnalysis["feedCut"] = null;
  if (caption.length > CAPTION_FEED_PREVIEW_LENGTH) {
    const head = caption.slice(0, CAPTION_FEED_PREVIEW_LENGTH);
    const endsAtWord = /\s/.test(caption[CAPTION_FEED_PREVIEW_LENGTH]);
    feedCut = { shown: (endsAtWord ? head : head.replace(/\s+\S*$/, "") || head).trimEnd() };
  }
  return { length: caption.length, hashtags, mentions, feedCut, issues };
}
