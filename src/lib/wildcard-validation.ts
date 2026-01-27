const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateWildcardContent(content: string): ValidationResult {
  // Check size
  const sizeInBytes = new Blob([content]).size;
  if (sizeInBytes > MAX_SIZE_BYTES) {
    const sizeMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Content too large (${sizeMB}MB). Maximum size is 10MB.`,
    };
  }

  // Check for null bytes
  if (content.includes("\0")) {
    return {
      valid: false,
      error: "Content contains null bytes (\\0) which are not allowed.",
    };
  }

  // Check for other problematic invisible characters
  // Allow: spaces, tabs, newlines, carriage returns
  // Block: other control characters (0x00-0x1F except 0x09, 0x0A, 0x0D)
  // eslint-disable-next-line
  const problematicChars = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
  if (problematicChars.test(content)) {
    return {
      valid: false,
      error: "Content contains invalid control characters.",
    };
  }

  return { valid: true };
}
