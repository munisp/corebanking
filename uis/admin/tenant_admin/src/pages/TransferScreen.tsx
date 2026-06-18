import { ArrowLeftRight } from "lucide-react";
import React, { useState } from "react";
import TransferApplicationForm from "../components/forms/TransferApplicationForm";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import PageHeader from "../components/PageHeader";

const TransferScreen: React.FC = () => {
  const [showForm] = useState(true);
  const { primaryColor } = useTenantBranding();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Fund Transfer"
          title="Transfer Funds"
          description="Transfer funds between accounts"
          icon={<ArrowLeftRight className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8">
        <TransferApplicationForm
          open={showForm}
          onOpenChange={() => {}}
          onSuccess={() => {
            console.log("Transfer successful");
          }}
          standalone={true}
        />
      </div>
    </div>
  );
};

export default TransferScreen;
