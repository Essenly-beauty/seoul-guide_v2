export function TopicTag({ children }: { children: string }) {
  const label = children.startsWith("#") ? children : `#${children}`;
  return <span className="topic-tag">{label}</span>;
}
