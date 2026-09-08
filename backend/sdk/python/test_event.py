"""Cross-language synthetic vectors plus Python-specific ownership/type boundaries."""
from __future__ import annotations
import base64
from dataclasses import FrozenInstanceError, replace
import hashlib
import json
import os
from pathlib import Path
import unittest
from greeto_webhooks.event import EventLimits, WebhookEventError, verify_webhook_event
from greeto_webhooks.signature import KeyVersion, Policy, WebhookProofError, sign_webhook, verify_webhook

FIXTURE = json.loads((Path(__file__).resolve().parents[2] / 'testdata/webhook-event-v1.json').read_text())
KEY = KeyVersion('test-key',bytes([0x42])*32,1,9000,9100)
POLICY = Policy(300,10,4096)
LIMITS = EventLimits(8,128,64)
BODY = b'{"event_id":"evt-001","data":"private_test_note"}'
RESULTS: list[dict[str,str]] = []

def headers(body: bytes = BODY) -> list[tuple[str,str]]:
    return list(sign_webhook(body,'evt-001','delivery-001',KEY,1000,POLICY).items())

class Conformance(unittest.TestCase):
    @classmethod
    def tearDownClass(cls) -> None:
        path=os.environ.get('GREETO_CONFORMANCE_REPORT')
        if path:
            Path(path).write_text(json.dumps(RESULTS,indent=2)+'\n')

def case_test(case: dict):
    def check(self: Conformance) -> None:
        raw=base64.b64decode(case['body_base64'],validate=True)
        pairs=[('X-Platform-Event-Id',v) for v in case.get('event_headers',['evt-001'])]
        pairs += [('X-Platform-Delivery-Id','delivery-001'),('X-Platform-Timestamp','1000'),
                  ('X-Platform-Key-Id',case.get('key_header','test-key')),('X-Platform-Signature',case['signature'])]
        if case.get('lowercase_headers'):
            pairs=[(k.lower(),v) for k,v in pairs]
        limit=case.get('limits',FIXTURE['defaults']['limits'])
        try:
            event=verify_webhook_event(raw,pairs,[KEY],case.get('now',1000),POLICY,
                EventLimits(limit['maxDepth'],limit['maxTokens'],limit['maxKeyBytes']))
            self.assertEqual(event.event_id,'evt-001')
            self.assertEqual(event.raw_body(),raw)
            self.assertEqual(event.proof.body_sha256,hashlib.sha256(raw).hexdigest())
            result=dict(name=case['name'],code='ok',event_id=event.event_id,body_sha256=event.proof.body_sha256)
        except (WebhookEventError,WebhookProofError) as exc:
            result=dict(name=case['name'],code=exc.code,event_id='',body_sha256='')
        self.assertEqual(result['code'],case['expected'])
        RESULTS.append(result)
    return check
for case in FIXTURE['cases']:
    setattr(Conformance,'test_'+case['name'],case_test(case))

class PythonBoundary(unittest.TestCase):
    def event(self):
        return verify_webhook_event(BODY,headers(),[KEY],1000,POLICY,LIMITS)

    def test_frozen_body_and_metadata(self):
        e=self.event()
        with self.assertRaises(FrozenInstanceError): e.event_id='other'
        with self.assertRaises(FrozenInstanceError): e.proof.delivery_id='other'
        self.assertIsInstance(e.raw_body(),bytes)

    def test_no_headers_retained(self):
        h=headers();e=verify_webhook_event(BODY,h,[KEY],1000,POLICY,LIMITS)
        h[0]=('X-Platform-Event-Id','other')
        self.assertEqual(e.event_id,'evt-001');self.assertEqual(e.raw_body(),BODY)

    def test_redacted_normal_formatting(self):
        e=self.event()
        for text in (str(e),repr(e),f'{e!r}'):
            self.assertIn('body omitted',text);self.assertNotIn('private_test_note',text);self.assertNotIn('evt-001',text)

    def test_mutable_or_text_body_rejected(self):
        for raw in (bytearray(BODY),BODY.decode(),memoryview(BODY)):
            with self.assertRaises(WebhookProofError): verify_webhook_event(raw,headers(),[KEY],1000,POLICY,LIMITS)

    def test_collapsed_headers_rejected(self):
        with self.assertRaises(WebhookProofError): verify_webhook_event(BODY,dict(headers()),[KEY],1000,POLICY,LIMITS)

    def test_invalid_limits(self):
        for l in (None,EventLimits(True,128,64),EventLimits(8,3,64),EventLimits(8,128,7),EventLimits(65,128,64)):
            with self.assertRaises(WebhookEventError): verify_webhook_event(BODY,headers(),[KEY],1000,POLICY,l)

    def test_invalid_policy_and_body_bound(self):
        with self.assertRaises(WebhookProofError): verify_webhook_event(BODY,headers(),[KEY],1000,Policy(300,10,0),LIMITS)
        with self.assertRaises(WebhookProofError): verify_webhook_event(BODY,headers(),[KEY],1000,Policy(300,10,1),LIMITS)

    def test_revoked_key(self):
        with self.assertRaises(WebhookProofError): verify_webhook_event(BODY,headers(),[replace(KEY,revoked=True)],1000,POLICY,LIMITS)

    def test_rotation_overlap(self):
        old=replace(KEY,sign_until=1001,verify_until=1200)
        new=KeyVersion('next',bytes([0x33])*32,1001,2000,2100)
        self.assertEqual(verify_webhook_event(BODY,headers(),[new,old],1010,POLICY,LIMITS).event_id,'evt-001')

    def test_repeated_signature_is_not_durable_replay_protection(self):
        self.assertEqual(self.event().proof,self.event().proof)

    def test_signature_header_is_not_body_id(self):
        h=headers();h[0]=('X-Platform-Event-Id','evt-other')
        verify_webhook(BODY,h,[KEY],1000,POLICY)
        with self.assertRaises(WebhookEventError): verify_webhook_event(BODY,h,[KEY],1000,POLICY,LIMITS)

    def test_header_size_and_invalid_unicode(self):
        for value in ('a'*257,'\ud800'):
            h=headers();h[0]=('X-Platform-Event-Id',value)
            with self.assertRaises(WebhookProofError): verify_webhook_event(BODY,h,[KEY],1000,POLICY,LIMITS)

if __name__=='__main__': unittest.main()
