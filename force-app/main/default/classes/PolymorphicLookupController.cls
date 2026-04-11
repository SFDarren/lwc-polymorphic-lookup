public with sharing class PolymorphicLookupController {
    
    public class LookupRecord {
        @AuraEnabled public String id;
        @AuraEnabled public String title;
        @AuraEnabled public String subtitle;
        @AuraEnabled public String icon;
    }

    @AuraEnabled(cacheable=true)
    public static List<LookupRecord> searchRecords(String objectApiName, String searchKey, String iconName, String subtitleField, String whereClause, Integer queryLimit) {
        // 1. Inputs & Defaults
        Integer limitRecs = (queryLimit == null) ? 5 : queryLimit;
        String key = (searchKey != null) ? searchKey : ''; // No escape needed for Bind Vars
        
        // 2. Sanitize Schema Names (Bind vars cannot be used for Table/Field names)
        String safeObject = String.escapeSingleQuotes(objectApiName);
        String safeSubtitleField = (String.isNotBlank(subtitleField)) ? String.escapeSingleQuotes(subtitleField) : null;

        // 3. Prepare Bind Variables Map
        Map<String, Object> bindParams = new Map<String, Object>();
        bindParams.put('searchKey', '%' + key + '%');
        bindParams.put('limitRecs', limitRecs);

        // 4. Build Dynamic Query
        // Note: We use :searchKey and :limitRecs which match the keys in our map
        String selectClause = 'SELECT Id, Name';
        if (safeSubtitleField != null) {
            selectClause += ', ' + safeSubtitleField;
        }

        String baseQuery = selectClause + ' FROM ' + safeObject;
        
        // Build Where Clause
        String filterPart = '';
        
        // A. Name Filter
        if (String.isNotBlank(key)) {
            filterPart = 'Name LIKE :searchKey';
        }

        // B. Custom Where Clause (Still risky if input is raw user data)
        // Ideally, 'whereClause' should be validated or parsed, as binds can't handle dynamic logic fragments.
        if (String.isNotBlank(whereClause)) {
            if (String.isNotBlank(filterPart)) {
                filterPart = '(' + filterPart + ') AND (' + whereClause + ')';
            } else {
                filterPart = whereClause;
            }
        }

        if (String.isNotBlank(filterPart)) {
            baseQuery += ' WHERE ' + filterPart;
        }

        // C. Ordering
        if (String.isBlank(key) && String.isBlank(whereClause)) {
            baseQuery += ' ORDER BY LastViewedDate DESC NULLS LAST';
        } else {
            baseQuery += ' ORDER BY Name ASC';
        }

        baseQuery += ' LIMIT :limitRecs';

        // 5. Execute
        return executeQueryWithBinds(baseQuery, bindParams, safeObject, iconName, safeSubtitleField);
    }

    @AuraEnabled
    public static List<LookupRecord> getLatestCreatedRecord(String objectApiName, String iconName, String userId) {
        String safeObject = String.escapeSingleQuotes(objectApiName);

        // Calculate time
        Datetime withinTime = Datetime.now().addSeconds(-30);

        // Bind Map
        Map<String, Object> bindParams = new Map<String, Object>{
            'withinTime' => withinTime,
            'userId' => userId
        };

        String query = 'SELECT Id, Name FROM ' + safeObject +
                       ' WHERE CreatedDate >= :withinTime AND CreatedById = :userId ORDER BY CreatedDate DESC LIMIT 1';

        return executeQueryWithBinds(query, bindParams, safeObject, iconName, null);
    }

    /**
     * Helper to process results using modern Database.queryWithBinds
     * and AccessLevel.USER_MODE for FLS/CRUD enforcement.
     */
    private static List<LookupRecord> executeQueryWithBinds(String query, Map<String, Object> bindMap, String objName, String iconName, String subField) {
        List<LookupRecord> results = new List<LookupRecord>();
        
        try {
            // THE MODERN SECURE QUERY
            // AccessLevel.USER_MODE enforces FLS and Sharing Rules automatically
            List<SObject> searchResults = Database.queryWithBinds(query, bindMap, AccessLevel.USER_MODE);

            for (SObject so : searchResults) {
                LookupRecord rec = new LookupRecord();
                rec.id = (String)so.get('Id');
                rec.title = (String)so.get('Name');
                rec.icon = iconName;
                
                if (subField != null) {
                    try {
                        Object val = so.get(subField);
                        rec.subtitle = (val != null) ? String.valueOf(val) : ''; 
                    } catch(Exception e) {
                        rec.subtitle = ''; 
                    }
                } else {
                    rec.subtitle = objName; 
                }
                results.add(rec);
            }
        } catch (System.QueryException e) {
            // This catches security violations (e.g. User lacks access to 'SubtitleField')
            System.debug('Security or Query Error: ' + e.getMessage());
            
            // Optional: Graceful fallback if FLS fails on the subtitle field
            if (e.getMessage().contains('No access to field')) {
                 // You could retry without the subtitle field here if desired
            }
        } catch (Exception e) {
             System.debug('Unexpected Error: ' + e.getMessage());
        }

        return results;
    }
}