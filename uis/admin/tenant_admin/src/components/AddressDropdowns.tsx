import { useEffect, useState } from "react";

// Nigeria location data
const NIGERIA_STATES = [
  { code: "AB", name: "Abia" },
  { code: "AD", name: "Adamawa" },
  { code: "AK", name: "Akwa Ibom" },
  { code: "AN", name: "Anambra" },
  { code: "BA", name: "Bauchi" },
  { code: "BY", name: "Bayelsa" },
  { code: "BE", name: "Benue" },
  { code: "BO", name: "Borno" },
  { code: "CR", name: "Cross River" },
  { code: "DE", name: "Delta" },
  { code: "EB", name: "Ebonyi" },
  { code: "ED", name: "Edo" },
  { code: "EK", name: "Ekiti" },
  { code: "EN", name: "Enugu" },
  { code: "FC", name: "FCT - Abuja" },
  { code: "GO", name: "Gombe" },
  { code: "IM", name: "Imo" },
  { code: "JI", name: "Jigawa" },
  { code: "KD", name: "Kaduna" },
  { code: "KN", name: "Kano" },
  { code: "KT", name: "Katsina" },
  { code: "KE", name: "Kebbi" },
  { code: "KO", name: "Kogi" },
  { code: "KW", name: "Kwara" },
  { code: "LA", name: "Lagos" },
  { code: "NA", name: "Nasarawa" },
  { code: "NI", name: "Niger" },
  { code: "OG", name: "Ogun" },
  { code: "ON", name: "Ondo" },
  { code: "OS", name: "Osun" },
  { code: "OY", name: "Oyo" },
  { code: "PL", name: "Plateau" },
  { code: "RI", name: "Rivers" },
  { code: "SO", name: "Sokoto" },
  { code: "TA", name: "Taraba" },
  { code: "YO", name: "Yobe" },
  { code: "ZA", name: "Zamfara" },
];

// Major cities by state
const CITIES_BY_STATE: Record<string, string[]> = {
  LA: [
    "Ikeja",
    "Lagos Island",
    "Lekki",
    "Victoria Island",
    "Surulere",
    "Ikorodu",
    "Epe",
    "Badagry",
  ],
  FC: ["Abuja", "Gwagwalada", "Kuje", "Bwari", "Kubwa", "Nyanya", "Lugbe"],
  KN: ["Kano", "Fagge", "Gwale", "Nassarawa", "Tarauni", "Ungogo"],
  KD: ["Kaduna", "Zaria", "Kafanchan", "Kagoro"],
  ON: ["Akure", "Ondo", "Owo", "Ikare"],
  OG: ["Abeokuta", "Ijebu-Ode", "Sagamu", "Ota"],
  OY: ["Ibadan", "Ogbomoso", "Oyo", "Iseyin"],
  RI: ["Port Harcourt", "Obio-Akpor", "Eleme", "Bonny"],
  AN: ["Awka", "Onitsha", "Nnewi", "Ekwulobia"],
  EN: ["Enugu", "Nsukka", "Agbani", "Oji River"],
  IM: ["Owerri", "Orlu", "Okigwe"],
  AB: ["Umuahia", "Aba", "Arochukwu", "Ohafia"],
  ED: ["Benin City", "Auchi", "Ekpoma", "Uromi"],
  DE: ["Asaba", "Warri", "Sapele", "Ughelli"],
  AK: ["Uyo", "Eket", "Ikot Ekpene", "Oron"],
  CR: ["Calabar", "Ugep", "Ogoja"],
  BY: ["Yenagoa", "Brass", "Sagbama"],
  EB: ["Abakaliki", "Afikpo", "Onueke"],
  KO: ["Lokoja", "Okene", "Kabba", "Ankpa"],
  KW: ["Ilorin", "Offa", "Jebba", "Lafiagi"],
  NA: ["Lafia", "Keffi", "Akwanga", "Nasarawa"],
  NI: ["Minna", "Bida", "Kontagora", "Suleja"],
  OS: ["Osogbo", "Ile-Ife", "Ilesa", "Ikirun"],
  EK: ["Ado-Ekiti", "Ikere", "Efon-Alaaye", "Ise-Ekiti"],
  BE: ["Makurdi", "Gboko", "Otukpo", "Katsina-Ala"],
  PL: ["Jos", "Bukuru", "Pankshin", "Shendam"],
  SO: ["Sokoto", "Tambuwal", "Gwadabawa", "Wurno"],
  KE: ["Birnin Kebbi", "Argungu", "Yauri", "Zuru"],
  ZA: ["Gusau", "Kaura Namoda", "Talata Mafara", "Bungudu"],
  KT: ["Katsina", "Daura", "Funtua", "Malumfashi"],
  JI: ["Dutse", "Hadejia", "Gumel", "Kazaure"],
  BA: ["Bauchi", "Azare", "Misau", "Katagum"],
  GO: ["Gombe", "Kumo", "Deba", "Billiri"],
  BO: ["Maiduguri", "Biu", "Bama", "Dikwa"],
  YO: ["Damaturu", "Potiskum", "Gashua", "Nguru"],
  AD: ["Yola", "Jimeta", "Mubi", "Numan"],
  TA: ["Jalingo", "Wukari", "Bali", "Ibi"],
};

// Countries for future expansion
const COUNTRIES = [
  { code: "NG", name: "Nigeria" },
  // Can add more countries later
];

interface AddressDropdownsProps {
  country: string;
  state: string;
  city: string;
  onCountryChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onCityChange: (value: string) => void;
  required?: boolean;
  className?: string;
}

export function AddressDropdowns({
  country,
  state,
  city,
  onCountryChange,
  onStateChange,
  onCityChange,
  required = false,
  className = "",
}: AddressDropdownsProps) {
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  // Update available cities when state changes
  useEffect(() => {
    if (state) {
      const stateObj = NIGERIA_STATES.find((s) => s.name === state);
      const cities = stateObj ? CITIES_BY_STATE[stateObj.code] || [] : [];
      setAvailableCities(cities);

      // Reset city if it's not in the new state's cities
      if (city && !cities.includes(city)) {
        onCityChange("");
      }
    } else {
      setAvailableCities([]);
      if (city) {
        onCityChange("");
      }
    }
  }, [state, city, onCityChange]);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
      {/* Country */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          Country {required && "*"}
        </label>
        <select
          value={country}
          onChange={(e) => {
            onCountryChange(e.target.value);
            // Reset state and city when country changes
            onStateChange("");
            onCityChange("");
          }}
          className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
          required={required}
        >
          <option value="">Select Country</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* State */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          State {required && "*"}
        </label>
        <select
          value={state}
          onChange={(e) => onStateChange(e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!country}
          required={required}
        >
          <option value="">Select State</option>
          {country &&
            NIGERIA_STATES.map((s) => (
              <option key={s.code} value={s.name}>
                {s.name}
              </option>
            ))}
        </select>
      </div>

      {/* City */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          City {required && "*"}
        </label>
        <select
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!state || availableCities.length === 0}
          required={required}
        >
          <option value="">Select City</option>
          {availableCities.map((cityName) => (
            <option key={cityName} value={cityName}>
              {cityName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
