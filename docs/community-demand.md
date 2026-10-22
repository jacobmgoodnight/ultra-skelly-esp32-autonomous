# Owner requests for independent Ultra Skelly routines

Research checked October 21, 2026. These are examples of interest, not a market
size estimate or permission to promote the project in someone else's discussion.
No replies, comments, messages or issues were posted during this research.

## Suggested GitHub description

> Custom autonomous routines for Ultra Skelly v2 on ESP32. Schedule movement at your own intervals with an offline-capable browser configurator. No Wi-Fi, phone or account required after setup.

The practical pitch is **customizable recurring motion without manual app taps
or a sensor trigger**. Fixed equal min/max values request a fixed interval;
different min/max values randomize the interval. Cooldowns, playback and other
work may postpone a request. There is no clock/calendar scheduling feature.

[Three revised Reddit drafts and titles](reddit-posts.md) are ready for review.

## Public places where people asked for related behavior

| Priority | Place and date | What people actually asked/reported | Fit and limits |
| --- | --- | --- | --- |
| Strong | [Reddit: HD Ultra Skelly — Hints at greatness but needs another revision](https://www.reddit.com/r/halloween/comments/1mpkymc/hd_ultra_skelly_hints_at_greatness_but_needs/) — August 13, 2025, with later owner comments | The owner describes Bluetooth mode requiring manual animation triggers rather than acting independently. Other comments discuss unwanted sensor timer limits and wanting sayings/animations without manual intervention. | Closest public discussion found for the core use case. It is historical owner experience, not a test of the latest app. A faulty sensor loop is a separate issue this controller does not repair. Current r/Halloween rules restrict promotion and generated text; do not paste these drafts into this thread. |
| Strong, historical | [DecorPro SVI Canadian App Store reviews](https://apps.apple.com/ca/app/decorpro-svi/id6743928023) — review titled **Brutal**, October 10, 2025 | The reviewer reports having to replay clips manually rather than getting independent playback. A September 30 review also describes switching out of sensor mode for Bluetooth control. | Directly supports the recurring-playback frustration. The review's other claims are not independently verified, and later app versions exist. This is a research lead, not a place to insert an unrelated product review. |
| Related, broader scope | [SkellyUltraWebController issue #2: Multi-Character Halloween Show Automation](https://github.com/martinecker/SkellyUltraWebController/issues/2) — October 13, 2026 | An owner wants six 6.5-foot Ultra Skellys performing scripted dialogue with timed recordings, lighting, fog and other props, without replacing the original electronics. | Clear demand for external/custom automation. **Our controller does not provide six-prop synchronization, scripted dialogue or fog/light-show integration.** It can demonstrate a simpler single-prop recurring routine; do not claim it fulfills the whole request. |
| Related, partial fit | [SVI-Ultra-Skelly-Tools issue #1: Add control of arm, head, torso, jaw if possible](https://github.com/tinkertims/SVI-Ultra-Skelly-Tools/issues/1) — October 15, 2025 | The requester asks for independent joint control and potentially positioning joints by a percentage of travel. | Our enable switches and per-part intervals address part of that interest. **There is no direct joint-position or jaw-angle control.** Keep that limitation explicit. |
| Supplied example, original URL unverified | User-supplied YouTube screenshot, channel handle **@Cartersonthecape**, truncated title **The BEST Skelly Yet?! Home Depot's N…** | A commenter asks for random head movement every few minutes through the night; the creator replies that they wanted the same arrangement with lights on, without pressing an app button each time. | Excellent statement of the desired outcome. The thumbnail says **12-ft** app-controlled Skelly; our tested device is the **6.5-ft Ultra Skelly v2**. No verified original video/comment URL was found, so none is invented here. |

The two exact recurring/manual-trigger complaints above are distinct from the
broader GitHub requests. Search also surfaced AI/vision controllers and unrelated
Skelly products; their presence is not evidence that our particular feature is
unique or that those owners requested the same thing.

## Accurate DecorPro and sensor comparison

The [manufacturer's model 25SV24690 instructions](https://images.thdstatic.com/catalog/pdfImages/de/de31ba83-c4e4-430a-b0be-8d8ccdd4826b.pdf)
describe separate Bluetooth, lights-only, step-pad/try-me, and timer/sensor modes.
Timer/sensor enables the sensor for six hours, then disables it for eighteen;
a sensor trigger requests one animation/sound cycle during its active window.
That is an automatic sensor response with an active-window timer, not a user-set
recurring head-movement interval.

DecorPro already customizes sounds, lights and eyes. Do not say that customization
itself is unique to this project or that the stock prop has no timer/autonomous
response at all. The reviewed app listing describes those customization features;
this research did not independently test every capability of its latest release.

| Approach | Trigger/workflow | What to say |
| --- | --- | --- |
| DecorPro/manual Bluetooth use | User controls/configures the prop through a nearby phone; historical owners describe manually starting animations. | Our ESP32 supplies recurring commands after setup, so a phone need not remain connected. Avoid a blanket claim about every current DecorPro version. |
| Stock sensor/step-pad modes | Animation follows a trigger; sensor mode also has a built-in active window. | Our intervals do not depend on a visitor triggering a sensor or step pad. This does not repair the sensor or combine simultaneous app/sensor control. |
| This ESP32 controller | A dedicated powered ESP32 sends enabled commands at fixed/randomized intervals, respecting cooldowns and coordination. | Customizable recurring routines, local BLE, no runtime phone/Wi-Fi/account. Setup still needs a computer/toolchain and possibly a browser for MP3 preparation. |

## Recommended first outreach

Start with a real demonstration of **head-only movement every 120–240 seconds**
on the supported Ultra Skelly v2. This answers the clearest recurring-motion
request without adding jaw-file preparation or unverified combinations. Caption
it with the device model, interval settings and board/core version.

Use r/ESP32 for the prepared technical/project draft and follow its disclosure
and frequency rules. For existing discussions, offer a relevant answer only
where the community permits it, disclose that it is your project, and state the
single-prop/ESP32 requirement. Do not use App Store reviews as an advertising
channel or post links to unrelated hardware-failure discussions.

Current r/Halloween rules prohibit app/site promotion in the main feed and
generated text in posts/comments. r/HalloweenProps also requires human-generated
content. These notes and drafted posts are not permission to bypass those rules.
