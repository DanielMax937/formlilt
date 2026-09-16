'use client';
import { useEffect, useRef } from 'react';
import type { Field, UILanguage } from '@/lib/schema';
import { t } from '@/lib/i18n';
import { dateParts } from '@/lib/validate';
export function FieldInput({
  field,
  value,
  onChange,
  language,
  disabled,
  invalid,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
  language: UILanguage;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    container.current?.querySelector<HTMLElement>('input,textarea,select,button')?.focus();
  }, [field.id]);
  const common = {
    id: 'answer-input',
    'aria-labelledby': 'question-heading',
    'aria-describedby': invalid ? 'answer-error' : undefined,
    'aria-invalid': invalid,
    disabled,
  };
  let control: React.ReactNode;
  if (field.type === 'select')
    control = (
      <select
        {...common}
        className="field-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t(language, 'select')}</option>
        {field.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  else if (field.type === 'multiselect') {
    let selected: string[] = [];
    try {
      const parsed = JSON.parse(value || '[]');
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) selected = parsed;
    } catch {}
    control = (
      <fieldset className="choice-list" aria-labelledby="question-heading" disabled={disabled}>
        {field.options?.map((option, i) => (
          <label className="choice-row" key={option}>
            <input
              id={i === 0 ? 'answer-input' : undefined}
              type="checkbox"
              checked={selected.includes(option)}
              onChange={(e) =>
                onChange(
                  JSON.stringify(
                    e.target.checked ? [...selected, option] : selected.filter((v) => v !== option),
                  ),
                )
              }
            />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
    );
  } else if (field.type === 'checkbox')
    control = (
      <fieldset className="boolean-options" aria-labelledby="question-heading" disabled={disabled}>
        {['true', 'false'].map((option, i) => (
          <label className={'boolean-option ' + (value === option ? 'selected' : '')} key={option}>
            <input
              id={i === 0 ? 'answer-input' : undefined}
              type="radio"
              name={'answer-' + field.id}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {t(language, option === 'true' ? 'yes' : 'no')}
          </label>
        ))}
      </fieldset>
    );
  else if (field.type === 'textarea')
    control = (
      <textarea
        {...common}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={field.constraints?.maxLength ?? 10000}
        rows={4}
      />
    );
  else {
    let display = value;
    if (field.type === 'date' && value) {
      const p = dateParts(value, field.constraints?.dateFormat);
      if (p) display = `${p[0]}-${String(p[1]).padStart(2, '0')}-${String(p[2]).padStart(2, '0')}`;
    }
    control = (
      <input
        {...common}
        type={
          field.type === 'date'
            ? 'date'
            : field.type === 'number'
              ? 'number'
              : field.type === 'email'
                ? 'email'
                : field.type === 'phone'
                  ? 'tel'
                  : 'text'
        }
        value={display}
        onChange={(e) => onChange(e.target.value)}
        maxLength={field.constraints?.maxLength ?? 10000}
        min={field.type === 'number' ? field.constraints?.min : undefined}
        max={field.type === 'number' ? field.constraints?.max : undefined}
        step={field.type === 'number' ? 'any' : undefined}
        autoComplete="off"
      />
    );
  }
  return <div ref={container}>{control}</div>;
}
