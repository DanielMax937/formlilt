'use client';
import { assertRequestFits } from '@/lib/deployment';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Download, AlertCircle, Pencil, FileText } from 'lucide-react';
import { Header } from './header';
import { useLanguage } from './language-provider';
import { FieldInput } from './inputs/field-input';
import { SignaturePad } from './inputs/signature-pad';
import { DocumentPreview } from './document-preview';
import { useFormSession } from '@/hooks/use-form-session';
import { activeFields, pruneAnswers } from '@/lib/next-field';
import { getOriginal, clearSession } from '@/lib/storage';
import { formatDate, invalidFields } from '@/lib/validate';
import { plainSummary } from '@/lib/summary';
import { errorText, t } from '@/lib/i18n';
import { event } from '@/lib/analytics';
import type { Field, Answers } from '@/lib/schema';
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function Review({ id }: { id: string }) {
  const { language } = useLanguage();
  const flow = useFormSession(id, language, true);
  const { session } = flow;
  const router = useRouter();
  const [original, setOriginal] = useState<File>();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [name, setName] = useState('');
  const [lock, setLock] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const [filled, setFilled] = useState<File>();
  const [summary, setSummary] = useState('');
  useEffect(() => {
    void getOriginal(id).then((file) => setOriginal(file));
  }, [id]);
  useEffect(() => {
    setEditing(null);
  }, [session?.answers]);
  if (!session)
    return (
      <div className="shell">
        <Header />
        <main id="main" className="panel">
          <h1>{t(language, session === undefined ? 'loading' : 'noSession')}</h1>
          <Link href="/">{t(language, 'home')}</Link>
        </main>
      </div>
    );
  const fields = activeFields(session.schema, session.answers);
  const invalid = invalidFields(session.schema, session.answers);
  const editField = session.schema.fields.find((f) => f.id === editing);
  const edit = (field: Field) => {
    flow.persist({ ...session, currentFieldId: field.id, state: 'reviewing' });
    setEditing(field.id);
    setValue(session.answers[field.id]?.value ?? '');
    setName(session.answers[field.id]?.signedBy ?? '');
    setError('');
  };
  const display = (field: Field, answers: Answers) => {
    const answer = answers[field.id];
    if (!answer?.value || answer.status === 'skipped') return t(language, 'skipped');
    if (field.type === 'signature')
      return `${t(language, 'signatureSaved')} · ${answer.signedBy || ''}`;
    if (field.type === 'checkbox') return t(language, answer.value === 'true' ? 'yes' : 'no');
    if (field.type === 'date') return formatDate(answer.value, field.constraints?.dateFormat);
    if (field.type === 'multiselect') {
      try {
        return (JSON.parse(answer.value) as string[]).join(', ');
      } catch {
        return answer.value;
      }
    }
    return answer.value;
  };
  const finalize = async () => {
    setError('');
    if (invalid.length) {
      document.getElementById('review-' + invalid[0].id)?.focus();
      setError(t(language, 'missing'));
      return;
    }
    if (!original) {
      setError(t(language, 'missingFile'));
      return;
    }
    setGenerating(true);
    try {
      const data = new FormData();
      data.set('original', original);
      data.set(
        'payload',
        JSON.stringify({
          schema: session.schema,
          answers: session.answers,
          uiLanguage: language,
          lock,
        }),
      );
      if (!assertRequestFits(data)) throw new Error(t(language, 'serverSizeLimit'));
      const response = await fetch('/api/finalize', { method: 'POST', body: data });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(errorText(language, result.error?.code, result.error?.message));
      }
      const blob = await response.blob();
      const file = new File([blob], original.name.replace(/\.[^.]+$/, '') + '-filled.pdf', {
        type: 'application/pdf',
      });
      setFilled(file);
      const header = response.headers.get('X-Summary');
      if (header) setSummary(decodeURIComponent(header));
      downloadBlob(file, file.name);
      event('completed');
      event('download');
    } catch (e) {
      setError(e instanceof Error ? e.message : t(language, 'error'));
    } finally {
      setGenerating(false);
    }
  };
  return (
    <div className="shell review-shell">
      <Header>
        <button
          className="text-button"
          onClick={() => void clearSession(id).then(() => router.push('/'))}
        >
          {t(language, 'clear')}
        </button>
      </Header>
      <main id="main">
        <div className="review-heading">
          <p className="eyebrow">{t(language, 'review')}</p>
          <h1>{t(language, 'reviewTitle')}</h1>
          <p className="muted">{t(language, 'reviewIntro')}</p>
        </div>
        {session.schema.precision === 'approximate' && (
          <p className="notice">
            <AlertCircle size={20} />
            {t(language, 'approximate')}
          </p>
        )}
        {invalid.length > 0 && (
          <p className="notice required-notice">
            <AlertCircle size={20} />
            {t(language, 'missing')} ({invalid.length})
          </p>
        )}
        <div className="review-grid">
          <section className="review-answers" aria-label={t(language, 'review')}>
            {session.schema.sections.map((section) => {
              const sectionFields = fields.filter((f) => f.section === section.id);
              return (
                sectionFields.length > 0 && (
                  <div className="review-section panel" key={section.id}>
                    <h2>{section.title}</h2>
                    {sectionFields.map((field) => (
                      <div
                        key={field.id}
                        className={
                          'review-row ' +
                          (invalid.some((f) => f.id === field.id) ? 'needs-attention' : '')
                        }
                      >
                        <div className="review-row-top">
                          <div>
                            <p className="review-label">
                              {field.label}{' '}
                              <span className="small muted">
                                {t(language, field.required ? 'required' : 'optional')}
                              </span>
                            </p>
                            <p className="review-value">{display(field, session.answers)}</p>
                            {session.answers[field.id]?.normalizedFrom && (
                              <p className="small muted">
                                {t(language, 'originalValue')}:{' '}
                                {session.answers[field.id].normalizedFrom}
                              </p>
                            )}
                          </div>
                          <button
                            id={'review-' + field.id}
                            className="tool-button"
                            data-testid={'edit-' + field.id}
                            aria-label={`${t(language, 'edit')}: ${field.label}`}
                            onClick={() => edit(field)}
                          >
                            <Pencil size={16} />
                            <span>{t(language, 'edit')}</span>
                          </button>
                        </div>
                        {editing === field.id && editField && (
                          <form
                            className="review-editor"
                            noValidate
                            onSubmit={(e) => {
                              e.preventDefault();
                              void flow.action('answer', value, undefined, false, undefined, name);
                            }}
                          >
                            <h3 id="question-heading">{field.label}</h3>
                            {field.type === 'signature' ? (
                              <SignaturePad
                                value={value}
                                name={name}
                                onChange={setValue}
                                onNameChange={setName}
                                language={language}
                              />
                            ) : (
                              <FieldInput
                                field={field}
                                value={value}
                                onChange={setValue}
                                language={language}
                                invalid={!!flow.error}
                              />
                            )}
                            <div className="button-row">
                              <button className="button primary" disabled={flow.busy}>
                                {t(language, 'save')}
                              </button>
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => {
                                  setEditing(null);
                                  flow.clearTranslation();
                                }}
                              >
                                {t(language, 'close')}
                              </button>
                            </div>
                            {flow.error && (
                              <p className="error-message" id="answer-error" role="alert">
                                {flow.error}
                              </p>
                            )}
                            {flow.translation && (
                              <div className="translation-box">
                                <p>{t(language, 'confirmTranslation')}</p>
                                <p>{flow.translation.value}</p>
                                <div className="button-row">
                                  <button
                                    type="button"
                                    className="button secondary"
                                    onClick={() => {
                                      const tr = flow.translation!;
                                      flow.clearTranslation();
                                      void flow.action(
                                        'answer',
                                        tr.value,
                                        undefined,
                                        true,
                                        tr.original,
                                      );
                                    }}
                                  >
                                    {t(language, 'confirm')}
                                  </button>
                                  <button
                                    type="button"
                                    className="text-button"
                                    onClick={() => {
                                      const tr = flow.translation!;
                                      flow.clearTranslation();
                                      void flow.action('answer', tr.original, undefined, true);
                                    }}
                                  >
                                    {t(language, 'keepOriginal')}
                                  </button>
                                </div>
                              </div>
                            )}
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                )
              );
            })}
          </section>
          <aside className="review-actions">
            <div className="panel export-panel">
              <FileText size={30} />
              <h2>{session.schema.title}</h2>
              <p className="saved-note">
                <CheckCircle2 size={16} />
                {t(language, 'saved')}
              </p>
              <label className="lock-choice">
                <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
                <span>{t(language, 'lock')}</span>
              </label>
              <button
                className="button primary download-button"
                onClick={() => void finalize()}
                disabled={generating}
              >
                <Download size={18} />
                {t(language, generating ? 'downloading' : 'download')}
              </button>
              {error && (
                <p role="alert" className="error-message">
                  {error}
                </p>
              )}
              <div className="export-secondary">
                <button
                  className="text-button"
                  onClick={() =>
                    downloadBlob(
                      new Blob(
                        [
                          JSON.stringify(
                            {
                              schema: session.schema,
                              answers: pruneAnswers(session.schema, session.answers),
                            },
                            null,
                            2,
                          ),
                        ],
                        { type: 'application/json' },
                      ),
                      'fillflow-answers.json',
                    )
                  }
                >
                  {t(language, 'json')}
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(summary || plainSummary(session.schema, session.answers, language))
                      .then(() => setCopied(true))
                      .catch(() => setError(t(language, 'error')))
                  }
                >
                  {t(language, copied ? 'copied' : 'summary')}
                </button>
              </div>
              <button className="button secondary" onClick={() => setPreview(!preview)}>
                {t(language, preview ? 'close' : 'preview')}
              </button>
              <Link className="text-button" href="/">
                {t(language, 'newForm')} →
              </Link>
            </div>
          </aside>
        </div>
        {preview && original && (
          <section className="panel preview-section">
            <h2>{t(language, 'preview')}</h2>
            <DocumentPreview file={original} language={language} />
          </section>
        )}
        {filled && (
          <section className="panel preview-section">
            <h2>{t(language, 'previewFilled')}</h2>
            <DocumentPreview file={filled} language={language} />
          </section>
        )}
      </main>
    </div>
  );
}
