import { isDemoOnly } from '@/lib/deployment';
import { About } from '@/components/about';
import { getEnv } from '@/lib/env';
export const dynamic = 'force-dynamic';
export default function Page() {
  const env = getEnv();
  if (isDemoOnly())
    return (
      <About
        provider="Precomputed demos"
        model="GPT-6 Astra / GPT-5.6 Luna via agent-im · no live model calls"
      />
    );
  const model =
    env.LLM_PROVIDER === 'agent-im'
      ? env.AGENT_IM_MODEL
      : env.LLM_PROVIDER === 'openai'
        ? env.OPENAI_MODEL
        : (env.DOUBAO_MODEL ?? 'Not configured');
  return <About provider={env.LLM_PROVIDER} model={model} />;
}
