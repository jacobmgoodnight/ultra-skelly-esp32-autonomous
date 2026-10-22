# Contributing

This project documents field tests performed on a single Home Depot Ultra Skelly v2. Different firmware or hardware revisions may behave differently.

If contributing a test report, include (when comfortable) the ESP32 package version, Skelly firmware revision if known, whether head/jaw/eyes behaved as expected, and the exact command bytes from your Serial Monitor. **Please remove personal device addresses, network secrets, or private information from logs before sharing them publicly.**

Please distinguish **verified on physical hardware** from **inferred from a source implementation**. Avoid enabling torso/arm experiments by default. Keep experimental commands in an isolated sketch until confirmed.

For Studio bugs, include your browser/version, reproduction steps and the settings
that trigger the problem. A reduced JSON profile is helpful after checking it for
private device names. Never post credentials or personal Bluetooth addresses.

## Development

Use Node.js 22, Python 3 and a C++17 compiler for the automated checks. Firmware
compilation uses **Arduino-ESP32 3.3.12**, board **ESP32 Dev Module**. Follow the
commands in [docs/testing.md](docs/testing.md); mocked tests and compilation are
software evidence only.

Edit the canonical `firmware/SkellyAutonomous/SkellyAutonomous.ino`, then run
`node scripts/sync-template.cjs`. Do not edit `studio/template.js` by hand.
After Studio JavaScript, CSS or template changes, run
`node scripts/version-studio-assets.cjs`. Keep motor cooldowns and feature defaults
conservative, and include attended pass/fail criteria for unverified behavior.

Keep pull requests focused. Explain the problem, resulting behavior and checks
run. Document physical observations in the verification matrix separately from
logs; a successful BLE write is not proof of movement. Feature ideas and reports
are welcome through [GitHub Issues](https://github.com/jacobmgoodnight/ultra-skelly-esp32-autonomous/issues).
