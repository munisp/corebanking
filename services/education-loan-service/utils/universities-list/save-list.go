package universitieslist

import (
	"encoding/json"
	"os"
)

func SaveToJSON(filename string, data []University) error {
	file, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filename, file, 0644)
}
