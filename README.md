# lwc-polymorphic-lookup
A reusable, fully configurable Polymorphic Lookup component for Salesforce LWC and Screen Flows. Supports custom filters, dynamic subtitles, and "Show All" modal.

# LWC Polymorphic Lookup

## Features
- Search across multiple objects (Polymorphic behavior).
- **Flow Support:** Drag-and-drop into Screen Flows with CSV configuration.
- **Custom Filters:** Apply SOQL filters per object using JSON.
- **Dynamic UI:** Configurable Icons and Subtitles (e.g. show Email for Contacts).

## Installation
1. Deploy source to your org using SFDX.
2. Assign the `PolymorphicLookup` permission set (if you create one).

## Usage

### In LWC
```html
<c-polymorphic-lookup
    label="Related To"
    object-options={myOptions}
    filter-config={myFilters}
    onselect={handleSelect}>
</c-polymorphic-lookup>
```
### In Flow

1. Drag Polymorphic Lookup (Flow) to the screen.
2. Set Object API Names: Account, Opportunity
3. Set Filter JSON: {"Account": "Type = 'Customer'"}

### License
MIT
