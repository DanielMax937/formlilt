'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Landmark, HeartPulse, ShieldCheck } from 'lucide-react';
import { DEMOS, type DemoSlug } from '@/lib/demos';
import { FormSchema } from '@/lib/schema';
import { createSession } from '@/lib/storage';
import { useLanguage } from './language-provider';
import { t, errorText } from '@/lib/i18n';
export function DemoCards() {
  const { language } = useLanguage();
  const [busy, setBusy] = useState<DemoSlug>();
  const [error, setError] = useState('');
  const router = useRouter();
  const start = async (slug: DemoSlug) => {
    setBusy(slug);
    setError('');
    try {
      const [data, file] = await Promise.all([
        fetch('/api/demo/' + slug),
        fetch('/demo-forms/' + slug + '.pdf'),
      ]);
      const payload = await data.json();
      if (!data.ok) throw new Error(errorText(language, payload.error?.code));
      if (!file.ok) throw new Error(t(language, 'missingFile'));
      const schema = FormSchema.parse(payload.schema);
      const session = await createSession(
        schema,
        new File([await file.blob()], slug + '.pdf', { type: 'application/pdf' }),
        language,
        slug,
      );
      router.push('/fill/' + session.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(language, 'error'));
      setBusy(undefined);
    }
  };
  const icons = [Landmark, ShieldCheck, HeartPulse];
  return (
    <section id="demo-forms" className="demos" aria-labelledby="demo-heading">
      <div className="section-heading">
        <h2 id="demo-heading">{t(language, 'demosTitle')}</h2>
        <p className="muted small">{t(language, 'demosNote')}</p>
      </div>
      <div className="demo-grid">
        {DEMOS.map((demo, i) => {
          const Icon = icons[i];
          return (
            <button
              className={'demo-card ' + demo.color}
              key={demo.slug}
              data-testid={'demo-' + demo.slug}
              disabled={!!busy}
              onClick={() => void start(demo.slug)}
            >
              <div className="demo-top">
                <span className="demo-icon">
                  <Icon size={23} />
                </span>
                <span className="tag">{demo.category}</span>
                <ArrowUpRight className="demo-arrow" size={20} />
              </div>
              <h3>{demo.formTitle}</h3>
              <p>{demo.publisher}</p>
              <span className="demo-cta">
                {busy === demo.slug ? t(language, 'loading') : t(language, 'tryDemo')}{' '}
                <span aria-hidden="true">→</span>
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </section>
  );
}
