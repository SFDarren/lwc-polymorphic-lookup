import { LightningElement } from 'lwc';

export default class ParentComponent extends LightningElement {
    
    // Updated supportedObjects with subtitleField
    supportedObjects = [
        { 
            label: 'Opportunity', 
            plural: 'Opportunities', 
            value: 'Opportunity', 
            iconName: 'standard:opportunity',
            subtitleField: 'StageName' // Example: Show Stage as subtitle
        },
        { 
            label: 'Account', 
            plural: 'Accounts', 
            value: 'Account', 
            iconName: 'standard:account',
            subtitleField: 'BillingCity' // Example: Show City
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
            subtitleField: 'Email' // Example: Show Email
        }
    ];

    handleLookupSelection(event) {
        const { recordId, objectType } = event.detail;
        console.log('User selected:', recordId, 'from object:', objectType);
    }
}