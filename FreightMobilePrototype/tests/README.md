# Mobile smoke test

The test opens `index.html` directly with `file://`, exercises customer and carrier flows, and writes screen captures to `/tmp/freight-ui-after/`.

Playwright is loaded from a temporary tool directory. To set it up on another machine, run `npm install --prefix /tmp/freight-ui-tools --no-audit --no-fund playwright`. No production dependency is added to the project:

```sh
NODE_PATH=/tmp/freight-ui-tools/node_modules node tests/smoke.cjs
```

If Chrome is in a different location, set `CHROME_BIN` to its executable path. The script checks the supported viewport sizes, local sign-in and registration, order periods and status filters, form validation and currencies, status timestamps, local document/photo selection, gallery keyboard/back behavior, 2GIS link construction without opening it, and browser errors. It uses the two attributed local images as test input files. The app itself does not present them as cargo photos unless the test explicitly selects them in the upload control.

Regression checks cover unique order IDs, customer ownership after sign-out/sign-in, carrier navigation and report counts, unsafe monetary values, and photo bounds in landscape. Each browser action has an 8-second timeout. A `finally` block closes Chromium after success or failure so an assertion cannot leave the test process waiting indefinitely.

Real iOS/Android keyboards, screen readers, pinch gestures and opening the 2GIS app still need a device check. CDP safe-area emulation does not replace that check.
