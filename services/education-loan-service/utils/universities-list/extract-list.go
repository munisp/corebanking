package universitieslist

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

type RawUniversity struct {
	Name                string
	Type                string
	ViceChancellor      string
	YearOfEstablishment string
	URL                 string
}

func ExtractUniversities(url string, uniType string) ([]RawUniversity, error) {
	log.Printf("Extracting %s universities from: %s", uniType, url)

	resp, err := http.Get(url)
	if err != nil {
		log.Printf("Error fetching URL: %v", err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Printf("Bad status code: %d", resp.StatusCode)
		return nil, fmt.Errorf("status code error: %d", resp.StatusCode)
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		log.Printf("Error parsing HTML: %v", err)
		return nil, err
	}

	var universities []RawUniversity
	seen := make(map[string]bool) // Track duplicates

	// The NUC website uses HTML tables with the following structure:
	// Columns: S/N | University Name | Vice Chancellor | Website Address | Year Est.
	// Try different table selectors
	rowCount := 0

	doc.Find("table tr").Each(func(i int, row *goquery.Selection) {
		rowCount++
		cells := row.Find("td")

		// Should have at least 2 cells (S/N and University Name)
		if cells.Length() < 2 {
			return
		}

		// Extract data from table cells
		// Looking at the screenshots:
		// Column 0: S/N
		// Column 1: University Name (FEDERAL UNIVERSITIES / STATE UNIVERSITIES / PRIVATE UNIVERSITIES)
		// Column 2: Vice Chancellor (or empty for some)
		// Column 3: Website Address
		// Column 4: Year Established

		var name, viceChancellor, website, yearEst string

		// Get university name from column 1 (index 1, since 0 is S/N)
		nameCell := cells.Eq(1)
		name = strings.TrimSpace(nameCell.Text())

		// Check if there's a link in the name cell
		if nameCell.Find("a").Length() > 0 {
			href, exists := nameCell.Find("a").Attr("href")
			if exists {
				website = strings.TrimSpace(href)
			}
		}

		// Get vice chancellor from column 2 if exists
		if cells.Length() > 2 {
			viceChancellor = strings.TrimSpace(cells.Eq(2).Text())
		}

		// Get website from column 3 if exists and not already set
		if cells.Length() > 3 && website == "" {
			websiteCell := cells.Eq(3)
			if websiteCell.Find("a").Length() > 0 {
				href, exists := websiteCell.Find("a").Attr("href")
				if exists {
					website = strings.TrimSpace(href)
				}
			} else {
				// Sometimes website is just text
				websiteText := strings.TrimSpace(websiteCell.Text())
				if strings.HasPrefix(websiteText, "http") {
					website = websiteText
				}
			}
		}

		// Get year established from column 4 if exists
		if cells.Length() > 4 {
			yearEst = strings.TrimSpace(cells.Eq(4).Text())
		}

		// Clean up name
		name = strings.TrimSpace(name)
		name = strings.ReplaceAll(name, "  ", " ")

		// Validate and add university
		normalizedName := strings.ToLower(strings.TrimSpace(name))

		// Skip if empty, too short, or already seen
		if name == "" || len(name) < 4 || seen[normalizedName] {
			return
		}

		// Exclude common non-university entries (make sure these are lowercase)
		excludeTerms := []string{
			"s/n", "university name", "vice chancellor", "website",
			"year est", "federal universities", "state universities",
			"private universities", "showing", "entries", "search",
			"website address", "year established",
		}

		shouldExclude := false
		for _, term := range excludeTerms {
			if normalizedName == term || strings.Contains(normalizedName, "entries per page") {
				shouldExclude = true
				break
			}
		}

		if !shouldExclude {
			universities = append(universities, RawUniversity{
				Name:                name,
				Type:                uniType,
				ViceChancellor:      viceChancellor,
				YearOfEstablishment: yearEst,
				URL:                 website,
			})
			seen[normalizedName] = true
		}
	})

	log.Printf("Processed %d table rows, extracted %d universities (%s)", rowCount, len(universities), uniType)
	return universities, nil
}

func LoadFromJSON(filename string) ([]University, error) {
	file, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var data []University
	err = json.Unmarshal(file, &data)
	if err != nil {
		return nil, err
	}

	return data, nil
}
