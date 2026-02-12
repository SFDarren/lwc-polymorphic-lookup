/* parentComponent.js */
import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ParentComponent extends LightningElement {
    
    @track selectionLog = [];

    // Configuration for the Object Dropdown
    supportedObjects = [
        { 
            label: 'Opportunity', 
            plural: 'Opportunities', 
            value: 'Opportunity', 
            iconName: 'standard:opportunity',
            subtitleField: 'StageName' 
        },
        { 
            label: 'Account', 
            plural: 'Accounts', 
            value: 'Account', 
            iconName: 'standard:account',
            subtitleField: 'Phone' // Changed to phone for better demo data
        },
        { 
            label: 'Contact', 
            plural: 'Contacts', 
            value: 'Contact', 
            iconName: 'standard:contact',
            subtitleField: 'Email' 
        },
        { 
            label: 'Case', 
            plural: 'Cases', 
            value: 'Case', 
            iconName: 'standard:case',
            subtitleField: 'Status' 
        }
    ];

    get filterConfiguration() {
        return {
            // Updated to be a bit looser so you definitely get results in your screenshot
            'Account': "CreatedDate >= LAST_N_DAYS:30", 
            'Opportunity': "IsWon = true"
        };
    }

    handleLookupSelection(event) {
        const { recordId, objectType } = event.detail;
        
        // Create a log entry for the UI
        const newLog = {
            timestamp: Date.now(),
            time: new Date().toLocaleTimeString(),
            action: recordId ? 'Record Selected' : 'Selection Cleared',
            recordId: recordId || 'N/A',
            objectType: objectType || 'N/A'
        };

        // Add to start of array
        this.selectionLog = [newLog, ...this.selectionLog];
        
        console.log('User selected:', recordId, 'from object:', objectType);
    }

    handleSave() {
        // Just for demo effect
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Call logged successfully!',
                variant: 'success'
            })
        );
    }
}