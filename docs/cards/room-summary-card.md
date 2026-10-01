# Nodalia Room Summary Card

`custom:nodalia-room-summary-card` groups room metrics and native Nodalia cards
into one room hub. Media players appear on the home screen; device panels hold
lights, covers, climate, vacuums, fans, humidifiers, security and other entities.
Locks use the native Lock card and its editor/configuration rather than Entity.

```yaml
type: custom:nodalia-room-summary-card
name: Living room
temperature: sensor.living_room_temperature
lights:
  - light.living_room
locks:
  - lock.front_door
media_player: media_player.living_room
```

Only the visible panel remains connected. Configured hidden cards are parked in
a disconnected fragment, allowing their timers, streams and listeners to stop.
Returning to that panel reuses their identity. Changing configuration or HA
connection/user removes connected and parked children and clears their cache.
Ordinary HA updates refresh metadata and metrics without replacing the children;
even an unchanged parent signature passes current HA to visible embedded cards.

Native buttons support keyboard activation. Updating room/cover state preserves
focus on its current action; selecting a panel that removes its navigation button
returns focus to Home, and removing the focused panel falls back to the room
action. Moving, cancelling, reconfiguring or detaching cancels a pending hold.
Configured services retain strict allowlists, explicit targets and false/zero
values. Missing numeric metrics remain distinct from actual zero.
