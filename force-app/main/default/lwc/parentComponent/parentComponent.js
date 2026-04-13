/* parentComponent.js */
import { LightningElement, track } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";

export default class ParentComponent extends LightningElement {
  @track selectionLog = [];
  @track isDisabled = false;
  @track isRequired = false;
  @track isMultiDisabled = false;
  @track isMultiRequired = false;

  // ── Example 1: Multi-object with filters ──────────────────────────────
  multiObjectOptions = [
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
    },
    {
      label: "Opportunity",
      plural: "Opportunities",
      value: "Opportunity",
      iconName: "standard:opportunity",
      subtitleField: "StageName"
    },
    {
      label: "Case",
      plural: "Cases",
      value: "Case",
      iconName: "standard:case",
      subtitleField: "Status"
    }
  ];

  get multiObjectFilter() {
    return {
      Account: "CreatedDate >= LAST_N_DAYS:365",
      Opportunity: "IsWon = true"
    };
  }

  // ── Example 2: Single object — Account only, showCreate + fieldLevelHelp ─
  singleObjectOptions = [
    {
      label: "Account",
      plural: "Accounts",
      value: "Account",
      iconName: "standard:account",
      subtitleField: "Phone"
    }
  ];

  // ── Example 1: Disabled / required toggles + validity ─────────────────
  get disabledButtonLabel() {
    return this.isDisabled ? "Enable Lookup" : "Disable Lookup";
  }

  handleToggleDisabled() {
    this.isDisabled = !this.isDisabled;
  }

  get requiredButtonLabel() {
    return this.isRequired ? "Make Optional" : "Make Required";
  }

  handleToggleRequired() {
    this.isRequired = !this.isRequired;
  }

  handleCheckValidity() {
    const lookup = this.template.querySelector('[data-id="example1-lookup"]');
    const isValid = lookup ? lookup.reportValidity() : true;
    if (isValid) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Valid",
          message: "Selection is valid — ready to submit.",
          variant: "success"
        })
      );
    }
  }

  // ── Example 3: Multi-select disabled / required toggles ──────────────
  get multiDisabledButtonLabel() {
    return this.isMultiDisabled ? "Enable" : "Disable";
  }

  handleToggleMultiDisabled() {
    this.isMultiDisabled = !this.isMultiDisabled;
  }

  get multiRequiredButtonLabel() {
    return this.isMultiRequired ? "Make Optional" : "Make Required";
  }

  handleToggleMultiRequired() {
    this.isMultiRequired = !this.isMultiRequired;
  }

  handleCheckMultiValidity() {
    const lookup = this.template.querySelector('[data-id="example3-lookup"]');
    const isValid = lookup ? lookup.reportValidity() : true;
    if (isValid) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Valid",
          message: "Multi-select selection is valid.",
          variant: "success"
        })
      );
    }
  }

  // ── Example 3: Multi-select cross-object ──────────────────────────────
  // Used to pass a literal false to allow-cross-object-selection without requiring API v66
  lockedCrossObjectSelection = false;
  noShowPills = false;

  multiSelectObjectOptions = [
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
    },
    {
      label: "Lead",
      plural: "Leads",
      value: "Lead",
      iconName: "standard:lead",
      subtitleField: "Company"
    }
  ];

  // ── Shared event handler ───────────────────────────────────────────────
  handleLookupSelection(event) {
    const {
      recordId,
      objectType,
      recordName,
      iconName,
      action,
      selectedRecords
    } = event.detail;

    let newLog;
    if (action && selectedRecords) {
      // Multi-select event
      const actionLabel =
        action === "add"
          ? "Added"
          : action === "remove"
            ? "Removed"
            : "Cleared";
      newLog = {
        timestamp: Date.now(),
        time: new Date().toLocaleTimeString(),
        action: actionLabel,
        recordId: recordId || "—",
        recordName: recordName || "—",
        objectType: objectType || "—",
        iconName: iconName || "—",
        selectedCount: selectedRecords.length,
        selectedSummary: selectedRecords.map((r) => r.title).join(", ") || "—"
      };
    } else {
      // Single-select event
      newLog = {
        timestamp: Date.now(),
        time: new Date().toLocaleTimeString(),
        action: recordId ? "Selected" : "Cleared",
        recordId: recordId || "—",
        recordName: recordName || "—",
        objectType: objectType || "—",
        iconName: iconName || "—",
        selectedCount: null,
        selectedSummary: null
      };
    }
    this.selectionLog = [newLog, ...this.selectionLog];
  }
}
