import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '@/components/language-provider';
export const metadata: Metadata = { title: 'FillFlow — Forms, one question at a time', description: 'Upload a form. Answer in your language. Sign and download your completed PDF.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><LanguageProvider>{children}</LanguageProvider></body></html>; }
