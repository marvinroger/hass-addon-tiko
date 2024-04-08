# Changelog

## 1.4.6

- Fix errors when temperature sensor battery is low

## 1.4.5

- Fix errors when temperature sensor is disconnected

## 1.4.4

- Fix error `null value in column "retain_mobile_session"` that some users might encounter

## 1.4.3

- Fix authentication error due to token being expired

## 1.4.2

- Fix state being stale due to a logic error

## 1.4.1

- Fix lockup by refreshing tokens every 12 hours
- Handle rate limiting by waiting for the next available time slot
- Fix misleading credentials error when it's in fact due to rate limiting
- Make error messages more explicit

## 1.4.0

- Fix the API communication with tiko by handling cookies
- Report the devices as `unavailable` when the API communication fails

## 1.3.1

- Fix the warning `'dict object' has no attribute 'current_humidity'` when humidity is not supported

## 1.3.0

- Add a new `Bypass tiko schedule` option to avoid having the target temperature reset by the tiko schedule.

  This works by effectively deleting all the schedules set on the tiko app

## 1.2.0

- Add new sensors for the current temperature and humidity

## 1.1.0

- Allow the add-on to run outside of the Home Assistant Supervisor context.

  This allows the add-on to be deployed as a standalone container for advanced use-cases

## 1.0.6

- Fix issue where MQTT discovery could fail

## 1.0.5

- Ignore humidity data if it's not supported

## 1.0.4

- Fix domain prefix

## 1.0.3

- Fix container not starting

## 1.0.2

- Add support for Mon Pilotage Elec (not tested)

## 1.0.1

- Don't report error if `null` is returned as `rooms` from tiko

## 1.0.0

- Initial release
