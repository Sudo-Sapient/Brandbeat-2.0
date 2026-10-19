# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Venue owners and managers (cafés, restaurants, bars, fashion retail, hotels, gyms, salons). They set up their own background music once, on their own, and then their staff run the player during opening hours on a tablet or phone at the counter: glancing at it, tapping pause or skip between customers.

## Product Purpose

Brandbeat 2.0 turns a brand into a week of background music. The owner describes the brand (name, category, description, logo/photos/PDF); the product drafts a customer profile, an Aaker brand map, a soundboard, sample songs per part of the day, and spoken announcements, each verified or edited by the owner, then schedules a full week (music plus announcements) and plays it. Success: the owner approves a week that sounds like their brand without needing music knowledge, and staff can run the player without thinking.

## Positioning

Music chosen from the brand itself, not from a mood list: every song carries a plain-language reason it fits this brand at this time of day, and the owner verifies each AI step before it shapes the next.

## Operating Context

- Setup: one sitting, usually on a laptop, by a non-musical owner. Eight steps: brand inputs (agentic intake) → customer profile → brand map (Aaker) → soundboard → vibe check (5 sample songs per daypart, approve/regenerate/edit) → announcements/promos → weekly schedule (week → day → daypart) → player.
- Daily use: the player on a tablet or phone at the counter, in a busy room, glanced at between customers.
- Parts of the day: morning 07–11, midday 11–16, evening 16–22 (mock defaults).

## Capabilities and Constraints

- Current build is a mock: AI responses are synthetic (src/lib/ai.ts, same shapes as future LLM output), music is FPO generated audio, voices use the browser's speech synthesis, state lives in localStorage.
- Production will add: real LLM calls, PDF/asset reading, Lyria (or licensed catalogue) music, Voicemaker voices, database and accounts.
- Logo colour extraction is real and drives the player artwork.
- Stack: Next.js (App Router), TypeScript, Tailwind v4, GSAP, raw WebGL; React Three Fiber and Rive allowed where they earn it.

## Brand Commitments

- Product name: Brandbeat, "a product of Audesy". Wordmark, type, colour and presentation are open (user confirmed nothing else is fixed).
- The current production site's look (brandbeat.audesy.ai) is not a reference; the user called its UI/UX bad.

## Evidence on Hand

None real yet: no customers, testimonials, catalogue, or licensing facts to cite. All demonstration content (brands, songs, scores) is synthetic and must stay labelled as such; never invent claims about licensing, customers, or results.

## Product Principles

1. The owner verifies every AI step; nothing reaches the week unapproved.
2. Every song explains itself in plain language tied to the brand.
3. Speak venue, not music theory: parts of the day, customers, announcements.
4. The player is for a busy counter: glanceable, big targets, one-tap control.
5. The brand's own colours and character show up in what plays.

## Accessibility & Inclusion

WCAG 2.2 AA. Respect reduced motion (shaders and auto-moving content pause). Player controls must be large touch targets usable at arm's length.
