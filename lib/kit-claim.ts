export type KitClaimMethod = "hotel" | "cafe";

export type KitClaimValues = {
  email: string;
  via: KitClaimMethod;
  address: string;
};

export type KitClaimErrors = Partial<Record<"email" | "address", string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateKitClaim({ email, via, address }: KitClaimValues): KitClaimErrors {
  const errors: KitClaimErrors = {};

  if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (via === "hotel" && !address.trim()) {
    errors.address = "Enter your Seoul accommodation name and address.";
  }

  return errors;
}
