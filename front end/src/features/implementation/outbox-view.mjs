/**
 * Pure presentation for ONE authorized control-outbox scan page, not fleet health.
 * @param {object} options Expected authenticated scope, an adapter observation and clock.
 * @returns {object} Display state, safe counters and reason; no storage/network/actions.
 * A scope match or a source commit is not permission to publish or certify a release.
 */
export function outboxView({expectedScope,observation,now=Date.now()}={}) {
  const empty=(state,reason)=>Object.freeze({state,reason,counts:null,observedAt:null});
  const id=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)&&v!=='00000000-0000-0000-0000-000000000000';
  const scope=s=>!!s&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).length===3&&['tenantId','workspaceId','environmentId'].every(k=>Object.hasOwn(s,k)&&id(s[k]));
  const keys=['scanned','published','alreadyPublished','pending','blocked'];
  if(!scope(expectedScope)||observation==null)return empty('not_connected','An authenticated scope and authorized adapter observation are required.');
  if(!scope(observation.scope)||!['tenantId','workspaceId','environmentId'].every(k=>expectedScope[k]===observation.scope[k]))return empty('unavailable','The observation does not match the current workspace scope.');
  if(observation.kind!=='control_status_outbox_page'||observation.source!=='authorized_adapter')return empty('unavailable','Unsupported observation source.');
  const time=v=>typeof v==='string'&&/^[1-9]\d{3}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
  if(!Number.isFinite(now)||!time(observation.observedAt)||!time(observation.expiresAt))return empty('unavailable','Missing or malformed observation time.');
  const start=Date.parse(observation.observedAt),end=Date.parse(observation.expiresAt);
  if(end<=start||end-start>60000||start>now)return empty('unavailable','Invalid observation freshness interval.');
  if(now>=end)return empty('stale','The observation expired; refresh through the authorized backend.');
  const raw=observation.counts;
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==keys.length||
     keys.some(k=>!Object.hasOwn(raw,k)||!Number.isSafeInteger(raw[k])||raw[k]<0||raw[k]>100)||
     raw.scanned!==raw.published+raw.alreadyPublished+raw.pending+raw.blocked)return empty('unavailable','Page counters are incomplete or inconsistent.');
  const counts=Object.freeze(Object.fromEntries(keys.map(k=>[k,raw[k]])));
  return Object.freeze({state:counts.blocked?'blocked':counts.pending?'pending':'observed',
    reason:counts.blocked?'This page contains unresolved events. They remain pending in the outbox.':
      counts.pending?'Some transport or marker outcomes remain unconfirmed.':'This page was observed; it does not prove downstream consumption, total backlog or business success.',
    counts,observedAt:observation.observedAt});
}
