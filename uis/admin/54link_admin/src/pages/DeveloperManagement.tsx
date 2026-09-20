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
import { useEffect, useState } from "react";

interface Developer {
  name: string;
  // Add other properties as needed
}

interface SuspendDeveloperRequest {
  reason: string;
  suspend_apps: boolean;
}

interface ReactivateDeveloperRequest {
  reason: string;
  reactivate_apps: boolean;
}

interface SuspendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  developer: Developer | null;
  onConfirm: (data: SuspendDeveloperRequest) => void;
}

interface ReactivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  developer: Developer | null;
  onConfirm: (data: ReactivateDeveloperRequest) => void;
}

// ST-06: mock developer roster removed — "Jane Doe" was hardcoded fiction.
// No live developer-directory API exists yet; the list starts empty and the
// page says so instead of showing fabricated people.
export function DeveloperManagement() {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  // ...existing code...
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [reactivateDialog, setReactivateDialog] = useState(false);
  const [selectedDeveloper, setSelectedDeveloper] = useState<Developer | null>(
    null,
  );

  // ST-06: no real developer-directory API exists; nothing is loaded.
  useEffect(() => {
    setDevelopers([]);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Developer Management</h1>
      {/* Removed error display as error is not declared */}
      {developers.length === 0 && (
        <p className="text-muted-foreground">
          No developers to display — the live developer directory is not yet
          available. Previously shown entries were hardcoded sample data and
          have been removed (ST-06).
        </p>
      )}
      <div>
        <ul>
          {developers.map((dev) => (
            <li key={dev.name} className="flex items-center gap-4">
              <span>{dev.name}</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setSelectedDeveloper(dev);
                  setSuspendDialog(true);
                }}
              >
                Suspend
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedDeveloper(dev);
                  setReactivateDialog(true);
                }}
              >
                Reactivate
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <SuspendDialog
        open={suspendDialog}
        onOpenChange={setSuspendDialog}
        developer={selectedDeveloper}
        onConfirm={() => setSuspendDialog(false)}
      />
      <ReactivateDialog
        open={reactivateDialog}
        onOpenChange={setReactivateDialog}
        developer={selectedDeveloper}
        onConfirm={() => setReactivateDialog(false)}
      />
    </div>
  );
}

function SuspendDialog({
  open,
  onOpenChange,
  developer,
  onConfirm,
}: SuspendDialogProps) {
  const [reason, setReason] = useState("");
  const [suspendApps, setSuspendApps] = useState(true);

  const handleSubmit = () => {
    onConfirm({
      reason,
      suspend_apps: suspendApps,
    });
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend Developer Account</DialogTitle>
          <DialogDescription>
            Suspend {developer?.name}'s account and restrict access.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="reason">Reason *</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Policy violation, security concern"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="suspendApps"
              checked={suspendApps}
              onChange={(e) => setSuspendApps(e.target.checked)}
            />
            <Label htmlFor="suspendApps">Also suspend all apps</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!reason}
          >
            Suspend Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReactivateDialog({
  open,
  onOpenChange,
  developer,
  onConfirm,
}: ReactivateDialogProps) {
  const [reason, setReason] = useState("");
  const [reactivateApps, setReactivateApps] = useState(true);

  const handleSubmit = () => {
    onConfirm({
      reason,
      reactivate_apps: reactivateApps,
    });
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reactivate Developer Account</DialogTitle>
          <DialogDescription>
            Reactivate {developer?.name}'s account and restore access.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="reason">Reason *</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Issue resolved, terms accepted"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="reactivateApps"
              checked={reactivateApps}
              onChange={(e) => setReactivateApps(e.target.checked)}
            />
            <Label htmlFor="reactivateApps">Also reactivate all apps</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!reason}>
            Reactivate Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
