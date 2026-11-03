// All GitHub I/O. Only this module holds the token; the model never sees it.
import type { getOctokit } from '@actions/github';

export type Octokit = ReturnType<typeof getOctokit>;

export interface Repo {
  owner: string;
  repo: string;
}

export interface PullRequest {
  number: number;
  title: string;
  body: string;
  author: string;
  baseRef: string;
  headRef: string;
  headSha: string;
  changedFiles: number;
}

export interface ChangedFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export const COMMENT_MARKER = '<!-- github-ai-code-review -->';

export async function fetchPullRequest(octokit: Octokit, repo: Repo, number: number): Promise<PullRequest> {
  const { data } = await octokit.rest.pulls.get({ ...repo, pull_number: number });
  return {
    number: data.number,
    title: data.title,
    body: data.body ?? '',
    author: data.user.login,
    baseRef: data.base.ref,
    headRef: data.head.ref,
    headSha: data.head.sha,
    changedFiles: data.changed_files,
  };
}

export async function fetchChangedFiles(octokit: Octokit, repo: Repo, number: number): Promise<ChangedFile[]> {
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, { ...repo, pull_number: number, per_page: 100 });
  return files.map(f => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));
}

/** Updates this action's comment on the PR, or creates it if there is none. Returns the comment URL. */
export async function upsertComment(octokit: Octokit, repo: Repo, number: number, body: string): Promise<string> {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, { ...repo, issue_number: number, per_page: 100 });
  // Only a bot-authored comment counts, so a human quoting the marker cannot hijack the slot.
  const own = comments.find(c => c.user?.type === 'Bot' && c.body?.startsWith(COMMENT_MARKER));
  if (own) {
    const { data } = await octokit.rest.issues.updateComment({ ...repo, comment_id: own.id, body });
    return data.html_url;
  }
  const { data } = await octokit.rest.issues.createComment({ ...repo, issue_number: number, body });
  return data.html_url;
}
