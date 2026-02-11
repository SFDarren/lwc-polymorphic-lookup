public with sharing class PolymorphicLookupController {
    
    // Corrected Class Name: LookupRecord
    public class LookupRecord {
        @AuraEnabled public String id;
        @AuraEnabled public String title;
        @AuraEnabled public String subtitle;
        @AuraEnabled public String icon;
    }

    @AuraEnabled(cacheable=true)
    public static List<LookupRecord> searchRecords(String objectApiName, String searchKey, String iconName, String subtitleField, String whereClause, Integer queryLimit) {
        List<LookupRecord> results = new List<LookupRecord>();
        String query;
        
        // Default limit if not provided
        Integer limitRecs = (queryLimit == null) ? 5 : queryLimit;

        // Sanitize inputs
        String key = (searchKey != null) ? String.escapeSingleQuotes(searchKey) : '';
        String obj = String.escapeSingleQuotes(objectApiName);
        String subField = (String.isNotBlank(subtitleField)) ? String.escapeSingleQuotes(subtitleField) : null;

        // --- Build Logic ---
        
        // 1. Base WHERE Clause (Name Search)
        String nameFilter = '';
        if (String.isNotBlank(key)) {
            nameFilter = 'Name LIKE \'%' + key + '%\'';
        }

        // 2. Combine with Custom Filter (whereClause)
        // We wrap both in parentheses to ensure (Name matches) AND (Custom Filter matches)
        String finalWhereStatement = '';
        
        if (String.isNotBlank(nameFilter) && String.isNotBlank(whereClause)) {
            finalWhereStatement = 'WHERE (' + nameFilter + ') AND (' + whereClause + ')';
        } else if (String.isNotBlank(nameFilter)) {
            finalWhereStatement = 'WHERE ' + nameFilter;
        } else if (String.isNotBlank(whereClause)) {
            finalWhereStatement = 'WHERE ' + whereClause;
        }

        // 3. Ordering
        // If no search key and no filter is provided, fallback to "Recently Viewed"
        String orderBy = ' ORDER BY Name ASC'; 
        if (String.isBlank(key) && String.isBlank(whereClause)) {
             orderBy = ' ORDER BY LastViewedDate DESC NULLS LAST';
        }

        try {
            // Attempt 1: Query WITH Subtitle Field
            String selectFields = 'SELECT Id, Name' + (subField != null ? ', ' + subField : '');
            query = selectFields + ' FROM ' + obj + ' ' + finalWhereStatement + orderBy + ' LIMIT ' + String.valueOf(limitRecs);
            
            results = executeQuery(query, obj, iconName, subField, null);

        } catch (Exception e) {
            // Fallback: If Subtitle Field is invalid/inaccessible, query WITHOUT it
            System.debug('Error querying subtitle field, falling back to Name only: ' + e.getMessage());
            try {
                String selectFields = 'SELECT Id, Name';
                query = selectFields + ' FROM ' + obj + ' ' + finalWhereStatement + orderBy + ' LIMIT ' + String.valueOf(limitRecs);
                
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
            // Calculate time for Bind Variable
            Datetime withinTime = Datetime.now().addSeconds(-10);
    
            String query = 'SELECT Id, Name FROM ' + obj + ' WHERE CreatedDate >= :withinTime ORDER BY CreatedDate DESC LIMIT 1';
            
            // Pass withinTime to helper so the bind variable :withinTime works in the dynamic query
            results = executeQuery(query, obj, iconName, null, withinTime);
        } catch (Exception e) {
            System.debug('Critical Query Error: ' + e.getMessage());
        }
        
        return results;
    }

    // Helper to process results
    // Note: 'withinTime' parameter is required here for the bind variable :withinTime to work in Database.query()
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
                    Object val = so.get(subField);
                    rec.subtitle = (val != null) ? String.valueOf(val) : ''; 
                } catch(Exception e) {
                    rec.subtitle = ''; 
                }
            } else {
                rec.subtitle = obj; 
            }
            results.add(rec);
        }
        return results;
    }
}