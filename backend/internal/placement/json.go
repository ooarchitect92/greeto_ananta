package placement

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"unicode/utf8"
)

// strictDecode rejects duplicate/case-variant keys, excessive nesting, trailing
// values and invalid UTF-8 before typed decoding. encoding/json alone may accept
// duplicate/case-insensitive fields, which are unsuitable for signed authority.
func strictDecode(raw []byte, out any) error {
	if !utf8.Valid(raw) {
		return errors.New("invalid_utf8")
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := walkValue(decoder, 0); err != nil {
		return err
	}
	if _, err := decoder.Token(); err != io.EOF {
		return errors.New("trailing_json")
	}
	return decodeTyped(raw, out)
}
func walkValue(d *json.Decoder, depth int) error {
	if depth > 8 {
		return errors.New("json_too_deep")
	}
	token, err := d.Token()
	if err != nil {
		return err
	}
	delim, isDelim := token.(json.Delim)
	if !isDelim {
		return nil
	}
	switch delim {
	case '{':
		seen := map[string]bool{}
		for d.More() {
			token, err = d.Token()
			if err != nil {
				return err
			}
			key, ok := token.(string)
			if !ok || key != strings.ToLower(key) || seen[key] {
				return errors.New("ambiguous_json_key")
			}
			seen[key] = true
			if err = walkValue(d, depth+1); err != nil {
				return err
			}
		}
		token, err = d.Token()
		if err != nil || token != json.Delim('}') {
			return errors.New("invalid_object")
		}
	case '[':
		for d.More() {
			if err = walkValue(d, depth+1); err != nil {
				return err
			}
		}
		token, err = d.Token()
		if err != nil || token != json.Delim(']') {
			return errors.New("invalid_array")
		}
	default:
		return errors.New("unexpected_delimiter")
	}
	return nil
}
