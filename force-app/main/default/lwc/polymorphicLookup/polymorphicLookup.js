/* polymorphicLookup.js */
import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import searchRecords from '@salesforce/apex/PolymorphicLookupController.searchRecords';
import getLatestCreatedRecord from '@salesforce/apex/PolymorphicLookupController.getLatestCreatedRecord';
import userId from "@salesforce/user/Id";

export default class PolymorphicLookup extends NavigationMixin(LightningElement) {
    @api label = 'Related To';
    @api objectOptions = []; 
    @api required = false;
    // NEW: Accepts a generic object/map: { 'Account': "Sales_Org__c = '123'", ... }
    @api filterConfig = {};

    @track selectedObject = {};
    @track searchResults = []; // Dropdown results
    @track modalSearchResults = []; // Modal results
    @track searchTerm = '';
    @track selectedRecord = null;
    
    isObjectDropdownOpen = false;
    isSearchDropdownOpen = false;
    isLoading = false;
    isModalOpen = false; // Controls the "Show All" modal
    isModalLoading = false;
    isCreatingRecord = false;
    
    showSelectionHelp = false; 
    searchThrottlingTimeout;

    // Configuration for the Modal Datatable
    // using 'button' type with 'base' variant looks like a text link
    get modalColumns() {
        return [
            { 
                label: 'Name', 
                type: 'button', 
                typeAttributes: { 
                    label: { fieldName: 'title' }, 
                    variant: 'base',
                    name: 'select_record' 
                } 
            },
            { label: this.selectedObject.subtitleField || 'Info', fieldName: 'subtitle' }
        ];
    }

    connectedCallback() {
        if (this.objectOptions && this.objectOptions.length > 0) {
            this.selectedObject = this.objectOptions[0];
        }
    }

    get isSelectionMade() {
        return !!this.selectedRecord;
    }

    // --- Dynamic Classes ---
    get objectDropdownClass() {
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isObjectDropdownOpen ? 'slds-is-open' : ''}`;
    }

    get searchDropdownClass() {
        const isOpen = this.isSearchDropdownOpen && !this.isCreatingRecord;
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${isOpen ? 'slds-is-open' : ''}`;
    }

    get selectionContainerClass() {
        return `slds-combobox_container slds-has-selection ${this.showSelectionHelp ? 'has-focus' : ''}`;
    }

    get placeholderText() {
        return `Search ${this.selectedObject.plural + '...' || '...'}`;
    }

    // --- Object Selector ---
    toggleObjectDropdown() {
        this.isObjectDropdownOpen = !this.isObjectDropdownOpen;
        if (this.isObjectDropdownOpen) {
            this.isSearchDropdownOpen = false;
        }
    }

    handleObjectSelect(event) {
        const selectedValue = event.currentTarget.dataset.value;
        this.selectedObject = this.objectOptions.find(opt => opt.value === selectedValue);
        this.isObjectDropdownOpen = false;
        
        this.searchTerm = '';
        this.searchResults = [];
        this.isSearchDropdownOpen = false;
        
        setTimeout(() => {
            const searchInput = this.template.querySelector('input.slds-combobox__input');
            if (searchInput) {
                searchInput.focus();
            }
        }, 0);
    }

    handleObjectKeyDown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            
            const selectedValue = event.currentTarget.dataset.value;
            this.selectedObject = this.objectOptions.find(opt => opt.value === selectedValue);
            this.isObjectDropdownOpen = false;
            
            this.searchTerm = '';
            this.searchResults = [];
            this.isSearchDropdownOpen = false;
            
            setTimeout(() => {
                const searchInput = this.template.querySelector('input.slds-combobox__input');
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
        if(this.isCreatingRecord) return;
        this.isObjectDropdownOpen = false;
        this.isSearchDropdownOpen = true;
        this.performSearch(5); // Limit 5 for dropdown
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
    }

    handleSearchInput(event) {
        this.searchTerm = event.target.value;
        this.isSearchDropdownOpen = true;
        
        if (this.searchThrottlingTimeout) {
            clearTimeout(this.searchThrottlingTimeout);
        }

        this.searchThrottlingTimeout = setTimeout(() => {
            this.performSearch(5);
        }, 300);
    }

    // Reusable search function
    performSearch(limitSize) {
        const isModal = limitSize > 5;
        if (isModal) this.isModalLoading = true;
        else this.isLoading = true;

        // NEW: Extract specific filter for the currently selected object
        let whereClause = '';
        if (this.filterConfig && this.selectedObject.value && this.filterConfig[this.selectedObject.value]) {
            whereClause = this.filterConfig[this.selectedObject.value];
        }

        searchRecords({ 
            objectApiName: this.selectedObject.value, 
            searchKey: this.searchTerm,
            iconName: this.selectedObject.iconName,
            subtitleField: this.selectedObject.subtitleField,
            whereClause: whereClause, // Pass the filter to Apex
            queryLimit: limitSize
        })
        .then(results => {
            if (isModal) {
                this.modalSearchResults = results;
                this.isModalLoading = false;
            } else {
                this.searchResults = results;
                this.isLoading = false;
            }
        })
        .catch(error => {
            console.error('Error', error);
            if (isModal) {
                this.modalSearchResults = [];
                this.isModalLoading = false;
            } else {
                this.searchResults = [];
                this.isLoading = false;
            }
        });
    }

    // --- Modal Logic ("Show All") ---
    handleShowAll(event) {
        // Prevent blur from closing the dropdown too early
        if(event) event.preventDefault();
        
        this.isSearchDropdownOpen = false;
        this.isModalOpen = true;
        
        // Fetch more results for the datatable
        this.performSearch(50); 
    }

    handleCloseModal() {
        this.isModalOpen = false;
    }

    handleModalRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        if (actionName === 'select_record') {
            // Mimic the structure of handleRecordSelect
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
        this.selectedRecord = {
            id: recordId,
            title: recordName,
            icon: iconName,
            objectType: this.selectedObject.value
        };

        this.searchTerm = '';
        this.isSearchDropdownOpen = false;
        this.dispatchSelection();
    }

    handleClearSelection() {
        this.selectedRecord = null;
        this.showSelectionHelp = false;
        this.dispatchSelection();

        setTimeout(() => {
            const searchInput = this.template.querySelector('input.slds-combobox__input');
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
        if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault();
            this.handleClearSelection();
        }
    }

    handleItemKeyDown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            
            // Check for specific actions based on data attributes or dataset
            const action = event.currentTarget.dataset.action;

            if (action === 'show-all') {
                this.handleShowAll();
            } else if (action === 'new-record') {
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

    

    initialLocationHref
    locationHrefPoll
    handleNewRecord(event) {
        event.preventDefault();
        this.isCreatingRecord = true;
        this.isSearchDropdownOpen = false;
        this.initialLocationHref = window.location.href;
        this.searchResults = [];

        let hrefHasChanged = false;
        this.locationHrefPoll = setInterval(() => {
            if (hrefHasChanged && this.initialLocationHref == window.location.href) {
                // means popup was launched and closed
                clearInterval(this.locationHrefPoll)
                this.locationHrefPoll = null;

                this.isLoading = true;
                // query record created by user in the last 30 seconds?
                getLatestCreatedRecord({ 
                    objectApiName: this.selectedObject.value, 
                    iconName: this.selectedObject.iconName,
                    userId: userId
                }).then(results => {
                    console.log('results: ', JSON.stringify(results, null, 2))
                    if (results.length != 0) {
                        const result = results[0];
                        this.finalizeSelection(result.id, result.title, this.selectedObject.iconName);
                    }
                }).catch(error => {
                    console.log('fail silently since this is just default error: ', JSON.stringify(error, null, 2))
                }).finally(() => {
                    this.isLoading = false;
                    this.isCreatingRecord = false;
                })
            } else {
                if (this.initialLocationHref != window.location.href) {
                    hrefHasChanged = true;
                }
            }
        }, 500)

        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: this.selectedObject.value,
                actionName: 'new'
            },
            state : {
                count: '1',
                nooverride: '1',
                useRecordTypeCheck : '1',
                navigationLocation: 'RELATED_LIST' // this will make it stay in current record page after closed
            }
        });

        
    }

    dispatchSelection() {
        const selectEvent = new CustomEvent('select', {
            detail: { 
                recordId: this.selectedRecord ? this.selectedRecord.id : null, 
                objectType: this.selectedRecord ? this.selectedRecord.objectType : null
            }
        });
        this.dispatchEvent(selectEvent);
    }
}