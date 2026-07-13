package universitieslist

import (
	"strings"
)

type University struct {
	Name                string `json:"name"`
	ViceChancellor      string `json:"vice_chancellor"`
	YearOfEstablishment string `json:"year_of_establishment"`
	Type                string `json:"type"`
	URL                 string `json:"url"`
}

func TransformUniversities(raw []RawUniversity) []University {
	var result []University
	seen := make(map[string]bool) // Track duplicates by normalized name

	for _, r := range raw {
		normalizedName := normalizeName(r.Name)
		lowerName := strings.ToLower(normalizedName)

		// Skip if already added
		if seen[lowerName] {
			continue
		}

		// Skip if name is too short or invalid
		if len(normalizedName) < 4 {
			continue
		}

		result = append(result, University{
			Name:                normalizedName,
			ViceChancellor:      r.ViceChancellor,
			YearOfEstablishment: r.YearOfEstablishment,
			Type:                r.Type,
			URL:                 r.URL,
		})

		seen[lowerName] = true
	}

	return result
}

func normalizeName(name string) string {
	// Trim whitespace
	name = strings.TrimSpace(name)

	// Remove multiple spaces
	name = strings.Join(strings.Fields(name), " ")

	// Remove common prefixes/suffixes that might cause matching issues
	name = strings.TrimPrefix(name, "The ")
	name = strings.TrimPrefix(name, "the ")

	// Remove trailing commas, periods
	name = strings.TrimRight(name, ".,;:")

	return name
}
