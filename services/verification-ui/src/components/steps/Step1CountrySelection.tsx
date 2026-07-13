/**
 * Step 1: Country Selection
 * Modern searchable country selector with flags and popular countries
 */

import { useMemo, useState, useEffect } from "react";
import type { Country } from "../../types/verification";
import "./Step1CountrySelection.css";

interface Step1CountrySelectionProps {
  countries: Country[];
  selectedCountry: Country | null;
  loading: boolean;
  onSelectCountry: (country: Country) => void;
  onLoadCountries: () => void;
}

export function Step1CountrySelection({
  countries,
  selectedCountry,
  loading,
  onSelectCountry,
  onLoadCountries,
}: Step1CountrySelectionProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Load countries on mount
  useEffect(() => {
    if (countries.length === 0) {
      onLoadCountries();
    }
  }, []);

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) {
      return countries;
    }

    const query = searchQuery.toLowerCase();
    return countries.filter((country) =>
      country.name.toLowerCase().includes(query) ||
      country.code.toLowerCase().includes(query) ||
      country.region?.toLowerCase().includes(query),
    );
  }, [countries, searchQuery]);

  const popularCountries = useMemo(
    () => countries.filter((c) => c.popular),
    [countries],
  );

  const handleSelectCountry = (country: Country) => {
    onSelectCountry(country);
  };

  return (
    <div className="step1-container">
      <div className="step1-header">
        <h1>Verify Your Identity</h1>
        <p className="step1-subtitle">
          Start by selecting the country where your identity document was issued
        </p>
      </div>

      {/* Search Box */}
      <div className="step1-search-container">
        <input
          type="text"
          placeholder="Search countries by name or code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="step1-search-input"
          disabled={loading}
          aria-label="Search countries"
        />
        <svg
          className="step1-search-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
      </div>

      {/* Popular Countries (if no search) */}
      {!searchQuery.trim() && popularCountries.length > 0 && (
        <div className="step1-popular-section">
          <h3 className="step1-section-title">Popular Countries</h3>
          <div className="step1-countries-grid">
            {popularCountries.map((country) => (
              <CountryCard
                key={country.code}
                country={country}
                selected={selectedCountry?.code === country.code}
                onSelect={() => handleSelectCountry(country)}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Countries */}
      <div className="step1-all-countries-section">
        {searchQuery.trim() && (
          <h3 className="step1-section-title">
            Search Results ({filteredCountries.length})
          </h3>
        )}

        {loading ? (
          <div className="step1-loading">
            <div className="step1-spinner"></div>
            <p>Loading countries...</p>
          </div>
        ) : filteredCountries.length === 0 ? (
          <div className="step1-empty-state">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6m0 4v.01"></path>
            </svg>
            <p>No countries found</p>
            <button
              className="step1-clear-btn"
              onClick={() => setSearchQuery("")}
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="step1-countries-list">
            {filteredCountries.map((country) => (
              <CountryListItem
                key={country.code}
                country={country}
                selected={selectedCountry?.code === country.code}
                onSelect={() => handleSelectCountry(country)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Country Card Component (for grid view)
 */
function CountryCard({
  country,
  selected,
  onSelect,
}: {
  country: Country;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`country-card ${selected ? "selected" : ""}`}
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      aria-label={`Select ${country.name}`}
    >
      {country.flag && <span className="country-flag">{country.flag}</span>}
      <span className="country-name">{country.name}</span>
      <span className="country-code">{country.code}</span>
      {selected && (
        <svg
          className="check-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      )}
    </button>
  );
}

/**
 * Country List Item Component (for list view)
 */
function CountryListItem({
  country,
  selected,
  onSelect,
}: {
  country: Country;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`country-list-item ${selected ? "selected" : ""}`}
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      aria-label={`Select ${country.name}`}
    >
      <div className="country-list-content">
        {country.flag && <span className="country-flag-lg">{country.flag}</span>}
        <div className="country-info">
          <span className="country-name-lg">{country.name}</span>
          {country.region && (
            <span className="country-region">{country.region}</span>
          )}
        </div>
      </div>
      <span className="country-code-lg">{country.code}</span>
      {selected && (
        <svg
          className="check-icon-lg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
        </svg>
      )}
    </button>
  );
}
