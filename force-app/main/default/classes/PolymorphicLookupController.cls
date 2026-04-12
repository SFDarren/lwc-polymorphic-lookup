public with sharing class PolymorphicLookupController {
  public class LookupRecord {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String title;
    @AuraEnabled
    public String subtitle;
    @AuraEnabled
    public String icon;
  }

  @AuraEnabled(cacheable=true)
  public static List<LookupRecord> searchRecords(
    String objectApiName,
    String searchKey,
    String iconName,
    String subtitleField,
    String whereClause,
    Integer queryLimit
  ) {
    Integer limitRecs = queryLimit != null ? queryLimit : 5;
    String key = searchKey != null ? searchKey : '';

    String safeObject = String.escapeSingleQuotes(objectApiName);
    String safeSubtitleField = sanitizeFieldName(subtitleField);

    Map<String, Object> bindParams = new Map<String, Object>{
      'searchKey' => '%' +
      key +
      '%',
      'limitRecs' => limitRecs
    };

    String selectClause = 'SELECT Id, Name';
    if (safeSubtitleField != null) {
      selectClause += ', ' + safeSubtitleField;
    }

    String filterPart = '';
    if (String.isNotBlank(key)) {
      filterPart = 'Name LIKE :searchKey';
    }

    // whereClause is a trusted admin-supplied SOQL fragment — not raw user input.
    // Bind variables cannot be used for dynamic logic fragments, so it is concatenated directly.
    if (String.isNotBlank(whereClause)) {
      filterPart = String.isNotBlank(filterPart)
        ? '(' + filterPart + ') AND (' + whereClause + ')'
        : whereClause;
    }

    String query = selectClause + ' FROM ' + safeObject;
    if (String.isNotBlank(filterPart)) {
      query += ' WHERE ' + filterPart;
    }
    query += String.isBlank(key) && String.isBlank(whereClause)
      ? ' ORDER BY LastViewedDate DESC NULLS LAST'
      : ' ORDER BY Name ASC';
    query += ' LIMIT :limitRecs';

    return executeQueryWithBinds(
      query,
      bindParams,
      safeObject,
      iconName,
      safeSubtitleField
    );
  }

  @AuraEnabled(cacheable=true)
  public static List<LookupRecord> getRecordById(
    String recordId,
    String objectApiName,
    String iconName,
    String subtitleField
  ) {
    String safeObject = String.escapeSingleQuotes(objectApiName);
    String safeSubtitleField = sanitizeFieldName(subtitleField);

    String selectClause = 'SELECT Id, Name';
    if (safeSubtitleField != null) {
      selectClause += ', ' + safeSubtitleField;
    }

    String query =
      selectClause +
      ' FROM ' +
      safeObject +
      ' WHERE Id = :recordId LIMIT 1';

    return executeQueryWithBinds(
      query,
      new Map<String, Object>{ 'recordId' => recordId },
      safeObject,
      iconName,
      safeSubtitleField
    );
  }

  @AuraEnabled
  public static List<LookupRecord> getLatestCreatedRecord(
    String objectApiName,
    String iconName,
    String userId
  ) {
    String safeObject = String.escapeSingleQuotes(objectApiName);
    Datetime withinTime = Datetime.now().addSeconds(-30);

    String query =
      'SELECT Id, Name FROM ' +
      safeObject +
      ' WHERE CreatedDate >= :withinTime AND CreatedById = :userId' +
      ' ORDER BY CreatedDate DESC LIMIT 1';

    return executeQueryWithBinds(
      query,
      new Map<String, Object>{ 'withinTime' => withinTime, 'userId' => userId },
      safeObject,
      iconName,
      null
    );
  }

  // Sanitize a developer-supplied field name for safe inclusion in a dynamic query.
  // Returns null when the field is blank so callers can skip SELECT and subtitle mapping.
  private static String sanitizeFieldName(String fieldName) {
    return String.isNotBlank(fieldName)
      ? String.escapeSingleQuotes(fieldName)
      : null;
  }

  // Executes a dynamic SOQL query using bind variables and USER_MODE to enforce FLS and sharing.
  private static List<LookupRecord> executeQueryWithBinds(
    String query,
    Map<String, Object> bindMap,
    String objName,
    String iconName,
    String subField
  ) {
    List<LookupRecord> results = new List<LookupRecord>();
    try {
      List<SObject> rows = Database.queryWithBinds(
        query,
        bindMap,
        AccessLevel.USER_MODE
      );
      for (SObject so : rows) {
        LookupRecord rec = new LookupRecord();
        rec.id = (String) so.get('Id');
        rec.title = (String) so.get('Name');
        rec.icon = iconName;
        if (subField != null) {
          try {
            Object val = so.get(subField);
            rec.subtitle = val != null ? String.valueOf(val) : '';
          } catch (Exception e) {
            rec.subtitle = '';
          }
        } else {
          rec.subtitle = objName;
        }
        results.add(rec);
      }
    } catch (System.QueryException qe) {
      System.debug(
        LoggingLevel.WARN,
        'PolymorphicLookup query failed: ' + qe.getMessage()
      );
    } catch (Exception e) {
      System.debug(
        LoggingLevel.ERROR,
        'PolymorphicLookup unexpected error: ' + e.getMessage()
      );
    }
    return results;
  }
}
