@IsTest
private class PolymorphicLookupControllerTest {
  // Account + Name: universally available in every Salesforce org.
  // Phone: standard Account field, always exists — used to test subtitle mapping without
  // requiring custom fields or setting values (tests the null-value path automatically).
  @TestSetup
  static void setupData() {
    insert new List<Account>{
      new Account(Name = 'Alpha Testing Corp'),
      new Account(Name = 'Beta Industries')
    };
  }

  // -------------------------------------------------------------------------
  // searchRecords
  // -------------------------------------------------------------------------

  @IsTest
  static void searchRecords_returnsMatchingRecords() {
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
    // Blank key → no Name LIKE filter → returns records ordered by LastViewedDate DESC
    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.searchRecords(
      'Account',
      '',
      'standard:account',
      null,
      '',
      10
    );

    Assert.isTrue(
      results.size() >= 2,
      'Blank search should return all records up to limit'
    );
  }

  @IsTest
  static void searchRecords_withSubtitleField() {
    // Phone is standard on Account and was not set in setup, so subtitle = empty string
    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.searchRecords(
      'Account',
      'Alpha',
      'standard:account',
      'Phone',
      '',
      10
    );

    Assert.areEqual(1, results.size());
    Assert.isNotNull(results[0].subtitle);
  }

  @IsTest
  static void searchRecords_withWhereClause() {
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
    // When subtitleField is null, subtitle should be the object API name
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

  // -------------------------------------------------------------------------
  // getRecordById
  // -------------------------------------------------------------------------

  @IsTest
  static void getRecordById_findsExistingRecord() {
    Account acc = [
      SELECT Id
      FROM Account
      WHERE Name = 'Alpha Testing Corp'
      LIMIT 1
    ];

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.getRecordById(
      acc.Id,
      'Account',
      'standard:account',
      null
    );

    Assert.areEqual(1, results.size());
    Assert.areEqual(acc.Id, results[0].id);
    Assert.areEqual('Alpha Testing Corp', results[0].title);
    Assert.areEqual('Account', results[0].subtitle); // null subtitleField → object name
  }

  @IsTest
  static void getRecordById_nonexistentId_returnsEmpty() {
    String fakeId =
      Account.SObjectType.getDescribe().getKeyPrefix() + '000000000000';

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.getRecordById(
      fakeId,
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
    Account acc = [
      SELECT Id
      FROM Account
      WHERE Name = 'Alpha Testing Corp'
      LIMIT 1
    ];

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.getRecordById(
      acc.Id,
      'Account',
      'standard:account',
      'Phone'
    );

    Assert.areEqual(1, results.size());
    Assert.isNotNull(results[0].subtitle); // Phone was not set → empty string
  }

  // -------------------------------------------------------------------------
  // getLatestCreatedRecord
  // -------------------------------------------------------------------------

  @IsTest
  static void getLatestCreatedRecord_findsJustCreatedRecord() {
    // Push @TestSetup records outside the 30-second window so only the
    // freshly inserted record is returned by the CreatedDate filter.
    for (Account acc : [SELECT Id FROM Account]) {
      Test.setCreatedDate(acc.Id, Datetime.now().addMinutes(-5));
    }

    Account fresh = new Account(Name = 'Just Created Corp');
    insert fresh;

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
    // A syntactically valid but non-matching user ID should return nothing
    String fakeUserId = '005000000000000AAA';

    List<PolymorphicLookupController.LookupRecord> results = PolymorphicLookupController.getLatestCreatedRecord(
      'Account',
      'standard:account',
      fakeUserId
    );

    Assert.areEqual(0, results.size(), 'Wrong userId should return no records');
  }
}
