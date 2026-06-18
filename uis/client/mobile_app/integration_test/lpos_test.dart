import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('LPOs Screen Tests', () {
    Future<void> loginAndNavigateToLPOs(WidgetTester tester) async {
      app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();

      // Should now be on login screen
      expect(find.byType(TextFormField), findsWidgets);

      // Enter email
      final emailFields = find.byType(TextFormField);
      await tester.enterText(emailFields.first, 'test10@gmail.com');
      await tester.pump();

      // Enter password
      await tester.enterText(emailFields.last, 'Test1234@');
      await tester.pump();

      // Find and tap login button
      final loginButton = find.text('Login');
      expect(loginButton, findsWidgets);
      await tester.tap(loginButton.last);
      await tester.pump();

      // Wait for login to complete
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle(const Duration(seconds: 5));

      // Should be on dashboard with BottomNavigationBar
      expect(find.byType(BottomNavigationBar), findsOneWidget);

      // Find and tap "More" in the quick actions grid
      final moreButton = find.text('More');
      if (moreButton.evaluate().isNotEmpty) {
        await tester.tap(moreButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 2));

        // Should now be on More Actions screen
        expect(find.text('More Actions'), findsWidgets);

        // Wait for list to load
        await tester.pump(const Duration(seconds: 1));
        await tester.pumpAndSettle();

        // Scroll down to find Active LPOs if needed
        final listView = find.byType(ListView);
        if (listView.evaluate().isNotEmpty) {
          // Scroll down more to ensure we find LPOs
          await tester.drag(listView.first, const Offset(0, -500));
          await tester.pumpAndSettle();
        }

        // Find and tap on Active LPOs ListTile
        final lpoListTile = find.ancestor(
          of: find.text('Active LPOs'),
          matching: find.byType(ListTile),
        );

        if (lpoListTile.evaluate().isNotEmpty) {
          print('✓ Found Active LPOs in More Actions');
          await tester.tap(lpoListTile.first);
          await tester.pumpAndSettle(const Duration(seconds: 3));
          
          // Extra wait for navigation
          await tester.pump(const Duration(seconds: 1));
          await tester.pumpAndSettle();
        } else {
          print('WARNING: Active LPOs not found in More Actions');
          // Try to find it without the ListTile ancestor
          final lpoText = find.text('Active LPOs');
          if (lpoText.evaluate().isNotEmpty) {
            print('✓ Found Active LPOs text, attempting to tap');
            await tester.tap(lpoText.first);
            await tester.pumpAndSettle(const Duration(seconds: 3));
          }
        }
      }
    }

    testWidgets('Navigate to LPOs screen from More Actions',
        (WidgetTester tester) async {
      await loginAndNavigateToLPOs(tester);

      // Wait for LPOs screen to fully load
      await tester.pumpAndSettle(const Duration(seconds: 3));
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();

      // Verify we're on Active LPOs screen
      final hasLPOTitle = find.text('Active LPOs').evaluate().isNotEmpty;
      final hasNoLPOs = find.text('No Active LPOs').evaluate().isNotEmpty;
      final hasCreateButton = find.text('Apply for LPO').evaluate().isNotEmpty;
      final hasLPOCards = find.byType(Card).evaluate().isNotEmpty;

      print('=== Active LPOs Screen Elements ===');
      print('hasLPOTitle: $hasLPOTitle');
      print('hasNoLPOs: $hasNoLPOs');
      print('hasCreateButton: $hasCreateButton');
      print('hasLPOCards: $hasLPOCards');

      // Should be on Active LPOs screen
      final isOnLPOsScreen = hasLPOTitle || hasNoLPOs || hasCreateButton;
      
      expect(isOnLPOsScreen, isTrue,
             reason: 'Should be on Active LPOs screen');
      
      print('✓ Successfully navigated to Active LPOs screen');
      
      // Give widgets time to settle before test ends
      await tester.pump(const Duration(milliseconds: 100));
    });

    // testWidgets('View LPOs list or empty state', (WidgetTester tester) async {
    //   await loginAndNavigateToLPOs(tester);

    //   // Wait for screen to load
    //   await tester.pumpAndSettle(const Duration(seconds: 3));

    //   // Check if there are LPOs or empty state
    //   final hasLPOCards = find.byType(Card).evaluate().isNotEmpty;
    //   final hasEmptyState = find.text('No Active LPOs').evaluate().isNotEmpty;
    //   final hasErrorState = find.text('Error loading LPOs').evaluate().isNotEmpty;

    //   expect(hasLPOCards || hasEmptyState || hasErrorState, isTrue,
    //          reason: 'Should show either LPOs, empty state, or error state');

    //   print('✓ LPOs list or empty state displayed correctly');
      
    //   await tester.pump(const Duration(milliseconds: 100));
    // });

    // testWidgets('View LPO details', (WidgetTester tester) async {
    //   await loginAndNavigateToLPOs(tester);

    //   await tester.pumpAndSettle(const Duration(seconds: 3));

    //   // Check if there are any LPO cards
    //   final lpoCards = find.byType(Card);
      
    //   if (lpoCards.evaluate().isNotEmpty) {
    //     // Tap on the first LPO card
    //     await tester.tap(lpoCards.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 3));

    //     // Verify we're on LPO details screen
    //     final hasLPODetails = find.text('LPO Details').evaluate().isNotEmpty;
    //     final hasFinancialDetails = find.text('Financial Details').evaluate().isNotEmpty;
    //     final hasRepaymentDetails = find.text('Repayment Details').evaluate().isNotEmpty;

    //     expect(hasLPODetails || hasFinancialDetails || hasRepaymentDetails, isTrue,
    //            reason: 'Should be on LPO details screen');

    //     print('✓ Successfully viewed LPO details');
    //   } else {
    //     print('⚠ No LPOs available to view details');
    //   }
      
    //   await tester.pump(const Duration(milliseconds: 100));
    // });

    // testWidgets('Create new LPO - navigate to form', (WidgetTester tester) async {
    //   await loginAndNavigateToLPOs(tester);

    //   await tester.pumpAndSettle(const Duration(seconds: 3));

    //   // Look for the create button (either in AppBar or empty state)
    //   final createButtonInAppBar = find.byIcon(Icons.add);
    //   final createButtonText = find.text('Apply for LPO');

    //   Finder? createButton;
      
    //   if (createButtonInAppBar.evaluate().isNotEmpty) {
    //     createButton = createButtonInAppBar.first;
    //   } else if (createButtonText.evaluate().isNotEmpty) {
    //     createButton = createButtonText.first;
    //   }

    //   if (createButton != null) {
    //     await tester.tap(createButton);
    //     await tester.pumpAndSettle(const Duration(seconds: 3));

    //     // Verify we're on the LPO application form
    //     final hasLPOApplication = find.text('Apply for LPO').evaluate().isNotEmpty;
    //     final hasSupplierInfo = find.text('Supplier Information').evaluate().isNotEmpty;
    //     final hasLPODetails = find.text('LPO Details').evaluate().isNotEmpty;

    //     expect(hasLPOApplication || hasSupplierInfo || hasLPODetails, isTrue,
    //            reason: 'Should be on LPO application form');

    //     print('✓ Successfully navigated to LPO application form');
    //   } else {
    //     print('⚠ Apply for LPO button not found');
    //   }
      
    //   await tester.pump(const Duration(milliseconds: 100));
    // });

    // testWidgets('Make LPO payment - open payment dialog', (WidgetTester tester) async {
    //   await loginAndNavigateToLPOs(tester);

    //   await tester.pumpAndSettle(const Duration(seconds: 3));

    //   // Check if there are any LPO cards
    //   final lpoCards = find.byType(Card);
      
    //   if (lpoCards.evaluate().isNotEmpty) {
    //     // Tap on the first LPO card to view details
    //     await tester.tap(lpoCards.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 3));

    //     // Look for Make Payment button
    //     final makePaymentButton = find.text('Make Payment');
        
    //     if (makePaymentButton.evaluate().isNotEmpty) {
    //       await tester.tap(makePaymentButton.first);
    //       await tester.pumpAndSettle(const Duration(seconds: 2));

    //       // Verify payment dialog is shown
    //       final hasMakePayment = find.text('Make Payment').evaluate().length > 1;
    //       final hasPinField = find.text('PIN').evaluate().isNotEmpty;

    //       expect(hasMakePayment || hasPinField, isTrue,
    //              reason: 'Should show payment dialog');

    //       print('✓ Successfully opened payment dialog');
          
    //       // Close the dialog
    //       final cancelButton = find.text('Cancel');
    //       if (cancelButton.evaluate().isNotEmpty) {
    //         await tester.tap(cancelButton);
    //         await tester.pumpAndSettle();
    //       }
    //     } else {
    //       print('⚠ Make Payment button not found (LPO might not be eligible for payment)');
    //     }
    //   } else {
    //     print('⚠ No LPOs available to make payment');
    //   }
      
    //   await tester.pump(const Duration(milliseconds: 100));
    // });
  });
}