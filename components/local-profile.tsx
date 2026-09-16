'use client';
import { useEffect, useState } from 'react';
import { useLanguage } from './language-provider';
import { loadProfile, saveProfile, profileSlot, type Profile } from '@/lib/profile';
import { t } from '@/lib/i18n';
import type { Field } from '@/lib/schema';
const copy = {
  en: {
    title: 'Save details for your next form',
    note: 'Optional. Stored only in this browser. Suggestions need your approval before filling a field. Clear all removes these details too.',
    enabled: 'Remember my details on this device',
    name: 'Full name',
    address: 'Current address',
    idNumber: 'Identity document number',
    save: 'Save preferences',
    saved: 'Preferences saved on this device.',
    suggestion: 'Use saved detail',
  },
  'zh-CN': {
    title: '为下次填表保存资料',
    note: '可选，仅保存在此浏览器。建议值需点击后才填入。“清除全部”也会删除这些资料。',
    enabled: '在此设备记住我的资料',
    name: '全名',
    address: '当前地址',
    idNumber: '证件号码',
    save: '保存设置',
    saved: '设置已保存在此设备。',
    suggestion: '使用已保存的资料',
  },
  es: {
    title: 'Guardar datos para el próximo formulario',
    note: 'Opcional. Solo en este navegador. Debes aprobar cada sugerencia. Borrar todo también elimina estos datos.',
    enabled: 'Recordar mis datos en este dispositivo',
    name: 'Nombre completo',
    address: 'Dirección actual',
    idNumber: 'Número de documento',
    save: 'Guardar preferencias',
    saved: 'Preferencias guardadas en este dispositivo.',
    suggestion: 'Usar dato guardado',
  },
  ja: {
    title: '次の書類のために情報を保存',
    note: '任意。このブラウザー内だけに保存され、提案を選ぶまで入力されません。「すべて削除」でこの情報も消えます。',
    enabled: 'この端末に情報を保存する',
    name: '氏名',
    address: '現住所',
    idNumber: '本人確認書類の番号',
    save: '設定を保存',
    saved: 'この端末に設定を保存しました。',
    suggestion: '保存した情報を使う',
  },
};
const empty: Profile = { enabled: false, name: '', address: '', idNumber: '' };
export function LocalProfile() {
  const { language } = useLanguage();
  const text = copy[language];
  const [profile, setProfile] = useState<Profile>(empty);
  const [status, setStatus] = useState('');
  useEffect(() => {
    setProfile(loadProfile() ?? empty);
  }, []);
  return (
    <details className="profile-panel panel">
      <summary>{text.title}</summary>
      <p className="muted small">{text.note}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            saveProfile(profile);
            setStatus(text.saved);
          } catch {
            setStatus(t(language, 'storage_error'));
          }
        }}
      >
        <label className="profile-consent">
          <input
            type="checkbox"
            checked={profile.enabled}
            onChange={(e) => setProfile({ ...profile, enabled: e.target.checked })}
          />
          {text.enabled}
        </label>
        <div className="profile-grid">
          {(['name', 'address', 'idNumber'] as const).map((key) => (
            <label key={key}>
              {text[key]}
              <input
                autoComplete="off"
                type={key === 'idNumber' ? 'password' : 'text'}
                value={profile[key]}
                maxLength={key === 'address' ? 300 : key === 'name' ? 150 : 60}
                disabled={!profile.enabled}
                onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <button className="button secondary" type="submit">
          {text.save}
        </button>
        {status && <p role="status">{status}</p>}
      </form>
    </details>
  );
}
export function ProfileSuggestion({
  field,
  value,
  onUse,
}: {
  field: Field;
  value: string;
  onUse: (value: string) => void;
}) {
  const { language } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    setProfile(loadProfile());
  }, [field.id]);
  const slot = profileSlot(field);
  const suggestion = slot && profile?.[slot];
  if (value || !suggestion) return null;
  return (
    <button type="button" className="profile-suggestion" onClick={() => onUse(suggestion)}>
      {copy[language].suggestion}:{' '}
      <strong>{slot === 'idNumber' ? '••••' + suggestion.slice(-4) : suggestion}</strong>
    </button>
  );
}
