'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Header } from './header';
import { useLanguage } from './language-provider';
import { t } from '@/lib/i18n';
import { clearAllSessions } from '@/lib/storage';
const copy = {
  en: {
    title: 'Your form. Your choices.',
    intro: 'How FormLilt handles your information.',
    storage: 'On this device',
    storageText:
      'Original files are saved in IndexedDB; questions, answers and signatures are saved in localStorage so you can resume. They remain until you clear them or your browser removes its data. Anyone with access to this browser profile may be able to read them.',
    server: 'During processing',
    serverText:
      'FormLilt processes uploads and answers in request memory. It has no account system or document database. Pages go to the configured model service for extraction; relevant answers can go there for translation. The provider’s retention policy applies. In local agent-im mode, runner sessions and image attachments may be retained outside FormLilt.',
    voice: 'Voice and signatures',
    voiceText:
      'Voice input and reading use your browser’s speech services. FormLilt does not upload or store recordings; the browser or operating system may use a remote speech provider. Signatures are saved as PNG images with the name you enter.',
    usage: 'Usage measurements',
    usageText:
      'When enabled, Vercel Analytics receives page views and event names such as upload and download. Form names, filenames, answers, signatures, query strings and browser session IDs are excluded. Upload quotas use a hashed IP key in Redis; no document content goes into Redis.',
    model: 'Model service',
    source: 'Open source',
    sourceText:
      'The application is licensed under MIT. Demo documents and Noto fonts have their own source notices and licenses.',
    contact: 'Contact',
    contactText:
      'This local build has no public support address configured. Contact the person who shared this app with you.',
    cleared: 'Saved forms and preferences cleared.',
  },
  'zh-CN': {
    title: '你的表格，由你掌握。',
    intro: 'FormLilt 如何处理你的资料。',
    storage: '在当前设备上',
    storageText:
      '原文件保存在 IndexedDB；问题、答案和签名保存在 localStorage，方便继续填写。它们会保留到你主动清除，或浏览器删除数据时。能访问此浏览器用户配置的人，也可能读取这些内容。',
    server: '处理过程中',
    serverText:
      'FormLilt 在请求内存中处理文件和答案，不设账号系统或文档数据库。提取结构时，页面会发给配置的模型服务；翻译时可能发送相关答案。模型服务自身的保留政策适用。本地 agent-im 模式的运行器可能在 FormLilt 之外保存会话和图片附件。',
    voice: '语音与签名',
    voiceText:
      '语音输入和朗读使用浏览器的语音服务。FormLilt 不上传或保存录音；浏览器或操作系统可能使用远程语音服务商。签名以 PNG 图片保存，并关联你输入的姓名。',
    usage: '使用统计',
    usageText:
      '启用后，Vercel Analytics 接收页面访问和 upload、download 等事件名。不会包含表格名、文件名、答案、签名、查询参数或浏览器会话 ID。上传限额在 Redis 中使用经过哈希处理的 IP 键，不保存文档内容。',
    model: '模型服务',
    source: '开源许可',
    sourceText: '应用代码采用 MIT 许可。演示文档和 Noto 字体分别遵循其来源说明与许可。',
    contact: '联系方式',
    contactText: '当前本地版本尚未配置公开支持地址，请联系向你提供本应用的人。',
    cleared: '已清除保存的表格与偏好。',
  },
  es: {
    title: 'Tu formulario. Tú decides.',
    intro: 'Cómo se trata tu información en FormLilt.',
    storage: 'En este dispositivo',
    storageText:
      'Los archivos se guardan en IndexedDB; las preguntas, respuestas y firmas, en localStorage. Permanecen hasta que los borres o el navegador elimine sus datos. Quien acceda a este perfil del navegador podría leerlos.',
    server: 'Durante el procesamiento',
    serverText:
      'FormLilt procesa archivos y respuestas en memoria, sin cuentas ni base de datos de documentos. Las páginas se envían al servicio de modelos configurado; algunas respuestas pueden enviarse para traducirlas. Se aplica la política de retención del proveedor. agent-im puede conservar sesiones y adjuntos fuera de FormLilt.',
    voice: 'Voz y firmas',
    voiceText:
      'Se utilizan los servicios de voz del navegador. FormLilt no sube ni guarda grabaciones; el navegador o sistema operativo puede utilizar un proveedor remoto. Las firmas se guardan como imágenes PNG con el nombre indicado.',
    usage: 'Estadísticas',
    usageText:
      'Si se activa Vercel Analytics, recibe visitas y nombres de eventos. Se excluyen títulos, archivos, respuestas, firmas, parámetros de consulta e identificadores de sesión. Las cuotas usan una clave IP con hash en Redis, sin contenido de documentos.',
    model: 'Servicio de modelos',
    source: 'Código abierto',
    sourceText:
      'La aplicación usa la licencia MIT. Los documentos de ejemplo y las fuentes Noto tienen sus propias licencias.',
    contact: 'Contacto',
    contactText:
      'Esta versión local no tiene una dirección de soporte pública. Contacta a quien te proporcionó la aplicación.',
    cleared: 'Formularios y preferencias eliminados.',
  },
  ja: {
    title: '書類も、選択も、あなたのもの。',
    intro: 'FormLilt における情報の取り扱い。',
    storage: 'この端末での保存',
    storageText:
      '元のファイルは IndexedDB に、質問・回答・署名は localStorage に保存されます。削除操作を行うか、ブラウザーがデータを削除するまで残ります。このブラウザープロファイルにアクセスできる人は内容を読める可能性があります。',
    server: '処理中の情報',
    serverText:
      'FormLilt はファイルと回答をリクエストのメモリー内で処理し、アカウントや書類用データベースを設けません。項目の抽出ではページを、翻訳では関連する回答を、設定されたモデルサービスに送信します。その事業者の保存方針が適用されます。ローカルの agent-im はアプリ外にセッションや画像を保存する場合があります。',
    voice: '音声と署名',
    voiceText:
      '音声入力と読み上げにはブラウザーの音声サービスを使います。FormLilt は録音を送信・保存しませんが、ブラウザーや OS が外部の音声サービスを使う場合があります。署名は入力した氏名とともに PNG 画像として保存されます。',
    usage: '利用状況の計測',
    usageText:
      'Vercel Analytics を有効にすると、ページ閲覧とイベント名を送信します。書類名・ファイル名・回答・署名・検索パラメーター・セッション ID は除外します。利用回数は IP のハッシュを Redis に記録して制限し、書類内容は保存しません。',
    model: 'モデルサービス',
    source: 'オープンソース',
    sourceText:
      'アプリは MIT ライセンスです。デモ書類と Noto フォントにはそれぞれの出典・ライセンスがあります。',
    contact: 'お問い合わせ',
    contactText:
      'このローカル版には公開サポート窓口が設定されていません。アプリを共有した方にお問い合わせください。',
    cleared: '保存した書類と設定を削除しました。',
  },
};
export function About({ provider, model }: { provider: string; model: string }) {
  const { language } = useLanguage();
  const text = copy[language];
  const [cleared, setCleared] = useState(false);
  const contact = process.env.NEXT_PUBLIC_CONTACT_URL;
  return (
    <div className="shell about-shell">
      <Header />
      <main id="main">
        <div className="review-heading">
          <p className="eyebrow">{t(language, 'privacy')}</p>
          <h1>{text.title}</h1>
          <p className="muted">{text.intro}</p>
        </div>
        <div className="panel about-copy">
          {[
            ['storage', 'storageText'],
            ['server', 'serverText'],
            ['voice', 'voiceText'],
            ['usage', 'usageText'],
          ].map(([heading, body]) => (
            <section key={heading}>
              <h2>{text[heading as keyof typeof text]}</h2>
              <p>{text[body as keyof typeof text]}</p>
            </section>
          ))}
          <section>
            <h2>{text.model}</h2>
            <p>
              {provider} · {model}
            </p>
            <p className="small muted">Built with GPT-6 Astra · Runtime model shown above.</p>
          </section>
          <section>
            <h2>{text.source}</h2>
            <p>{text.sourceText}</p>
            <a href="/LICENSE.txt">MIT License</a> ·{' '}
            <a href="/demo-forms/README.md">Demo sources</a> ·{' '}
            <a href="/fonts/README.md">Font licenses</a>
          </section>
          <section>
            <h2>{text.contact}</h2>
            {contact && /^https:\/\//.test(contact) ? (
              <a href={contact} rel="noreferrer">
                {text.contact}
              </a>
            ) : (
              <p>{text.contactText}</p>
            )}
          </section>
          <button
            className="button secondary"
            onClick={() => void clearAllSessions().then(() => setCleared(true))}
          >
            {t(language, 'clearAll')}
          </button>
          {cleared && <p role="status">{text.cleared}</p>}
          <p>
            <Link href="/">{t(language, 'home')} →</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
