import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

interface VerificationUrlModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verificationUrl: string;
  email: string;
}

export function VerificationUrlModal({
  open,
  onOpenChange,
  verificationUrl,
  email,
}: VerificationUrlModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleOpenUrl = () => {
    window.open(verificationUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-150">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <DialogTitle>Admin Created Successfully</DialogTitle>
              <DialogDescription>
                Verification URL has been generated for {email}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="verification-url">KYC Verification URL</Label>
            <div className="flex gap-2">
              <Input
                id="verification-url"
                value={verificationUrl}
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title={copied ? "Copied!" : "Copy URL"}
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleOpenUrl}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Send this URL to the admin to complete their KYC verification
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <h4 className="mb-2 text-sm font-medium text-blue-900 dark:text-blue-100">
              Next Steps
            </h4>
            <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <li>• Share the verification URL with the admin via email or secure channel</li>
              <li>• The admin will use this URL to complete their KYC verification</li>
              <li>• Once verified, the admin can access their account</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
