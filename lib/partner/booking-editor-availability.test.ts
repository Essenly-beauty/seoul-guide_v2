import { describe, expect, it } from "vitest";
import { editorAvailabilityUrl } from "@/components/partner/partner-booking-editor";

// 2026-10-21 버튼 점검: '시간 변경' 창에서 담당자를 비우면 담당자 없이 가능 시간을 조회해 409(BOOKING_UNAVAILABLE)를 받고
// "예약 시간을 조회하지 못했습니다"를 보였다. 담당자가 필요한데 비어 있으면 조회하지 않는다.
const base = { placeId: "studio", serviceId: "svc", date: "2026-10-24" };

describe("booking editor availability lookup", () => {
  it("does not look up reschedule slots until a required staff member is chosen", () => {
    expect(editorAvailabilityUrl({ ...base, bookingId: "b1", staffId: "", needsStaff: true })).toBeNull();
    expect(editorAvailabilityUrl({ ...base, bookingId: "b1", staffId: "s1", needsStaff: true })).toBe("/api/partner/operations/bookings/b1/availability?date=2026-10-24&staffId=s1");
  });

  it("looks up a store-mode reschedule without a staff member", () => {
    expect(editorAvailabilityUrl({ ...base, bookingId: "b1", staffId: "", needsStaff: false })).toBe("/api/partner/operations/bookings/b1/availability?date=2026-10-24");
  });

  it("keeps the new-booking rules: a service is required, and a staff member in staff mode", () => {
    expect(editorAvailabilityUrl({ ...base, serviceId: "", staffId: "s1", needsStaff: true })).toBeNull();
    expect(editorAvailabilityUrl({ ...base, staffId: "", needsStaff: true })).toBeNull();
    expect(editorAvailabilityUrl({ ...base, staffId: "s1", needsStaff: true })).toBe("/api/places/studio/availability?serviceId=svc&date=2026-10-24&staffId=s1");
    expect(editorAvailabilityUrl({ ...base, staffId: "", needsStaff: false })).toBe("/api/places/studio/availability?serviceId=svc&date=2026-10-24");
  });
});
