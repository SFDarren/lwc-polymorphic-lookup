@IsTest
private class PolymorphicLookupControllerTest {
  // ---------------------------------------------------------------------------
  // Helpers — build in-memory SObjects via JSON (no DML, no org dependencies)
  // ---------------------------------------------------------------------------

  private static final String MOCK_ID_1 = '001000000000001AAA';
  private static final String MOCK_ID_2 = '001000000000002AAA';

  private static Account mockAccount(String id, String name, String phone) {
    Map<String, Object> fields = new Map<String, Object>{
      'attributes' => new Map<String, String>{ 'type' => 'Account' },
      'Id' => id,
      'Name' => name
    };
    if (phone != null) {
      fields.put('Phone', phone);
    }
    return (Account) JSON.deserialize(JSON.serialize(fields), Account.class);
  }

  // -------------------------------------------------------------------------
  // searchRecords
  // -------------------------------------------------------------------------

  @IsTest
  static void searchRecords_returnsMatchingRecords() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>{
      mockAccount(MOCK_ID_1, 'Alpha Testing Corp', null)
    };

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.searchRecords(
      'Account',
      'Alpha',
      'standard:account',
      null,
      '',
      10
    );

    Assert.areEqual(
      1,
      results.size(),
      'Should find exactly one match for "Alpha"'
    );
    Assert.areEqual('Alpha Testing Corp', results[0].title);
    Assert.areEqual('standard:account', results[0].icon);
  }

  @IsTest
  static void searchRecords_blankSearchKey_returnsRecords() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>{
      mockAccount(MOCK_ID_1, 'Alpha Testing Corp', null),
      mockAccount(MOCK_ID_2, 'Beta Industries', null)
    };

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.searchRecords(
      'Account',
      '',
      'standard:account',
      null,
      '',
      10
    );

    Assert.areEqual(
      2,
      results.size(),
      'Blank search should return all mocked records'
    );
  }

  @IsTest
  static void searchRecords_withSubtitleField() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>{
      mockAccount(MOCK_ID_1, 'Alpha Testing Corp', '555-1234')
    };

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.searchRecords(
      'Account',
      'Alpha',
      'standard:account',
      'Phone',
      '',
      10
    );

    Assert.areEqual(1, results.size());
    Assert.areEqual('555-1234', results[0].subtitle);
  }

  @IsTest
  static void searchRecords_withSubtitleField_nullValue() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>{
      mockAccount(MOCK_ID_1, 'Alpha Testing Corp', null)
    };

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.searchRecords(
      'Account',
      'Alpha',
      'standard:account',
      'Phone',
      '',
      10
    );

    Assert.areEqual(1, results.size());
    Assert.areEqual(
      '',
      results[0].subtitle,
      'Null subtitle field value → empty string'
    );
  }

  @IsTest
  static void searchRecords_withWhereClause() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>{
      mockAccount(MOCK_ID_2, 'Beta Industries', null)
    };

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.searchRecords(
      'Account',
      '',
      'standard:account',
      null,
      'Name LIKE \'Beta%\'',
      10
    );

    Assert.areEqual(1, results.size());
    Assert.areEqual('Beta Industries', results[0].title);
  }

  @IsTest
  static void searchRecords_respectsQueryLimit() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>{
      mockAccount(MOCK_ID_1, 'Alpha Testing Corp', null)
    };

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.searchRecords(
      'Account',
      '',
      'standard:account',
      null,
      '',
      1
    );

    Assert.areEqual(1, results.size(), 'Should respect the limit parameter');
  }

  @IsTest
  static void searchRecords_nullQueryLimit_defaultsToFive() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>{
      mockAccount(MOCK_ID_1, 'Acc 1', null),
      mockAccount(MOCK_ID_2, 'Acc 2', null)
    };

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.searchRecords(
      'Account',
      '',
      'standard:account',
      null,
      '',
      null
    );

    Assert.isTrue(results.size() <= 5, 'Null limit should default to 5');
  }

  @IsTest
  static void searchRecords_nullSubtitle_usesObjectNameAsFallback() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>{
      mockAccount(MOCK_ID_1, 'Alpha Testing Corp', null)
    };

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.searchRecords(
      'Account',
      'Alpha',
      'standard:account',
      null,
      '',
      10
    );

    Assert.areEqual(1, results.size());
    Assert.areEqual('Account', results[0].subtitle);
  }

  @IsTest
  static void searchRecords_emptyResults() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>();

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.searchRecords(
      'Account',
      'Nonexistent',
      'standard:account',
      null,
      '',
      10
    );

    Assert.areEqual(0, results.size(), 'No matches → empty list');
  }

  // -------------------------------------------------------------------------
  // getRecordById
  // -------------------------------------------------------------------------

  @IsTest
  static void getRecordById_findsExistingRecord() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>{
      mockAccount(MOCK_ID_1, 'Alpha Testing Corp', null)
    };

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.getRecordById(
      MOCK_ID_1,
      'Account',
      'standard:account',
      null
    );

    Assert.areEqual(1, results.size());
    Assert.areEqual(MOCK_ID_1, results[0].id);
    Assert.areEqual('Alpha Testing Corp', results[0].title);
    Assert.areEqual('Account', results[0].subtitle);
  }

  @IsTest
  static void getRecordById_nonexistentId_returnsEmpty() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>();

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.getRecordById(
      '001000000000000AAA',
      'Account',
      'standard:account',
      null
    );

    Assert.areEqual(
      0,
      results.size(),
      'Non-existent ID should return empty list'
    );
  }

  @IsTest
  static void getRecordById_withSubtitleField() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>{
      mockAccount(MOCK_ID_1, 'Alpha Testing Corp', '555-1234')
    };

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.getRecordById(
      MOCK_ID_1,
      'Account',
      'standard:account',
      'Phone'
    );

    Assert.areEqual(1, results.size());
    Assert.areEqual('555-1234', results[0].subtitle);
  }

  // -------------------------------------------------------------------------
  // API name validation
  // -------------------------------------------------------------------------

  @IsTest
  static void searchRecords_invalidObjectApiName_throwsAuraHandledException() {
    Boolean caught = false;
    try {
      PolymorphicLookupController.searchRecords(
        'Account; DELETE',
        'test',
        'standard:account',
        null,
        '',
        5
      );
    } catch (AuraHandledException e) {
      caught = true;
      Assert.isTrue(
        e.getMessage().contains('Invalid object API name'),
        'Should mention invalid object API name'
      );
    }
    Assert.isTrue(
      caught,
      'Should throw AuraHandledException for invalid object name'
    );
  }

  @IsTest
  static void searchRecords_invalidSubtitleField_throwsAuraHandledException() {
    Boolean caught = false;
    try {
      PolymorphicLookupController.searchRecords(
        'Account',
        'test',
        'standard:account',
        'Name; DROP TABLE',
        '',
        5
      );
    } catch (AuraHandledException e) {
      caught = true;
      Assert.isTrue(
        e.getMessage().contains('Invalid field name'),
        'Should mention invalid field name'
      );
    }
    Assert.isTrue(
      caught,
      'Should throw AuraHandledException for invalid field name'
    );
  }

  @IsTest
  static void getRecordById_invalidObjectApiName_throwsAuraHandledException() {
    Boolean caught = false;
    try {
      PolymorphicLookupController.getRecordById(
        MOCK_ID_1,
        'DROP TABLE Accounts',
        'standard:account',
        null
      );
    } catch (AuraHandledException e) {
      caught = true;
    }
    Assert.isTrue(
      caught,
      'Should throw AuraHandledException for invalid object name'
    );
  }

  @IsTest
  static void searchRecords_customObjectApiName_isValid() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>();

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.searchRecords(
      'My_Custom_Object__c',
      '',
      'standard:custom',
      'Custom_Field__c',
      '',
      5
    );

    Assert.areEqual(
      0,
      results.size(),
      'Custom object names with __c suffix should be accepted'
    );
  }

  @IsTest
  static void searchRecords_namespacedObjectApiName_isValid() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>();

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.searchRecords(
      'ns__Custom_Object__c',
      '',
      'standard:custom',
      'ns__Custom_Field__c',
      '',
      5
    );

    Assert.areEqual(
      0,
      results.size(),
      'Namespaced object/field names with ns__Name__c should be accepted'
    );
  }

  // -------------------------------------------------------------------------
  // getLatestCreatedRecord
  // -------------------------------------------------------------------------

  @IsTest
  static void getLatestCreatedRecord_findsJustCreatedRecord() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>{
      mockAccount(MOCK_ID_1, 'Just Created Corp', null)
    };

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.getLatestCreatedRecord(
      'Account',
      'standard:account',
      UserInfo.getUserId()
    );

    Assert.areEqual(1, results.size());
    Assert.areEqual('Just Created Corp', results[0].title);
  }

  @IsTest
  static void getLatestCreatedRecord_wrongUserId_returnsEmpty() {
    PolymorphicLookupController.mockQueryRows = new List<SObject>();

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.getLatestCreatedRecord(
      'Account',
      'standard:account',
      '005000000000000AAA'
    );

    Assert.areEqual(0, results.size(), 'Wrong userId should return no records');
  }
}
