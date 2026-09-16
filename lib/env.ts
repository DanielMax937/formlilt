import { z } from 'zod';
const optionalSecret = z
  .string()
  .optional()
  .transform((value) => value || undefined);
export const Env = z.object({
  LLM_PROVIDER: z.enum(['agent-im', 'doubao', 'openai']).default('agent-im'),
  AGENT_IM_BASE_URL: z.string().url().default('http://127.0.0.1:3300/v1'),
  AGENT_IM_API_KEY: z.string().default('agent-im-local'),
  AGENT_IM_MODEL: z.string().min(1).default('codex-login/gpt-6-astra'),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(300000),
  LLM_STRUCTURED_OUTPUT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  ARK_BASE_URL: z.string().url().default('https://ark.cn-beijing.volces.com/api/v3'),
  ARK_API_KEY: optionalSecret,
  DOUBAO_MODEL: optionalSecret,
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_API_KEY: optionalSecret,
  OPENAI_MODEL: z.string().default('gpt-6-astra'),
  UPSTASH_REDIS_REST_URL: z
    .string()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.string().url().optional()),
  UPSTASH_REDIS_REST_TOKEN: optionalSecret,
  RATE_LIMIT_EXTRACT_PER_DAY: z.coerce.number().int().min(1).max(100).default(3),
});
export const getEnv = () => Env.parse(process.env);
