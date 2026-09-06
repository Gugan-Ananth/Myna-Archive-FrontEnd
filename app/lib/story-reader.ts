/**
 * Display-only transforms for the story reader.
 * Stored HTML from the editor is left unchanged.
 */

import { isStorySoundId } from "./story-sounds";
import type { StoryCharacter } from "./types";

type QuoteDir = "open" | "close" | "either";

type QuoteMark = {
  start: number;
  end: number;
  dir: QuoteDir;
};

type EnhanceCtx = {
  ledeDone: boolean;
  title: string;
  droppedTitle: boolean;
  lastSpeakerKey: string | null;
  lastSide: "left" | "right";
  hasDialogue: boolean;
  characters: Map<string, StoryCharacter>;
};

export type StoryDialogueEnhanceOptions = {
  title?: string;
  characters?: StoryCharacter[];
};

type HtmlToken =
  | { kind: "text"; raw: string }
  | {
      kind: "tag";
      raw: string;
      name: string;
      closing: boolean;
      selfClosing: boolean;
    };

const VOID_TAGS = new Set([
  "br",
  "hr",
  "img",
  "input",
  "meta",
  "link",
  "source",
  "area",
  "col",
  "embed",
  "wbr",
]);

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "li",
  "ul",
  "ol",
  "hr",
  "figure",
  "section",
  "article",
  "table",
  "pre",
  "header",
  "footer",
]);

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const CONTAINER_TAGS = new Set([
  "ul",
  "ol",
  "figure",
  "section",
  "article",
  "table",
]);
const SKIP_DIALOGUE_TAGS = new Set(["pre", "table", "h1", "h2", "h3", "h4", "h5", "h6"]);

const WORDS_PER_MINUTE = 220;
const LEDE_MIN_CHARS = 40;

const INDENT_PROPS = new Set([
  "text-indent",
  "margin-left",
  "padding-left",
  "text-align",
  "padding-inline-start",
  "margin-inline-start",
]);

/** Opening copy length used to estimate reading time. */
export function storyReadMinutes(html: string): number {
  const words = visibleText(html).split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/**
 * Align paragraphs, pull quoted speech onto its own line, and tidy scene
 * breaks without mutating the stored editor HTML.
 */
export function enhanceStoryHtml(
  html: string,
  options?: StoryDialogueEnhanceOptions,
): string {
  if (!html.trim()) return html;
  const characters = new Map<string, StoryCharacter>();
  for (const character of options?.characters ?? []) {
    const key = character.name.trim().toLowerCase();
    if (key && !characters.has(key)) characters.set(key, character);
  }
  const ctx: EnhanceCtx = {
    ledeDone: false,
    title: options?.title?.trim() ?? "",
    droppedTitle: false,
    lastSpeakerKey: null,
    lastSide: "left",
    hasDialogue: false,
    characters,
  };
  return markStorySounds(markStoryInlineImages(transformFragment(html, ctx)));
}

/** Unique speaker names in document order from `Name: "dialogue"` lines. */
export function extractStorySpeakers(html: string): string[] {
  if (!html.trim()) return [];
  const pairs = pairQuotes(html);
  const names: string[] = [];
  const seen = new Set<string>();
  for (const pair of pairs) {
    const inner = html.slice(pair.open.end, pair.close.start);
    if (!shouldWrapDialogue(inner)) continue;
    const speaker = findSpeakerBefore(html, pair.open.start);
    if (!speaker) continue;
    const key = speaker.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(speaker.name);
  }
  return names;
}

/** Stable hue for default initials portraits. */
export function storyCharacterHue(name: string): number {
  let hash = 0;
  const key = name.trim().toLowerCase();
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function transformFragment(html: string, ctx: EnhanceCtx): string {
  const tokens = tokenizeHtml(html);
  const out: string[] = [];
  let i = 0;
  let loose: HtmlToken[] = [];

  const flushLoose = () => {
    if (loose.length === 0) return;
    const raw = loose.map((token) => token.raw).join("");
    const cleaned = stripLineIndents(raw);
    loose = [];
    if (!visibleText(cleaned) && !/<img\b/i.test(cleaned)) return;
    if (isSceneBreak(cleaned)) {
      out.push(sceneBreakMarkup());
      return;
    }
    out.push(wrapProseBlock("<p>", "p", cleaned, "</p>", ctx));
  };

  while (i < tokens.length) {
    const token = tokens[i];
    if (
      token &&
      token.kind === "tag" &&
      !token.closing &&
      BLOCK_TAGS.has(token.name)
    ) {
      flushLoose();
      if (token.selfClosing || token.name === "hr") {
        out.push(
          token.name === "hr" ? sceneBreakMarkup() : token.raw,
        );
        i += 1;
        continue;
      }
      const open = token;
      i += 1;
      const innerTokens: HtmlToken[] = [];
      let depth = 1;
      while (i < tokens.length && depth > 0) {
        const current = tokens[i];
        if (!current) break;
        if (
          current.kind === "tag" &&
          current.name === open.name &&
          !current.selfClosing
        ) {
          if (current.closing) depth -= 1;
          else depth += 1;
        }
        if (depth > 0) innerTokens.push(current);
        i += 1;
      }
      const inner = innerTokens.map((innerToken) => innerToken.raw).join("");
      out.push(
        transformBlock(open.raw, open.name, inner, `</${open.name}>`, ctx),
      );
      continue;
    }
    if (token) loose.push(token);
    i += 1;
  }
  flushLoose();
  return out.join("");
}

function transformBlock(
  openRaw: string,
  name: string,
  inner: string,
  closeRaw: string,
  ctx: EnhanceCtx,
): string {
  if (CONTAINER_TAGS.has(name) || fragmentHasBlock(inner)) {
    return (
      stripIndentStyles(openRaw) + transformFragment(inner, ctx) + closeRaw
    );
  }

  const cleaned = stripLineIndents(inner);
  if (HEADING_TAGS.has(name)) {
    if (
      !ctx.droppedTitle &&
      ctx.title &&
      visibleText(cleaned).toLowerCase() === ctx.title.toLowerCase()
    ) {
      ctx.droppedTitle = true;
      return "";
    }
    return stripIndentStyles(openRaw) + cleaned + closeRaw;
  }

  return wrapProseBlock(openRaw, name, cleaned, closeRaw, ctx);
}

function wrapProseBlock(
  openRaw: string,
  name: string,
  inner: string,
  closeRaw: string,
  ctx: EnhanceCtx,
): string {
  const cleaned = stripIndentStylesInHtml(inner);
  if (!visibleText(cleaned) && !/<img\b/i.test(cleaned)) return "";
  if (isSceneBreak(cleaned)) return sceneBreakMarkup();

  const withDialogue = annotateDialogueSides(
    SKIP_DIALOGUE_TAGS.has(name)
      ? cleaned
      : wrapEmDashDialogue(wrapDialogues(cleaned, ctx), ctx),
    ctx,
  );

  let open = stripIndentStyles(openRaw);
  const canLede = name === "p" || name === "div";
  if (
    canLede &&
    !ctx.ledeDone &&
    !withDialogue.includes("story-dialogue") &&
    startsWithLetter(withDialogue) &&
    visibleText(withDialogue).length >= LEDE_MIN_CHARS
  ) {
    open = addClass(open, "story-lede");
    ctx.ledeDone = true;
  }
  if (isAllDialogue(withDialogue)) {
    open = addClass(open, "story-dialogue-block");
  }
  return open + withDialogue + closeRaw;
}

function wrapEmDashDialogue(html: string, ctx: EnhanceCtx): string {
  if (html.includes("story-dialogue")) return html;
  if (isSceneBreak(html)) return html;
  const trimmed = html.trim();
  const startsWithDash =
    /^(?:—|–)/.test(visibleText(trimmed)) ||
    /^(?:\s|&nbsp;)*(?:&mdash;|&ndash;|—|–)/i.test(trimmed);
  if (!startsWithDash) return html;
  const inner = stripLeadingDash(html);
  if (!visibleText(inner)) return html;
  return dialogueMarkup(inner, null, "dash", ctx);
}

function stripLeadingDash(html: string): string {
  return html.replace(
    /^(?:\s|&nbsp;)*(?:&mdash;|&ndash;|—|–)\s*/i,
    "",
  );
}

/** Same speaker stays on the same side; a new speaker flips, like a chat. */
function annotateDialogueSides(html: string, ctx: EnhanceCtx): string {
  return html.replace(
    /<span class="story-dialogue"([^>]*)>/gi,
    (match, attrs: string) => {
      if (/\bdata-side\s*=/.test(attrs)) return match;
      const speakerMatch = attrs.match(
        /\bdata-speaker\s*=\s*["']([^"']*)["']/i,
      );
      const speakerKey = speakerMatch?.[1]?.trim().toLowerCase() || null;
      const side = nextDialogueSide(ctx, speakerKey);
      return `<span class="story-dialogue" data-side="${side}"${attrs}>`;
    },
  );
}

function nextDialogueSide(
  ctx: EnhanceCtx,
  speakerKey: string | null,
): "left" | "right" {
  if (speakerKey && ctx.lastSpeakerKey === speakerKey) {
    return ctx.lastSide;
  }
  const side = !ctx.hasDialogue
    ? "left"
    : ctx.lastSide === "left"
      ? "right"
      : "left";
  ctx.hasDialogue = true;
  ctx.lastSide = side;
  ctx.lastSpeakerKey = speakerKey;
  return side;
}

function wrapDialogues(html: string, ctx: EnhanceCtx): string {
  const pairs = pairQuotes(html);
  if (pairs.length === 0) return html;

  const keep = new Set<number>();
  for (const pair of pairs) {
    const inner = html.slice(pair.open.end, pair.close.start);
    if (shouldWrapDialogue(inner)) keep.add(pair.open.start);
  }
  if (keep.size === 0) return html;

  let result = html;
  const reverse = [...pairs].sort((a, b) => b.open.start - a.open.start);
  for (const pair of reverse) {
    if (!keep.has(pair.open.start)) continue;
    const inner = result.slice(pair.open.end, pair.close.start);
    const speaker = findSpeakerBefore(result, pair.open.start);
    const replaceStart = speaker ? speaker.start : pair.open.start;
    result =
      result.slice(0, replaceStart) +
      dialogueMarkup(inner, speaker?.name ?? null, "quote", ctx) +
      result.slice(pair.close.end);
  }
  return result;
}

function pairQuotes(
  html: string,
): { open: QuoteMark; close: QuoteMark }[] {
  const quotes = findQuotes(html);
  const pairs: { open: QuoteMark; close: QuoteMark }[] = [];
  const stack: QuoteMark[] = [];
  for (const quote of quotes) {
    if (quote.dir === "open" || (quote.dir === "either" && stack.length === 0)) {
      stack.push(quote);
    } else if (stack.length > 0) {
      const open = stack.pop();
      if (open) pairs.push({ open, close: quote });
    }
  }
  return pairs;
}

function dialogueMarkup(
  inner: string,
  speaker: string | null,
  kind: "quote" | "dash",
  ctx: EnhanceCtx,
): string {
  const speakerAttr = speaker
    ? ` data-speaker="${escapeAttr(speaker)}"`
    : "";
  const kindAttr = kind === "dash" ? ` data-kind="dash"` : "";
  const name = speaker
    ? `<span class="story-dialogue-name">${escapeText(speaker)}</span>`
    : "";
  return (
    `<span class="story-dialogue"${speakerAttr}>` +
    avatarMarkup(speaker, ctx) +
    `<span class="story-dialogue-col">` +
    name +
    `<span class="story-dialogue-bubble"${kindAttr}>${inner}</span>` +
    `</span></span>`
  );
}

function avatarMarkup(speaker: string | null, ctx: EnhanceCtx): string {
  const key = speaker?.trim().toLowerCase() ?? "";
  const match = key ? ctx.characters.get(key) : undefined;
  const url = match?.thumbnailUrl || match?.mediaUrl || "";
  if (url) {
    return `<img class="story-dialogue-avatar" src="${escapeAttr(url)}" alt="">`;
  }
  const initial = speaker ? speakerInitial(speaker) : "?";
  const hue = speaker ? storyCharacterHue(speaker) : 250;
  return (
    `<span class="story-dialogue-avatar story-dialogue-avatar-fallback" style="--story-avatar-hue:${hue}" aria-hidden="true">` +
    escapeText(initial) +
    "</span>"
  );
}

function speakerInitial(name: string): string {
  const ch = Array.from(name.trim())[0];
  return ch ? ch.toUpperCase() : "?";
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
  return escapeAttr(value).replace(/'/g, "&#39;");
}

const NAME_CHAR = /[\p{L}\p{M}\p{N}'\-]/u;

function isSpeakerName(name: string): boolean {
  if (name.length < 1 || name.length > 40) return false;
  return /\p{L}/u.test(name);
}

function findSpeakerBefore(
  html: string,
  quoteStart: number,
): { name: string; start: number } | null {
  let i = skipWsBack(html, quoteStart);
  if (i <= 0 || html[i - 1] !== ":") return null;
  i = skipWsBack(html, i - 1);

  const nameChars: string[] = [];
  while (i > 0) {
    if (html[i - 1] === ">") {
      const tagStart = findTagStartBack(html, i);
      if (tagStart < 0) break;
      i = tagStart;
      continue;
    }
    const ch = html[i - 1];
    if (!ch || !NAME_CHAR.test(ch)) break;
    nameChars.push(ch);
    i -= 1;
  }

  const name = nameChars.reverse().join("").replace(/\s+/g, " ").trim();
  if (!isSpeakerName(name)) return null;
  return { name, start: expandOverOpenTags(html, i) };
}

function expandOverOpenTags(html: string, start: number): number {
  let i = start;
  while (i > 0) {
    const next = skipWsBack(html, i);
    if (next <= 0 || html[next - 1] !== ">") return i;
    const tagStart = findTagStartBack(html, next);
    if (tagStart < 0) return i;
    const tag = html.slice(tagStart, next);
    if (tag.startsWith("</") || tag.startsWith("<!")) return i;
    const name = /^<\/?([a-zA-Z][a-zA-Z0-9:-]*)/.exec(tag)?.[1]?.toLowerCase();
    if (name && VOID_TAGS.has(name)) return i;
    i = tagStart;
  }
  return i;
}

function skipWsBack(html: string, from: number): number {
  let i = from;
  while (i > 0) {
    const ch = html[i - 1];
    if (ch && /\s/.test(ch)) {
      i -= 1;
      continue;
    }
    const slice = html.slice(Math.max(0, i - 10), i).toLowerCase();
    const entity = slice.match(
      /&(nbsp|ensp|emsp|thinsp|#160|#x0*a0);$/i,
    );
    if (entity?.[0]) {
      i -= entity[0].length;
      continue;
    }
    break;
  }
  return i;
}

function findTagStartBack(html: string, end: number): number {
  // `end` is the index after `>`. Walk back to the matching `<`.
  let i = end - 1;
  while (i > 0) {
    if (html[i - 1] === "<") return i - 1;
    i -= 1;
  }
  return -1;
}

function findQuotes(html: string): QuoteMark[] {
  const quotes: QuoteMark[] = [];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html[i] === "<") {
      i = skipTag(html, i);
      continue;
    }
    const hit = matchQuoteAt(html, i);
    if (hit) {
      quotes.push({ start: i, end: i + hit.len, dir: hit.dir });
      i += hit.len;
      continue;
    }
    i += 1;
  }
  return quotes;
}

function matchQuoteAt(
  html: string,
  index: number,
): { len: number; dir: QuoteDir } | null {
  const slice = html.slice(index);
  const named: Array<[RegExp, QuoteDir]> = [
    [/^&quot;/i, "either"],
    [/^&#0*34;/i, "either"],
    [/^&#x0*22;/i, "either"],
    [/^&ldquo;/i, "open"],
    [/^&rdquo;/i, "close"],
    [/^&laquo;/i, "open"],
    [/^&raquo;/i, "close"],
    [/^&bdquo;/i, "open"],
    [/^&#0*8220;/i, "open"],
    [/^&#0*8221;/i, "close"],
    [/^&#x0*201c;/i, "open"],
    [/^&#x0*201d;/i, "close"],
  ];
  for (const [pattern, dir] of named) {
    const match = slice.match(pattern);
    if (match?.[0]) return { len: match[0].length, dir };
  }
  const char = html[index];
  if (char === '"') return { len: 1, dir: "either" };
  if (char === "\u201C" || char === "\u00AB" || char === "\u201E") {
    return { len: 1, dir: "open" };
  }
  if (char === "\u201D" || char === "\u00BB") {
    return { len: 1, dir: "close" };
  }
  return null;
}

function skipTag(html: string, start: number): number {
  let i = start + 1;
  while (i < html.length) {
    const char = html[i];
    if (char === '"' || char === "'") {
      const quote = char;
      i += 1;
      while (i < html.length && html[i] !== quote) i += 1;
      i += 1;
      continue;
    }
    if (char === ">") return i + 1;
    i += 1;
  }
  return html.length;
}

function shouldWrapDialogue(inner: string): boolean {
  if (!visibleText(inner)) return false;
  return !/<(?:p|div|h[1-6]|blockquote|ul|ol|table|hr)\b/i.test(inner);
}

function isAllDialogue(html: string): boolean {
  return /^\s*<span class="story-dialogue"[^>]*>[\s\S]*<\/span>\s*$/.test(
    html,
  );
}

function isSceneBreak(html: string): boolean {
  const text = visibleText(html);
  return /^(?:\*(?:\s*\*){2,}|(?:[·•.](?:\s*[·•.]){2,})|-{3,}|—{1,3}|_{3,}|✦|❋)$/.test(
    text,
  );
}

function sceneBreakMarkup(): string {
  return '<div class="story-break" role="separator"></div>';
}

function startsWithLetter(html: string): boolean {
  const text = visibleText(html);
  return /^\p{L}/u.test(text);
}

function stripLineIndents(html: string): string {
  const parts = html.split(/(<br\s*\/?>)/i);
  const stripped = parts
    .map((part) => (/^<br/i.test(part) ? part : stripLeadingIndent(part)))
    .join("");
  return stripped
    .replace(/^(?:(?:<br\s*\/?>)\s*)+/gi, "")
    .replace(/(?:(?:<br\s*\/?>)\s*)+$/gi, "");
}

function stripLeadingIndent(html: string): string {
  let next = html.replace(
    /^(?:\s|&nbsp;|&#160;|&#x0*a0;|&ensp;|&emsp;|&thinsp;|\u00a0|\u2002|\u2003|\u2007|\u2009)+/gi,
    "",
  );
  next = next.replace(
    /^(<(?:span|font|b|strong|i|em|u|small)(?:\s[^>]*)?>)(?:\s|&nbsp;|&#160;|&#x0*a0;)+/i,
    "$1",
  );
  return next.replace(
    /(?:\s|&nbsp;|&#160;|&#x0*a0;|&ensp;|&emsp;)+$/gi,
    "",
  );
}

function stripIndentStylesInHtml(html: string): string {
  return html.replace(/<[^>]+>/g, (tag) => {
    if (tag.startsWith("</") || tag.startsWith("<!--")) return tag;
    return stripIndentStyles(tag);
  });
}

function stripIndentStyles(openTag: string): string {
  if (!/\bstyle\s*=/i.test(openTag)) return openTag;
  return openTag
    .replace(/\bstyle\s*=\s*"([^"]*)"/i, (_, styles: string) => {
      const kept = styles
        .split(";")
        .map((decl) => decl.trim())
        .filter(Boolean)
        .filter((decl) => {
          const prop = decl.split(":")[0]?.trim().toLowerCase();
          return Boolean(prop) && !INDENT_PROPS.has(prop);
        });
      return kept.length > 0 ? `style="${kept.join("; ")}"` : "";
    })
    .replace(/\s{2,}/g, " ")
    .replace(/\s+>/g, ">");
}

/** Clickable catalog sounds: keep the words, add a button role. */
function markStorySounds(html: string): string {
  return html.replace(/<span\b([^>]*)>/gi, (tag, attrs: string) => {
    if (!/\bstory-sound\b/i.test(tag)) return tag;
    const sound = /\bdata-sound\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
    const id = (sound?.[2] ?? sound?.[3] ?? "").trim().toLowerCase();
    if (!isStorySoundId(id)) return tag;
    let next = addAttr(tag, "tabindex", "0");
    next = addAttr(next, "role", "button");
    return next;
  });
}

/** Chapter photos: clickable, skip dialogue portraits. */
function markStoryInlineImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\bstory-dialogue-avatar\b/i.test(tag)) return tag;
    let next = addClass(tag, "story-inline-photo");
    next = addAttr(next, "tabindex", "0");
    next = addAttr(next, "role", "button");
    next = addAttr(next, "draggable", "false");
    return next;
  });
}

function addAttr(openTag: string, name: string, value: string): string {
  if (new RegExp(`\\b${name}\\s*=`, "i").test(openTag)) return openTag;
  return openTag.replace(/^<([a-zA-Z0-9:-]+)/, `<$1 ${name}="${value}"`);
}

function addClass(openTag: string, className: string): string {
  const classAttr = /\bclass\s*=\s*("([^"]*)"|'([^']*)')/i.exec(openTag);
  if (classAttr) {
    const current = classAttr[2] ?? classAttr[3] ?? "";
    if (current.split(/\s+/).includes(className)) return openTag;
    return (
      openTag.slice(0, classAttr.index) +
      `class="${`${current} ${className}`.trim()}"` +
      openTag.slice(classAttr.index + classAttr[0].length)
    );
  }
  return openTag.replace(/^<([a-zA-Z0-9:-]+)/, `<$1 class="${className}"`);
}

function fragmentHasBlock(inner: string): boolean {
  return tokenizeHtml(inner).some(
    (token) =>
      token.kind === "tag" && !token.closing && BLOCK_TAGS.has(token.name),
  );
}

function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  const pattern = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9:-]*)[^>]*>/g;
  let last = 0;
  let match: RegExpExecArray | null = pattern.exec(html);
  while (match) {
    if (match.index > last) {
      tokens.push({ kind: "text", raw: html.slice(last, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith("<!--")) {
      tokens.push({
        kind: "tag",
        raw,
        name: "comment",
        closing: true,
        selfClosing: true,
      });
    } else {
      const name = (match[1] ?? "").toLowerCase();
      const closing = raw.startsWith("</");
      const selfClosing =
        !closing && (raw.endsWith("/>") || VOID_TAGS.has(name));
      tokens.push({ kind: "tag", raw, name, closing, selfClosing });
    }
    last = match.index + raw.length;
    match = pattern.exec(html);
  }
  if (last < html.length) {
    tokens.push({ kind: "text", raw: html.slice(last) });
  }
  return tokens;
}

function visibleText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&#x0*a0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}
