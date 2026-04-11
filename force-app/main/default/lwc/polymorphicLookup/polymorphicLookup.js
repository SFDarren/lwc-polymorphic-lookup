/* polymorphicLookup.js 
 * date: 10 Apr 2026 
 * author: Darren Seet
 * */
import { LightningElement, api, track } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import searchRecords from "@salesforce/apex/PolymorphicLookupController.searchRecords";
import getLatestCreatedRecord from "@salesforce/apex/PolymorphicLookupController.getLatestCreatedRecord";
import getRecordById from "@salesforce/apex/PolymorphicLookupController.getRecordById";
import userId from "@salesforce/user/Id";

export default class PolymorphicLookup extends NavigationMixin(LightningElement) {
    @api label = "Related To";
    @api objectOptions = [];
    @api required = false;
    @api filterConfig = {};
    @api showCreate;
    @api disabled = false;
    @api variant = "standard"; // "standard" | "label-hidden"
    @api placeholder;
    @api dropdownLimit = 5;
    @api modalLimit = 50;
    @api fieldLevelHelp;
    @api messageWhenValueMissing = "Complete this field.";
    @api valueObjectApiName; // required when objectOptions has >1 entry and value is set externally

    // Pre-population: accepts a record ID. Resolves the display name via Apex.
    _value = null;
    _valueResolved = false;

    @api
    get value() {
        return this._value;
    }
    set value(recordId) {
        this._value = recordId;
        this._valueResolved = false;
        if (recordId) {
            this._resolveRecordById(recordId);
        } else {
            this.selectedRecord = null;
        }
    }

    @track selectedObject = {};
    @track searchResults = []; // Dropdown results
    @track modalSearchResults = []; // Modal results
    @track searchTerm = "";
    @track selectedRecord = null;
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

    // Configuration for the Modal Datatable
    // using 'button' type with 'base' variant looks like a text link
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
            { label: this.selectedObject.subtitleField || "Info", fieldName: "subtitle" }
        ];
    }

    dropdownStyle = "";
    _rafId = null;

    _startPositionLoop() {
        if (this._rafId) return;
        const tick = () => {
            this._calculateDropdownPosition();
            if (this.isSearchDropdownOpen) {
                this._rafId = requestAnimationFrame(tick);
            } else {
                this._rafId = null;
            }
        };
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

        this.dropdownStyle = `
            position: fixed;
            top: ${fixedTop}px;
            left: ${fixedLeft}px;
            width: ${inputRect.width}px;
        `;
    }

    connectedCallback() {
        if (this.objectOptions && this.objectOptions.length > 0) {
            this.selectedObject = this.objectOptions[0];
        }
        // If value was set before connectedCallback (e.g., Flow pre-population), resolve now
        if (this._value && !this._valueResolved) {
            this._resolveRecordById(this._value);
        }
    }

    _resolveRecordById(recordId) {
        // Determine which object to use for the lookup
        let objectApiName = this.valueObjectApiName;
        let iconName;
        let subtitleField;
        if (!objectApiName && this.objectOptions && this.objectOptions.length === 1) {
            objectApiName = this.objectOptions[0].value;
            iconName = this.objectOptions[0].iconName;
            subtitleField = this.objectOptions[0].subtitleField;
        } else if (objectApiName && this.objectOptions) {
            const match = this.objectOptions.find((o) => o.value === objectApiName);
            if (match) {
                iconName = match.iconName;
                subtitleField = match.subtitleField;
            }
        }
        if (!objectApiName) return;

        getRecordById({ recordId, objectApiName, iconName: iconName || "", subtitleField: subtitleField || null })
            .then((results) => {
                if (results && results.length > 0) {
                    const rec = results[0];
                    // Sync selectedObject to the resolved object type
                    if (objectApiName && this.objectOptions) {
                        const match = this.objectOptions.find((o) => o.value === objectApiName);
                        if (match) this.selectedObject = match;
                    }
                    this.selectedRecord = {
                        id: rec.id,
                        title: rec.title,
                        icon: rec.icon,
                        objectType: objectApiName
                    };
                    this._valueResolved = true;
                }
            })
            .catch((error) => {
                console.error("PolymorphicLookup: failed to resolve record by ID", error);
            });
    }

    disconnectedCallback() {
        this._stopPositionLoop();
        if (this.locationHrefPoll) {
            clearInterval(this.locationHrefPoll);
            this.locationHrefPoll = null;
        }
    }

    get isSelectionMade() {
        return !!this.selectedRecord;
    }

    get showNoResults() {
        return !this.isLoading && this.searchResults.length === 0 && this.isSearchDropdownOpen;
    }

    // --- Dynamic Classes ---
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
        if (this.placeholder) return this.placeholder;
        return `Search ${this.selectedObject.plural + "..." || "..."}`;
    }

    get searchAriaLabel() {
        return `Search ${this.selectedObject.plural || "records"}`;
    }

    get labelClass() {
        return this.variant === "label-hidden"
            ? "slds-form-element__label slds-assistive-text"
            : "slds-form-element__label";
    }

    get formElementClass() {
        return `slds-form-element${this._showError && this.errorMessage ? " slds-has-error" : ""}`;
    }

    get errorMessage() {
        if (this._customValidity) return this._customValidity;
        if (this.required && !this.selectedRecord) return this.messageWhenValueMissing;
        return null;
    }

    @api
    checkValidity() {
        return !this.errorMessage;
    }

    @api
    reportValidity() {
        const valid = this.checkValidity();
        this._showError = !valid;
        return valid;
    }

    @api
    setCustomValidity(message) {
        this._customValidity = message || "";
        if (!message) this._showError = false;
    }

    get isSingleObject() {
        return this.objectOptions && this.objectOptions.length === 1;
    }

    get searchContainerClass() {
        return this.isSingleObject ? "single-object slds-combobox_container slds-combobox-addon_end" : "slds-combobox_container slds-combobox-addon_end"; // merged border (right side only)
    }

    // --- Object Selector ---
    toggleObjectDropdown() {
        if (this.disabled) return;
        this.isObjectDropdownOpen = !this.isObjectDropdownOpen;
        if (this.isObjectDropdownOpen) {
            this.isSearchDropdownOpen = false;
        }
    }

    handleObjectSelect(event) {
        const selectedValue = event.currentTarget.dataset.value;
        this.selectedObject = this.objectOptions.find((opt) => opt.value === selectedValue);
        this.isObjectDropdownOpen = false;

        this.searchTerm = "";
        this.searchResults = [];
        this.isSearchDropdownOpen = false;

        setTimeout(() => {
            const searchInput = this.template.querySelector("input.slds-combobox__input");
            if (searchInput) {
                searchInput.focus();
            }
        }, 0);
    }

    handleObjectKeyDown(event) {
        if (event.key === "Enter") {
            event.preventDefault();

            const selectedValue = event.currentTarget.dataset.value;
            this.selectedObject = this.objectOptions.find((opt) => opt.value === selectedValue);
            this.isObjectDropdownOpen = false;

            this.searchTerm = "";
            this.searchResults = [];
            this.isSearchDropdownOpen = false;

            setTimeout(() => {
                const searchInput = this.template.querySelector("input.slds-combobox__input");
                if (searchInput) {
                    searchInput.focus();
                }
            }, 0);
        }
    }

    handleObjectBlur(event) {
        // 1. Check where the focus is going next
        const nextFocusedElement = event.relatedTarget;

        // 2. If the user clicked inside the component (e.g., clicked the scrollbar,
        //    or tabbed to an item in the list), DO NOT close.
        if (nextFocusedElement && this.template.contains(nextFocusedElement)) {
            return;
        }

        // 3. Focus has left the component entirely (clicked background or outside field)
        this.isObjectDropdownOpen = false;
    }

    // --- Search Logic ---
    handleSearchFocus() {
        if (this.disabled || this.isCreatingRecord) return;
        this.isObjectDropdownOpen = false;
        this.isSearchDropdownOpen = true;
        this._focusedIndex = -1;
        this._calculateDropdownPosition();
        this._startPositionLoop();
        this.performSearch(this.dropdownLimit);
    }

    handleSearchBlur(event) {
        const nextFocusedElement = event.relatedTarget;

        // If the next focused element is INSIDE this component (e.g., the list items),
        // DO NOT close the dropdown.
        if (nextFocusedElement && this.template.contains(nextFocusedElement)) {
            // Keep open
            return;
        }

        // Only close if we are truly leaving the component
        this.isSearchDropdownOpen = false;
        this._focusedIndex = -1;
        this._stopPositionLoop();
    }

    handleSearchKeyDown(event) {
        if (!this.isSearchDropdownOpen) return;

        if (event.key === "Escape") {
            event.preventDefault();
            this.isSearchDropdownOpen = false;
            this._focusedIndex = -1;
            this._stopPositionLoop();
            const input = this.refs.searchInput && this.refs.searchInput.querySelector("input");
            if (input) input.blur();
            return;
        }

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const items = this.refs.recordListbox
                ? Array.from(this.refs.recordListbox.querySelectorAll("li[tabindex='0']"))
                : [];
            if (!items.length) return;

            if (event.key === "ArrowDown") {
                this._focusedIndex = Math.min(this._focusedIndex + 1, items.length - 1);
            } else {
                this._focusedIndex = Math.max(this._focusedIndex - 1, 0);
            }
            items[this._focusedIndex].focus();
        }
    }

    handleSearchInput(event) {
        this.searchTerm = event.target.value;
        this.isSearchDropdownOpen = true;
        this._calculateDropdownPosition();

        if (this.searchThrottlingTimeout) {
            clearTimeout(this.searchThrottlingTimeout);
        }

        this.searchThrottlingTimeout = setTimeout(() => {
            this.performSearch(this.dropdownLimit);
        }, 300);
    }

    // Reusable search function
    performSearch(limitSize) {
        const isModal = limitSize > 5;
        if (isModal) this.isModalLoading = true;
        else this.isLoading = true;

        // Race condition guard: discard stale responses
        this._searchGeneration += 1;
        const generation = this._searchGeneration;

        this.searchError = null; // Clear previous error

        // Extract specific filter for the currently selected object
        let whereClause = "";
        if (this.filterConfig && this.selectedObject.value && this.filterConfig[this.selectedObject.value]) {
            whereClause = this.filterConfig[this.selectedObject.value];
        }

        searchRecords({
            objectApiName: this.selectedObject.value,
            searchKey: this.searchTerm,
            iconName: this.selectedObject.iconName,
            subtitleField: this.selectedObject.subtitleField,
            whereClause: whereClause,
            queryLimit: limitSize
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
                const message = error?.body?.message || "Search failed. Please try again.";
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

    // --- Modal Logic ("Show All") ---
    handleShowAll(event) {
        // Prevent blur from closing the dropdown too early
        if (event) event.preventDefault();

        this.isSearchDropdownOpen = false;
        this.isModalOpen = true;

        // Fetch more results for the datatable
        this.performSearch(this.modalLimit);

        // Focus first focusable element in modal after render
        setTimeout(() => {
            const modal = this.template.querySelector(".slds-modal");
            if (modal) {
                const focusable = modal.querySelector("button, [tabindex='0'], input, [href]");
                if (focusable) focusable.focus();
            }
        }, 0);
    }

    handleCloseModal() {
        this.isModalOpen = false;
        // Return focus to search input
        setTimeout(() => {
            const input = this.refs.searchInput && this.refs.searchInput.querySelector("input");
            if (input) input.focus();
        }, 0);
    }

    handleModalRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        if (actionName === "select_record") {
            this.finalizeSelection(row.id, row.title, row.icon);
            this.isModalOpen = false;
        }
    }

    // --- Selection Actions ---
    handleRecordSelect(event) {
        event.preventDefault();
        const recordId = event.currentTarget.dataset.id;
        const recordName = event.currentTarget.dataset.title;
        const iconName = event.currentTarget.dataset.icon;

        this.finalizeSelection(recordId, recordName, iconName);
    }

    finalizeSelection(recordId, recordName, iconName) {
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
        this.dispatchSelection();
    }

    handleClearSelection() {
        if (this.disabled) return;
        this.selectedRecord = null;
        this._value = null;
        this._showError = false;
        this.showSelectionHelp = false;
        this.dispatchSelection();

        setTimeout(() => {
            const searchInput = this.template.querySelector("input.slds-combobox__input");
            if (searchInput) {
                searchInput.focus();
            }
        }, 0);
    }

    // --- Selection State Interaction ---
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

            // Check for specific actions based on data attributes or dataset
            const action = event.currentTarget.dataset.action;

            if (action === "show-all") {
                this.handleShowAll();
            } else if (action === "new-record") {
                this.handleNewRecord(event);
            } else {
                // It is a standard record selection
                const recordId = event.currentTarget.dataset.id;
                const recordName = event.currentTarget.dataset.title;
                const iconName = event.currentTarget.dataset.icon;

                this.finalizeSelection(recordId, recordName, iconName);
            }
        }
    }

    initialLocationHref;
    locationHrefPoll;
    handleNewRecord(event) {
        event.preventDefault();
        if (this.disabled) return;
        this.isCreatingRecord = true;
        this.isSearchDropdownOpen = false;
        this.initialLocationHref = window.location.href;
        this.searchResults = [];

        let hrefHasChanged = false;
        this.locationHrefPoll = setInterval(() => {
            if (hrefHasChanged && this.initialLocationHref == window.location.href) {
                // means popup was launched and closed
                clearInterval(this.locationHrefPoll);
                this.locationHrefPoll = null;

                this.isLoading = true;
                // query record created by user in the last 30 seconds?
                getLatestCreatedRecord({
                    objectApiName: this.selectedObject.value,
                    iconName: this.selectedObject.iconName,
                    userId: userId
                })
                    .then((results) => {
                        console.log("results: ", JSON.stringify(results, null, 2));
                        if (results.length != 0) {
                            const result = results[0];
                            this.finalizeSelection(result.id, result.title, this.selectedObject.iconName);
                        }
                    })
                    .catch((error) => {
                        console.log("fail silently since this is just default error: ", JSON.stringify(error, null, 2));
                    })
                    .finally(() => {
                        this.isLoading = false;
                        this.isCreatingRecord = false;
                    });
            } else {
                if (this.initialLocationHref != window.location.href) {
                    hrefHasChanged = true;
                }
            }
        }, 500);

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
                navigationLocation: "RELATED_LIST" // this will make it stay in current record page after closed
            }
        });
    }

    dispatchSelection() {
        const selectEvent = new CustomEvent("select", {
            detail: {
                recordId: this.selectedRecord ? this.selectedRecord.id : null,
                objectType: this.selectedRecord ? this.selectedRecord.objectType : null,
                recordName: this.selectedRecord ? this.selectedRecord.title : null,
                iconName: this.selectedRecord ? this.selectedRecord.icon : null
            }
        });
        this.dispatchEvent(selectEvent);
    }
}