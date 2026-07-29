# Advanced Vacuum Card

`custom:nodalia-advance-vacuum-card` supports several room-cleaning APIs while keeping the same Nodalia map interface.

## Platform compatibility

| Platform | Room cleaning | Zones | Go to point | Live room source |
|---|---|---|---|---|
| Roborock | Native `vacuum.clean_area` when HA mappings exist; raw command fallback | `app_zoned_clean` | `roborock.set_vacuum_goto_position` | Vacuum/map attributes when available; session fallback otherwise |
| Dreame Vacuum | `dreame_vacuum.vacuum_clean_segment` | `dreame_vacuum.vacuum_clean_zone` | `dreame_vacuum.vacuum_goto` | Map `active_segments` and the related `current_room` sensor |
| Xiaomi Miio | `xiaomi_miio.vacuum_clean_segment` | `xiaomi_miio.vacuum_clean_zone` | `xiaomi_miio.vacuum_goto` | Vacuum/map attributes or an explicit tracking entity |
| Ecovacs (current HA integration) | `vacuum.clean_area` | HA areas only | Not exposed by the standard vacuum API | Vacuum/map attributes or an explicit tracking entity |
| Deebot Universe (legacy) | `vacuum.send_command` with `spot_area` | `custom_area` | Not exposed by the supported service profile | Vacuum/map attributes or an explicit tracking entity |
| Matter / Home Assistant | `vacuum.clean_area` | HA areas only | Not exposed by the standard vacuum API | An explicit tracking entity if the integration publishes one |
| Valetudo | MQTT Map Segmentation | MQTT Zone Cleaning | MQTT Go To Location | An explicit MQTT/template sensor if required |

`vacuum_platform: auto` reads the integration platform from Home Assistant's entity registry. If it cannot identify it, the backward-compatible Roborock command profile is used. Existing `map_modes[].service_call_schema` definitions are also honored, including the common Xiaomi Vacuum Map Card placeholders.

For Valetudo, set the base topic without a trailing slash:

```yaml
vacuum_platform: Hypfer/Valetudo
vacuum_mqtt_topic: valetudo/my_robot
```

## Live room highlighting

The card prioritizes live information in this order:

1. Active/current room attributes on the vacuum and map entities, including `active_segments`, `selected_segments`, `current_room`, `room_id`, and equivalent area fields.
2. A related current-room or active-segments entity discovered on the same Home Assistant device.
3. `room_tracking.entity`, when configured explicitly.
4. The in-memory/shared cleaning session as a fallback for integrations that do not publish room progress.

The visual editor exposes the optional tracking entity and attribute. A Dreame setup normally needs no override because its map entity publishes `active_segments` and its current-room sensor includes `room_id`.

```yaml
room_tracking:
  auto_detect: true
  entity: sensor.robot_current_room
  attribute: room_id
  activity_entity: sensor.robot_task_status
```

Room names are matched as well as numeric identifiers, so a sensor state such as `Baño` can resolve to the configured room whose ID is `15`. Active rooms remain highlighted during a mop-wash, drying, or auto-empty interlude when the integration still reports the cleaning task. `activity_entity` is only needed when the integration's status sensor is not attached to the same HA device and cannot be discovered automatically.

The optional `shared_cleaning_session_entity` is not the authoritative room-status source anymore. It remains useful for restoring selections across browsers and as a fallback for Roborock/Xiaomi models that expose only the generic `cleaning` state.

## Matter and `vacuum.clean_area`

Home Assistant's standard vacuum model exposes the activity (`cleaning`, `paused`, `docked`, and so on), but not a universal current-room attribute. Its `CLEAN_AREA` feature maps HA areas to vendor segments. The card matches each room label to an HA area name, or accepts an explicit area ID in `room_segments`:

```yaml
room_segments:
  - id: "10000"
    label: Salón
    area_id: living_room
    outline: [[0, 0], [100, 0], [100, 100], [0, 100]]
```

Configure the vacuum's area mapping in Home Assistant before using this profile. See the official [Vacuum entity developer documentation](https://developers.home-assistant.io/docs/core/entity/vacuum/) and Home Assistant's [`vacuum/get_segments` implementation](https://github.com/home-assistant/core/blob/dev/homeassistant/components/vacuum/websocket.py).

## Integration references

- [Home Assistant Roborock implementation](https://github.com/home-assistant/core/blob/dev/homeassistant/components/roborock/vacuum.py)
- [Home Assistant Xiaomi Miio services](https://github.com/home-assistant/core/blob/dev/homeassistant/components/xiaomi_miio/services.yaml)
- [Home Assistant Matter vacuum implementation](https://github.com/home-assistant/core/blob/dev/homeassistant/components/matter/vacuum.py)
- [Dreame Vacuum integration](https://github.com/Tasshack/dreame-vacuum)
- [Valetudo MQTT integration](https://valetudo.cloud/pages/integrations/mqtt/)
