/**
 * @module polymorphicLookupFlowWrapper
 * @description Flow Screen Component wrapper for polymorphicLookup. Accepts
 *   comma-delimited string inputs suitable for Flow Builder text fields and
 *   implements the full Flow validation contract (validate / setCustomValidity /
 *   reportValidity).
 * @author Darren Seet
 * @since 2026-04-10
 * @license MIT
 */
import { LightningElement, api, track } from "lwc";
import { FlowAttributeChangeEvent } from "lightning/flowSupport";

export default class PolymorphicLookupFlowWrapper extends LightningElement {
  /** @api {string} Field label displayed above the lookup */
  @api label;
  /** @api {string} Comma-separated SObject API names (e.g. "Account,Contact") */
  @api objectApiNames;
  /** @api {string} Comma-separated SLDS icon names (parallel to objectApiNames) */
  @api iconNames;
  /** @api {string} Comma-separated subtitle field API names (parallel to objectApiNames) */
  @api subtitleFields;
  /** @api {boolean} Enables Flow validation */
  @api required = false;
  /** @api {string} JSON-stringified filter map (e.g. '{"Account": "Type = \'Customer\'"}') */
  @api filterJson;
  /** @api {boolean} Adds "New {Object}" option in dropdown */
  @api showCreate;
  /** @api {number} Max records in inline dropdown */
  @api dropdownLimit = 5;
  /** @api {number} Max records in "Show All" modal */
  @api modalLimit = 50;
  /** @api {string} Overrides auto-generated placeholder */
  @api placeholder;

  /** @api {boolean} Enables multi-select mode */
  @api multiSelect = false;
  /** @api {number|null} Maximum selections; null = unlimited */
  @api maxSelections;

  _allowCrossObjectSelection = true;
  @api
  get allowCrossObjectSelection() {
    return this._allowCrossObjectSelection;
  }
  set allowCrossObjectSelection(val) {
    this._allowCrossObjectSelection = val !== false && val !== "false";
  }

  // Flow Outputs — single-select
  _selectedRecordId;
  _selectedObjectType;
  @api get selectedRecordId() {
    return this._selectedRecordId;
  }
  set selectedRecordId(v) {
    this._selectedRecordId = v;
  }
  @api get selectedObjectType() {
    return this._selectedObjectType;
  }
  set selectedObjectType(v) {
    this._selectedObjectType = v;
  }

  // Flow Outputs — multi-select (CSV strings)
  _selectedRecordIds = "";
  _selectedObjectTypes = "";
  @api get selectedRecordIds() {
    return this._selectedRecordIds;
  }
  set selectedRecordIds(v) {
    this._selectedRecordIds = v;
  }
  @api get selectedObjectTypes() {
    return this._selectedObjectTypes;
  }
  set selectedObjectTypes(v) {
    this._selectedObjectTypes = v;
  }

  @track computedObjectOptions = [];
  @track computedFilterConfig = {};

  connectedCallback() {
    this.generateObjectOptions();
    this.parseFilterJson();
  }

  generateObjectOptions() {
    if (!this.objectApiNames) {
      this.computedObjectOptions = [];
      return;
    }

    const names = this.objectApiNames.split(",").map((item) => item.trim());
    const icons = this.iconNames
      ? this.iconNames.split(",").map((item) => item.trim())
      : [];
    const subtitles = this.subtitleFields
      ? this.subtitleFields.split(",").map((item) => item.trim())
      : [];

    this.computedObjectOptions = names.map((apiName, index) => {
      return {
        label: apiName,
        plural: apiName + "s",
        value: apiName,
        iconName: icons[index] || "standard:default",
        subtitleField: subtitles[index] || "CreatedDate"
      };
    });
  }

  parseFilterJson() {
    if (this.filterJson) {
      try {
        this.computedFilterConfig = JSON.parse(this.filterJson);
      } catch (error) {
        console.error(
          "PolymorphicLookupFlowWrapper: Invalid JSON in filterJson",
          error
        );
        this.computedFilterConfig = {};
      }
    } else {
      this.computedFilterConfig = {};
    }
  }

  handleLookupSelection(event) {
    const { recordId, objectType, selectedRecords } = event.detail;

    if (this.multiSelect && selectedRecords) {
      const ids = selectedRecords.map((r) => r.id).join(",");
      const types = selectedRecords.map((r) => r.objectType).join(",");
      this._selectedRecordIds = ids;
      this._selectedObjectTypes = types;
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectedRecordIds", ids)
      );
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectedObjectTypes", types)
      );
    } else {
      this._selectedRecordId = recordId;
      this._selectedObjectType = objectType;
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectedRecordId", recordId)
      );
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectedObjectType", objectType)
      );
    }
  }

  get lookup() {
    return this.template.querySelector("c-polymorphic-lookup");
  }

  /**
   * Flow validation lifecycle hook. Delegates to the inner lookup's reportValidity.
   * @returns {{isValid: boolean, errorMessage?: string}}
   */
  @api
  validate() {
    const isValid = this.lookup ? this.lookup.reportValidity() : true;
    if (!isValid) {
      return { isValid: false, errorMessage: "" }; // core component renders its own error
    }
    return { isValid: true };
  }

  /**
   * Sets a custom error message on the inner lookup.
   * @param {string} message - Error message (empty string to clear)
   */
  @api
  setCustomValidity(message) {
    if (this.lookup) this.lookup.setCustomValidity(message);
  }

  /**
   * Triggers inline error display on the inner lookup.
   */
  @api
  reportValidity() {
    if (this.lookup) this.lookup.reportValidity();
  }
}
