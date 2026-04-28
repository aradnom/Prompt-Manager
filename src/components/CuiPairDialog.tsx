import { useState } from "react";
import { api } from "@/lib/api";
import { useUserEvent } from "@/contexts/UserEventsContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Map Node's os.platform()/process.platform values to names a normal human
// would recognize. Anything unknown falls through as-is.
const PLATFORM_NAMES: Record<string, string> = {
  Darwin: "macOS",
  darwin: "macOS",
  Linux: "Linux",
  linux: "Linux",
  Windows_NT: "Windows",
  Windows: "Windows",
  win32: "Windows",
  FreeBSD: "FreeBSD",
  freebsd: "FreeBSD",
  OpenBSD: "OpenBSD",
  openbsd: "OpenBSD",
  SunOS: "Solaris",
  sunos: "Solaris",
  AIX: "AIX",
  aix: "AIX",
};

interface ParsedFingerprint {
  app?: string;
  host?: string;
  platform?: string;
  apiKeyPrefix?: string;
}

/**
 * Fingerprint format is `<app> | host=<h> | platform=<p> | api=<prefix>`.
 * Unknown keys are ignored so the CUI side can add fields without breaking us.
 */
function parseFingerprint(fp: string): ParsedFingerprint {
  const parts = fp
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  const out: ParsedFingerprint = {};
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      if (!out.app) out.app = part;
      continue;
    }
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "host") out.host = value;
    else if (key === "platform") out.platform = value;
    else if (key === "api") out.apiKeyPrefix = value;
  }
  return out;
}

function prettyPlatform(raw: string | undefined): string {
  if (!raw) return "unknown";
  return PLATFORM_NAMES[raw] ?? raw;
}

interface Pending {
  requestId: string;
  fingerprint: string;
}

export function CuiPairDialog() {
  const [pending, setPending] = useState<Pending | null>(null);

  const denyMutation = api.integrations.denyPair.useMutation();
  const confirmMutation = api.integrations.confirmPair.useMutation();

  // If a second request arrives while one is already open, replace — simpler
  // than queuing, and in practice the user will only ever pair once per CUI
  // instance. Revisit if that turns out to be wrong.
  useUserEvent("cui-pair-request", (event) => {
    setPending({ requestId: event.requestId, fingerprint: event.fingerprint });
  });

  const parsed = pending ? parseFingerprint(pending.fingerprint) : null;

  const handleAllow = () => {
    if (pending) {
      confirmMutation.mutate({ requestId: pending.requestId });
    }
    setPending(null);
  };

  const handleDeny = () => {
    if (pending) {
      denyMutation.mutate({ requestId: pending.requestId });
    }
    setPending(null);
  };

  return (
    <Dialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) handleDeny();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pair with ComfyUI</DialogTitle>
          <DialogDescription>
            A ComfyUI instance is requesting your encryption key so it can read
            your prompts. Only allow this if you just started the pairing
            process yourself.
          </DialogDescription>
        </DialogHeader>

        {parsed && (
          <dl className="space-y-2 text-sm py-2">
            <div className="flex gap-3">
              <dt className="text-cyan-medium w-24 shrink-0">Host</dt>
              <dd className="font-mono break-all">
                {parsed.host ?? "unknown"}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-cyan-medium w-24 shrink-0">Platform</dt>
              <dd>{prettyPlatform(parsed.platform)}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-cyan-medium w-24 shrink-0">API key</dt>
              <dd className="font-mono">
                {parsed.apiKeyPrefix ? `${parsed.apiKeyPrefix}…` : "unknown"}
              </dd>
            </div>
          </dl>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleDeny}>
            Deny
          </Button>
          <Button onClick={handleAllow}>Allow</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
