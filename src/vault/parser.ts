// vault {username}/{project}.md 의 결정론적 파서/직렬화.
//
// 원칙
// - markdown 이 source of truth. 이 모듈은 read 시점의 파생 표현(VaultDoc)일 뿐.
// - body 텍스트는 verbatim 보존 (사람 손편집을 코드가 덮어쓰지 않는다).
// - 직렬화는 정규화(스캐폴딩 공백만 정리)되고 idempotent — 같은 내용이면 같은 출력.
// - 파서는 절대 throw 하지 않는다. 인식 못 한 라인도 보존한다 (데이터 유실 금지).

export interface EntryBlock {
  headline: string;
  metaLine: string;
  prNumbers: number[];
  date: string; // "YYYY-MM-DD" 또는 ""
  bodyLines: string[];
}

export interface CategoryBlock {
  name: string;
  descLines: string[]; // "## name" 과 첫 "### " 사이의 비표준 라인 (보통 비어 있음)
  entries: EntryBlock[];
}

export interface VaultDoc {
  title: string; // H1
  preamble: string[]; // H1 과 첫 카테고리 사이 라인
  categories: CategoryBlock[];
}

export interface NewEntry {
  category: string;
  headline: string;
  metaLine: string;
  body: string;
}

const PR_RE = /\[PR #(\d+)\]/g;
const DATE_RE = /(\d{4}-\d{2}-\d{2})/;

export function recordedPrNumbers(content: string): Set<number> {
  const set = new Set<number>();
  for (const m of content.matchAll(PR_RE)) {
    const n = Number.parseInt(m[1] ?? "", 10);
    if (Number.isFinite(n)) set.add(n);
  }
  return set;
}

export function isRecorded(content: string, prNumber: number): boolean {
  return recordedPrNumbers(content).has(prNumber);
}

export function emptyDoc(title: string): VaultDoc {
  return { title, preamble: [], categories: [] };
}

function isMetaLine(line: string): boolean {
  return /\[PR #\d+\]/.test(line) || line.includes("·");
}

function trimBlankEdges(lines: string[]): string[] {
  const out = [...lines];
  while (out.length > 0 && (out[0] ?? "").trim() === "") out.shift();
  while (out.length > 0 && (out[out.length - 1] ?? "").trim() === "") out.pop();
  return out;
}

function dateFromText(text: string): string {
  return DATE_RE.exec(text)?.[1] ?? "";
}

function prNumbersFromText(text: string): number[] {
  return [...recordedPrNumbers(text)];
}

function finalizeEntry(headline: string, rawBody: string[]): EntryBlock {
  let body = trimBlankEdges(rawBody);
  let metaLine = "";
  if (body.length > 0 && isMetaLine(body[0] ?? "")) {
    metaLine = (body[0] ?? "").trim();
    body = trimBlankEdges(body.slice(1));
  }
  const scanText = `${metaLine}\n${body.join("\n")}`;
  return {
    headline,
    metaLine,
    prNumbers: prNumbersFromText(scanText),
    date: dateFromText(metaLine) || dateFromText(scanText),
    bodyLines: body,
  };
}

export function parseVault(content: string): VaultDoc {
  const lines = content.split("\n");
  let i = 0;

  // 1) H1 + preamble (첫 "## " 이전)
  const headLines: string[] = [];
  while (i < lines.length && !/^##\s/.test(lines[i] ?? "")) {
    headLines.push(lines[i] ?? "");
    i++;
  }
  let title = "";
  const preambleRaw: string[] = [];
  for (const l of headLines) {
    const m = /^#\s+(.+?)\s*$/.exec(l);
    if (m && title === "") {
      title = m[1] ?? "";
      continue;
    }
    preambleRaw.push(l);
  }

  // 2) 카테고리 / entry
  const categories: CategoryBlock[] = [];
  let cat: CategoryBlock | null = null;
  let entryHeadline: string | null = null;
  let entryBody: string[] = [];
  const catDesc: string[] = [];

  const flushEntry = () => {
    if (entryHeadline !== null && cat) {
      cat.entries.push(finalizeEntry(entryHeadline, entryBody));
    }
    entryHeadline = null;
    entryBody = [];
  };
  const flushCat = () => {
    flushEntry();
    if (cat) {
      cat.descLines = trimBlankEdges(catDesc);
      categories.push(cat);
    }
    cat = null;
    catDesc.length = 0;
  };

  for (; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const mCat = /^##\s+(.+?)\s*$/.exec(line);
    const mEntry = /^###\s+(.+?)\s*$/.exec(line);
    if (mCat) {
      flushCat();
      cat = { name: mCat[1] ?? "", descLines: [], entries: [] };
      continue;
    }
    if (mEntry) {
      flushEntry();
      entryHeadline = mEntry[1] ?? "";
      continue;
    }
    if (entryHeadline !== null) {
      entryBody.push(line);
    } else if (cat) {
      catDesc.push(line);
    } else {
      // 카테고리 시작 전의 떠도는 라인 — preamble 로 보존
      preambleRaw.push(line);
    }
  }
  flushCat();

  return { title, preamble: trimBlankEdges(preambleRaw), categories };
}

export function serializeVault(doc: VaultDoc): string {
  const out: string[] = [];
  out.push(`# ${doc.title}`);
  if (doc.preamble.length > 0) {
    out.push("");
    out.push(...doc.preamble);
  }
  for (const c of doc.categories) {
    out.push("");
    out.push(`## ${c.name}`);
    if (c.descLines.length > 0) {
      out.push("");
      out.push(...c.descLines);
    }
    for (const e of c.entries) {
      out.push("");
      out.push(`### ${e.headline}`);
      if (e.metaLine) out.push(e.metaLine);
      if (e.bodyLines.length > 0) {
        out.push("");
        out.push(...e.bodyLines);
      }
    }
  }
  const text = out.join("\n").replace(/\n{3,}/g, "\n\n");
  return `${text.trimEnd()}\n`;
}

function maxPr(e: EntryBlock): number {
  return e.prNumbers.length > 0 ? Math.max(...e.prNumbers) : 0;
}

// 날짜 desc (최근 위), 동률은 PR 번호 desc. 빈 날짜는 맨 아래.
function compareEntries(a: EntryBlock, b: EntryBlock): number {
  const byDate = b.date.localeCompare(a.date);
  if (byDate !== 0) return byDate;
  return maxPr(b) - maxPr(a);
}

export function sortEntries(entries: EntryBlock[]): void {
  entries.sort(compareEntries);
}

export function appendEntry(
  doc: VaultDoc,
  newEntry: NewEntry,
  prNumber: number,
  date: string,
): void {
  const metaLine = newEntry.metaLine.trim();
  const prNumbers = [...new Set([prNumber, ...prNumbersFromText(metaLine)])];
  const block: EntryBlock = {
    headline: newEntry.headline.trim(),
    metaLine,
    prNumbers,
    date: date || dateFromText(metaLine),
    bodyLines: trimBlankEdges(newEntry.body.split("\n")),
  };

  let cat = doc.categories.find((c) => c.name === newEntry.category);
  if (!cat) {
    cat = { name: newEntry.category, descLines: [], entries: [] };
    doc.categories.push(cat);
    doc.categories.sort((a, b) => a.name.localeCompare(b.name));
  }
  cat.entries.push(block);
  cat.entries.sort(compareEntries);
}
