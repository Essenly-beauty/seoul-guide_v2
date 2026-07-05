"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/routes";

export function SignoutModal() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button className="btn danger" onClick={() => setOpen(true)}>Sign Out</button>
      {open && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="box">
            <h3 className="h3">Sign out of Essenly?</h3>
            <p className="muted small">You&apos;ll need to sign in again to access your profile and favorites.</p>
            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn danger" style={{ flex: 1 }} onClick={() => router.push(routes.splash)}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
