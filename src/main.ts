import { randomBytes } from 'node:crypto';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { selectFiles } from './context.ts';
import { fetchChangedFiles, fetchPullRequest, upsertComment } from './github.ts';
import { systemPrompt, userMessage } from './prompt.ts';
import { render, renderNothingToReview } from './render.ts';
import { runReview } from './review.ts';

async function run(): Promise<void> {
  const number = github.context.payload.pull_request?.number;
  if (number === undefined) {
    throw new Error(`這個 action 只能在 pull_request 事件執行，目前是 ${github.context.eventName}`);
  }
  const apiKey = core.getInput('claude-api-key', { required: true });
  const model = core.getInput('model', { required: true });
  const octokit = github.getOctokit(core.getInput('github-token', { required: true }));
  const repo = github.context.repo;

  const pr = await fetchPullRequest(octokit, repo, number);
  const changed = await fetchChangedFiles(octokit, repo, number);
  const selection = selectFiles(changed, pr.changedFiles);
  core.info(`PR #${pr.number}：${changed.length} 個檔案，送審 ${selection.files.length} 個，跳過 ${selection.skipped.length} 個`);

  let body: string;
  if (selection.files.length === 0) {
    body = renderNothingToReview(pr, selection);
  } else {
    const nonce = randomBytes(8).toString('hex');
    const result = await runReview(apiKey, model, systemPrompt(nonce), userMessage(pr, selection, nonce));
    core.info(`模型 ${result.model}：輸入 ${result.inputTokens} tokens、輸出 ${result.outputTokens} tokens、${result.output.findings.length} 則發現`);
    body = render(repo, pr, selection, result);
  }

  const url = await upsertComment(octokit, repo, number, body);
  core.setOutput('comment-url', url);
  core.info(`留言：${url}`);
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
