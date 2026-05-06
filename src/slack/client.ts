import type { UsageTotals } from "../anthropic/usage.js";
import type { BuiltEntry } from "../curator/entry-builder.js";
import type { ThresholdJudgement } from "../curator/threshold-judge.js";
import type { PRContext, PRMode } from "../github/pr-context.js";
import { logger } from "../utils/logger.js";

const COLOR_PASS = "#22c55e";
const COLOR_SKIP = "#9ca3af";
const COLOR_FAIL = "#ef4444";

const FAIL_ERROR_LIMIT = 300;

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: Array<{ type: string; text: string }>;
}

interface SlackPayload {
  attachments: Array<{
    color: string;
    blocks: SlackBlock[];
  }>;
}

async function post(webhookUrl: string, payload: SlackPayload): Promise<void> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn("Slack 전송 실패", { status: res.status, body: text.slice(0, 200) });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("Slack 전송 예외", { error: msg });
  }
}

function vaultEntryUrl(targetRepo: string, username: string, project: string): string {
  return `https://github.com/${targetRepo}/blob/main/${username}/${project}.md`;
}

function modeLabel(mode: PRMode): string {
  return mode;
}

function field(label: string, value: string): string {
  return `• *${label}*: ${value}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.0001) return "<$0.0001";
  return `$${usd.toFixed(4)}`;
}

function usageLine(totals: UsageTotals): string {
  const parts = [
    `${totals.callCount} calls`,
    `${formatNumber(totals.inputTokens)} in / ${formatNumber(totals.outputTokens)} out`,
  ];
  if (totals.cacheReadTokens > 0 || totals.cacheWriteTokens > 0) {
    parts.push(
      `cache ${formatNumber(totals.cacheReadTokens)} read / ${formatNumber(totals.cacheWriteTokens)} write`,
    );
  }
  parts.push(`~${formatCost(totals.costUsd)}`);
  return parts.join(" · ");
}

export async function sendSlackPass(
  webhookUrl: string,
  pr: PRContext,
  entry: BuiltEntry,
  targetRepo: string,
  projectName: string,
  totals?: UsageTotals,
): Promise<void> {
  const vaultUrl = vaultEntryUrl(targetRepo, pr.author, projectName);
  const fields = [
    field("레포", `\`${pr.owner}/${pr.repo}\``),
    field("PR", `<${pr.url}|#${pr.number} ${pr.title}>`),
    field("작성자", `\`${pr.author}\``),
    field("카테고리", `\`${entry.category}\``),
    field("모드", `\`${modeLabel(pr.mode)}\``),
  ].join("\n");

  const contextLines: string[] = [`<${vaultUrl}|vault entry> · <${pr.url}|PR>`];
  if (totals) contextLines.unshift(usageLine(totals));

  const payload: SlackPayload = {
    attachments: [
      {
        color: COLOR_PASS,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `🎯 *새 적립*\n*${entry.headline}*`,
            },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: fields },
          },
          {
            type: "context",
            elements: contextLines.map((text) => ({ type: "mrkdwn", text })),
          },
        ],
      },
    ],
  };
  await post(webhookUrl, payload);
}

export async function sendSlackSkip(
  webhookUrl: string,
  pr: PRContext,
  judgement: ThresholdJudgement,
  projectName: string,
  totals?: UsageTotals,
): Promise<void> {
  const fields = [
    field("레포", `\`${pr.owner}/${pr.repo}\``),
    field("PR", `<${pr.url}|#${pr.number}>`),
    field("작성자", `\`${pr.author}\``),
    field("사유", judgement.reason),
  ].join("\n");

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⏭️ *Skip* — \`${projectName}\`\n*${pr.title}*`,
      },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: fields },
    },
  ];

  if (totals) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: usageLine(totals) }],
    });
  }

  await post(webhookUrl, { attachments: [{ color: COLOR_SKIP, blocks }] });
}

export interface SlackFailParams {
  repo: string;
  prNumber?: number;
  prUrl?: string;
  prTitle?: string;
  author?: string;
  stage: string;
  mode?: PRMode;
  errorMessage: string;
  runUrl?: string;
  totals?: UsageTotals;
}

export async function sendSlackFail(webhookUrl: string, params: SlackFailParams): Promise<void> {
  const errorTrimmed =
    params.errorMessage.length > FAIL_ERROR_LIMIT
      ? `${params.errorMessage.slice(0, FAIL_ERROR_LIMIT)}…`
      : params.errorMessage;

  const prField = params.prUrl
    ? `<${params.prUrl}|#${params.prNumber ?? "?"}${params.prTitle ? ` ${params.prTitle}` : ""}>`
    : params.prNumber
      ? `#${params.prNumber}`
      : "(unknown)";

  const fieldLines = [
    field("레포", `\`${params.repo}\``),
    field("PR", prField),
    params.author ? field("작성자", `\`${params.author}\``) : null,
    field("단계", `\`${params.stage}\``),
    params.mode ? field("모드", `\`${modeLabel(params.mode)}\``) : null,
    field("에러", `\`\`\`${errorTrimmed}\`\`\``),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const links = [
    params.runUrl ? `<${params.runUrl}|workflow run>` : null,
    params.prUrl ? `<${params.prUrl}|PR>` : null,
  ].filter((l): l is string => l !== null);

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `❌ *실패* — \`${params.stage}\` 단계`,
      },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: fieldLines },
    },
  ];

  const contextLines: string[] = [];
  if (params.totals) contextLines.push(usageLine(params.totals));
  if (links.length > 0) contextLines.push(links.join(" · "));
  if (contextLines.length > 0) {
    blocks.push({
      type: "context",
      elements: contextLines.map((text) => ({ type: "mrkdwn", text })),
    });
  }

  await post(webhookUrl, { attachments: [{ color: COLOR_FAIL, blocks }] });
}
