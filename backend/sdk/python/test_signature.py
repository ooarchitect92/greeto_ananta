"""Real crypto conformance tests using PUBLIC SYNTHETIC fixture keys only."""
from dataclasses import replace
import json
from pathlib import Path
import unittest
from greeto_webhooks.signature import HEADERS as H, KeyVersion, Policy, WebhookProofError, sign_webhook, verify_webhook

AT = 1788825600
BODY = b'{"event_id":"evt_fixture"}'
KEY = KeyVersion('current', b'a' * 32, AT - 1000, AT + 1000, AT + 2000)
POLICY = Policy(300, 30, 4096)


def signed():
    return dict(sign_webhook(BODY, 'evt_fixture', 'dlv_fixture', KEY, AT, POLICY))


class Signatures(unittest.TestCase):
    def invalid(self, fn, config=False):
        with self.assertRaises(WebhookProofError) as caught:
            fn()
        self.assertEqual(caught.exception.code, 'WEBHOOK_SIGNING_CONFIG_INVALID' if config else 'WEBHOOK_PROOF_INVALID')

    def test_body_and_json_changes(self):
        for body in (b'[bad]', b'{ "event_id": "evt_fixture" }'):
            self.invalid(lambda: verify_webhook(body, list(signed().items()), [KEY], AT, POLICY))

    def test_size_limits(self):
        p = replace(POLICY, max_body_bytes=len(BODY)-1)
        self.invalid(lambda: verify_webhook(BODY, list(signed().items()), [KEY], AT, p))
        self.invalid(lambda: sign_webhook(BODY, 'evt_fixture', 'dlv_fixture', KEY, AT, p))

    def test_retry_is_not_a_replay_ledger(self):
        a = verify_webhook(BODY, list(signed().items()), [KEY], AT+1, POLICY)
        fresh = sign_webhook(BODY, 'evt_fixture', 'dlv_fixture', KEY, AT+1, POLICY)
        b = verify_webhook(BODY, list(fresh.items()), [KEY], AT+1, POLICY)
        self.assertEqual((a.delivery_id,a.body_sha256), (b.delivery_id,b.body_sha256))
        self.assertNotEqual(signed()[H['signature']], fresh[H['signature']])

    def test_unsigned_event_header_is_not_proof(self):
        h = signed(); h[H['event']] = 'evt_untrusted'
        proof = verify_webhook(BODY,list(h.items()),[KEY],AT,POLICY)
        self.assertFalse(hasattr(proof,'event_id'))

    def test_rotation(self):
        old = replace(KEY, sign_until=AT+1, verify_until=AT+10)
        new = replace(KEY, id='next',secret=b'b'*32,not_before=AT+1)
        verify_webhook(BODY,list(signed().items()),[new,old],AT+5,POLICY)
        self.invalid(lambda: sign_webhook(BODY,'evt_fixture','dlv_fixture',old,AT+5,POLICY))
        fresh = sign_webhook(BODY,'evt_fixture','dlv_fixture',new,AT+5,POLICY)
        verify_webhook(BODY,list(fresh.items()),[new,old],AT+5,POLICY)
        self.invalid(lambda: verify_webhook(BODY,list(signed().items()),[new,old],AT+10,POLICY))

    def test_header_casing(self):
        verify_webhook(BODY,[(k.lower(),v) for k,v in signed().items()],[KEY],AT,POLICY)

    def test_reject_collapsed_header_mapping(self):
        self.invalid(lambda: verify_webhook(BODY,signed(),[KEY],AT,POLICY))

    def test_reject_text_or_mutable_body(self):
        for value in ('decoded',bytearray(BODY)):
            self.invalid(lambda: verify_webhook(value,list(signed().items()),[KEY],AT,POLICY))

    def test_reject_header_non_strings(self):
        self.invalid(lambda: verify_webhook(BODY,[(H['signature'],42)],[KEY],AT,POLICY))


def add(name, fn):
    setattr(Signatures, 'test_' + name, fn)


vectors = json.loads((Path(__file__).resolve().parents[2]/'contracts/fixtures/webhook-signature-v1.json').read_text())['vectors']
for v in vectors:
    def check(self, v=v):
        body=bytes.fromhex(v['body_hex']); k=replace(KEY,id=v['key_id'],secret=bytes.fromhex(v['key_hex']))
        headers=sign_webhook(body,v['event_id'],v['delivery_id'],k,v['at'],POLICY)
        self.assertEqual(headers[H['signature']],v['signature'])
        proof=verify_webhook(body,list(headers.items()),[k],v['at'],POLICY)
        self.assertEqual((proof.delivery_id,proof.body_sha256),(v['delivery_id'],v['body_sha256']))
    add('vector_'+v['name'],check)

for i,name in enumerate(H.values()):
    def missing(self,name=name):
        headers=signed(); del headers[name]
        self.invalid(lambda: verify_webhook(BODY,list(headers.items()),[KEY],AT,POLICY))
    def duplicate(self,name=name):
        headers=list(signed().items())+[(name.lower(),signed()[name])]
        self.invalid(lambda: verify_webhook(BODY,headers,[KEY],AT,POLICY))
    add('missing_'+str(i),missing); add('duplicate_'+str(i),duplicate)

bad = [('signature','v1=aa'),('signature','v2='+'a'*64),('signature','v1='+'A'*64),
       ('signature','v1='+'a'*64+'\n'),('delivery','dlv_fixture\n'),('delivery','dlv.fixture'),
       ('delivery','dlv_changed'),('key','unknown'),('timestamp','01788825600'),('timestamp','-1'),
       ('timestamp','1788825600.0'),('timestamp','1e9'),('timestamp',' 1788825600'),
       ('timestamp','1788825600\n'),('timestamp','99999999999')]
for i,(name,value) in enumerate(bad):
    def malformed(self,name=name,value=value):
        headers=signed(); headers[H[name]]=value
        self.invalid(lambda: verify_webhook(BODY,list(headers.items()),[KEY],AT,POLICY))
    add('malformed_'+str(i),malformed)

for delta in (-31,-30,300,301):
    def clock(self,delta=delta):
        fn=lambda: verify_webhook(BODY,list(signed().items()),[KEY],AT+delta,POLICY)
        if -30 <= delta <= 300: fn()
        else: self.invalid(fn)
    add('clock_'+str(delta).replace('-','minus'),clock)

for name,patch in [('revoked',{'revoked':True}),('future',{'not_before':AT+1}),
                   ('sign_ended',{'sign_until':AT}),('expired',{'sign_until':AT-1,'verify_until':AT})]:
    def interval(self,patch=patch):
        self.invalid(lambda: verify_webhook(BODY,list(signed().items()),[replace(KEY,**patch)],AT,POLICY))
    add('key_'+name,interval)

configs=[([],POLICY,AT),([KEY]*3,POLICY,AT),([KEY,replace(KEY,secret=b'b'*32)],POLICY,AT),
         ([KEY,replace(KEY,id='other')],POLICY,AT),([replace(KEY,secret=b'short')],POLICY,AT),
         ([replace(KEY,verify_until=KEY.sign_until-1)],POLICY,AT),([KEY],Policy(0,0,4096),AT),([KEY],POLICY,True)]
for i,(keys,policy,now) in enumerate(configs):
    def bad_config(self,keys=keys,policy=policy,now=now):
        self.invalid(lambda: verify_webhook(BODY,list(signed().items()),keys,now,policy),True)
    add('config_'+str(i),bad_config)

if __name__ == '__main__':
    unittest.main()
