import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Source-status checks only. Reading a repository JSON file is not a live health
// check and must not certify an infrastructure adapter or release gate.
const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const ui = await readJson('../src/contracts/delivery-status.json');
const repository = await readJson('../../docs/delivery/status.json');

test('frontend and repository delivery projections are identical', () => {
  assert.deepEqual(ui, repository);
});
test('PLT-004 records source evidence without advancing blocked parent acceptance', () => {
  assert.equal(ui.baseline_count, 262);
  assert.equal(ui.certified_done, 0);
  assert.equal(ui.branch, 'main');
  assert.match(ui.evidence_commit, /^[0-9a-f]{40}$/);
  assert.equal(ui.items.find(item => item.id === 'PLT-004')?.status, 'Blocked');
  assert.equal(ui.items.find(item => item.id === 'EVT-003')?.status, 'Blocked');
  assert.match(ui.controls.find(item => item.id === 'placement')?.state ?? '', /not configured/);
});
test('the F03 pipeline projection retains all original ordered stages', () => {
  assert.deepEqual(ui.ingress_stages.map(stage => stage.id), [
    'edge_bounds', 'expected_credential', 'raw_proof', 'bounded_parse',
    'authorized_placement', 'durable_append', 'ack_boundary', 'async_consumers'
  ]);
});
