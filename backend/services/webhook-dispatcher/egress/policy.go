// Package egress implements the outbound leg INSIDE the approved F07 egress proxy.
// It is not a public proxy, dispatcher, authentication service or Action Gateway.
// No listener, route, credential, infrastructure or background worker is installed.
package egress

import (
	"fmt"
	"net/netip"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

// Fault is a stable, sanitized error. Never attach raw URLs, query strings,
// response bodies, DNS errors, TLS errors, signing material or credentials.
type Fault string

func (f Fault) Error() string { return string(f) }

var label = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)
var tld = regexp.MustCompile(`^[a-z][a-z0-9-]*[a-z]$`)
var uuid = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
var token = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_:-]{0,127}$`)
var keyToken = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$`)
var stamp = regexp.MustCompile(`^(0|[1-9][0-9]{0,9})$`)
var mac = regexp.MustCompile(`^v1=[0-9a-f]{64}$`)

// Conservative public-network profile. Reject special-purpose ranges, including
// transition mechanisms; do not infer public reachability from IsGlobalUnicast.
// IANA IPv4/IPv6 registries reviewed 2026-09-08 (see INC-008 guide). Some special
// anycast allocations are deliberately excluded too: this is not a routing table.
var blocked = prefixes(
	"0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
	"169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24",
	"192.31.196.0/24", "192.52.193.0/24", "192.88.99.0/24", "192.168.0.0/16",
	"192.175.48.0/24", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24",
	"224.0.0.0/4", "240.0.0.0/4", "2001::/23", "2001:db8::/32",
	"2002::/16", "2620:4f:8000::/48", "3fff::/20",
)
var globalV6 = netip.MustParsePrefix("2000::/3")

func prefixes(values ...string) []netip.Prefix {
	result := make([]netip.Prefix, len(values))
	for i, value := range values {
		result[i] = netip.MustParsePrefix(value)
	}
	return result
}

// PublicAddress classifies an address for this public-webhook profile. It does not
// grant endpoint authority or prove routing safety. IPv4-mapped IPv6 is unwrapped
// before validation; zones, NAT64, Teredo, 6to4, local and special ranges fail closed.
// Network policy MUST additionally block locally routed public/metadata addresses.
func PublicAddress(address netip.Addr) bool {
	if !address.IsValid() || address.Zone() != "" {
		return false
	}
	address = address.Unmap()
	if !address.IsGlobalUnicast() || address.IsPrivate() || address.IsLoopback() || address.IsLinkLocalUnicast() {
		return false
	}
	if address.Is6() && !globalV6.Contains(address) {
		return false
	}
	for _, prefix := range blocked {
		if prefix.Contains(address) {
			return false
		}
	}
	return true
}

// Destination validates one exact public HTTPS destination without DNS or I/O.
// parameters: raw is the registered URL; allowedPorts is an operator-approved
// profile, never values from request JSON. returns: canonical URL, DNS hostname,
// effective port. No wildcard, numeric-IP endpoint, userinfo, fragment or ambiguous
// authority is accepted. IDNs must already be validated ASCII/Punycode A-labels.
// Query/path are retained for execution but are NEVER emitted into diagnostics.
func Destination(raw string, allowedPorts []uint16) (*url.URL, string, uint16, error) {
	if len(raw) == 0 || len(raw) > 2048 {
		return nil, "", 0, Fault("DESTINATION_INVALID")
	}
	for _, r := range raw {
		if r <= 32 || r >= 127 || r == '\\' {
			return nil, "", 0, Fault("DESTINATION_INVALID")
		}
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.Opaque != "" || strings.Contains(raw, "#") || strings.ContainsAny(u.Host, "%[]") {
		return nil, "", 0, Fault("DESTINATION_INVALID")
	}
	host := strings.ToLower(u.Hostname())
	if len(host) > 253 || strings.HasSuffix(host, ".") || !strings.Contains(host, ".") {
		return nil, "", 0, Fault("DESTINATION_INVALID")
	}
	parts := strings.Split(host, ".")
	for _, part := range parts {
		if !label.MatchString(part) {
			return nil, "", 0, Fault("DESTINATION_INVALID")
		}
	}
	if !tld.MatchString(parts[len(parts)-1]) {
		return nil, "", 0, Fault("DESTINATION_INVALID")
	}
	for _, suffix := range []string{"localhost", "local", "internal", "home", "lan", "arpa"} {
		if host == suffix || strings.HasSuffix(host, "."+suffix) {
			return nil, "", 0, Fault("DESTINATION_BLOCKED")
		}
	}
	port := uint64(443)
	if strings.Contains(u.Host, ":") {
		text := u.Port()
		port, err = strconv.ParseUint(text, 10, 16)
		if err != nil || port == 0 || strconv.FormatUint(port, 10) != text {
			return nil, "", 0, Fault("DESTINATION_INVALID")
		}
	}
	allowed := false
	for _, item := range allowedPorts {
		if uint64(item) == port {
			allowed = true
		}
	}
	if !allowed {
		return nil, "", 0, Fault("PORT_BLOCKED")
	}
	u.Host = host
	if port != 443 {
		u.Host = fmt.Sprintf("%s:%d", host, port)
	}
	if u.Path == "" {
		u.Path = "/"
	}
	return u, host, uint16(port), nil
}
