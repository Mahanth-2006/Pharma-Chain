import type { ReactNode } from "react";

/**
 * React-safe boundary for the app-wide text treatment.
 *
 * The previous implementation walked #root and replaced React-owned text nodes
 * with spans after commit. That caused React 19 to reconcile against nodes it
 * no longer owned, producing insertBefore/removeChild NotFoundErrors. Explicit
 * TextEffect instances remain available for animated copy; this boundary keeps
 * the app tree untouched and is intentionally render-only.
 */
export default function GlobalTextEffect({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
