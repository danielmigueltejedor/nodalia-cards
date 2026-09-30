import test from 'node:test';
import assert from 'node:assert/strict';
import { createHassFixture } from './fixtures/hass.mjs';

test('HA fixtures normalize entity shape and isolate mutable states', () => {
  const entities = { 'lock.front_door': { state: 'locked', attributes: { friendly_name: 'Front door' } }, 'media_player.room': { state: 'playing' } };
  const first = createHassFixture({ entities }), second = createHassFixture({ entities });
  assert.equal(first.states['lock.front_door'].entity_id, 'lock.front_door');
  assert.deepEqual(first.states['media_player.room'].attributes, {});
  first.states['lock.front_door'].attributes.friendly_name = 'Changed';
  assert.equal(second.states['lock.front_door'].attributes.friendly_name, 'Front door');
  assert.equal(entities['lock.front_door'].attributes.friendly_name, 'Front door');
});
