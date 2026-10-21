import { readJson, sameOrigin } from '@/lib/partner/http';
import { PartnerError } from '@/lib/partner/server';
import { BookingError } from './server';

const messages: Record<string, string> = {
  AUTH_REQUIRED: '로그인이 필요합니다.', INVALID_REQUEST: '예약 정보를 확인해 주세요.',
  PLACE_NOT_FOUND: '매장을 찾을 수 없습니다.', BOOKING_NOT_FOUND: '예약을 찾을 수 없습니다.',
  BOOKING_UNAVAILABLE: '현재 이 매장은 예약을 받을 수 없습니다.', SLOT_UNAVAILABLE: '선택한 시간은 예약할 수 없습니다. 다른 시간을 선택해 주세요.',
  STALE_SELECTION: '예약 정보가 변경되었습니다. 메뉴와 시간을 다시 선택해 주세요.',
  BOOKING_CONFLICT: '예약 상태가 변경되었습니다. 새로고침 후 다시 시도해 주세요.',
  PARTNER_FORBIDDEN: '이 예약을 관리할 권한이 없습니다.', PARTNER_READ_ONLY: '현재 매장 상태에서는 예약을 변경할 수 없습니다.',
  BOOKING_SERVICE_UNAVAILABLE: '예약 정보를 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  CUSTOMER_NOT_FOUND: '고객을 찾을 수 없습니다.',
  BOOKING_MESSAGES_UNAVAILABLE: '현재 이 예약에는 앱 메시지를 보낼 수 없습니다.',
  STAFF_NOT_FOUND: '담당자를 찾을 수 없습니다.', PROFILE_REVIEW_NOT_FOUND: '검수 요청을 찾을 수 없습니다.',
  MEDIA_INVALID: 'JPEG, PNG 또는 WebP 사진 파일을 선택해 주세요.', MEDIA_TOO_LARGE: '사진은 5MB 이하로 올려 주세요.',
  MEDIA_NOT_FOUND: '사진 또는 연결할 항목을 찾을 수 없습니다.', MEDIA_LIMIT_EXCEEDED: '매장 사진은 검수 대기를 포함해 최대 30장까지 올릴 수 있습니다.',
  MEDIA_UPLOAD_INCOMPLETE: '사진 업로드가 완료되지 않았습니다. 같은 파일로 다시 시도해 주세요.',
  INVALID_ORIGIN: '요청 출처를 확인할 수 없습니다.', UNSUPPORTED_MEDIA_TYPE: 'JSON 형식으로 요청해 주세요.',
  INVALID_JSON: '요청 내용을 확인해 주세요.', BODY_TOO_LARGE: '요청 크기가 너무 큽니다.', BODY_READ_FAILED: '요청을 읽을 수 없습니다. 다시 시도해 주세요.',
};
export function bookingJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
}
export function bookingFailure(error: unknown): Response {
  const known = (error instanceof BookingError || error instanceof PartnerError) && Object.hasOwn(messages, error.code)
    ? error : new BookingError(503, 'BOOKING_SERVICE_UNAVAILABLE');
  return bookingJson({ code: known.code, error: messages[known.code] }, known.status);
}
export function noBookingQuery(request: Request): void {
  if (new URL(request.url).searchParams.size !== 0) throw new BookingError(400, 'INVALID_REQUEST');
}
export async function bookingRequestBody(request: Request): Promise<unknown> {
  noBookingQuery(request);
  if (!sameOrigin(request)) throw new BookingError(403, 'INVALID_ORIGIN');
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new BookingError(415, 'UNSUPPORTED_MEDIA_TYPE');
  return readJson(request);
}
