import { LightningElement } from 'lwc';

export default class ParentComponent extends LightningElement {
    
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
            subtitleField: 'BillingCity' 
        },
        { 
            label: 'Case', 
            plural: 'Cases', 
            value: 'Case', 
            iconName: 'standard:case',
            subtitleField: 'CaseNumber' 
        },
        { 
            label: 'Contact', 
            plural: 'Contacts', 
            value: 'Contact', 
            iconName: 'standard:contact',
            subtitleField: 'Email' 
        }
    ];

    // NEW: Define the filters here
    get filterConfiguration() {
        return {
            // Filter 1: Accounts created yesterday or today
            'Account': "CreatedDate >= YESTERDAY",
            
            // Filter 2: Only Closed Won Opportunities
            'Opportunity': "StageName = 'Closed Won'"
            
            // Note: Case and Contact have no entry, so they will show ALL records (default behavior)
        };
    }

    handleLookupSelection(event) {
        const { recordId, objectType } = event.detail;
        console.log('User selected:', recordId, 'from object:', objectType);
    }
}