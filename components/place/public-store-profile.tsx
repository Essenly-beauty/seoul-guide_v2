'use client';
import { Mail, Phone } from 'lucide-react';
import { useLocale } from '@/lib/i18n/locale-provider';
import type { PublishedPlace } from '@/lib/place-profile';
import styles from './public-store-profile.module.css';

type Contact = PublishedPlace['publishedContact'];
export function PublicStoreNotice({ contact }: { contact?: Contact }) {
  const { t } = useLocale();
  return contact?.notice ? <aside className={styles.notice}><strong>{t('Venue notice')}</strong><p>{contact.notice}</p></aside> : null;
}
export function PublicStoreContact({ contact }: { contact?: Contact }) {
  const { t } = useLocale();
  if (!contact?.contactPhone && !contact?.contactEmail) return null;
  return <dl className={styles.contacts}>
    {contact.contactPhone && <div><dt><Phone aria-hidden="true" /><span>{t('Phone number')}</span></dt><dd><a href={`tel:${contact.contactPhone.replace(/[().\s-]/g, '')}`}>{contact.contactPhone}</a></dd></div>}
    {contact.contactEmail && <div><dt><Mail aria-hidden="true" /><span>{t('Email')}</span></dt><dd><a href={`mailto:${contact.contactEmail}`}>{contact.contactEmail}</a></dd></div>}
  </dl>;
}
