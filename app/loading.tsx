import { Skeleton, SkeletonLines, SkeletonList, SkeletonStatus } from "@/components/ui/skeleton";

// Route-level loading: the page's own shape (header, hero, text, rows) drawn
// as skeleton blocks — not the brand lockup (owner decision 2026-10-20: a logo
// splash hides what is coming; a skeleton shows it).
export default function Loading() {
  return (
    <SkeletonStatus label="Loading" className="skel-page">
      <div className="skel-page-bar">
        <Skeleton width={40} height={40} radius={20} />
        <Skeleton width="44%" height={16} radius={6} />
      </div>
      <Skeleton height={190} radius={16} />
      <SkeletonLines lines={3} widths={["70%", "92%", "52%"]} lineHeight={13} />
      <SkeletonList rows={3} />
    </SkeletonStatus>
  );
}
