/** Pure parameter validation shared by the editor, handoff export and Node tests. */
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const SECRET_KEY = /^(?:password|passwd|secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|private[_-]?key|client[_-]?secret)$/i;
const SECRET_VALUE = /(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{20,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}|\bEAA[A-Za-z0-9]{50,})/;
export function assertSafeData(value, depth = 0) {
  if (depth > 16) throw new Error('Nested JSON exceeds the 16-level limit.');
  if (typeof value === 'string' && SECRET_VALUE.test(value)) throw new Error('Possible credential detected. Use an opaque credential reference instead.');
  if (!value || typeof value !== 'object') return;
  if (Object.keys(value).length > 500) throw new Error('JSON exceeds the 500-key limit.');
  for (const key of Object.keys(value)) {
    if (['__proto__','prototype','constructor'].includes(key)) throw new Error('Unsafe JSON key.');
    if (SECRET_KEY.test(key)) throw new Error('Raw credential fields are not permitted. Use a credential reference.');
    assertSafeData(value[key], depth + 1);
  }
}
export function defaultValues(feature) {
  return Object.fromEntries(feature.fields.map(f => [f.name, f.type === 'json' ? JSON.stringify(f.default, null, 2) : structuredClone(f.default)]));
}
function validateUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Use an HTTPS URL.');
  if (url.username || url.password || url.hash) throw new Error('URLs cannot include credentials or fragments.');
  // Basic browser sanity only: the backend must perform DNS, redirect and egress enforcement.
  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || host.startsWith('[') || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || /\.(localhost|local|internal)$/.test(host)) throw new Error('Use a public hostname, not a local or private address.');
  for (const key of url.searchParams.keys()) if (SECRET_KEY.test(key)) throw new Error('Do not put credentials in URL query parameters.');
}
export function validateFeature(feature, input) {
  const errors = {}; const values = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {valid: false, errors: {_form: 'Parameters must be an object.'}, values};
  const known = new Set(feature.fields.map(f => f.name));
  for (const key of Object.keys(input)) if (!known.has(key)) errors._form = `Unknown parameter: ${key}`;
  for (const field of feature.fields) {
    const raw = own(input, field.name) ? input[field.name] : undefined;
    try {
      let value = raw;
      const empty = value === undefined || value === null || (typeof value === 'string' && !value.trim()) || (field.type === 'multiselect' && Array.isArray(value) && !value.length);
      if (empty) {
        if (field.required) throw new Error('This parameter is required.');
        values[field.name] = field.type === 'multiselect' ? [] : '';
        continue;
      }
      if (field.type === 'number') {
        if (typeof value !== 'number' && (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value.trim()))) throw new Error('Enter a finite number.');
        value = Number(value);
        if (!Number.isFinite(value)) throw new Error('Enter a finite number.');
        if (field.integer !== false && !Number.isInteger(value)) throw new Error('Enter a whole number.');
        if (field.min !== undefined && value < field.min) throw new Error(`Minimum: ${field.min}.`);
        if (field.max !== undefined && value > field.max) throw new Error(`Maximum: ${field.max}.`);
      } else if (field.type === 'boolean') {
        if (typeof value !== 'boolean') throw new Error('Select true or false.');
      } else if (field.type === 'multiselect') {
        if (!Array.isArray(value) || value.some(v => !field.options.includes(v)) || new Set(value).size !== value.length) throw new Error('Choose unique values from the available options.');
      } else if (field.type === 'json') {
        if (typeof value === 'string' && value.length > 16000) throw new Error('JSON is limited to 16,000 characters.');
        value = typeof value === 'string' ? JSON.parse(value) : value;
        if (value === null || typeof value !== 'object') throw new Error('Enter a JSON object or array.');
        if (JSON.stringify(value).length > 16000) throw new Error('JSON is limited to 16,000 characters.');
        assertSafeData(value);
      } else {
        if (typeof value !== 'string') throw new Error('Enter text.');
        value = value.trim();
        if (value.length > (field.maxLength || 4000)) throw new Error(`Maximum length: ${field.maxLength || 4000}.`);
        if (field.type === 'select' && !field.options.includes(value)) throw new Error('Choose a listed option.');
        if (field.pattern && !new RegExp(field.pattern).test(value)) throw new Error('Use the documented reference format.');
        if (field.type === 'url') validateUrl(value);
        if (field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Use 24-hour HH:MM.');
        if (field.type === 'datetime' && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))) throw new Error('Use an ISO timestamp with seconds and timezone, such as 2026-09-07T09:00:00+05:30.');
        if (field.type === 'datetime') {
          const [year,month,day] = value.slice(0,10).split('-').map(Number);
          const calendar = new Date(Date.UTC(year,month-1,day));
          if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month-1 || calendar.getUTCDate() !== day) throw new Error('Use a real calendar date.');
        }
        if (field.typeHint === 'iana-timezone') { try { new Intl.DateTimeFormat('en', {timeZone: value}); } catch {throw new Error('Use a valid IANA timezone.');} }
      }
      assertSafeData(value);
      values[field.name] = value;
    } catch(error) { errors[field.name] = error instanceof SyntaxError ? 'Enter valid JSON.' : error.message; }
  }
  const fail = (key, condition, message) => {if (condition) errors[key] = message;};
  if (feature.id === 'journey-twin') fail('synthetic_only', values.synthetic_only !== true, 'This frontend preview supports synthetic fixtures only.');
  if (feature.id === 'ai-policy') {
    fail('cross_tenant_reuse', values.cross_tenant_reuse !== false, 'Cross-tenant reuse is not authorized by this configuration.');
    fail('fallback_model_refs', !Array.isArray(values.fallback_model_refs) || values.fallback_model_refs.some(v => typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v)), 'Use an array of opaque model references.');
    fail('fallback_model_refs', Array.isArray(values.fallback_model_refs) && values.fallback_model_refs.length > values.max_fallbacks, 'Fallback count exceeds max_fallbacks.');
  }
  if (feature.id === 'knowledge') fail('overlap', values.overlap >= values.chunk_size, 'Overlap must be smaller than chunk size.');
  if (feature.id === 'audiences') fail('exclude_opt_out', values.exclude_opt_out !== true, 'Opted-out contacts must remain excluded.');
  if (feature.id === 'channel-center' && values.capability_state === 'ready') {
    fail('capability_version', !values.capability_version, 'Readiness requires a server-verified capability version.');
    fail('connection_ref', !values.connection_ref, 'Readiness requires an authorized connection reference.');
  }
  if (feature.id === 'customer-state' && values.operation === 'link_verified_identity') fail('identity_evidence_ref', !values.identity_evidence_ref, 'Linking requires permitted identity evidence.');
  if (feature.id === 'action-receipts' && !['unknown','none','unobserved','not_observed'].includes(values.observed_state)) fail('evidence_ref', !values.evidence_ref, 'An observed outcome requires an evidence reference; this browser does not verify it.');
  if (feature.id === 'operations' && values.from && values.to) fail('to', Date.parse(values.from) > Date.parse(values.to), 'End must not precede start.');
  return {valid: Object.keys(errors).length === 0, errors, values};
}
export function buildHandoff(feature, input) {
  const result = validateFeature(feature, input);
  if (!result.valid) throw new Error('Resolve parameter errors before exporting.');
  return {schema_version: '1.0', feature_id: feature.id, status: 'draft', validation: 'browser_only',
    authorization: 'server_must_resolve_scope_and_permissions', execution: 'not_requested',
    contract_status: feature.contract?.status || 'not_verified', parameters: result.values};
}
