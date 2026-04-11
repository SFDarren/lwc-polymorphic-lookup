import { LightningElement, api, track } from "lwc";
import { FlowAttributeChangeEvent } from "lightning/flowSupport";

export default class PolymorphicLookupFlowWrapper extends LightningElement {
  // Flow Inputs
  @api label;
  @api objectApiNames;
  @api iconNames;
  @api subtitleFields;
  @api required = false;
  @api filterJson;
  @api showCreate;
  @api dropdownLimit = 5;
  @api modalLimit = 50;
  @api placeholder;

  // Multi-select inputs
  @api multiSelect = false;
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

  @api
  validate() {
    const isValid = this.lookup ? this.lookup.reportValidity() : true;
    if (!isValid) {
      return { isValid: false, errorMessage: "" }; // core component renders its own error
    }
    return { isValid: true };
  }

  @api
  setCustomValidity(message) {
    if (this.lookup) this.lookup.setCustomValidity(message);
  }

  @api
  reportValidity() {
    if (this.lookup) this.lookup.reportValidity();
  }
}
