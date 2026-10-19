# Brandbeat UI

## Authority
`/Users/sidbhat/Downloads/brandbeat_ui_book_colors.pdf`, Brandbeat Color & Brandbook v1.0, October 2026, supplied by the user. Nine-page image-based PDF; guidelines recovered with local Apple Vision OCR. Ambiguous OCR hex values were resolved against the repeated application-map values (Bone and Black). This replaces the provisional white/orange direction.

Keep the user's minimal, text-first B2B workflow. The brandbook supplies identity, not permission to restore decorative records, gradients or 3D animations.

## Tokens
| Role | Value |
| --- | --- |
| Bone canvas | #F2EEE5 |
| Penguin Red | #B8451F |
| Hover / pressed | #9C3A1A / #82301A |
| Primary text | #0A0A0A |
| Supporting text | #5A5550 |
| Soft surface | #ECE7DC |
| Hairline | #C5BFB5 |
| App surfaces | #FFFFFF |
| Accent tint | #F5E8E2 |
| Player | #111111 |
| Live dot | #10B981 |

Use Hairline for structure, never essential text. Status colours have functional meaning, not decorative meaning. Excluded genres use #B91C1C on #FEF2F2 with #EF4444 border. Player stats use the four specified dashboard tints and matching borders; primary numbers use rust. Customer-uploaded palettes remain project data, not application chrome.

## Typography and shape
Cormorant Garamond 500/600 for identity, page headings, section headings and stat numbers. Inter Variable for app body, navigation, labels and controls. Fonts loaded through Next's font pipeline. Wordmark is rust “B” + black “randbeat”, weight 600. No invented logo artwork.

4px button corners, 14px app containers, 16px stats, pill badges. White fields and cards on Bone. Primary buttons use white text in the app, Bone on the landing page. Disabled app buttons use Hairline at 60% opacity; landing primary uses 50%. Rust sidebar uses 12% white hover and 22% white active overlays.

## Structure
Persistent rust navigation on desktop, wrapping navigation strip on small screens. Content remains task-first: heading, short guidance, labelled fields or rows, one primary next action. Desktop maximum 1440px, 32px content padding, 16px mobile padding. Tablet daypart graphs stack rather than squeeze.

- Brand: form, optional validated website and asset upload. URLs are saved, not crawled. Demo assets store filenames and extracted image colours, not uploaded document contents.
- Customers: selection table and optional add form. Table scroll stays within its container.
- Aaker: editable product, organisation, person and symbol sections; two columns becoming one.
- Soundboard: horizontal sliders and explicit genre selection/exclusion.
- Songs: plain rows, expandable reasons, pin/swap, guarded Regenerate and feedback.
- Week: each day has three independent energy graphs from actual scheduled song order, fixed 0–100 scale, accessible values and expandable playlists. Not audience forecasts or clock-time analytics.
- Player: near-black playback console with visible Playing/Paused/Announcement status, labelled transport, functional live indicator, separate stats and schedule. No decorative canvas.

## Verification and limitations
Preserve URL validation/persistence, Aaker editing, kept-song regeneration, approval gates and all 21 daypart graphs. Browser checks cover desktop 1440, tablet 768 and mobile 390, with no decorative canvases or horizontal document overflow. Local screenshot capture is available, but this session cannot visually inspect image attachments; do not claim a visual pixel-match audit.

The public deployed reference is accessible; the app is behind login. Exact graph parity remains unverified. The supplied PDF establishes UI brand colours and typography; it is not a client's business brand deck for intake.
