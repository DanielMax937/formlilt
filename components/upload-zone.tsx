'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Camera, FileUp, LoaderCircle } from 'lucide-react';
import { usePageRender } from '@/hooks/use-page-render';
import { useLanguage } from './language-provider';
import { t, errorText } from '@/lib/i18n';
import { FormSchema } from '@/lib/schema';
import { createSession } from '@/lib/storage';
import { event } from '@/lib/analytics';
export function UploadZone() {
  const { language } = useLanguage();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const { render, progress } = usePageRender();
  const [state, setState] = useState<'idle' | 'rendering' | 'extracting'>('idle');
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [lastFile, setLastFile] = useState<File>();
  const upload = async (file?: File) => {
    if (!file || state !== 'idle') return;
    setError('');
    setLastFile(file);
    setState('rendering');
    event('upload');
    try {
      const { original, pages } = await render(file);
      setState('extracting');
      const data = new FormData();
      data.set('original', original);
      for (const page of pages) data.append('pages[]', page);
      const response = await fetch('/api/extract', { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok)
        throw new Error(errorText(language, result.error?.code, result.error?.message));
      const schema = FormSchema.parse(result.schema);
      const session = await createSession(schema, original, language);
      event('schema_ok');
      router.push('/fill/' + session.id);
    } catch (e) {
      event('upload_rejected');
      setError(e instanceof Error ? e.message : t(language, 'error'));
    } finally {
      setState('idle');
    }
  };
  return (
    <section
      aria-labelledby="upload-heading"
      className={'upload-panel ' + (drag ? 'dragging' : '')}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void upload(e.dataTransfer.files[0]);
      }}
    >
      <div className="upload-inner">
        <span className="upload-symbol">
          {state === 'idle' ? <FileUp size={34} /> : <LoaderCircle className="spin" size={34} />}
        </span>
        <h2 id="upload-heading">{t(language, 'uploadTitle')}</h2>
        <p aria-live="polite">
          {state === 'rendering'
            ? `${t(language, 'reading')} ${progress.page} ${t(language, 'of')} ${progress.total}`
            : state === 'extracting'
              ? t(language, 'extracting')
              : t(language, 'uploadText')}
        </p>
        <div className="button-row">
          <button
            className="button primary"
            disabled={state !== 'idle'}
            onClick={() => input.current?.click()}
          >
            <Upload size={18} />
            {t(language, 'choose')}
          </button>
          <button
            className="button secondary camera-button"
            disabled={state !== 'idle'}
            onClick={() => camera.current?.click()}
          >
            <Camera size={18} />
            {t(language, 'camera')}
          </button>
        </div>
        <p className="small muted">{t(language, 'formats')}</p>
        <input
          ref={input}
          className="sr-only"
          tabIndex={-1}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
          aria-label={t(language, 'choose')}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
        <input
          ref={camera}
          className="sr-only"
          tabIndex={-1}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label={t(language, 'camera')}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </div>
      {error && (
        <div className="error-message" role="alert">
          {error}
          <button className="text-button" onClick={() => void upload(lastFile)}>
            {t(language, 'retry')}
          </button>
        </div>
      )}
    </section>
  );
}
