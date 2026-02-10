public with sharing class PolymorphicLookupController {
    
    public class LookupRecord {
        @AuraEnabled public String id;
        @AuraEnabled public String title;
        @AuraEnabled public String subtitle;
        @AuraEnabled public String icon;
    }

    @AuraEnabled(cacheable=true)
    public static List<LookupRecord> searchRecords(String objectApiName, String searchKey, String iconName) {
        List<LookupRecord> results = new List<LookupRecord>();
        String query;
        
        // Sanitize inputs
        String key = String.escapeSingleQuotes(searchKey);
        String obj = String.escapeSingleQuotes(objectApiName);

        try {
            if (String.isBlank(key)) {
                // Return recently viewed if search is empty
                query = 'SELECT Id, Name FROM ' + obj + ' ORDER BY LastViewedDate DESC NULLS LAST LIMIT 5';
            } else {
                query = 'SELECT Id, Name FROM ' + obj + ' WHERE Name LIKE \'%' + key + '%\' LIMIT 5';
            }

            for (SObject so : Database.query(query)) {
                LookupRecord rec = new LookupRecord();
                rec.id = (String)so.get('Id');
                rec.title = (String)so.get('Name');
                rec.subtitle = obj; // Or customize to show specific fields
                rec.icon = iconName;
                results.add(rec);
            }
        } catch (Exception e) {
            // Handle exceptions (e.g., object doesn't have LastViewedDate or access issues)
            System.debug(e.getMessage());
        }
        
        return results;
    }
}