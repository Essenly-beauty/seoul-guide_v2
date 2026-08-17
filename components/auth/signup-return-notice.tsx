"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthUser } from "@/lib/auth/use-auth";
import { useFavoritesReady } from "@/lib/favorites";
import { routes } from "@/lib/routes";
import { favoriteSavedMessage, takePendingFavoriteReturn } from "@/lib/signup-return";
import { useToast } from "@/components/ui/toast";

/** Shows the post-auth acknowledgement once the saved-place store is ready. */
export function SignupReturnNotice() {
  const pathname = usePathname();
  const { user, loading } = useAuthUser();
  const favoritesReady = useFavoritesReady();
  const { toast } = useToast();

  useEffect(() => {
    if (loading || !user || !favoritesReady || pathname === routes.onboardingBasics) return;
    const pending = takePendingFavoriteReturn();
    if (pending) toast(favoriteSavedMessage(pending.placeName), 3000);
  }, [favoritesReady, loading, pathname, toast, user]);

  return null;
}
