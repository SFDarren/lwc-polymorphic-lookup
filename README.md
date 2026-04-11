# LWC Polymorphic Lookup

A production-ready, plug-and-play combobox field for Salesforce LWC and Flow screens. Search across **one or more SObject types**, select a record, and receive a rich event with the record's ID, name, object type, and icon.

<video src="https://github.com/user-attachments/assets/6874e42c-9039-4af0-9c51-a4c09c940ca6" controls width="100%" autoplay></video>

---

## Features

- **Multi-object switcher** — hidden automatically when only one object is configured
- **Throttled search** with inline dropdown and "Show All" modal (datatable)
- **Per-object SOQL filters** — `filterConfig` injects a WHERE clause per object
- **"New Record" flow** — opens an object create popup via NavigationMixin, auto-selects the newly created record on return
- **Fixed-position dropdown** — escapes CSS `transform` stacking contexts (e.g., SLDS modals)
- **Full Form API** — `checkValidity()`, `reportValidity()`, `setCustomValidity()` match LWC platform base components
- **Flow-ready wrapper** — CSV string inputs compatible with Flow Builder text fields, implements the Flow `validate()` lifecycle
- **Pre-population** — set `value` to a record ID to resolve and display the record name on load
- **Accessibility** — keyboard navigation (Arrow keys, Escape), ARIA labels, live regions, modal focus management
- **CSS custom properties** — theme the dropdown height, focus ring color, and z-index from the consumer

---

## Installation

```bash
sf project deploy start --source-dir force-app
```

Requires the `PolymorphicLookupController` Apex class and the `polymorphicLookup` + `polymorphicLookupFlowWrapper` LWC bundles.

---

## Usage

### 1. LWC-to-LWC

Pass a JS array to `object-options` and listen for the `onselect` event.

```html
<c-polymorphic-lookup
    label="Related To"
    object-options={objectOptions}
    filter-config={filterConfig}
    required
    show-create
    dropdown-limit="5"
    modal-limit="50"
    field-level-help="Select the record this activity is related to."
    message-when-value-missing="Please select a record."
    onselect={handleSelect}>
</c-polymorphic-lookup>
```

```js
// objectOptions shape
objectOptions = [
    {
        label: 'Account',         // display label in switcher / placeholder
        plural: 'Accounts',       // used in placeholder and modal header
        value: 'Account',         // SObject API name passed to Apex
        iconName: 'standard:account',
        subtitleField: 'Phone'    // second field shown below the record name
    },
    {
        label: 'Contact',
        plural: 'Contacts',
        value: 'Contact',
        iconName: 'standard:contact',
        subtitleField: 'Email'
    }
];

// filterConfig — WHERE clause per object (trusted admin input only, not end-user)
get filterConfig() {
    return {
        Account: "CreatedDate >= LAST_N_DAYS:365",
        Opportunity: "IsWon = true"
    };
}

// Event detail: { recordId, objectType, recordName, iconName }
handleSelect(event) {
    const { recordId, objectType, recordName, iconName } = event.detail;
}
```

#### Validation (Form API)

The component implements the same API as LWC base form components:

```js
// check without showing UI
const isValid = this.template.querySelector('c-polymorphic-lookup').checkValidity();

// trigger inline error display and return validity
const isValid = this.template.querySelector('c-polymorphic-lookup').reportValidity();

// set a programmatic error (empty string clears)
this.template.querySelector('c-polymorphic-lookup').setCustomValidity('Must select a closed-won opportunity.');
this.template.querySelector('c-polymorphic-lookup').reportValidity();
```

#### Pre-population

```html
<!-- Single-object: object is auto-inferred -->
<c-polymorphic-lookup
    label="Account"
    object-options={singleObjectOptions}
    value={existingAccountId}>
</c-polymorphic-lookup>

<!-- Multi-object: must also supply valueObjectApiName -->
<c-polymorphic-lookup
    label="Related To"
    object-options={multiObjectOptions}
    value={existingRecordId}
    value-object-api-name="Contact">
</c-polymorphic-lookup>
```

---

### 2. Flow Screen

Drag **Polymorphic Lookup (Flow)** onto a Flow screen. No JavaScript required.

| Property | Type | Description |
|---|---|---|
| **Field Label** | Text | Label shown above the field |
| **Object API Names (CSV)** | Text | e.g. `Account,Contact,Case` |
| **Icon Names (CSV)** | Text | e.g. `standard:account,standard:contact,standard:case` |
| **Subtitle Fields (CSV)** | Text | e.g. `Phone,Email,Status` |
| **Filter Configuration (JSON)** | Text | e.g. `{"Account": "Type = 'Customer'"}` |
| **Required** | Boolean | Enables built-in Flow validation |
| **Show New Record Option** | Boolean | Adds "New {Object}" to dropdown |
| **Dropdown Result Limit** | Number | Default: 5 |
| **Modal Result Limit** | Number | Default: 50 |
| **Placeholder Text** | Text | Overrides auto-generated placeholder |

**Outputs** (use in subsequent Flow elements):
- `{!YourComponentName.selectedRecordId}` — 18-char record ID
- `{!YourComponentName.selectedObjectType}` — SObject API name

---

## Full @api Surface

| Property | Type | Default | Description |
|---|---|---|---|
| `label` | String | `"Related To"` | Field label |
| `objectOptions` | Array | `[]` | Object config array (see shape above) |
| `required` | Boolean | `false` | Shows red asterisk; triggers validation |
| `filterConfig` | Object | `{}` | Per-object SOQL WHERE clauses |
| `showCreate` | Boolean | `false` | Adds "New {Object}" option |
| `disabled` | Boolean | `false` | Disables all interaction |
| `value` | String | `null` | Pre-populate with a record ID |
| `valueObjectApiName` | String | `null` | Required for `value` in multi-object mode |
| `variant` | String | `"standard"` | `"standard"` or `"label-hidden"` |
| `placeholder` | String | auto | Overrides auto-generated placeholder |
| `dropdownLimit` | Integer | `5` | Max records in inline dropdown |
| `modalLimit` | Integer | `50` | Max records in "Show All" modal |
| `fieldLevelHelp` | String | `null` | Tooltip next to label |
| `messageWhenValueMissing` | String | `"Complete this field."` | Validation error text |

| Method | Returns | Description |
|---|---|---|
| `checkValidity()` | Boolean | `true` if valid; no UI change |
| `reportValidity()` | Boolean | Shows/hides inline error; returns validity |
| `setCustomValidity(msg)` | void | Set or clear a custom error string |

| Event | Detail | Description |
|---|---|---|
| `select` | `{ recordId, objectType, recordName, iconName }` | Fires on selection and on clear (`recordId` is `null` on clear) |

---

## CSS Custom Properties

Override on a parent element or via Experience Cloud theming:

```css
c-polymorphic-lookup {
    --polymorphic-lookup-dropdown-max-height: 400px;
    --polymorphic-lookup-focus-color: #1b96ff;
    --polymorphic-lookup-z-index: 9000;
}
```

---

## Apex Controller

`PolymorphicLookupController` exposes two methods:

| Method | Cacheable | Description |
|---|---|---|
| `searchRecords` | Yes | Dynamic SOQL across any object. Uses `Database.queryWithBinds` + `AccessLevel.USER_MODE` for FLS/CRUD enforcement |
| `getLatestCreatedRecord` | No | Fetches the most recent record created by the current user in the last 30 seconds (used after "New Record" navigation) |
| `getRecordById` | Yes | Resolves a record ID to display name + subtitle (used for `value` pre-population) |

> **Security note:** The `whereClause` parameter in `searchRecords` is appended as a raw SOQL fragment and must come from **trusted admin config** (Flow input / LWC property), not from end-user input.

---

## Development

```bash
# Run Jest unit tests
npm run test:unit

# Run tests in watch mode
npm run test:unit:watch

# Lint
npm run lint

# Format
npm run prettier

# Deploy
sf project deploy start --source-dir force-app

# Local dev server (hot reload, no deploy)
sf lightning dev component --target-org <alias>
```

Pre-commit hooks auto-run prettier, eslint, and jest on staged files.

---

## License

MIT
