import type { BuiltEntry } from "../curator/entry-builder.js";
import type { ThresholdJudgement } from "../curator/threshold-judge.js";
import type { PRContext } from "../github/pr-context.js";
import { logger } from "../utils/logger.js";

const COLOR_PASS = "#22c55e";
const COLOR_SKIP = "#9ca3af";

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
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.warn("Slack 전송 실패", { status: res.status, body: text.slice(0, 200) });
  }
}

function vaultEntryUrl(targetRepo: string, username: string, project: string): string {
  return `https://github.com/${targetRepo}/blob/main/${username}/${project}.md`;
}

export async function sendSlackPass(
  webhookUrl: string,
  pr: PRContext,
  entry: BuiltEntry,
  targetRepo: string,
  projectName: string,
): Promise<void> {
  const vaultUrl = vaultEntryUrl(targetRepo, pr.author, projectName);
  const payload: SlackPayload = {
    attachments: [
      {
        color: COLOR_PASS,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `🎯 *새 적립* — ${pr.author}/${projectName}`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `<${pr.url}|#${pr.number}> *${entry.headline}*\n  └ \`${entry.category}\``,
            },
          },
          {
            type: "context",
            elements: [
              { type: "mrkdwn", text: `<${vaultUrl}|vault> · <${pr.url}|PR>` },
            ],
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
): Promise<void> {
  const payload: SlackPayload = {
    attachments: [
      {
        color: COLOR_SKIP,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `⏭️ *skip* — ${pr.author}/${projectName}`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `<${pr.url}|#${pr.number}> ${pr.title}\n  └ ${judgement.reason}`,
            },
          },
        ],
      },
    ],
  };
  await post(webhookUrl, payload);
}
