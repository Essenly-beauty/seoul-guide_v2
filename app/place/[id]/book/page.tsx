import type { Metadata } from 'next';
import { BookingFlow } from '@/components/booking/booking-flow';
import { getPlace } from '@/lib/data';
import { readPublicPlaceProfile, readPublicPlaceMedia } from '@/lib/place-profile-server';
import { mergePublicPlaceProfile } from '@/lib/place-profile';
export const metadata: Metadata = { title: 'Book a visit | MYSEOULDROP', robots: { index: false, follow: false } };
export default async function BookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ service?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const isPreview = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_BOOKING_PREVIEW === '1' && id === 'myseouldrop-booking-studio';
  const source = getPlace(id);
  const [published, media] = await Promise.all([readPublicPlaceProfile(id), readPublicPlaceMedia(id)]);
  const place = source ? mergePublicPlaceProfile(source, published) : undefined;
  const venue = place ? { name: published.status === 'published' ? place.name : undefined, photoUrl: place.photos?.[0] ?? place.photoUrl, address: place.address, introduction: place.about || place.aboutKr, englishOk: published.status === 'published' ? place.englishOk : undefined, notice: place.publishedContact?.notice } : published.status === 'published' ? { name: published.profile.nameEn || published.profile.nameKo, address: published.profile.address, introduction: published.profile.introductionEn || published.profile.introductionKo, englishOk: published.profile.englishOk, notice: published.profile.notice } : undefined;
  return <BookingFlow initialMedia={media} venue={venue} isPreview={isPreview} placeId={id} initialService={typeof query.service === 'string' ? query.service : ''} />;
}
