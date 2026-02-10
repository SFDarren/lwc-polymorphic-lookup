import { LightningElement } from 'lwc';

export default class ParentComponent extends LightningElement {
    
    // Define the objects you want to support
    supportedObjects = [
        { label: 'Opportunity', value: 'Opportunity', iconName: 'standard:opportunity' },
        { label: 'Account', value: 'Account', iconName: 'standard:account' },
        { label: 'Case', value: 'Case', iconName: 'standard:case' },
        { label: 'Contact', value: 'Contact', iconName: 'standard:contact' }
    ];

    handleLookupSelection(event) {
        const { recordId, objectType } = event.detail;
        console.log('User selected:', recordId, 'from object:', objectType);
    }
}