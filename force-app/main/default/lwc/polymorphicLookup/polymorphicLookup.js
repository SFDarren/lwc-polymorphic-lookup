import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import searchRecords from '@salesforce/apex/PolymorphicLookupController.searchRecords';

export default class PolymorphicLookup extends NavigationMixin(LightningElement) {
    @api label = 'Related To';
    @api objectOptions = []; 

    @track selectedObject = {};
    @track searchResults = [];
    @track searchTerm = '';
    @track selectedRecord = null;
    
    isObjectDropdownOpen = false;
    isSearchDropdownOpen = false;
    isLoading = false;
    
    // New state for help text
    showSelectionHelp = false; 
    searchThrottlingTimeout;

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
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isSearchDropdownOpen ? 'slds-is-open' : ''}`;
    }

    get selectionContainerClass() {
        return `slds-combobox_container slds-has-selection ${this.showSelectionHelp ? 'has-focus' : ''}`;
    }

    get placeholderText() {
        return `Search ${this.selectedObject.label || '...'}`;
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
        
        // Reset Search & Focus
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

    // --- Search ---

    handleSearchFocus() {
        this.isObjectDropdownOpen = false;

        this.isSearchDropdownOpen = true;
        this.performSearch(); 
    }

    handleSearchBlur() {
        setTimeout(() => {
            this.isSearchDropdownOpen = false;
        }, 200);
    }

    handleSearchInput(event) {
        this.searchTerm = event.target.value;
        this.isSearchDropdownOpen = true;
        
        if (this.searchThrottlingTimeout) {
            clearTimeout(this.searchThrottlingTimeout);
        }

        this.searchThrottlingTimeout = setTimeout(() => {
            this.performSearch();
        }, 300);
    }

    performSearch() {
        this.isLoading = true;
        searchRecords({ 
            objectApiName: this.selectedObject.value, 
            searchKey: this.searchTerm,
            iconName: this.selectedObject.iconName
        })
        .then(results => {
            this.searchResults = results;
            this.isLoading = false;
        })
        .catch(error => {
            console.error('Error', error);
            this.searchResults = [];
            this.isLoading = false;
        });
    }

    // --- Selection Actions ---

    handleRecordSelect(event) {
        event.preventDefault(); 
        const recordId = event.currentTarget.dataset.id;
        const recordName = event.currentTarget.dataset.title;
        const iconName = event.currentTarget.dataset.icon;

        this.selectedRecord = {
            id: recordId,
            title: recordName,
            icon: iconName,
            objectType: this.selectedObject.value
        };

        this.searchTerm = '';
        this.isSearchDropdownOpen = false;
        this.dispatchSelection();

        // Focus the "selected" input to trigger the help text immediately if desired
        // or just wait for user interaction.
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

    // --- Selection State Interaction (New) ---

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

    handleNewRecord(event) {
        event.preventDefault();
        this.isSearchDropdownOpen = false;
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: this.selectedObject.value,
                actionName: 'new'
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