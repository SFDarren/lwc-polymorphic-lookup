/**
 * @module polymorphicLookup
 * @description Combobox-style lookup that searches across one or more Salesforce
 *   SObject types. Supports single-select, multi-select (pill-based), inline
 *   dropdown, "Show All" modal, per-object SOQL filters, "New Record" creation
 *   via NavigationMixin, and full Form API (checkValidity / reportValidity /
 *   setCustomValidity). Not exposed directly — must be consumed by a wrapper.
 * @author Darren Seet
 * @since 2026-04-10
 * @license MIT
 */
import { LightningElement, api, track } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import searchRecords from "@salesforce/apex/PolymorphicLookupController.searchRecords";
import getLatestCreatedRecord from "@salesforce/apex/PolymorphicLookupController.getLatestCreatedRecord";
import getRecordById from "@salesforce/apex/PolymorphicLookupController.getRecordById";
import userId from "@salesforce/user/Id";

/** @constant {number} Throttle delay (ms) between keystrokes before firing search */
const SEARCH_THROTTLE_MS = 300;
/** @constant {number} Poll interval (ms) for detecting new-record popup closure */
const NEW_RECORD_POLL_MS = 500;
/** @constant {number} Delay (ms) before programmatic focus — 0 defers to next microtask */
const FOCUS_DELAY_MS = 0;

/**
 * @typedef {Object} ObjectOption
 * @property {string} label    - Display label in the object switcher
 * @property {string} plural   - Plural form used in placeholder and modal header
 * @property {string} value    - SObject API name passed to Apex
 * @property {string} iconName - SLDS icon reference (e.g. "standard:account")
 * @property {string} [subtitleField] - API name of a second field shown below the record name
 */

export default class PolymorphicLookup extends NavigationMixin(
  LightningElement
) {
  /** @api {string} Field label displayed above the input */
  @api label = "Related To";
  /** @api {ObjectOption[]} Array of object configurations for the switcher */
  @api objectOptions = [];
  /** @api {boolean} When true, shows red asterisk and triggers validation */
  @api required = false;
  /** @api {Object.<string, string>} Map of SObject API name → SOQL WHERE clause */
  @api filterConfig = {};
  /** @api {boolean} When true, adds a "New {Object}" option in the dropdown */
  @api showCreate;
  /** @api {boolean} When true, disables all interaction */
  @api disabled = false;
  /** @api {string} Visual variant — "standard" or "label-hidden" */
  @api variant = "standard";
  /** @api {string} Overrides the auto-generated placeholder text */
  @api placeholder;
  /** @api {number} Max records shown in inline dropdown */
  @api dropdownLimit = 5;
  /** @api {number} Max records shown in "Show All" modal */
  @api modalLimit = 50;
  /** @api {string} Tooltip text displayed next to the label */
  @api fieldLevelHelp;
  /** @api {string} Validation error text when required and empty */
  @api messageWhenValueMissing = "Complete this field.";
  /** @api {string} Required for value pre-population when objectOptions has >1 entry */
  @api valueObjectApiName;

  /** @api {boolean} Enables multi-select mode with pill-based selection */
  @api multiSelect = false;
  /** @api {number|null} Maximum number of selections; null = unlimited */
  @api maxSelections;

  _allowCrossObjectSelection = true;
  @api
  get allowCrossObjectSelection() {
    return this._allowCrossObjectSelection;
  }
  set allowCrossObjectSelection(val) {
    this._allowCrossObjectSelection = val !== false && val !== "false";
  }

  _showPills = true;
  @api
  get showPills() {
    return this._showPills;
  }
  set showPills(val) {
    this._showPills = val !== false && val !== "false";
  }

  // Pre-population: accepts a record ID (single) or array of IDs (multi).
  _value = null;
  _valueResolved = false;

  @api
  get value() {
    if (this.multiSelect) {
      return this._selectedRecords.map((r) => r.id);
    }
    return this._value;
  }
  set value(v) {
    if (this.multiSelect) {
      const ids = Array.isArray(v)
        ? v
        : v
          ? v.split(",").map((s) => s.trim())
          : [];
      this._selectedRecords = [];
      ids.forEach((id) => {
        if (id) this._resolveRecordById(id, true);
      });
    } else {
      this._value = v;
      this._valueResolved = false;
      if (v) {
        this._resolveRecordById(v, false);
      } else {
        this.selectedRecord = null;
      }
    }
  }

  // Always returns an array of selected IDs regardless of mode — stable type for consumers.
  @api
  get values() {
    if (this.multiSelect) {
      return this._selectedRecords.map((r) => r.id);
    }
    return this._value ? [this._value] : [];
  }

  @track selectedObject = {};
  @track searchResults = []; // Dropdown results
  @track modalSearchResults = []; // Modal results
  @track searchTerm = "";
  @track selectedRecord = null; // Single-select selection
  @track _selectedRecords = []; // Multi-select selections
  @track searchError = null;

  _customValidity = "";
  _showError = false;

  isObjectDropdownOpen = false;
  isSearchDropdownOpen = false;
  isLoading = false;
  isModalOpen = false; // Controls the "Show All" modal
  isModalLoading = false;
  isCreatingRecord = false;

  showSelectionHelp = false;
  searchThrottlingTimeout;
  _searchGeneration = 0;
  _focusedIndex = -1;
  _activedescendantId = null;

  // Configuration for the Modal Datatable.
  // 'button' type with 'base' variant renders as a text link.
  get modalColumns() {
    return [
      {
        label: "Name",
        type: "button",
        typeAttributes: {
          label: { fieldName: "title" },
          variant: "base",
          name: "select_record"
        }
      },
      {
        label: this.selectedObject.subtitleField || "Info",
        fieldName: "subtitle"
      }
    ];
  }

  dropdownStyle = "";
  _rafId = null;

  _startPositionLoop() {
    if (this._rafId) return;
    const tick = () => {
      this._calculateDropdownPosition();
      if (this.isSearchDropdownOpen) {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._rafId = requestAnimationFrame(tick);
      } else {
        this._rafId = null;
      }
    };
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._rafId = requestAnimationFrame(tick);
  }

  _stopPositionLoop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _calculateDropdownPosition() {
    const inputComponent = this.refs.searchInput;
    const anchorComponent = this.refs.fixedOffsetAnchor;

    if (!inputComponent || !anchorComponent) {
      return;
    }

    const inputRect = inputComponent.getBoundingClientRect();
    const anchorRect = anchorComponent.getBoundingClientRect();

    // The anchor is position:fixed; top:0; left:0 inside the same transformed
    // ancestor (e.g. SLDS modal container). Its getBoundingClientRect() tells us
    // where the fixed-position origin maps to in viewport coordinates, so we
    // subtract it to convert viewport coords → fixed-position coords.
    const fixedLeft = inputRect.left - anchorRect.left + inputRect.width / 2;
    const fixedTop = inputRect.bottom - anchorRect.top;

    this.dropdownStyle = `position: fixed; top: ${fixedTop}px; left: ${fixedLeft}px; width: ${inputRect.width}px;`;
  }

  connectedCallback() {
    if (this.objectOptions && this.objectOptions.length > 0) {
      this.selectedObject = this.objectOptions[0];
    }
    if (this.multiSelect) {
      const ids = Array.isArray(this._value) ? this._value : [];
      ids.forEach((id) => {
        if (id) this._resolveRecordById(id, true);
      });
    } else if (this._value && !this._valueResolved) {
      // If value was set before connectedCallback (e.g., Flow pre-population), resolve now
      this._resolveRecordById(this._value, false);
    }
  }

  _findObjectOption(objectApiName) {
    if (!this.objectOptions) return null;
    return this.objectOptions.find((o) => o.value === objectApiName) || null;
  }

  _resolveRecordById(recordId, appendToMulti) {
    let objectApiName = this.valueObjectApiName;
    let option;
    if (
      !objectApiName &&
      this.objectOptions &&
      this.objectOptions.length === 1
    ) {
      option = this.objectOptions[0];
      objectApiName = option.value;
    } else {
      option = this._findObjectOption(objectApiName);
    }
    if (!objectApiName) return;

    getRecordById({
      recordId,
      objectApiName,
      iconName: (option && option.iconName) || "",
      subtitleField: (option && option.subtitleField) || null
    })
      .then((results) => {
        if (results && results.length > 0) {
          const rec = results[0];
          if (appendToMulti) {
            if (!this._selectedRecords.find((r) => r.id === rec.id)) {
              this._selectedRecords = [
                ...this._selectedRecords,
                {
                  id: rec.id,
                  title: rec.title,
                  icon: rec.icon,
                  objectType: objectApiName
                }
              ];
            }
          } else {
            const match = this._findObjectOption(objectApiName);
            if (match) this.selectedObject = match;
            this.selectedRecord = {
              id: rec.id,
              title: rec.title,
              icon: rec.icon,
              objectType: objectApiName
            };
            this._valueResolved = true;
          }
        }
      })
      .catch((error) => {
        console.error(
          "PolymorphicLookup: failed to resolve record by ID",
          error
        );
      });
  }

  disconnectedCallback() {
    this._stopPositionLoop();
    if (this.searchThrottlingTimeout) {
      clearTimeout(this.searchThrottlingTimeout);
      this.searchThrottlingTimeout = null;
    }
    if (this.locationHrefPoll) {
      clearInterval(this.locationHrefPoll);
      this.locationHrefPoll = null;
    }
  }

  get isMultiSelect() {
    return this.multiSelect === true;
  }

  // In multi-select, input is always visible (never replaced by a selection display)
  get isInputVisible() {
    return this.isMultiSelect || !this.isSelectionMade;
  }

  // Single-select: input replaced by faux-pill when a selection is made
  get isSelectionMade() {
    return !!this.selectedRecord;
  }

  // The single-select pill-like faux input — only shown in single-select mode
  get showSingleSelectPill() {
    return !this.isMultiSelect && !!this.selectedRecord;
  }

  // Multi-select pill container — only shown when multiSelect + showPills + has selections
  get showPillContainer() {
    return (
      this.isMultiSelect &&
      this.showPills !== false &&
      this._selectedRecords.length > 0
    );
  }

  // Object switcher locked after first pick when cross-object selection is disallowed
  get isObjectSwitcherLocked() {
    return (
      this.isMultiSelect &&
      this.allowCrossObjectSelection === false &&
      this._selectedRecords.length > 0
    );
  }

  // Whether max selections has been reached
  get isAtMaxSelections() {
    return (
      this.isMultiSelect &&
      this.maxSelections != null &&
      this._selectedRecords.length >= this.maxSelections
    );
  }

  // Combined disabled state for the search input
  get isSearchInputDisabled() {
    return this.disabled || this.isAtMaxSelections;
  }

  // Exclude already-selected records from dropdown results
  get filteredSearchResults() {
    if (!this.isMultiSelect || !this._selectedRecords.length)
      return this.searchResults;
    const selectedIds = new Set(this._selectedRecords.map((r) => r.id));
    return this.searchResults.filter((r) => !selectedIds.has(r.id));
  }

  // Exclude already-selected records from modal results
  get filteredModalSearchResults() {
    if (!this.isMultiSelect || !this._selectedRecords.length)
      return this.modalSearchResults;
    const selectedIds = new Set(this._selectedRecords.map((r) => r.id));
    return this.modalSearchResults.filter((r) => !selectedIds.has(r.id));
  }

  get showNoResults() {
    return (
      !this.isLoading &&
      this.filteredSearchResults.length === 0 &&
      this.isSearchDropdownOpen
    );
  }

  get isSingleObject() {
    return this.objectOptions && this.objectOptions.length === 1;
  }

  get isMultiObject() {
    return !this.isSingleObject;
  }

  get objectDropdownClass() {
    return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isObjectDropdownOpen ? "slds-is-open" : ""}`;
  }

  get searchDropdownClass() {
    const isOpen = this.isSearchDropdownOpen && !this.isCreatingRecord;
    return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${isOpen ? "slds-is-open" : ""}`;
  }

  get selectionContainerClass() {
    return `slds-combobox_container slds-has-selection ${this.showSelectionHelp ? "has-focus" : ""}`;
  }

  get placeholderText() {
    if (this.isAtMaxSelections)
      return `Maximum ${this.maxSelections} selections reached`;
    if (this.placeholder) return this.placeholder;
    const objectName = this.selectedObject.plural || "records";
    return `Search ${objectName}...`;
  }

  get searchAriaLabel() {
    return `Search ${this.selectedObject.plural || "records"}`;
  }

  get activedescendantId() {
    return this._activedescendantId || undefined;
  }

  get labelClass() {
    return this.variant === "label-hidden"
      ? "slds-form-element__label slds-assistive-text"
      : "slds-form-element__label";
  }

  get formElementClass() {
    let cls = "slds-form-element";
    if (this._showError && this.errorMessage) cls += " slds-has-error";
    if (this.disabled) cls += " poly-disabled";
    return cls;
  }

  get errorMessage() {
    if (this._customValidity) return this._customValidity;
    if (this.required) {
      if (this.isMultiSelect && this._selectedRecords.length === 0)
        return this.messageWhenValueMissing;
      if (!this.isMultiSelect && !this.selectedRecord)
        return this.messageWhenValueMissing;
    }
    return null;
  }

  /**
   * Checks validity without showing UI errors.
   * @returns {boolean} True if the component is valid
   */
  @api
  checkValidity() {
    return !this.errorMessage;
  }

  /**
   * Shows or hides the inline error and returns validity.
   * @returns {boolean} True if valid
   */
  @api
  reportValidity() {
    const valid = this.checkValidity();
    this._showError = !valid;
    return valid;
  }

  /**
   * Sets a custom error message. Pass an empty string to clear.
   * @param {string} message - Error message to display
   */
  @api
  setCustomValidity(message) {
    this._customValidity = message || "";
    if (!message) this._showError = false;
  }

  /**
   * Clears all selections in multi-select mode and fires a 'clear' event.
   * No-op in single-select mode.
   */
  @api
  clearAll() {
    if (!this.isMultiSelect) return;
    this._selectedRecords = [];
    this._showError = false;
    this.dispatchEvent(
      new CustomEvent("select", {
        detail: {
          action: "clear",
          changedRecord: null,
          selectedRecords: [],
          recordId: null,
          objectType: null,
          recordName: null,
          iconName: null
        }
      })
    );
  }

  get searchContainerClass() {
    return this.isSingleObject
      ? "single-object slds-combobox_container slds-combobox-addon_end"
      : "slds-combobox_container slds-combobox-addon_end"; // merged border (right side only)
  }

  _isInternalFocusMove(event) {
    const next = event.relatedTarget;
    return next && this.template.contains(next);
  }

  _focusSearchInput() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    setTimeout(() => {
      const input =
        (this.refs.searchInput &&
          this.refs.searchInput.querySelector("input")) ||
        this.template.querySelector("input.slds-combobox__input");
      if (input) input.focus();
    }, FOCUS_DELAY_MS);
  }

  _selectObject(objectApiName) {
    this.selectedObject = this.objectOptions.find(
      (opt) => opt.value === objectApiName
    );
    this.isObjectDropdownOpen = false;
    this.searchTerm = "";
    this.searchResults = [];
    this.isSearchDropdownOpen = false;
    this._focusSearchInput();
  }

  toggleObjectDropdown() {
    if (this.disabled || this.isObjectSwitcherLocked) return;
    this.isObjectDropdownOpen = !this.isObjectDropdownOpen;
    if (this.isObjectDropdownOpen) {
      this.isSearchDropdownOpen = false;
    }
  }

  handleObjectSelect(event) {
    this._selectObject(event.currentTarget.dataset.value);
  }

  handleObjectKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      this._selectObject(event.currentTarget.dataset.value);
    }
  }

  handleObjectBlur(event) {
    if (this._isInternalFocusMove(event)) return;
    this.isObjectDropdownOpen = false;
  }

  handleSearchFocus() {
    if (this.disabled || this.isCreatingRecord || this.isAtMaxSelections)
      return;
    this.isObjectDropdownOpen = false;
    this.isSearchDropdownOpen = true;
    this._focusedIndex = -1;
    this._activedescendantId = null;
    this._calculateDropdownPosition();
    this._startPositionLoop();
    this.performSearch(this.dropdownLimit, false);
  }

  handleSearchBlur(event) {
    if (this._isInternalFocusMove(event)) return;
    this.isSearchDropdownOpen = false;
    this._focusedIndex = -1;
    this._activedescendantId = null;
    this._stopPositionLoop();
  }

  handleSearchKeyDown(event) {
    if (!this.isSearchDropdownOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      this.isSearchDropdownOpen = false;
      this._focusedIndex = -1;
      this._stopPositionLoop();
      const input =
        this.refs.searchInput && this.refs.searchInput.querySelector("input");
      if (input) input.blur();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const items = this.refs.recordListbox
        ? Array.from(
            this.refs.recordListbox.querySelectorAll("li[tabindex='0']")
          )
        : [];
      if (!items.length) return;

      if (event.key === "ArrowDown") {
        this._focusedIndex = Math.min(this._focusedIndex + 1, items.length - 1);
      } else {
        this._focusedIndex = Math.max(this._focusedIndex - 1, 0);
      }
      const focused = items[this._focusedIndex];
      this._activedescendantId = focused.id || null;
      focused.scrollIntoView({ block: "nearest" });
    }

    if (event.key === "Enter" && this._focusedIndex >= 0) {
      event.preventDefault();
      const items = this.refs.recordListbox
        ? Array.from(
            this.refs.recordListbox.querySelectorAll("li[tabindex='0']")
          )
        : [];
      if (items[this._focusedIndex]) {
        const item = items[this._focusedIndex];
        const action = item.dataset.action;
        if (action === "show-all") {
          this.handleShowAll();
        } else if (action === "new-record") {
          this.handleNewRecord(event);
        } else {
          this.finalizeSelection(
            item.dataset.id,
            item.dataset.title,
            item.dataset.icon
          );
        }
      }
    }
  }

  handleSearchInput(event) {
    this.searchTerm = event.target.value;
    this.isSearchDropdownOpen = true;
    this._calculateDropdownPosition();

    if (this.searchThrottlingTimeout) {
      clearTimeout(this.searchThrottlingTimeout);
    }

    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.searchThrottlingTimeout = setTimeout(() => {
      this.performSearch(this.dropdownLimit, false);
    }, SEARCH_THROTTLE_MS);
  }

  _whereClauseFor(objectApiName) {
    return (this.filterConfig && this.filterConfig[objectApiName]) || "";
  }

  // Reusable search function
  performSearch(limitSize, isModal) {
    if (isModal) this.isModalLoading = true;
    else this.isLoading = true;

    // Race condition guard: discard stale responses
    this._searchGeneration += 1;
    const generation = this._searchGeneration;

    this.searchError = null;

    // In multi-select mode, inflate the query limit so that after filtering out
    // already-selected records the dropdown still shows a full list of results.
    const queryLimit =
      !isModal && this.isMultiSelect && this._selectedRecords.length > 0
        ? limitSize + this._selectedRecords.length
        : limitSize;

    searchRecords({
      objectApiName: this.selectedObject.value,
      searchKey: this.searchTerm,
      iconName: this.selectedObject.iconName,
      subtitleField: this.selectedObject.subtitleField,
      whereClause: this._whereClauseFor(this.selectedObject.value),
      queryLimit: queryLimit
    })
      .then((results) => {
        if (generation !== this._searchGeneration) return; // stale response
        if (isModal) {
          this.modalSearchResults = results;
          this.isModalLoading = false;
        } else {
          this.searchResults = results;
          this.isLoading = false;
        }
      })
      .catch((error) => {
        if (generation !== this._searchGeneration) return;
        console.error("Error", error);
        const message =
          error?.body?.message || "Search failed. Please try again.";
        if (isModal) {
          this.modalSearchResults = [];
          this.isModalLoading = false;
        } else {
          this.searchResults = [];
          this.searchError = message;
          this.isLoading = false;
        }
      });
  }

  handleShowAll(event) {
    // Prevent blur from closing the dropdown too early
    if (event) event.preventDefault();

    this.isSearchDropdownOpen = false;
    this.isModalOpen = true;

    this.performSearch(this.modalLimit, true);

    // Focus first focusable element in modal after render
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    setTimeout(() => {
      const modal = this.template.querySelector(".slds-modal");
      if (modal) {
        const focusable = modal.querySelector(
          "button, [tabindex='0'], input, [href]"
        );
        if (focusable) focusable.focus();
      }
    }, FOCUS_DELAY_MS);
  }

  handleCloseModal() {
    this.isModalOpen = false;
    this._focusSearchInput();
  }

  handleModalKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      this.handleCloseModal();
      return;
    }
    if (event.key !== "Tab") return;

    const modal = this.template.querySelector(".slds-modal");
    if (!modal) return;

    const focusable = Array.from(
      modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.disabled && el.offsetParent !== null);

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && this.template.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.template.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  handleModalRowAction(event) {
    const actionName = event.detail.action.name;
    const row = event.detail.row;

    if (actionName === "select_record") {
      this.finalizeSelection(row.id, row.title, row.icon);
      this.isModalOpen = false;
    }
  }

  handleRecordSelect(event) {
    event.preventDefault();
    const recordId = event.currentTarget.dataset.id;
    const recordName = event.currentTarget.dataset.title;
    const iconName = event.currentTarget.dataset.icon;

    this.finalizeSelection(recordId, recordName, iconName);
  }

  finalizeSelection(recordId, recordName, iconName) {
    if (this.isMultiSelect) {
      // Guard: already selected or at max
      if (this._selectedRecords.find((r) => r.id === recordId)) return;
      if (this.isAtMaxSelections) return;

      const newRec = {
        id: recordId,
        title: recordName,
        icon: iconName,
        objectType: this.selectedObject.value
      };
      this._selectedRecords = [...this._selectedRecords, newRec];
      this._customValidity = "";
      this._showError = false;
      this.searchTerm = "";
      this.searchResults = [];
      this.dispatchSelection("add", newRec);

      // Input will be disabled — blur it so it doesn't look stale
      this.isSearchDropdownOpen = false;
      this._stopPositionLoop();
      Promise.resolve().then(() => {
        const input =
          this.refs.searchInput && this.refs.searchInput.querySelector("input");
        if (input) input.blur();
      });
    } else {
      this._value = recordId;
      this.selectedRecord = {
        id: recordId,
        title: recordName,
        icon: iconName,
        objectType: this.selectedObject.value
      };
      this._customValidity = "";
      this._showError = false;

      this.searchTerm = "";
      this.isSearchDropdownOpen = false;
      this._stopPositionLoop();
      this.dispatchSelection(null, null);
    }
  }

  handlePillRemove(event) {
    if (this.disabled) return;
    const recordId = event.target.name;
    const removed = this._selectedRecords.find((r) => r.id === recordId);
    if (!removed) return;
    this._selectedRecords = this._selectedRecords.filter(
      (r) => r.id !== recordId
    );
    this.dispatchSelection("remove", removed);
  }

  handleClearSelection() {
    if (this.disabled) return;
    this.selectedRecord = null;
    this._value = null;
    this._showError = false;
    this.showSelectionHelp = false;
    this.dispatchSelection(null, null);
    this._focusSearchInput();
  }

  handleSelectionFocus() {
    this.showSelectionHelp = true;
  }

  handleSelectionBlur() {
    this.showSelectionHelp = false;
  }

  handleSelectionKeydown(event) {
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      this.handleClearSelection();
    }
  }

  handleItemKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();

      const action = event.currentTarget.dataset.action;

      if (action === "show-all") {
        this.handleShowAll();
      } else if (action === "new-record") {
        this.handleNewRecord(event);
      } else {
        const recordId = event.currentTarget.dataset.id;
        const recordName = event.currentTarget.dataset.title;
        const iconName = event.currentTarget.dataset.icon;

        this.finalizeSelection(recordId, recordName, iconName);
      }
    }
  }

  initialLocationHref;
  locationHrefPoll;

  _onNewRecordPopupClosed() {
    this.isLoading = true;
    getLatestCreatedRecord({
      objectApiName: this.selectedObject.value,
      iconName: this.selectedObject.iconName,
      userId: userId
    })
      .then((results) => {
        if (results.length > 0) {
          const result = results[0];
          this.finalizeSelection(
            result.id,
            result.title,
            this.selectedObject.iconName
          );
        }
      })
      .catch(() => {
        // Swallow intentionally: popup may close without creating a record
      })
      .finally(() => {
        this.isLoading = false;
        this.isCreatingRecord = false;
      });
  }

  handleNewRecord(event) {
    event.preventDefault();
    if (this.disabled) return;

    this.isCreatingRecord = true;
    this.isSearchDropdownOpen = false;
    this.initialLocationHref = window.location.href;
    this.searchResults = [];

    let hrefHasChanged = false;
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.locationHrefPoll = setInterval(() => {
      if (hrefHasChanged && this.initialLocationHref === window.location.href) {
        clearInterval(this.locationHrefPoll);
        this.locationHrefPoll = null;
        this._onNewRecordPopupClosed();
      } else if (this.initialLocationHref !== window.location.href) {
        hrefHasChanged = true;
      }
    }, NEW_RECORD_POLL_MS);

    this[NavigationMixin.Navigate]({
      type: "standard__objectPage",
      attributes: {
        objectApiName: this.selectedObject.value,
        actionName: "new"
      },
      state: {
        count: "1",
        nooverride: "1",
        useRecordTypeCheck: "1",
        navigationLocation: "RELATED_LIST" // keeps page context after popup closes
      }
    });
  }

  dispatchSelection(action, changedRecord) {
    let detail;
    if (this.isMultiSelect) {
      const added = action === "add" ? changedRecord : null;
      detail = {
        action,
        changedRecord,
        selectedRecords: [...this._selectedRecords],
        // Backwards-compat fields — populated on 'add', null on 'remove'/'clear'
        recordId: added ? added.id : null,
        objectType: added ? added.objectType : null,
        recordName: added ? added.title : null,
        iconName: added ? added.icon : null
      };
    } else {
      const rec = this.selectedRecord;
      detail = {
        recordId: rec ? rec.id : null,
        objectType: rec ? rec.objectType : null,
        recordName: rec ? rec.title : null,
        iconName: rec ? rec.icon : null
      };
    }
    this.dispatchEvent(new CustomEvent("select", { detail }));
  }
}
