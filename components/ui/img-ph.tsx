import type { CSSProperties, ReactNode } from "react";

/** Photo placeholder — crossed box in the wireframe language. Children render centered (e.g. "+122"). */
export function ImgPh({ style, className, children }: {
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={["imgph", className].filter(Boolean).join(" ")} style={style} aria-hidden={children ? undefined : true}>
      {children}
    </div>
  );
}
