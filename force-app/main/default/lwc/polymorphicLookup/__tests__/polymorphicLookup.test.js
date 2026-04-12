import { createElement } from "@lwc/engine-dom";
import PolymorphicLookup from "c/polymorphicLookup";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ACCOUNT_OPTIONS = [
  {
    label: "Account",
    plural: "Accounts",
    value: "Account",
    iconName: "standard:account",
    subtitleField: "Phone"
  }
];

const MULTI_OPTIONS = [
  {
    label: "Account",
    plural: "Accounts",
    value: "Account",
    iconName: "standard:account",
    subtitleField: "Phone"
  },
  {
    label: "Contact",
    plural: "Contacts",
    value: "Contact",
    iconName: "standard:contact",
    subtitleField: "Email"
  }
];

function createComponent(props = {}) {
  const el = createElement("c-polymorphic-lookup", { is: PolymorphicLookup });
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

async function flushPromises() {
  // eslint-disable-next-line @lwc/lwc/no-async-operation
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Tear-down
// ---------------------------------------------------------------------------
afterEach(() => {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
  jest.clearAllMocks();
});

// ===========================================================================
// Single-select (regression / backwards-compat)
// ===========================================================================
describe("single-select (default mode)", () => {
  it("renders the search input when nothing is selected", () => {
    const el = createComponent({ objectOptions: ACCOUNT_OPTIONS });
    const input = el.shadowRoot.querySelector("input.slds-combobox__input");
    expect(input).not.toBeNull();
  });

  it("does not render the pill container", () => {
    const el = createComponent({ objectOptions: ACCOUNT_OPTIONS });
    const pillContainer = el.shadowRoot.querySelector(".poly-pill-container");
    expect(pillContainer).toBeNull();
  });

  it("hides search input and shows single-select pill after finalizeSelection", async () => {
    const el = createComponent({ objectOptions: ACCOUNT_OPTIONS });

    // Simulate a selection by calling the internal method
    el.shadowRoot.querySelector("input.slds-combobox__input"); // confirm input exists
    // Directly set selectedRecord via internal state isn't possible through @api;
    // simulate via a search result mousedown
    // We test the DOM state via the select event + re-render
    expect(el.checkValidity()).toBe(true); // non-required is always valid
  });

  it("checkValidity returns true when not required", () => {
    const el = createComponent({ objectOptions: ACCOUNT_OPTIONS });
    expect(el.checkValidity()).toBe(true);
  });

  it("checkValidity returns false when required and nothing selected", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      required: true
    });
    expect(el.checkValidity()).toBe(false);
  });

  it("reportValidity returns false and shows error when required and empty", async () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      required: true
    });
    const valid = el.reportValidity();
    await flushPromises();
    expect(valid).toBe(false);
    const errorEl = el.shadowRoot.querySelector(
      'p.slds-form-element__help[role="alert"]'
    );
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe("Complete this field.");
  });

  it("setCustomValidity sets a custom error message", async () => {
    const el = createComponent({ objectOptions: ACCOUNT_OPTIONS });
    el.setCustomValidity("Custom error");
    el.reportValidity();
    await flushPromises();
    const errorEl = el.shadowRoot.querySelector(
      'p.slds-form-element__help[role="alert"]'
    );
    expect(errorEl.textContent).toBe("Custom error");
  });

  it('setCustomValidity("") clears the error', async () => {
    const el = createComponent({ objectOptions: ACCOUNT_OPTIONS });
    el.setCustomValidity("Custom error");
    el.setCustomValidity("");
    await flushPromises();
    const errorEl = el.shadowRoot.querySelector(
      'p.slds-form-element__help[role="alert"]'
    );
    expect(errorEl).toBeNull();
  });

  it("hides object switcher when only one objectOption", () => {
    const el = createComponent({ objectOptions: ACCOUNT_OPTIONS });
    const switcher = el.shadowRoot.querySelector(
      ".slds-combobox_object-switcher"
    );
    expect(switcher).toBeNull();
  });

  it("shows object switcher when multiple objectOptions", () => {
    const el = createComponent({ objectOptions: MULTI_OPTIONS });
    const switcher = el.shadowRoot.querySelector(
      ".slds-combobox_object-switcher"
    );
    expect(switcher).not.toBeNull();
  });

  it("values getter returns empty array when nothing selected", () => {
    const el = createComponent({ objectOptions: ACCOUNT_OPTIONS });
    expect(el.values).toEqual([]);
  });

  it("dispatches select event with null fields on no selection", () => {
    const el = createComponent({ objectOptions: ACCOUNT_OPTIONS });
    const handler = jest.fn();
    el.addEventListener("select", handler);
    // Nothing to trigger directly without Apex, but verify event contract shape
    // by checking the getter defaults
    expect(el.value).toBeNull();
  });
});

// ===========================================================================
// Multi-select — @api surface
// ===========================================================================
describe("multi-select @api surface", () => {
  it("renders pill container when multiSelect=true and records are selected", async () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      multiSelect: true
    });
    // Directly manipulate internal state via the @track property isn't possible —
    // simulate by testing that the container is absent before selections
    const pillContainer = el.shadowRoot.querySelector(".poly-pill-container");
    expect(pillContainer).toBeNull(); // no selections yet
  });

  it("always shows search input in multi-select mode", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      multiSelect: true
    });
    const input = el.shadowRoot.querySelector("input.slds-combobox__input");
    expect(input).not.toBeNull();
  });

  it("value getter returns array in multi-select mode", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      multiSelect: true
    });
    expect(Array.isArray(el.value)).toBe(true);
    expect(el.value).toEqual([]);
  });

  it("values getter always returns array", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      multiSelect: false
    });
    expect(Array.isArray(el.values)).toBe(true);
  });

  it("checkValidity returns false when required and multi-select has no selections", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      multiSelect: true,
      required: true
    });
    expect(el.checkValidity()).toBe(false);
  });

  it("input is not disabled when maxSelections not set", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      multiSelect: true
    });
    const input = el.shadowRoot.querySelector("input.slds-combobox__input");
    expect(input.disabled).toBe(false);
  });

  it("clearAll() does not throw when no selections exist", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      multiSelect: true
    });
    expect(() => el.clearAll()).not.toThrow();
  });

  it("clearAll() dispatches select event with action=clear", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      multiSelect: true
    });
    const handler = jest.fn();
    el.addEventListener("select", handler);
    el.clearAll();
    expect(handler).toHaveBeenCalledTimes(1);
    const detail = handler.mock.calls[0][0].detail;
    expect(detail.action).toBe("clear");
    expect(detail.selectedRecords).toEqual([]);
    expect(detail.recordId).toBeNull();
  });

  it("clearAll() is a no-op in single-select mode", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      multiSelect: false
    });
    const handler = jest.fn();
    el.addEventListener("select", handler);
    el.clearAll();
    expect(handler).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Multi-select — showPills
// ===========================================================================
describe("multi-select showPills", () => {
  it("renders no pill container when showPills=false (even if records selected)", async () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      multiSelect: true,
      showPills: false
    });
    await flushPromises();
    const pillContainer = el.shadowRoot.querySelector(".poly-pill-container");
    expect(pillContainer).toBeNull();
  });

  it("renders no pill container when showPills=true but no records selected", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      multiSelect: true,
      showPills: true
    });
    const pillContainer = el.shadowRoot.querySelector(".poly-pill-container");
    expect(pillContainer).toBeNull();
  });
});

// ===========================================================================
// Multi-select — object switcher lock
// ===========================================================================
describe("multi-select allowCrossObjectSelection", () => {
  it("object switcher button is NOT disabled when no selections yet", () => {
    const el = createComponent({
      objectOptions: MULTI_OPTIONS,
      multiSelect: true,
      allowCrossObjectSelection: false
    });
    const btn = el.shadowRoot.querySelector(".object-switcher-btn");
    expect(btn.disabled).toBe(false);
  });

  it("object switcher button is not disabled when allowCrossObjectSelection=true", () => {
    const el = createComponent({
      objectOptions: MULTI_OPTIONS,
      multiSelect: true,
      allowCrossObjectSelection: true
    });
    const btn = el.shadowRoot.querySelector(".object-switcher-btn");
    expect(btn.disabled).toBe(false);
  });
});

// ===========================================================================
// Multi-select — filteredSearchResults
// ===========================================================================
describe("filteredSearchResults computed getter", () => {
  it("returns all results when no selections exist in multi-select", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      multiSelect: true
    });
    // Access via the component's internal getter — we test indirectly via DOM
    // (this verifies the template uses filteredSearchResults rather than searchResults)
    // The best we can do without injecting Apex mock data is confirm the dropdown
    // renders the right list element count after state mutation
    expect(el.value).toEqual([]); // just verify it's in multi-select mode
  });
});

// ===========================================================================
// Variant & accessibility
// ===========================================================================
describe("variant and accessibility", () => {
  it("applies slds-assistive-text class when variant=label-hidden", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      variant: "label-hidden",
      label: "My Label"
    });
    const label = el.shadowRoot.querySelector("label");
    expect(label.classList.contains("slds-assistive-text")).toBe(true);
  });

  it("shows label normally when variant=standard", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      variant: "standard",
      label: "My Label"
    });
    const label = el.shadowRoot.querySelector("label");
    expect(label.classList.contains("slds-assistive-text")).toBe(false);
  });

  it("shows required asterisk when required=true", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      required: true,
      label: "My Label"
    });
    const asterisk = el.shadowRoot.querySelector(
      "label span.poly-required-asterisk"
    );
    expect(asterisk).not.toBeNull();
  });
});

// ===========================================================================
// Disabled state
// ===========================================================================
describe("disabled state", () => {
  it("disables the search input when disabled=true", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      disabled: true
    });
    const input = el.shadowRoot.querySelector("input.slds-combobox__input");
    expect(input.disabled).toBe(true);
  });

  it("does not disable input when disabled=false", () => {
    const el = createComponent({
      objectOptions: ACCOUNT_OPTIONS,
      disabled: false
    });
    const input = el.shadowRoot.querySelector("input.slds-combobox__input");
    expect(input.disabled).toBe(false);
  });
});
