import { createElement } from "@lwc/engine-dom";
import PolymorphicLookupFlowWrapper from "c/polymorphicLookupFlowWrapper";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createComponent(props = {}) {
  const el = createElement("c-polymorphic-lookup-flow-wrapper", {
    is: PolymorphicLookupFlowWrapper
  });
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
// Object option generation from CSV inputs
// ===========================================================================
describe("generateObjectOptions (CSV parsing)", () => {
  it("builds objectOptions from comma-separated API names", async () => {
    const el = createComponent({ objectApiNames: "Account,Contact" });
    await flushPromises();

    // The inner polymorphicLookup should receive computed options
    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner).not.toBeNull();
    expect(inner.objectOptions).toHaveLength(2);
    expect(inner.objectOptions[0].value).toBe("Account");
    expect(inner.objectOptions[1].value).toBe("Contact");
  });

  it("maps icon names to corresponding object options", async () => {
    const el = createComponent({
      objectApiNames: "Account,Contact",
      iconNames: "standard:account,standard:contact"
    });
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.objectOptions[0].iconName).toBe("standard:account");
    expect(inner.objectOptions[1].iconName).toBe("standard:contact");
  });

  it("defaults icon to standard:default when iconNames is shorter", async () => {
    const el = createComponent({
      objectApiNames: "Account,Contact",
      iconNames: "standard:account"
    });
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.objectOptions[1].iconName).toBe("standard:default");
  });

  it("maps subtitle fields to corresponding object options", async () => {
    const el = createComponent({
      objectApiNames: "Account,Contact",
      subtitleFields: "Phone,Email"
    });
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.objectOptions[0].subtitleField).toBe("Phone");
    expect(inner.objectOptions[1].subtitleField).toBe("Email");
  });

  it("produces empty objectOptions when objectApiNames is not set", async () => {
    const el = createComponent({});
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.objectOptions).toHaveLength(0);
  });
});

// ===========================================================================
// Plural label generation
// ===========================================================================
describe("plural label generation", () => {
  it("uses pluralLabels CSV when provided", async () => {
    const el = createComponent({
      objectApiNames: "Opportunity,Case",
      pluralLabels: "Opportunities,Cases"
    });
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.objectOptions[0].plural).toBe("Opportunities");
    expect(inner.objectOptions[1].plural).toBe("Cases");
  });

  it("auto-generates smart plurals when pluralLabels is not set", async () => {
    const el = createComponent({
      objectApiNames: "Account,Opportunity,Case,Address"
    });
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.objectOptions[0].plural).toBe("Accounts");
    expect(inner.objectOptions[1].plural).toBe("Opportunities");
    expect(inner.objectOptions[2].plural).toBe("Cases");
    expect(inner.objectOptions[3].plural).toBe("Addresses");
  });

  it("handles words ending in -y with preceding vowel correctly", async () => {
    const el = createComponent({ objectApiNames: "Survey" });
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.objectOptions[0].plural).toBe("Surveys");
  });

  it("handles words ending in -s correctly", async () => {
    const el = createComponent({ objectApiNames: "Campus" });
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.objectOptions[0].plural).toBe("Campuses");
  });
});

// ===========================================================================
// Filter JSON parsing
// ===========================================================================
describe("filterJson parsing", () => {
  it("parses valid JSON filter config", async () => {
    const el = createComponent({
      objectApiNames: "Account",
      filterJson: '{"Account": "Type = \'Customer\'"}'
    });
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.filterConfig).toEqual({ Account: "Type = 'Customer'" });
  });

  it("handles invalid JSON gracefully", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const el = createComponent({
      objectApiNames: "Account",
      filterJson: "not valid json"
    });
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.filterConfig).toEqual({});
    consoleSpy.mockRestore();
  });

  it("defaults to empty object when filterJson is not set", async () => {
    const el = createComponent({ objectApiNames: "Account" });
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.filterConfig).toEqual({});
  });
});

// ===========================================================================
// Property pass-through
// ===========================================================================
describe("property pass-through to inner lookup", () => {
  it("passes label to inner component", async () => {
    const el = createComponent({
      objectApiNames: "Account",
      label: "My Custom Label"
    });
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.label).toBe("My Custom Label");
  });

  it("passes required to inner component", async () => {
    const el = createComponent({
      objectApiNames: "Account",
      required: true
    });
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.required).toBe(true);
  });

  it("passes multiSelect to inner component", async () => {
    const el = createComponent({
      objectApiNames: "Account",
      multiSelect: true
    });
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.multiSelect).toBe(true);
  });

  it("passes dropdownLimit and modalLimit to inner component", async () => {
    const el = createComponent({
      objectApiNames: "Account",
      dropdownLimit: 10,
      modalLimit: 100
    });
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    expect(inner.dropdownLimit).toBe(10);
    expect(inner.modalLimit).toBe(100);
  });
});

// ===========================================================================
// Flow validation
// ===========================================================================
describe("Flow validation contract", () => {
  it("validate() returns isValid: true when not required", () => {
    const el = createComponent({ objectApiNames: "Account" });
    const result = el.validate();
    expect(result.isValid).toBe(true);
  });

  it("validate() returns isValid: false when required and no selection", () => {
    const el = createComponent({
      objectApiNames: "Account",
      required: true
    });
    const result = el.validate();
    expect(result.isValid).toBe(false);
  });

  it("setCustomValidity and reportValidity delegate to inner lookup", async () => {
    const el = createComponent({ objectApiNames: "Account" });
    await flushPromises();

    el.setCustomValidity("Test error");
    el.reportValidity();
    await flushPromises();

    const inner = el.shadowRoot.querySelector("c-polymorphic-lookup");
    const errorEl = inner.shadowRoot.querySelector(
      'p.slds-form-element__help[role="alert"]'
    );
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe("Test error");
  });
});

// ===========================================================================
// allowCrossObjectSelection coercion
// ===========================================================================
describe("allowCrossObjectSelection boolean coercion", () => {
  it('coerces string "false" to boolean false', () => {
    const el = createComponent({
      objectApiNames: "Account,Contact",
      multiSelect: true,
      allowCrossObjectSelection: "false"
    });
    expect(el.allowCrossObjectSelection).toBe(false);
  });

  it("passes boolean false through", () => {
    const el = createComponent({
      objectApiNames: "Account,Contact",
      multiSelect: true,
      allowCrossObjectSelection: false
    });
    expect(el.allowCrossObjectSelection).toBe(false);
  });

  it("defaults to true", () => {
    const el = createComponent({
      objectApiNames: "Account,Contact",
      multiSelect: true
    });
    expect(el.allowCrossObjectSelection).toBe(true);
  });
});
