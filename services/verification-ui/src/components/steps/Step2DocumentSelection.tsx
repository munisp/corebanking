/**
 * Step 2: Document Selection
 * Select which verification document to use
 */

import { useMemo } from "react";
import type { DocumentRequirement, DocumentType } from "../../types/verification";
import "./Step2DocumentSelection.css";

interface Step2DocumentSelectionProps {
  documentRequirements: DocumentRequirement[];
  selectedDocumentType: DocumentType | null;
  onSelectDocument: (documentType: DocumentType) => void;
  loading: boolean;
  country: string;
}

export function Step2DocumentSelection({
  documentRequirements,
  selectedDocumentType,
  onSelectDocument,
  loading,
  country,
}: Step2DocumentSelectionProps) {
  const recommendedDoc = useMemo(
    () => documentRequirements.find((d) => d.recommended),
    [documentRequirements],
  );

  const handleSelectDocument = (docType: DocumentType) => {
    onSelectDocument(docType);
  };

  return (
    <div className="step2-container">
      <div className="step2-header">
        <h1>Select Document Type</h1>
        <p className="step2-subtitle">
          Choose which document you'd like to use for verification in {country}
        </p>
      </div>

      {loading ? (
        <div className="step2-loading">
          <div className="step2-spinner"></div>
          <p>Loading available documents...</p>
        </div>
      ) : documentRequirements.length === 0 ? (
        <div className="step2-empty-state">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M9 12h6m-6 4h6M10 5a1 1 0 011-1h2a1 1 0 011 1v2H10V5z"></path>
            <path d="M4 7h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"></path>
          </svg>
          <p>No documents available for this country</p>
        </div>
      ) : (
        <>
          {/* Recommended Document */}
          {recommendedDoc && (
            <div className="step2-recommended-section">
              <div className="step2-section-label">
                <span className="step2-recommended-badge">Recommended</span>
              </div>
              <DocumentCard
                requirement={recommendedDoc}
                selected={selectedDocumentType === recommendedDoc.type}
                onSelect={() => handleSelectDocument(recommendedDoc.type)}
                isRecommended={true}
              />
            </div>
          )}

          {/* All Documents */}
          <div className="step2-all-documents-section">
            {documentRequirements.length > 1 && (
              <div className="step2-section-label">Other Documents</div>
            )}
            <div className="step2-documents-grid">
              {documentRequirements.map((doc) => (
                <DocumentCard
                  key={doc.type}
                  requirement={doc}
                  selected={selectedDocumentType === doc.type}
                  onSelect={() => handleSelectDocument(doc.type)}
                />
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="step2-info-box">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <path
                d="M12 7v5m0 4v.01"
                stroke="white"
                strokeWidth="2"
                fill="none"
              ></path>
            </svg>
            <p>
              Make sure your document is clear, well-lit, and not expired for best results
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Document Card Component
 */
function DocumentCard({
  requirement,
  selected,
  onSelect,
  isRecommended = false,
}: {
  requirement: DocumentRequirement;
  selected: boolean;
  onSelect: () => void;
  isRecommended?: boolean;
}) {
  const getDocumentIcon = (type: string) => {
    const icons: Record<string, string> = {
      NATIONAL_ID: "🪪",
      PASSPORT: "📕",
      DRIVERS_LICENSE: "🚗",
      VOTER_CARD: "🗳️",
      RESIDENCE_PERMIT: "🏠",
      BVN: "🔐",
      NIN: "🔐",
      CAC: "🏢",
      OTHER: "📄",
    };
    return icons[type] || "📄";
  };

  const getSideText = (sides: string) => {
    if (sides === "both") return "Front & Back";
    if (sides === "front") return "Front Only";
    return "Back Only";
  };

  return (
    <button
      className={`document-card ${selected ? "selected" : ""} ${isRecommended ? "recommended" : ""}`}
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      aria-label={`Select ${requirement.name}`}
    >
      {isRecommended && (
        <div className="document-badge-top">
          <span className="badge">✓ Recommended</span>
        </div>
      )}

      <div className="document-icon-container">
        <span className="document-icon">{getDocumentIcon(requirement.type)}</span>
      </div>

      <h3 className="document-name">{requirement.name}</h3>

      <p className="document-description">{requirement.description}</p>

      <div className="document-specs">
        <div className="spec-item">
          <span className="spec-label">Sides:</span>
          <span className="spec-value">{getSideText(requirement.requiredSides)}</span>
        </div>
        {requirement.ocrCapable && (
          <div className="spec-item">
            <span className="spec-label">OCR:</span>
            <span className="spec-value ocr-capable">✓ Automatic</span>
          </div>
        )}
      </div>

      {selected && (
        <div className="document-checkmark">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
          </svg>
        </div>
      )}
    </button>
  );
}
