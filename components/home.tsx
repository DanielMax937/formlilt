'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LockKeyhole, ArrowRight } from 'lucide-react';
import { LocalProfile } from './local-profile';
import { Header } from './header';
import { UploadZone } from './upload-zone';
import { DemoCards } from './demo-cards';
import { useLanguage } from './language-provider';
import { t } from '@/lib/i18n';
import { listSessions, clearAllSessions } from '@/lib/storage';
import type { Session } from '@/lib/schema';
export function Home() {
  const { language } = useLanguage();
  const [sessions, setSessions] = useState<Session[]>([]);
  useEffect(() => {
    try {
      setSessions(listSessions());
    } catch {}
  }, []);
  return (
    <div className="shell">
      <Header />
      <main id="main">
        <div className="home-intro">
          <div className="hero">
            <p className="eyebrow">{t(language, 'eyebrow')}</p>
            <h1>
              {t(language, 'heroA')}
              <br />
              <em>{t(language, 'heroB')}</em>
            </h1>
            <p>{t(language, 'intro')}</p>
            <div className="quiet-note">
              <span className="tiny-line" />
              PDF → conversation → done
            </div>
          </div>
          <UploadZone />
        </div>
        {sessions.length > 0 && (
          <section className="resume-bar" aria-label={t(language, 'resume')}>
            <div>
              <span className="small muted">{t(language, 'resume')}</span>
              {sessions.slice(0, 3).map((s) => (
                <Link key={s.id} href={`/${s.state === 'reviewing' ? 'review' : 'fill'}/${s.id}`}>
                  {s.schema.title}
                  <ArrowRight size={16} />
                </Link>
              ))}
            </div>
            <button
              className="text-button"
              onClick={() => void clearAllSessions().then(() => setSessions([]))}
            >
              {t(language, 'clearAll')}
            </button>
          </section>
        )}
        <DemoCards />
        <LocalProfile key={sessions.map((s) => s.id).join()} />
        <section className="privacy-strip">
          <LockKeyhole size={23} />
          <div>
            <h2>{t(language, 'privacyTitle')}</h2>
            <p>
              {t(language, 'privacyA')} {t(language, 'privacyB')}
            </p>
            <p className="small">{t(language, 'privacyC')}</p>
          </div>
        </section>
      </main>
      <footer>
        <span>FormLilt · Forms, without the friction.</span>
        <Link href="/about">{t(language, 'privacy')}</Link>
      </footer>
    </div>
  );
}
