import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { tellerService, tillService } from "@/services/tellerService";
import type { Teller } from "@/types/teller";
import { Plus, UserCheck, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Window {
  window_number: number;
  teller_id?: string;
  teller_name?: string;
  till_id?: string;
  status: string;
  assigned_at?: string;
}

interface WindowManagementProps {
  onRefresh?: () => void;
}

export default function WindowManagement({ onRefresh }: WindowManagementProps) {
  const [windows, setWindows] = useState<Window[]>([]);
  const [tellers, setTellers] = useState<Teller[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [createWindowOpen, setCreateWindowOpen] = useState(false);
  const [assignTellerOpen, setAssignTellerOpen] = useState(false);
  const [selectedWindow, setSelectedWindow] = useState<Window | null>(null);

  // Form states
  const [newWindowNumber, setNewWindowNumber] = useState("");
  const [selectedTellerId, setSelectedTellerId] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const tellersData = await tellerService.listTellers();
      const tillsData = await tillService.listTills();

      setTellers(tellersData);

      // Build windows list from tellers and tills
      const windowsMap = new Map<string, Window>();

      // Add windows from tellers
      tellersData.forEach((teller) => {
        if (teller.window_number) {
          windowsMap.set(String(teller.window_number), {
            window_number: Number(teller.window_number),
            teller_id: teller.id,
            teller_name: `${teller.first_name} ${teller.last_name}`,
            till_id: teller.assigned_till_id,
            status: teller.status,
            assigned_at: teller.updated_at,
          });
        }
      });

      // Add windows from tills that don't have tellers
      tillsData.forEach((till) => {
        if (till.window_number && !windowsMap.has(String(till.window_number))) {
          windowsMap.set(String(till.window_number), {
            window_number: Number(till.window_number),
            till_id: till.till_id,
            status: "unassigned",
          });
        }
      });

      setWindows(
        Array.from(windowsMap.values()).sort(
          (a, b) => a.window_number - b.window_number,
        ),
      );
    } catch (error) {
      console.error("Error fetching window data:", error);
      toast.error("Failed to load window data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWindow = async () => {
    if (!newWindowNumber) {
      toast.error("Please enter a window number");
      return;
    }

    const windowNum = parseInt(newWindowNumber);
    if (windows.find((w) => w.window_number === windowNum)) {
      toast.error("Window number already exists");
      return;
    }

    try {
      // Create a till for this window
          await tillService.createTill({
        window_number: windowNum,
      });

      toast.success(`Window ${windowNum} created successfully`);
      setCreateWindowOpen(false);
      setNewWindowNumber("");
      fetchData();
      onRefresh?.();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to create window");
    }
  };

  const handleAssignTeller = async () => {
    if (!selectedTellerId) {
      toast.error("Please select a teller");
      return;
    }

    if (!selectedWindow) {
      toast.error("No window selected");
      return;
    }

    try {
      // Update teller with window and till assignment
      await tellerService.updateTellerAssignment(
        selectedTellerId,
        selectedWindow.window_number,
        selectedWindow.till_id || null,
      );

      // Also update status to active
      await tellerService.updateTellerStatus(selectedTellerId, "active");

      toast.success("Teller assigned successfully");
      setAssignTellerOpen(false);
      setSelectedTellerId("");
      setSelectedWindow(null);
      fetchData();
      onRefresh?.();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to assign teller");
    }
  };

  const handleUnassignTeller = async (window: Window) => {
    if (!window.teller_id) return;

    try {
      // Clear window and till assignment
      await tellerService.updateTellerAssignment(window.teller_id, null, null);

      // Update status to inactive
      await tellerService.updateTellerStatus(window.teller_id, "inactive");

      toast.success("Teller unassigned successfully");
      fetchData();
      onRefresh?.();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to unassign teller");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "inactive":
      case "unassigned":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
      case "on_break":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "suspended":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  const availableTellers = tellers.filter(
    (t) => !t.window_number || t.status === "inactive",
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Window Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage teller windows and assignments
          </p>
        </div>
        <Button onClick={() => setCreateWindowOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Window
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {windows.map((window) => (
          <Card key={window.window_number}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Window {window.window_number}
                </CardTitle>
                <Badge className={getStatusColor(window.status)}>
                  {window.status}
                </Badge>
              </div>
              <CardDescription>
                {window.teller_name || "No teller assigned"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Teller:</span>
                  <span className="font-medium">
                    {window.teller_name || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Till:</span>
                  <span className="font-medium">
                    {window.till_id ? `Till ${window.till_id.slice(-4)}` : "—"}
                  </span>
                </div>
                {window.assigned_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Since:</span>
                    <span className="font-medium">
                      {new Date(window.assigned_at).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {window.teller_id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleUnassignTeller(window)}
                  >
                    <UserX className="mr-1 h-3 w-3" />
                    Unassign
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setSelectedWindow(window);
                      setAssignTellerOpen(true);
                    }}
                  >
                    <UserCheck className="mr-1 h-3 w-3" />
                    Assign Teller
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {windows.length === 0 && !loading && (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              No windows configured. Click "Add Window" to create one.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Window Dialog */}
      <Dialog open={createWindowOpen} onOpenChange={setCreateWindowOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Window</DialogTitle>
            <DialogDescription>
              Add a new teller window to your branch
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="window_number">Window Number *</Label>
              <Input
                id="window_number"
                type="number"
                min="1"
                value={newWindowNumber}
                onChange={(e) => setNewWindowNumber(e.target.value)}
                placeholder="e.g., 1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateWindowOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateWindow}>Create Window</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Teller Dialog */}
      <Dialog open={assignTellerOpen} onOpenChange={setAssignTellerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assign Teller to Window {selectedWindow?.window_number}
            </DialogTitle>
            <DialogDescription>
              Select a teller to assign to this window
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="teller">Teller *</Label>
              <Select
                value={selectedTellerId}
                onValueChange={setSelectedTellerId}
              >
                <SelectTrigger id="teller">
                  <SelectValue placeholder="Select a teller" />
                </SelectTrigger>
                <SelectContent>
                  {availableTellers.map((teller) => (
                    <SelectItem key={teller.id} value={teller.id}>
                      {teller.first_name} {teller.last_name} -{" "}
                      {teller.employee_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableTellers.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  No available tellers. Register a new teller first.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignTellerOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAssignTeller} disabled={!selectedTellerId}>
              Assign Teller
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
