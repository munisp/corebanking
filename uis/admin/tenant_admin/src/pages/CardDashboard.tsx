import { Check, ChevronsUpDown, CreditCard } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import { cn } from "../lib/utils";
import apiClient from "../services/api";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  keycloakId?: string;
}

const CardDashboard: React.FC = () => {
  const { primaryColor } = useTenantBranding();

  // Step management
  const [currentStep, setCurrentStep] = useState(1);

  // Users list
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [customerComboOpen, setCustomerComboOpen] = useState(false);

  // Issue Card State (Step 1)
  const [customerId, setCustomerId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [cardType, setCardType] = useState("debit");
  const [nameOnCard, setNameOnCard] = useState("");
  const [issueLoading, setIssueLoading] = useState(false);

  // Issued card data
  const [issuedCard, setIssuedCard] = useState<{
    card_id: string;
    card_number: string;
    expiry_date: string;
  } | null>(null);

  // Set PIN State (Step 2)
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  // Fetch users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true);
      try {
        const response = await apiClient.get("/user/user/tenant");
        const data = response.data;

        // Handle different response structures
        let usersData: any[] = [];
        if (Array.isArray(data)) {
          usersData = data;
        } else if (Array.isArray(data.users)) {
          usersData = data.users;
        } else if (Array.isArray(data.data)) {
          usersData = data.data;
        }

        // Map users
        const mappedUsers: User[] = usersData.map((user: any) => ({
          id: user.id || user.user_id,
          name:
            user.name ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            "Unknown User",
          email: user.email || "",
          phone: user.phone_number || user.phone || "",
          keycloakId: user.keycloak_id || user.keycloakId || user.id,
        }));

        setUsers(mappedUsers);
      } catch (error: any) {
        console.error("Error fetching users:", error);
        toast.error("Failed to load users");
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleIssueCard = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!customerId.trim()) {
      toast.error("Please select a customer");
      return;
    }

    if (!accountId.trim()) {
      toast.error("Account ID is required");
      return;
    }

    if (!nameOnCard.trim()) {
      toast.error("Name on card is required");
      return;
    }

    if (nameOnCard.length > 50) {
      toast.error("Name on card must be 50 characters or less");
      return;
    }

    setIssueLoading(true);

    try {
      const response = await apiClient.post("/card/api/v1/cards/issue", {
        customer_id: customerId.trim(),
        account_id: accountId.trim(),
        card_type: cardType,
        name_on_card: nameOnCard.trim(),
      });

      const cardData = response.data;

      // Store issued card data
      setIssuedCard({
        card_id: cardData?.card_id || "",
        card_number: cardData?.card_number || "",
        expiry_date: cardData?.expiry_date || "",
      });

      toast.success("Card issued successfully! Please set a PIN.");

      // Move to step 2
      setCurrentStep(2);
    } catch (error: any) {
      console.error("Card issuance error:", error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to issue card";
      toast.error(errorMessage);
    } finally {
      setIssueLoading(false);
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!pin || pin.length < 4 || pin.length > 8) {
      toast.error("PIN must be between 4 and 8 characters");
      return;
    }

    if (!/^\d+$/.test(pin)) {
      toast.error("PIN must contain only numbers");
      return;
    }

    if (pin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }

    if (!issuedCard?.card_id) {
      toast.error("No card ID available");
      return;
    }

    setPinLoading(true);

    try {
      await apiClient.post(`/card/api/v1/cards/${issuedCard.card_id}/set-pin`, {
        pin: pin,
      });

      toast.success("Card PIN set successfully!");

      // Move to step 3 (completion)
      setCurrentStep(3);
    } catch (error: any) {
      console.error("Set PIN error:", error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to set card PIN";
      toast.error(errorMessage);
    } finally {
      setPinLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setCustomerId("");
    setAccountId("");
    setCardType("debit");
    setNameOnCard("");
    setIssuedCard(null);
    setPin("");
    setConfirmPin("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Card Management"
          title="Card Creation Wizard"
          description="Issue a new card and set up security in simple steps"
          icon={<CreditCard className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8">
        <div className="max-w-3xl mx-auto">
          {/* Step Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {[
                { num: 1, label: "Card Details" },
                { num: 2, label: "Set PIN" },
                { num: 3, label: "Complete" },
              ].map((step, idx) => (
                <React.Fragment key={step.num}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all ${
                        currentStep >= step.num
                          ? "text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                      style={{
                        backgroundColor:
                          currentStep >= step.num ? primaryColor : undefined,
                      }}
                    >
                      {currentStep > step.num ? (
                        <Check className="w-6 h-6" />
                      ) : (
                        step.num
                      )}
                    </div>
                    <span className="text-sm mt-2 font-medium">
                      {step.label}
                    </span>
                  </div>
                  {idx < 2 && (
                    <div
                      className={`flex-1 h-1 mx-4 rounded transition-all ${
                        currentStep <= step.num ? "bg-muted" : ""
                      }`}
                      style={{
                        backgroundColor:
                          currentStep > step.num ? primaryColor : undefined,
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step 1: Card Details */}
          {currentStep === 1 && (
            <Card>
              <form onSubmit={handleIssueCard} autoComplete="off">
                <CardHeader>
                  <CardTitle>Step 1: Card Details</CardTitle>
                  <CardDescription>
                    Enter the account details and cardholder information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerId">Customer *</Label>
                    <Popover
                      open={customerComboOpen}
                      onOpenChange={setCustomerComboOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={customerComboOpen}
                          className="w-full justify-between"
                          disabled={usersLoading}
                        >
                          {customerId
                            ? users.find(
                                (user) =>
                                  (user.keycloakId || user.id) === customerId,
                              )?.name
                            : usersLoading
                              ? "Loading users..."
                              : "Select customer"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search customers..." />
                          <CommandList>
                            <CommandEmpty>No customer found.</CommandEmpty>
                            <CommandGroup>
                              {users.map((user) => (
                                <CommandItem
                                  key={user.keycloakId || user.id}
                                  value={`${user.name} ${user.email}`}
                                  onSelect={() => {
                                    const userId = user.keycloakId || user.id;
                                    setCustomerId(userId);
                                    setCustomerComboOpen(false);
                                    // Auto-fill name from selected user
                                    if (!nameOnCard) {
                                      setNameOnCard(user.name);
                                    }
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      customerId ===
                                        (user.keycloakId || user.id)
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {user.name}
                                    </span>
                                    {user.email && (
                                      <span className="text-xs text-muted-foreground">
                                        {user.email}
                                      </span>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Select the customer for whom the card will be issued
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountId">Account ID *</Label>
                    <Input
                      id="accountId"
                      type="text"
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      required
                      placeholder="Enter account ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cardType">Card Type *</Label>
                    <Select value={cardType} onValueChange={setCardType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debit">Debit Card</SelectItem>
                        <SelectItem value="credit">Credit Card</SelectItem>
                        <SelectItem value="virtual">Virtual Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nameOnCard">Name on Card *</Label>
                    <Input
                      id="nameOnCard"
                      type="text"
                      value={nameOnCard}
                      onChange={(e) => setNameOnCard(e.target.value)}
                      required
                      maxLength={50}
                      placeholder="Enter cardholder name (max 50 characters)"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    className="w-full text-white"
                    disabled={issueLoading}
                    style={{
                      backgroundColor: issueLoading ? undefined : primaryColor,
                    }}
                  >
                    {issueLoading
                      ? "Creating Card..."
                      : "Continue to PIN Setup"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}

          {/* Step 2: Set PIN */}
          {currentStep === 2 && issuedCard && (
            <Card>
              <form onSubmit={handleSetPin} autoComplete="off">
                <CardHeader>
                  <CardTitle>Step 2: Set Card PIN</CardTitle>
                  <CardDescription>
                    Create a secure PIN for your new card
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <p className="text-sm font-medium">Card Details:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Card ID:</span>
                      <span className="font-mono">{issuedCard.card_id}</span>
                      <span className="text-muted-foreground">
                        Card Number:
                      </span>
                      <span className="font-mono">
                        {issuedCard.card_number}
                      </span>
                      <span className="text-muted-foreground">
                        Expiry Date:
                      </span>
                      <span className="font-mono">
                        {issuedCard.expiry_date}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pin">New PIN * (4-8 digits)</Label>
                    <Input
                      id="pin"
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      required
                      minLength={4}
                      maxLength={8}
                      pattern="[0-9]{4,8}"
                      placeholder="Enter 4-8 digit PIN"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPin">Confirm PIN *</Label>
                    <Input
                      id="confirmPin"
                      type="password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      required
                      minLength={4}
                      maxLength={8}
                      pattern="[0-9]{4,8}"
                      placeholder="Re-enter PIN to confirm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PIN must be 4-8 digits only. Make sure to remember this PIN
                    for card transactions.
                  </p>
                </CardContent>
                <CardFooter className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 text-white"
                    disabled={pinLoading}
                    style={{
                      backgroundColor: pinLoading ? undefined : primaryColor,
                    }}
                  >
                    {pinLoading ? "Setting PIN..." : "Set PIN & Complete"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}

          {/* Step 3: Completion */}
          {currentStep === 3 && issuedCard && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="w-6 h-6 text-green-500" />
                  Card Created Successfully!
                </CardTitle>
                <CardDescription>
                  Your card has been issued and is ready to use
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border-2 border-primary/20">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Card ID</p>
                      <p className="text-xl font-bold font-mono">
                        {issuedCard.card_id}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Card Number
                      </p>
                      <p className="text-2xl font-bold font-mono tracking-wider">
                        {issuedCard.card_number}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Expiry Date
                        </p>
                        <p className="text-lg font-semibold font-mono">
                          {issuedCard.expiry_date}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Card Type
                        </p>
                        <p className="text-lg font-semibold capitalize">
                          {cardType}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Cardholder Name
                      </p>
                      <p className="text-lg font-semibold">{nameOnCard}</p>
                    </div>
                  </div>
                </div>
                <div
                  className="p-4 rounded-lg border-2"
                  style={{
                    backgroundColor: `${primaryColor}15`,
                    borderColor: `${primaryColor}40`,
                  }}
                >
                  <p className="text-sm font-medium">
                    <strong>Important:</strong> Please save these card details
                    securely. The PIN you set will be required for all card
                    transactions.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleReset}
                  className="w-full text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Create Another Card
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardDashboard;
