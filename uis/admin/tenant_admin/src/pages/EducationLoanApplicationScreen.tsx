import React, { useState } from 'react';
import EducationLoanApplicationForm from '../components/forms/EducationLoanApplicationForm';
import { GraduationCap } from 'lucide-react';
import { useTenantBranding } from '../contexts/TenantBrandingContext';

const EducationLoanApplicationScreen: React.FC = () => {
  const [showForm] = useState(true);
  const { primaryColor } = useTenantBranding();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8" style={{ color: primaryColor }} />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Education Loan Application
              </h1>
              <p className="text-muted-foreground mt-1">
                Submit a new education loan application
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <EducationLoanApplicationForm
          open={showForm}
          onOpenChange={() => {}}
          onSuccess={() => {
            // Could redirect or show success message
            window.location.href = '/';
          }}
          standalone={true}
        />
      </div>
    </div>
  );
};

export default EducationLoanApplicationScreen;
