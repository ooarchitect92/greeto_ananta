package events

// AttemptEvidence is adapter-classified evidence, not a guessed universal meaning
// for HTTP status. In particular a 2xx without a required provider ID is ambiguous.
type AttemptEvidence struct {
	ProviderAccepted    bool
	DefinitiveRejection bool
	MayHaveExecuted     bool
	DocumentedSafeRetry bool
}

// ClassifyAttempt keeps ambiguity separate from failure and from safe retries.
// Provider acceptance never becomes DELIVERED, READ or VERIFIED_SUCCESS here.
func ClassifyAttempt(e AttemptEvidence) string {
	if e.ProviderAccepted && e.DefinitiveRejection {
		return "UNKNOWN"
	}
	if e.ProviderAccepted {
		return "PROVIDER_ACCEPTED"
	}
	if e.DefinitiveRejection {
		return "REJECTED"
	}
	if e.MayHaveExecuted {
		return "UNKNOWN"
	}
	if e.DocumentedSafeRetry {
		return "RETRY_WAIT"
	}
	return "UNKNOWN"
}
