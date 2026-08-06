# Motiro mobile

React Native / Expo implementation of the current Motiro flow: create a party, add participants and items, record purchases, and calculate equal-split balances and settlements.

## Run it

1. Install Node.js 20 or newer.
2. From this directory, run `npm install`.
3. Run `npm run android` and choose an Android emulator or a physical device with Expo Go.

The initial release deliberately stores data in memory, matching the current Android app. The domain files in `src/domain` are UI-independent and can be reused by the web client.
