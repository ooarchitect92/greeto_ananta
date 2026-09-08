package receiving

import (
	"bytes"
	"encoding/json"
	"io"
	"regexp"
	"strings"
	"unicode/utf8"
)

var eventIdentity = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_:-]{0,127}$`)

// eventID uses the standard JSON tokenizer, not a map/struct unmarshal that could
// silently replace duplicate keys or match event_id with case-insensitive aliases.
// Large unrelated JSON numbers remain json.Number, never float64. Other fields
// are structurally checked and discarded; their domain schemas are NOT validated.
func eventID(raw []byte, limits Limits) (string, error) {
	if !utf8.Valid(raw) || !scalarEscapes(raw) {
		return "", ErrEnvelope
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.UseNumber()
	tokens := 0
	next := func() (json.Token, error) {
		tokens++
		if tokens > limits.MaxTokens {
			return nil, ErrEnvelope
		}
		return d.Token()
	}
	first, err := next()
	if err != nil || first != json.Delim('{') {
		return "", ErrEnvelope
	}
	id := ""
	var container func(json.Delim, int) bool
	container = func(open json.Delim, depth int) bool {
		if depth > limits.MaxDepth {
			return false
		}
		seen := make(map[string]struct{})
		for d.More() {
			key := ""
			if open == '{' {
				t, e := next()
				var ok bool
				key, ok = t.(string)
				if e != nil || !ok || len(key) > limits.MaxKeyBytes {
					return false
				}
				if _, duplicate := seen[key]; duplicate {
					return false
				}
				seen[key] = struct{}{}
				// Do not let downstream case-insensitive decoders select a different ID.
				if depth == 1 && key != "event_id" && strings.EqualFold(key, "event_id") {
					return false
				}
			}
			t, e := next()
			if e != nil {
				return false
			}
			if depth == 1 && key == "event_id" {
				value, ok := t.(string)
				if !ok || !eventIdentity.MatchString(value) {
					return false
				}
				id = value
			}
			if delim, ok := t.(json.Delim); ok {
				if (delim != '{' && delim != '[') || !container(delim, depth+1) {
					return false
				}
			}
		}
		close, e := next()
		return e == nil && (open == '{' && close == json.Delim('}') || open == '[' && close == json.Delim(']'))
	}
	if !container('{', 1) || id == "" {
		return "", ErrEnvelope
	}
	// Whitespace is allowed; another object, trailing primitive or garbage is not.
	if _, e := d.Token(); e != io.EOF {
		return "", ErrEnvelope
	}
	return id, nil
}

// scalarEscapes rejects unpaired UTF-16 surrogate escapes that encoding/json v1
// otherwise replaces. JSON grammar still belongs to the standard decoder. Escaped
// backslashes are skipped, so a literal "\\ud800" is not a surrogate escape.
func scalarEscapes(raw []byte) bool {
	for i := 0; i < len(raw); i++ {
		if raw[i] != '\\' {
			continue
		}
		i++
		if i == len(raw) {
			return false
		}
		if raw[i] != 'u' {
			continue
		}
		if i+4 >= len(raw) {
			return false
		}
		u, ok := hex4(raw[i+1 : i+5])
		if !ok || u >= 0xdc00 && u <= 0xdfff {
			return false
		}
		i += 4
		if u < 0xd800 || u > 0xdbff {
			continue
		}
		if i+6 >= len(raw) || raw[i+1] != '\\' || raw[i+2] != 'u' {
			return false
		}
		low, ok := hex4(raw[i+3 : i+7])
		if !ok || low < 0xdc00 || low > 0xdfff {
			return false
		}
		i += 6
	}
	return true
}
func hex4(b []byte) (uint16, bool) {
	var v uint16
	for _, c := range b {
		v <<= 4
		switch {
		case c >= '0' && c <= '9':
			v += uint16(c - '0')
		case c >= 'a' && c <= 'f':
			v += uint16(c-'a') + 10
		case c >= 'A' && c <= 'F':
			v += uint16(c-'A') + 10
		default:
			return 0, false
		}
	}
	return v, true
}
