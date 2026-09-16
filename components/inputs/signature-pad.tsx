'use client';
import { useEffect, useRef, useState } from 'react';
import type { UILanguage } from '@/lib/schema';
import { t } from '@/lib/i18n';
function croppedPng(el: HTMLCanvasElement) {
  const context = el.getContext('2d')!;
  const pixels = context.getImageData(0, 0, el.width, el.height).data;
  let left = el.width,
    top = el.height,
    right = 0,
    bottom = 0;
  for (let y = 0; y < el.height; y++)
    for (let x = 0; x < el.width; x++)
      if (pixels[(y * el.width + x) * 4 + 3] > 20) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (right < left) return '';
  const crop = document.createElement('canvas');
  crop.width = right - left + 17;
  crop.height = bottom - top + 17;
  crop
    .getContext('2d')!
    .drawImage(el, left - 8, top - 8, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return crop.toDataURL('image/png');
}
type Props = {
  value: string;
  name: string;
  onChange: (value: string) => void;
  onNameChange: (value: string) => void;
  language: UILanguage;
  disabled?: boolean;
};
export function SignaturePad({ value, name, onChange, onNameChange, language, disabled }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const emitted = useRef(value);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  useEffect(() => {
    if (mode !== 'draw') return;
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, el.width, el.height);
    if (value) {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, (el.width - 32) / img.width, (el.height - 24) / img.height);
        ctx.drawImage(
          img,
          16,
          (el.height - img.height * scale) / 2,
          img.width * scale,
          img.height * scale,
        );
      };
      img.src = value;
    }
    dirty.current = !!value;
  }, [mode]);
  useEffect(() => {
    if (mode !== 'draw' || value === emitted.current) return;
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, el.width, el.height);
    if (value) {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, (el.width - 32) / img.width, (el.height - 24) / img.height);
        ctx.drawImage(
          img,
          16,
          (el.height - img.height * scale) / 2,
          img.width * scale,
          img.height * scale,
        );
      };
      img.src = value;
    }
    dirty.current = !!value;
    emitted.current = value;
  }, [value, mode]);
  const publish = (next: string) => {
    emitted.current = next;
    onChange(next);
  };
  const typeName = (text: string) => {
    onNameChange(text);
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, el.width, el.height);
    if (!text.trim()) {
      publish('');
      return;
    }
    let size = 68;
    ctx.font = `italic ${size}px Georgia, serif`;
    while (size > 20 && ctx.measureText(text).width > el.width - 70) {
      size--;
      ctx.font = `italic ${size}px Georgia, serif`;
    }
    ctx.fillStyle = '#17283e';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 35, el.height / 2, el.width - 70);
    publish(croppedPng(el));
  };
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - r.left) * event.currentTarget.width) / r.width,
      y: ((event.clientY - r.top) * event.currentTarget.height) / r.height,
    };
  };
  const finish = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (dirty.current) publish(croppedPng(event.currentTarget));
  };
  return (
    <div className="signature-control">
      <div className="signature-modes" role="group" aria-label={t(language, 'signature')}>
        <button
          type="button"
          className={'button ' + (mode === 'draw' ? 'secondary' : 'subtle')}
          disabled={disabled}
          aria-pressed={mode === 'draw'}
          onClick={() => setMode('draw')}
        >
          {t(language, 'draw')}
        </button>
        <button
          type="button"
          className={'button ' + (mode === 'type' ? 'secondary' : 'subtle')}
          disabled={disabled}
          aria-pressed={mode === 'type'}
          onClick={() => {
            setMode('type');
            if (name) typeName(name);
          }}
        >
          {t(language, 'typeSignature')}
        </button>
      </div>
      <label className="input-label" htmlFor="signature-name">
        {t(language, 'signer')}
      </label>
      <input
        id="signature-name"
        value={name}
        autoComplete="name"
        maxLength={150}
        disabled={disabled}
        onChange={(e) =>
          mode === 'type' ? typeName(e.target.value) : onNameChange(e.target.value)
        }
        aria-describedby="signature-hint"
      />
      <canvas
        ref={canvas}
        width={1000}
        height={320}
        className={'signature-canvas ' + (mode === 'type' ? 'typed' : '')}
        aria-label={t(language, 'signature')}
        onPointerDown={(event) => {
          if (disabled || mode !== 'draw') return;
          event.preventDefault();
          const ctx = event.currentTarget.getContext('2d');
          if (!ctx) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const p = point(event);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#17283e';
          drawing.current = true;
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const p = point(event);
          const ctx = event.currentTarget.getContext('2d');
          if (!ctx) return;
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          dirty.current = true;
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
      <div className="signature-footer">
        <p id="signature-hint" className="small muted">
          {t(language, mode === 'draw' ? 'signHint' : 'typedSignature')}
        </p>
        <button
          type="button"
          className="text-button"
          disabled={disabled}
          onClick={() => {
            const el = canvas.current;
            el?.getContext('2d')?.clearRect(0, 0, el.width, el.height);
            dirty.current = false;
            publish('');
          }}
        >
          {t(language, 'clearSignature')}
        </button>
      </div>
    </div>
  );
}
