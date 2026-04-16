/**
 * @description Apex controller for the polymorphicLookup LWC. Provides dynamic
 *   SOQL search, record-by-ID resolution, and latest-created-record detection.
 *   All queries use Database.queryWithBinds + AccessLevel.USER_MODE for FLS/CRUD
 *   enforcement.
 * @author Darren Seet
 * @since 2026-04-10
 */
public with sharing class PolymorphicLookupController {
  /**
   * @description DTO returned to the LWC with record display data.
   */
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

  /**
   * @description Searches records by name across any SObject type with optional SOQL WHERE filter.
   * @param objectApiName SObject API name to query
   * @param searchKey     Name search term (LIKE match)
   * @param iconName      SLDS icon reference passed through to the result
   * @param subtitleField API name of a secondary display field
   * @param whereClause   Trusted admin-supplied SOQL fragment (not end-user input)
   * @param queryLimit    Maximum records to return
   * @return List of matching LookupRecord DTOs
   */
  @AuraEnabled(cacheable=true)
  public static List<LookupRecord> searchRecords(
    String objectApiName,
    String searchKey,
    String iconName,
    String subtitleField,
    String whereClause,
    Integer queryLimit
  ) {
    validateApiName(objectApiName, 'object API name');

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

  /**
   * @description Resolves a single record by ID for pre-population display.
   * @param recordId      18-char Salesforce record ID
   * @param objectApiName SObject API name
   * @param iconName      SLDS icon reference
   * @param subtitleField API name of a secondary display field
   * @return Single-element list with the resolved LookupRecord, or empty list
   */
  @AuraEnabled(cacheable=true)
  public static List<LookupRecord> getRecordById(
    String recordId,
    String objectApiName,
    String iconName,
    String subtitleField
  ) {
    validateApiName(objectApiName, 'object API name');

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

  /**
   * @description Fetches the most recent record created by the current user within
   *   the last 30 seconds. Used after "New Record" popup closes to auto-select.
   * @param objectApiName SObject API name
   * @param iconName      SLDS icon reference
   * @param userId        Current user ID
   * @return Single-element list with the latest record, or empty list
   */
  @AuraEnabled
  public static List<LookupRecord> getLatestCreatedRecord(
    String objectApiName,
    String iconName,
    String userId
  ) {
    validateApiName(objectApiName, 'object API name');

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

  // Validates that a string is a legal SObject or field API name (alphanumeric + underscores,
  // with optional namespace prefix and __c / __r / __mdt / __e / __x suffixes).
  private static final Pattern SAFE_API_NAME = Pattern.compile(
    '^[a-zA-Z][a-zA-Z0-9_]*(__(c|r|mdt|e|x|b|pc|pr))?$'
  );

  private static void validateApiName(String name, String paramLabel) {
    if (String.isBlank(name) || !SAFE_API_NAME.matcher(name).matches()) {
      throw new AuraHandledException('Invalid ' + paramLabel + ': ' + name);
    }
  }

  // Sanitize a developer-supplied field name for safe inclusion in a dynamic query.
  // Returns null when the field is blank so callers can skip SELECT and subtitle mapping.
  private static String sanitizeFieldName(String fieldName) {
    if (String.isBlank(fieldName)) {
      return null;
    }
    validateApiName(fieldName, 'field name');
    return String.escapeSingleQuotes(fieldName);
  }

  @TestVisible
  private static List<SObject> mockQueryRows;

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
      List<SObject> rows = mockQueryRows != null
        ? mockQueryRows
        : Database.queryWithBinds(query, bindMap, AccessLevel.USER_MODE);
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
      throw new AuraHandledException('Search failed: ' + qe.getMessage());
    } catch (Exception e) {
      throw new AuraHandledException(
        'An unexpected error occurred: ' + e.getMessage()
      );
    }
    return results;
  }
}
