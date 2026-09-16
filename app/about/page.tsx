import { About } from '@/components/about';
import { getEnv } from '@/lib/env';
export const dynamic = 'force-dynamic';
export default function Page() {
  const env = getEnv();
  const model =
    env.LLM_PROVIDER === 'agent-im'
      ? env.AGENT_IM_MODEL
      : env.LLM_PROVIDER === 'openai'
        ? env.OPENAI_MODEL
        : (env.DOUBAO_MODEL ?? 'Not configured');
  return <About provider={env.LLM_PROVIDER} model={model} />;
}
