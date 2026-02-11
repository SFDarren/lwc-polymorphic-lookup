public with sharing class PolymorphicLookupController {
    
    public class LookupRecord {
        @AuraEnabled public String id;
        @AuraEnabled public String title;
        @AuraEnabled public String subtitle;
        @AuraEnabled public String icon;
    }

    @AuraEnabled(cacheable=true)
    public static List<LookupRecord> searchRecords(String objectApiName, String searchKey, String iconName, String subtitleField, Integer queryLimit) {
        List<LookupRecord> results = new List<LookupRecord>();
        String query;
        
        // Default limit if not provided
        Integer limitRecs = (queryLimit == null) ? 5 : queryLimit;

        // Sanitize inputs
        String key = String.escapeSingleQuotes(searchKey);
        String obj = String.escapeSingleQuotes(objectApiName);
        String subField = (String.isNotBlank(subtitleField)) ? String.escapeSingleQuotes(subtitleField) : null;

        try {
            // 1. Attempt Query WITH Subtitle Field
            if (String.isBlank(key)) {
                query = 'SELECT Id, Name' + (subField != null ? ', ' + subField : '') + ' FROM ' + obj + ' ORDER BY LastViewedDate DESC NULLS LAST LIMIT ' + String.valueOf(limitRecs);
            } else {
                query = 'SELECT Id, Name' + (subField != null ? ', ' + subField : '') + ' FROM ' + obj + ' WHERE Name LIKE \'%' + key + '%\' LIMIT ' + String.valueOf(limitRecs);
            }
            
            results = executeQuery(query, obj, iconName, subField, null);

        } catch (Exception e) {
            // 2. Fallback: If Field doesn't exist, query WITHOUT Subtitle Field
            System.debug('Error querying subtitle field, falling back to Name only: ' + e.getMessage());
            try {
                if (String.isBlank(key)) {
                    query = 'SELECT Id, Name FROM ' + obj + ' ORDER BY LastViewedDate DESC NULLS LAST LIMIT ' + String.valueOf(limitRecs);
                } else {
                    query = 'SELECT Id, Name FROM ' + obj + ' WHERE Name LIKE \'%' + key + '%\' LIMIT ' + String.valueOf(limitRecs);
                }
                results = executeQuery(query, obj, iconName, null, null);
            } catch (Exception innerEx) {
                System.debug('Critical Query Error: ' + innerEx.getMessage());
            }
        }
        
        return results;
    }

    @AuraEnabled
    public static List<LookupRecord> getLatestCreatedRecord(String objectApiName, String iconName, String userId) {
        List<LookupRecord> results = new List<LookupRecord>();
        String obj = String.escapeSingleQuotes(objectApiName);
    
        try {
            // Calculate the time 1 minute ago
            Datetime withinTime = Datetime.now().addSeconds(-10);
    
            // USE A BIND VARIABLE (:lastMinute) instead of string concatenation
            String query = 'SELECT Id, Name FROM ' + obj + ' WHERE CreatedDate >= :withinTime ORDER BY CreatedDate DESC LIMIT 1';
            
            results = executeQuery(query, obj, iconName, null, withinTime);
        } catch (Exception e) {
            System.debug('Critical Query Error: ' + e.getMessage());
        }
        
        return results;
    }

    // Helper to process results to avoid code duplication
    private static List<LookupRecord> executeQuery(String query, String obj, String iconName, String subField, Datetime withinTime) {
        List<LookupRecord> results = new List<LookupRecord>();
        for (SObject so : Database.query(query)) {
            LookupRecord rec = new LookupRecord();
            rec.id = (String)so.get('Id');
            rec.title = (String)so.get('Name');
            rec.icon = iconName;
            
            // Logic for Subtitle
            if (subField != null) {
                try {
                    // Navigate relationships if needed (basic support) or get direct field
                    Object val = so.get(subField);
                    rec.subtitle = (val != null) ? String.valueOf(val) : ''; 
                } catch(Exception e) {
                    rec.subtitle = ''; // Field null or issue
                }
            } else {
                // Default to Object Name if no field specified
                rec.subtitle = obj; 
            }
            results.add(rec);
        }
        return results;
    }
}