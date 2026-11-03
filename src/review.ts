// The only call to Claude. No tools are declared, so the model can only return
// JSON matching ReviewSchema; it never sees a token or touches the network.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

export const SEVERITIES = ['critical', 'major', 'minor'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Review dimensions, in the order they appear in the comment. */
export const ASPECTS = ['design', 'correctness', 'concurrency', 'security', 'performance', 'style'] as const;
export type Aspect = (typeof ASPECTS)[number];

export const RATINGS = ['good', 'fair', 'poor', 'na'] as const;
export type Rating = (typeof RATINGS)[number];

export const VERDICTS = ['approve', 'approve_with_suggestions', 'request_changes'] as const;
export type Verdict = (typeof VERDICTS)[number];

const Assessment = z.object({ rating: z.enum(RATINGS), comment: z.string() });

export const ReviewSchema = z.object({
  overview: z.string(),
  aspects: z.object({
    design: Assessment,
    correctness: Assessment,
    concurrency: Assessment,
    security: Assessment,
    performance: Assessment,
    style: Assessment,
  } satisfies Record<Aspect, typeof Assessment>),
  findings: z.array(
    z.object({
      aspect: z.enum(ASPECTS),
      file: z.string(),
      line: z.number().int(),
      severity: z.enum(SEVERITIES),
      title: z.string(),
      detail: z.string(),
    }),
  ),
  verdict: z.object({ decision: z.enum(VERDICTS), comment: z.string() }),
});

export type ReviewOutput = z.infer<typeof ReviewSchema>;

export interface ReviewResult {
  output: ReviewOutput;
  /** The model that actually answered (differs from the requested one after a fallback). */
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function runReview(apiKey: string, model: string, system: string, user: string): Promise<ReviewResult> {
  const client = new Anthropic({ apiKey });
  const stream = client.beta.messages.stream({
    model,
    max_tokens: 64000,
    // On a policy decline, the API re-runs the request on Anthropic's recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: betaZodOutputFormat(ReviewSchema) },
    system,
    messages: [{ role: 'user', content: user }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new Error(`Claude 拒絕審查這個 PR（類別：${message.stop_details?.category ?? '未提供'}）`);
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('Claude 的回應超過 max_tokens，review 不完整，不發布');
  }
  if (!message.parsed_output) {
    throw new Error(`Claude 的回應不符合 JSON schema（stop_reason：${message.stop_reason}）`);
  }
  return {
    output: message.parsed_output,
    model: message.model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}
