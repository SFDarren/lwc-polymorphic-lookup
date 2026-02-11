import { LightningElement, api, track } from 'lwc';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';

export default class PolymorphicLookupFlowWrapper extends LightningElement {
    // Flow Inputs
    @api label;
    @api objectApiNames; // "Account, Opportunity"
    @api iconNames;      // "standard:account, standard:opportunity"
    @api subtitleFields; // "BillingCity, StageName"
    @api required = false;

    // Flow Outputs
    @api selectedRecordId;
    @api selectedObjectType;

    @track computedObjectOptions = [];

    connectedCallback() {
        this.generateObjectOptions();
    }

    generateObjectOptions() {
        if (!this.objectApiNames) {
            this.computedObjectOptions = [];
            return;
        }

        // Split CSVs and trim whitespace
        const names = this.objectApiNames.split(',').map(item => item.trim());
        const icons = this.iconNames ? this.iconNames.split(',').map(item => item.trim()) : [];
        const subtitles = this.subtitleFields ? this.subtitleFields.split(',').map(item => item.trim()) : [];

        // Map arrays into the specific JSON structure your child component needs
        this.computedObjectOptions = names.map((apiName, index) => {
            return {
                label: apiName, // Or you could add a Label input, but API name is usually fine for internal users
                plural: apiName + 's', // Simple pluralization fallback
                value: apiName,
                iconName: icons[index] || 'standard:default', // Fallback icon
                subtitleField: subtitles[index] || 'CreatedDate' // Fallback subtitle
            };
        });
    }

    handleLookupSelection(event) {
        const { recordId, objectType } = event.detail;
        
        // Update local values
        this.selectedRecordId = recordId;
        this.selectedObjectType = objectType;

        // Notify Flow that values have changed
        this.dispatchEvent(new FlowAttributeChangeEvent('selectedRecordId', recordId));
        this.dispatchEvent(new FlowAttributeChangeEvent('selectedObjectType', objectType));
    }
    
    // Optional: Flow Custom Validation API
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