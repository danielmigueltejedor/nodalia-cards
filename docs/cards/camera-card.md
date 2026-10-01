# Nodalia Camera Card

`custom:nodalia-camera-card` displays camera previews and opens live playback.
A single camera can use `entity`; multiple cameras use the `cameras` list.

```yaml
type: custom:nodalia-camera-card
entity: camera.entrada
cameras:
  - camera.entrada
  - camera.garaje
camera_streams:
  - camera: camera.entrada
    provider: home_assistant
    muted: true
    controls: false
```

Live stream providers include Home Assistant, `frigate_go2rtc`, `go2rtc` and
`iframe`. Each camera retains its own stream and tap settings. Explicit URLs
and custom stream names are retained when changing the camera entity; a stream
name matching the old default updates to the new default. Removing a camera
also removes its camera-specific stream, tap and expanded-action rows.

The visual editor preserves missing entity selections, custom YAML fields and
focus. Adding a camera from a legacy `entity` configuration retains that first
camera. New camera/action rows remain editable before an entity is selected.
Malformed rows and invalid removal indices are ignored. Expanded actions can
control related entities, including locks, using toggle, more-info or service.
Service data and explicit targets preserve false and zero object values.

Camera hold actions run on the preview, with movement/cancellation and detach
cancelling an unfinished hold. Native Enter/Space opens playback once, Escape
closes it and returns focus to the preview. Connection or user changes close
playback; ordinary state updates retain the current player.

Old image failures cannot quarantine a newer token or another HA connection.
Signed Frigate endpoints are prefetched for the owning connection; an initial
playback signing failure retries once while that mount remains current. Closing
or removing the card cancels that retry. Native HA helper results and player
events from older mounts are ignored. Embedded Summary cameras use a body portal
across shadow roots, retain their styles and remove the portal on close/detach.
