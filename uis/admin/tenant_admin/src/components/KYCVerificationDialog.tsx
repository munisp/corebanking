import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, ExternalLink, ShieldAlert, UserCheck } from "lucide-react";
import { useState } from "react";

interface KYCVerificationDialogProps {
  open: boolean;
  kycUrl: string | null;
  onLogout: () => void;
}

export function KYCVerificationDialog({
  open,
  kycUrl,
  onLogout,
}: KYCVerificationDialogProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleKYCClick = () => {
    if (kycUrl) {
      setIsRedirecting(true);
      window.open(kycUrl, "_blank", "noopener,noreferrer");
      // Reset after a delay
      setTimeout(() => setIsRedirecting(false), 2000);
    }
  };

  return (
    <Dialog open={open} modal>
      <DialogContent className="sm:max-w-xl" showCloseButton={false}>
        {/* Header with Icon */}
        <div className="flex flex-col items-center text-center space-y-4 pt-6">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-linear-to-br from-amber-500 to-orange-500 shadow-lg">
              <ShieldAlert className="h-10 w-10 text-white" />
            </div>
          </div>
          
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-2xl font-bold">
              KYC Verification Required
            </DialogTitle>
            <DialogDescription className="text-base leading-relaxed">
              To ensure the security of our platform and comply with regulatory requirements,
              you need to complete your identity verification before accessing your account.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Information Cards */}
        <div className="grid gap-3 py-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
            <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Why KYC is Required
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                KYC (Know Your Customer) verification helps us protect your account and
                maintain a secure banking environment for all users.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-semibold text-green-900 dark:text-green-100">
                Quick & Simple Process
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300">
                The verification process only takes a few minutes. You'll need a valid
                government-issued ID and a clear photo.
              </p>
            </div>
          </div>

          {!kycUrl && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-1">
                <h4 className="text-sm font-semibold text-red-900 dark:text-red-100">
                  Verification Link Unavailable
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Your KYC verification link is not available. Please contact support
                  for assistance or try logging in again.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          {kycUrl ? (
            <>
              <Button
                variant="outline"
                onClick={onLogout}
                className="flex-1 sm:flex-initial"
              >
                Logout
              </Button>
              <Button
                onClick={handleKYCClick}
                disabled={isRedirecting}
                className="flex-1 bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
              >
                {isRedirecting ? (
                  <>Opening Verification Page...</>
                ) : (
                  <>
                    Complete Verification
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              onClick={onLogout}
              className="w-full"
            >
              Logout & Contact Support
            </Button>
          )}
        </DialogFooter>

        {kycUrl && (
          <p className="text-xs text-center text-muted-foreground pb-2">
            After completing verification, please log in again to access your account
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
