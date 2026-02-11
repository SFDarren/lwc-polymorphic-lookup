import { LightningElement, api, track } from 'lwc';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';

export default class PolymorphicLookupFlowWrapper extends LightningElement {
    // Flow Inputs
    @api label;
    @api objectApiNames; 
    @api iconNames;      
    @api subtitleFields; 
    @api required = false;
    
    // NEW: JSON String input for filters. Example: '{"Account": "BillingCity = \'NY\'"}'
    @api filterJson; 

    // Flow Outputs
    @api selectedRecordId;
    @api selectedObjectType;

    @track computedObjectOptions = [];
    @track computedFilterConfig = {}; // Stores the parsed object

    connectedCallback() {
        this.generateObjectOptions();
        this.parseFilterJson();
    }

    generateObjectOptions() {
        if (!this.objectApiNames) {
            this.computedObjectOptions = [];
            return;
        }

        const names = this.objectApiNames.split(',').map(item => item.trim());
        const icons = this.iconNames ? this.iconNames.split(',').map(item => item.trim()) : [];
        const subtitles = this.subtitleFields ? this.subtitleFields.split(',').map(item => item.trim()) : [];

        this.computedObjectOptions = names.map((apiName, index) => {
            return {
                label: apiName, 
                plural: apiName + 's', 
                value: apiName,
                iconName: icons[index] || 'standard:default', 
                subtitleField: subtitles[index] || 'CreatedDate' 
            };
        });
    }

    parseFilterJson() {
        if (this.filterJson) {
            try {
                // Ensure we handle basic Flow text template issues like smart quotes if necessary, 
                // but usually standard JSON.parse is enough if the admin is careful.
                this.computedFilterConfig = JSON.parse(this.filterJson);
            } catch (error) {
                console.error('PolymorphicLookupFlowWrapper: Invalid JSON in filterJson', error);
                this.computedFilterConfig = {};
            }
        } else {
            this.computedFilterConfig = {};
        }
    }

    handleLookupSelection(event) {
        const { recordId, objectType } = event.detail;
        
        this.selectedRecordId = recordId;
        this.selectedObjectType = objectType;

        this.dispatchEvent(new FlowAttributeChangeEvent('selectedRecordId', recordId));
        this.dispatchEvent(new FlowAttributeChangeEvent('selectedObjectType', objectType));
    }
    
    @api
    validate() {
        if (this.required && !this.selectedRecordId) {
            return { 
                isValid: false, 
                errorMessage: 'Please select a record.' 
            };
        }
        return { isValid: true };
    }
}