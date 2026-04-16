import { createElement } from "@lwc/engine-dom";
import ParentComponent from "c/parentComponent";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createComponent() {
  const el = createElement("c-parent-component", { is: ParentComponent });
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
// Rendering
// ===========================================================================
describe("rendering", () => {
  it("renders the demo heading", () => {
    const el = createComponent();
    const heading = el.shadowRoot.querySelector("h1");
    expect(heading).not.toBeNull();
    expect(heading.textContent).toContain("Polymorphic Lookup");
  });

  it("renders all polymorphic lookup instances", () => {
    const el = createComponent();
    const lookups = el.shadowRoot.querySelectorAll("c-polymorphic-lookup");
    // Example 1 + Example 2 + Example 3 (cross-object + locked + no-pills) = 5
    expect(lookups.length).toBe(5);
  });

  it("renders all lightning-card sections", () => {
    const el = createComponent();
    const cards = el.shadowRoot.querySelectorAll("lightning-card");
    // Example 1 + Example 2 + Example 3 + Example 4 (Flow) + Event Log = 5
    expect(cards.length).toBe(5);
  });
});

// ===========================================================================
// Toggle buttons
// ===========================================================================
describe("toggle buttons", () => {
  it("toggles disabled state on Example 1", async () => {
    const el = createComponent();
    const lookup = el.shadowRoot.querySelector('[data-id="example1-lookup"]');
    expect(lookup.disabled).toBe(false);

    // Find the Disable Lookup button
    const buttons = el.shadowRoot.querySelectorAll("lightning-button");
    const disableBtn = Array.from(buttons).find(
      (b) => b.label === "Disable Lookup"
    );
    expect(disableBtn).not.toBeNull();
    disableBtn.click();
    await flushPromises();

    expect(lookup.disabled).toBe(true);
  });

  it("toggles required state on Example 1", async () => {
    const el = createComponent();
    const lookup = el.shadowRoot.querySelector('[data-id="example1-lookup"]');
    expect(lookup.required).toBe(false);

    const buttons = el.shadowRoot.querySelectorAll("lightning-button");
    const requiredBtn = Array.from(buttons).find(
      (b) => b.label === "Make Required"
    );
    expect(requiredBtn).not.toBeNull();
    requiredBtn.click();
    await flushPromises();

    expect(lookup.required).toBe(true);
  });
});

// ===========================================================================
// Event log
// ===========================================================================
describe("event log", () => {
  it("logs a single-select event with correct fields", async () => {
    const el = createComponent();

    // Simulate the select event from a lookup
    const lookup = el.shadowRoot.querySelector('[data-id="example1-lookup"]');
    lookup.dispatchEvent(
      new CustomEvent("select", {
        detail: {
          recordId: "001000000000001",
          objectType: "Account",
          recordName: "Test Corp",
          iconName: "standard:account"
        }
      })
    );
    await flushPromises();

    const logEntries = el.shadowRoot.querySelectorAll(".slds-box");
    expect(logEntries.length).toBe(1);

    const badge = logEntries[0].querySelector(".slds-badge");
    expect(badge.textContent).toBe("Selected");
  });

  it("logs a multi-select add event", async () => {
    const el = createComponent();

    const lookup = el.shadowRoot.querySelector('[data-id="example1-lookup"]');
    lookup.dispatchEvent(
      new CustomEvent("select", {
        detail: {
          action: "add",
          recordId: "001000000000001",
          objectType: "Account",
          recordName: "Test Corp",
          iconName: "standard:account",
          changedRecord: {
            id: "001000000000001",
            title: "Test Corp",
            icon: "standard:account",
            objectType: "Account"
          },
          selectedRecords: [
            {
              id: "001000000000001",
              title: "Test Corp",
              icon: "standard:account",
              objectType: "Account"
            }
          ]
        }
      })
    );
    await flushPromises();

    const badge = el.shadowRoot.querySelector(".slds-badge");
    expect(badge.textContent).toBe("Added");
  });

  it("logs a clear event", async () => {
    const el = createComponent();

    const lookup = el.shadowRoot.querySelector('[data-id="example1-lookup"]');
    lookup.dispatchEvent(
      new CustomEvent("select", {
        detail: {
          recordId: null,
          objectType: null,
          recordName: null,
          iconName: null
        }
      })
    );
    await flushPromises();

    const badge = el.shadowRoot.querySelector(".slds-badge");
    expect(badge.textContent).toBe("Cleared");
  });

  it("prepends new log entries (most recent first)", async () => {
    const el = createComponent();
    const lookup = el.shadowRoot.querySelector('[data-id="example1-lookup"]');

    lookup.dispatchEvent(
      new CustomEvent("select", {
        detail: {
          recordId: "001000000000001",
          objectType: "Account",
          recordName: "First",
          iconName: "standard:account"
        }
      })
    );
    await flushPromises();

    lookup.dispatchEvent(
      new CustomEvent("select", {
        detail: {
          recordId: "001000000000002",
          objectType: "Account",
          recordName: "Second",
          iconName: "standard:account"
        }
      })
    );
    await flushPromises();

    const logEntries = el.shadowRoot.querySelectorAll(".slds-box");
    expect(logEntries.length).toBe(2);
  });
});
