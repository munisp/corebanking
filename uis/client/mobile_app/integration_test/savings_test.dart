import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Savings Screen Tests', () {
    Future<void> loginAndNavigateToSavings(WidgetTester tester) async {
      app.main();
      await tester.pumpAndSettle();

      // Wait for splash screen to finish and login screen to appear
      await tester.pumpAndSettle(const Duration(seconds: 10));
      
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

      // Wait for login to complete and navigate to dashboard
      await tester.pumpAndSettle(const Duration(seconds: 10));

      // Should be on dashboard with BottomNavigationBar
      expect(find.byType(BottomNavigationBar), findsOneWidget);

      // Find and tap "Savings" on the dashboard
      final savingsButton = find.text('Savings');
      if (savingsButton.evaluate().isNotEmpty) {
        print('✓ Found Savings on dashboard');
        await tester.tap(savingsButton.first);
        await tester.pumpAndSettle();
      } else {
        // Scroll to find Savings if needed
        final scrollable = find.byType(Scrollable);
        if (scrollable.evaluate().isNotEmpty) {
          await tester.drag(scrollable.first, const Offset(0, -300));
          await tester.pumpAndSettle();
          
          // Try again after scrolling
          final savingsAfterScroll = find.text('Savings');
          if (savingsAfterScroll.evaluate().isNotEmpty) {
            print('✓ Found Savings after scrolling');
            await tester.tap(savingsAfterScroll.first);
            await tester.pumpAndSettle();
          } else {
            print('WARNING: Savings not found on dashboard');
          }
        }
      }
    }

    testWidgets('Navigate to savings screen from More Actions',
        (WidgetTester tester) async {
      await loginAndNavigateToSavings(tester);

      // Wait for savings screen to fully load
      await tester.pumpAndSettle();

      // Verify we're on Savings screen (the actual AppBar title is "My Savings")
      final hasMySavingsTitle = find.text('My Savings').evaluate().isNotEmpty;
      final hasNoSavings = find.text('No Savings Plans Yet').evaluate().isNotEmpty;
      final hasCreateButton = find.text('Create Savings Plan').evaluate().isNotEmpty;
      final hasNewSavingsFAB = find.text('New Savings').evaluate().isNotEmpty;
      final hasSavingsCards = find.byType(Card).evaluate().isNotEmpty;

      print('=== Savings Screen Elements ===');
      print('hasMySavingsTitle: $hasMySavingsTitle');
      print('hasNoSavings: $hasNoSavings');
      print('hasCreateButton: $hasCreateButton');
      print('hasNewSavingsFAB: $hasNewSavingsFAB');
      print('hasSavingsCards: $hasSavingsCards');

      // Should be on Savings screen
      final isOnSavingsScreen = hasMySavingsTitle || hasNoSavings || hasCreateButton || hasNewSavingsFAB;
      
      expect(isOnSavingsScreen, isTrue,
             reason: 'Should be on Savings screen');
      
      print('✓ Successfully navigated to Savings screen');
    });

    // testWidgets('View savings list or empty state', (WidgetTester tester) async {
    //   await loginAndNavigateToSavings(tester);

    //   // Wait for screen to load
    //   await tester.pumpAndSettle(const Duration(seconds: 3));

    //   // Check if there are savings or empty state
    //   final hasSavingsCards = find.byType(Card).evaluate().isNotEmpty;
    //   final hasEmptyState = find.text('No Savings Plans Yet').evaluate().isNotEmpty;
    //   final hasErrorState = find.text('Error loading savings').evaluate().isNotEmpty;

    //   expect(hasSavingsCards || hasEmptyState || hasErrorState, isTrue,
    //          reason: 'Should show either savings, empty state, or error state');

    //   print('✓ Savings list or empty state displayed correctly');
      
    //   await tester.pump(const Duration(milliseconds: 100));
    // });

    // testWidgets('View savings details', (WidgetTester tester) async {
    //   await loginAndNavigateToSavings(tester);

    //   await tester.pumpAndSettle(const Duration(seconds: 3));

    //   // Check if there are any savings cards
    //   final savingsCards = find.byType(Card);
      
    //   if (savingsCards.evaluate().isNotEmpty) {
    //     // Tap on the first savings card
    //     await tester.tap(savingsCards.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 3));

    //     // Verify we're on savings details screen
    //     final hasSavingsDetails = find.text('Savings Details').evaluate().isNotEmpty;
    //     final hasCurrentBalance = find.text('Current Balance').evaluate().isNotEmpty;
    //     final hasManageSavings = find.text('Manage Savings').evaluate().isNotEmpty;

    //     expect(hasSavingsDetails || hasCurrentBalance || hasManageSavings, isTrue,
    //            reason: 'Should be on savings details screen');

    //     print('✓ Successfully viewed savings details');
    //   } else {
    //     print('⚠ No savings available to view details');
    //   }
      
    //   await tester.pump(const Duration(milliseconds: 100));
    // });

    // testWidgets('Create new savings plan - navigate to form', (WidgetTester tester) async {
    //   await loginAndNavigateToSavings(tester);

    //   await tester.pumpAndSettle(const Duration(seconds: 3));

    //   // Look for the create button (FAB or empty state button)
    //   final createButtonInAppBar = find.byIcon(Icons.add_circle_outline);
    //   final fabButton = find.text('New Savings');
    //   final createButtonText = find.text('Create Savings Plan');

    //   Finder? createButton;
      
    //   if (fabButton.evaluate().isNotEmpty) {
    //     createButton = fabButton.first;
    //   } else if (createButtonInAppBar.evaluate().isNotEmpty) {
    //     createButton = createButtonInAppBar.first;
    //   } else if (createButtonText.evaluate().isNotEmpty) {
    //     createButton = createButtonText.first;
    //   }

    //   if (createButton != null) {
    //     await tester.tap(createButton);
    //     await tester.pumpAndSettle(const Duration(seconds: 3));

    //     // Verify we're on the savings creation form
    //     final hasSavingsName = find.text('Savings Name').evaluate().isNotEmpty;
    //     final hasTargetAmount = find.text('Target Amount').evaluate().isNotEmpty;
    //     final hasTargetDate = find.text('Target Date').evaluate().isNotEmpty;

    //     expect(hasSavingsName || hasTargetAmount || hasTargetDate, isTrue,
    //            reason: 'Should be on savings creation form');

    //     print('✓ Successfully navigated to savings creation form');
    //   } else {
    //     print('⚠ Create savings button not found');
    //   }
      
    //   await tester.pump(const Duration(milliseconds: 100));
    // });

    // testWidgets('Make contribution - open dialog', (WidgetTester tester) async {
    //   await loginAndNavigateToSavings(tester);

    //   await tester.pumpAndSettle(const Duration(seconds: 3));

    //   // Check if there are any savings cards
    //   final savingsCards = find.byType(Card);
      
    //   if (savingsCards.evaluate().isNotEmpty) {
    //     // Tap on the first savings card to view details
    //     await tester.tap(savingsCards.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 3));

    //     // Look for Add Funds button
    //     final addFundsButton = find.text('Add Funds');
        
    //     if (addFundsButton.evaluate().isNotEmpty) {
    //       await tester.tap(addFundsButton.first);
    //       await tester.pumpAndSettle(const Duration(seconds: 2));

    //       // Verify contribution dialog is shown
    //       final hasContribution = find.text('Make Contribution').evaluate().isNotEmpty;
    //       final hasAmountField = find.text('Amount').evaluate().isNotEmpty;

    //       expect(hasContribution || hasAmountField, isTrue,
    //              reason: 'Should show contribution dialog');

    //       print('✓ Successfully opened contribution dialog');
          
    //       // Close the dialog
    //       final cancelButton = find.text('Cancel');
    //       if (cancelButton.evaluate().isNotEmpty) {
    //         await tester.tap(cancelButton);
    //         await tester.pumpAndSettle();
    //       }
    //     } else {
    //       print('⚠ Add Funds button not found (savings might not be active)');
    //     }
    //   } else {
    //     print('⚠ No savings available to contribute to');
    //   }
      
    //   await tester.pump(const Duration(milliseconds: 100));
    // });
  });
}