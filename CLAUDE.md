# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run all Jest unit tests
npm run test:unit

# Run tests in watch mode (during active development)
npm run test:unit:watch

# Run tests for a specific component
npx sfdx-lwc-jest -- --testPathPattern=polymorphicLookup

# Lint LWC/Aura JS files
npm run lint

# Format all files (Apex, LWC, XML, etc.)
npm run prettier

# Deploy to default org
sf project deploy start --source-dir force-app

# Deploy a single component
sf project deploy start --source-dir force-app/main/default/lwc/polymorphicLookup
sf project deploy start --source-dir force-app/main/default/classes/PolymorphicLookupController.cls

# Live preview (no deploy required)
sf lightning dev component --target-org <alias>
```

Pre-commit hooks auto-run prettier, eslint, and jest on staged files.

---

## Architecture: `polymorphicLookup`

This is the core reusable component. It is intentionally **not exposed** (`isExposed: false`) — it must be consumed by a wrapper.

### What it does

A combobox-style lookup field that lets the user search across **one or more Salesforce object types** and select a record. Features:

- Object-type switcher (hidden when only one object is configured)
- Throttled search with dropdown (limit 5) and "Show All" modal (limit 50)
- `filterConfig` per-object SOQL WHERE clause injection
- "New Record" flow using `NavigationMixin` with a poll-on-return pattern to auto-select the just-created record
- Fixed-position dropdown via `requestAnimationFrame` loop — handles rendering inside SLDS modals (transform ancestors)

### `@api` surface (inputs/outputs)

| Property        | Type    | Description                                       |
| --------------- | ------- | ------------------------------------------------- |
| `label`         | String  | Field label. Default: `"Related To"`              |
| `objectOptions` | Array   | Array of object config objects (see shape below)  |
| `required`      | Boolean | Shows red asterisk                                |
| `filterConfig`  | Object  | Map of `{ 'ObjectApiName': 'SOQL WHERE clause' }` |
| `showCreate`    | Boolean | Shows "New {Object}" option in dropdown           |

**Event emitted:** `select` — `event.detail = { recordId, objectType }`

**`objectOptions` item shape:**

```js
{
    label: 'Account',         // Display label
    plural: 'Accounts',       // Used in placeholder and modal header
    value: 'Account',         // SObject API name (passed to Apex)
    iconName: 'standard:account',  // SLDS icon
    subtitleField: 'Phone'    // API name of a second field to show under the name
}
```

---

## Consumption Patterns

### 1. LWC-to-LWC (JS config)

Pass a JS array to `object-options` and a plain JS object to `filter-config`. Listen for the `onselect` event.

### 2. Flow Screen Component

Use `polymorphicLookupFlowWrapper` — it accepts comma-delimited string inputs (`objectApiNames`, `iconNames`, `subtitleFields`) suitable for Flow Builder text fields, plus a `filterJson` string (JSON-stringified filter map). It implements the full Flow validation contract: `validate()`, `setCustomValidity()`, `reportValidity()`.

---

## Apex Controller: `PolymorphicLookupController`

Three `@AuraEnabled` methods:

- **`searchRecords`** (`cacheable=true`): Dynamic SOQL against any object. Uses `Database.queryWithBinds` + `AccessLevel.USER_MODE` for FLS/CRUD enforcement. The `whereClause` parameter is appended as a raw string fragment — it must come from trusted admin config (Flow input / LWC property), **not** from end-user input.

- **`getRecordById`** (`cacheable=true`): Fetches a single record by ID for pre-population of the component when a `value` is set externally.

- **`getLatestCreatedRecord`**: Non-cacheable. Fetches the most recent record created in the last 30 seconds by the current user, used after the "New Record" navigation popup closes.

The `whereClause` in `searchRecords` is the one area that cannot use bind variables (SOQL fragments must be concatenated). Keep this in mind when extending filter support.

---

## Key Implementation Details

- **Dropdown positioning**: The component uses a `position: fixed` element (`lwc:ref="fixedOffsetAnchor"`) as a coordinate origin to escape CSS `transform` stacking contexts (e.g., SLDS modals). A `requestAnimationFrame` loop keeps it aligned while open.
- **Blur handling**: `onblur`/`onfocusout` handlers check `event.relatedTarget` against `this.template.contains()` to avoid closing dropdowns on internal focus moves (scrollbar, list items).
- **New record detection**: After `NavigationMixin.Navigate` opens a new-record popup, a `setInterval` polls `window.location.href` — it waits for the URL to change and then return to the original, then calls `getLatestCreatedRecord`.
- **Single-object mode**: When `objectOptions` has exactly one entry, the object switcher is hidden and the input gets full border radius via the `single-object` CSS class.
