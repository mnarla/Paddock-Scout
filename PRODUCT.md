# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Formula 1 fans who want to explore a race-weekend prediction for a specific driver and understand which inputs move that prediction.

## Product Purpose

Paddock Scout combines current and historical Formula 1 data with a trained prediction model. The primary workflow is to select a driver, read the model's win and podium probabilities, and adjust race inputs to explore alternative outcomes.

## Positioning

The product presents model-driven race forecasts as an interactive pit-wall instrument rather than a static odds table. It connects the headline prediction to qualifying position, recent form, feature contributions, live race context, upgrades, and historical results.

## Operating Context

The product is used around a race weekend, often while users are also following Formula 1 timing, qualifying, news, or race coverage. Dense but quickly scannable data and clear live-versus-model status are important.

## Capabilities and Constraints

- Preserve the existing React and TanStack Router frontend and Python API behavior.
- Preserve driver selection, prediction requests, scenario controls, feature weights, calendar, upgrades, countdown, and archive functionality.
- Dynamic data may fall back to bundled 2026 data when the API is unavailable.
- Predictions are informational model outputs, not betting advice.

## Brand Commitments

- Product name: Paddock Scout.
- Formula 1 is the subject, but the interface must not imply it is an official FIA or Formula 1 product.
- The approved visual direction is broadcast timing graphics combined with a pit-wall engineering terminal.
- The interface should feel intentionally designed and motorsport-specific, not like a generic dark SaaS dashboard.

## Evidence on Hand

The repository contains real product flows, bundled 2026 driver/team/calendar data, model outputs, feature weights, technical-upgrade data, and historical archive views. Do not invent commercial claims, official affiliations, or model-performance guarantees.

## Product Principles

- Put the selected driver's prediction at the center of the experience.
- Make model status and data provenance legible.
- Use motorsport language and information structures without sacrificing clarity.
- Let team identity provide contextual color while the product maintains a restrained global palette.
- Preserve useful density, but create an unmistakable reading order.

## Accessibility & Inclusion

Maintain keyboard access, visible focus states, reduced-motion support, readable contrast, and responsive operation on desktop and mobile web.
