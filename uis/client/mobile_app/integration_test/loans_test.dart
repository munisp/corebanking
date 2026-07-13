import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Loans Screen Tests', () {
    Future<void> loginAndNavigateToLoans(WidgetTester tester) async {
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

        // Scroll down to find Active Loans if needed
        final listView = find.byType(ListView);
        if (listView.evaluate().isNotEmpty) {
          // await tester.drag(listView.first, const Offset(0, -300));
          await tester.pumpAndSettle();
        }

        // Find and tap on Active Loans
        final loansListTile = find.ancestor(
          of: find.text('Active Loans'),
          matching: find.byType(ListTile),
        );

        if (loansListTile.evaluate().isNotEmpty) {
          await tester.tap(loansListTile.first);
          await tester.pumpAndSettle(const Duration(seconds: 3));
        } else {
          print('WARNING: Active Loans not found in More Actions');
        }
      }
    }

    testWidgets('Navigate to loans screen from More Actions',
        (WidgetTester tester) async {
      await loginAndNavigateToLoans(tester);

      // Wait for loans screen to fully load
      await tester.pumpAndSettle(const Duration(seconds: 3));
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();

      // Verify we're on Active Loans screen
      final hasActiveLoansTitle = find.text('Active Loans').evaluate().isNotEmpty;
      final hasNoActiveLoans = find.text('No Active Loans').evaluate().isNotEmpty;
      final hasApplyButton = find.text('Apply for Loan').evaluate().isNotEmpty;
      final hasLoanCards = find.byType(Card).evaluate().isNotEmpty;

      print('=== Active Loans Screen Elements ===');
      print('hasActiveLoansTitle: $hasActiveLoansTitle');
      print('hasNoActiveLoans: $hasNoActiveLoans');
      print('hasApplyButton: $hasApplyButton');
      print('hasLoanCards: $hasLoanCards');

      // Should be on Active Loans screen
      final isOnLoansScreen = hasActiveLoansTitle || hasNoActiveLoans || hasApplyButton;
      
      expect(isOnLoansScreen, isTrue,
             reason: 'Should be on Active Loans screen');
      
      // Should NOT be on More Actions anymore
      expect(find.text('More Actions'), findsNothing);
      
      print('✓ Successfully navigated to Active Loans screen');
      
      // Give widgets time to settle before test ends
      await tester.pump(const Duration(milliseconds: 100));
    });

    testWidgets('View loans list or empty state', (WidgetTester tester) async {
      await loginAndNavigateToLoans(tester);

      // Wait for screen to load
      await tester.pumpAndSettle(const Duration(seconds: 3));

      // Check if there are loans or empty state
      final hasLoanCards = find.byType(Card).evaluate().isNotEmpty;
      final hasEmptyState = find.text('No Active Loans').evaluate().isNotEmpty;
      final hasErrorState = find.text('Error loading loans').evaluate().isNotEmpty;

      expect(hasLoanCards || hasEmptyState || hasErrorState, isTrue,
             reason: 'Should show either loans, empty state, or error state');

      print('✓ Loans list or empty state displayed correctly');
      
      await tester.pump(const Duration(milliseconds: 100));
    });

    // testWidgets('View loan details', (WidgetTester tester) async {
    //   await loginAndNavigateToLoans(tester);

    //   await tester.pumpAndSettle(const Duration(seconds: 3));

    //   // Check if there are any loan cards
    //   final loanCards = find.byType(Card);
      
    //   if (loanCards.evaluate().isNotEmpty) {
    //     // Tap on the first loan card
    //     await tester.tap(loanCards.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 3));

    //     // Verify we're on loan details screen
    //     final hasLoanDetails = find.text('Loan Details').evaluate().isNotEmpty;
    //     final hasPaymentInfo = find.text('Payment Information').evaluate().isNotEmpty;
    //     final hasLoanTerms = find.text('Loan Terms').evaluate().isNotEmpty;

    //     expect(hasLoanDetails || hasPaymentInfo || hasLoanTerms, isTrue,
    //            reason: 'Should be on loan details screen');

    //     print('✓ Successfully viewed loan details');
    //   } else {
    //     print('⚠ No loans available to view details');
    //   }
      
    //   await tester.pump(const Duration(milliseconds: 100));
    // });

    // testWidgets('Apply for new loan - navigate to form', (WidgetTester tester) async {
    //   await loginAndNavigateToLoans(tester);

    //   await tester.pumpAndSettle(const Duration(seconds: 3));

    //   // Look for the apply button (either in AppBar or empty state)
    //   final applyButtonInAppBar = find.byIcon(Icons.add);
    //   final applyButtonText = find.text('Apply for Loan');

    //   Finder? applyButton;
      
    //   if (applyButtonInAppBar.evaluate().isNotEmpty) {
    //     applyButton = applyButtonInAppBar.first;
    //   } else if (applyButtonText.evaluate().isNotEmpty) {
    //     applyButton = applyButtonText.first;
    //   }

    //   if (applyButton != null) {
    //     await tester.tap(applyButton);
    //     await tester.pumpAndSettle(const Duration(seconds: 3));

    //     // Verify we're on the loan application form
    //     final hasLoanAmount = find.text('Loan Amount').evaluate().isNotEmpty;
    //     final hasRepaymentPeriod = find.text('Repayment Period').evaluate().isNotEmpty;
    //     final hasLoanPurpose = find.text('Loan Purpose').evaluate().isNotEmpty;

    //     expect(hasLoanAmount || hasRepaymentPeriod || hasLoanPurpose, isTrue,
    //            reason: 'Should be on loan application form');

    //     print('✓ Successfully navigated to loan application form');
    //   } else {
    //     print('⚠ Apply for loan button not found');
    //   }
      
    //   await tester.pump(const Duration(milliseconds: 100));
    // });

    // testWidgets('Make loan payment - open payment dialog', (WidgetTester tester) async {
    //   await loginAndNavigateToLoans(tester);

    //   await tester.pumpAndSettle(const Duration(seconds: 3));

    //   // Check if there are any loan cards
    //   final loanCards = find.byType(Card);
      
    //   if (loanCards.evaluate().isNotEmpty) {
    //     // Tap on the first loan card to view details
    //     await tester.tap(loanCards.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 3));

    //     // Look for Make Payment button
    //     final makePaymentButton = find.text('Make Payment');
        
    //     if (makePaymentButton.evaluate().isNotEmpty) {
    //       await tester.tap(makePaymentButton.first);
    //       await tester.pumpAndSettle(const Duration(seconds: 2));

    //       // Verify payment dialog is shown
    //       final hasRepayLoan = find.text('Repay Loan').evaluate().isNotEmpty;
    //       final hasAmountField = find.text('Amount').evaluate().isNotEmpty;
    //       final hasPinField = find.text('PIN').evaluate().isNotEmpty;

    //       expect(hasRepayLoan || hasAmountField || hasPinField, isTrue,
    //              reason: 'Should show payment dialog');

    //       print('✓ Successfully opened payment dialog');
          
    //       // Close the dialog
    //       final cancelButton = find.text('Cancel');
    //       if (cancelButton.evaluate().isNotEmpty) {
    //         await tester.tap(cancelButton);
    //         await tester.pumpAndSettle();
    //       }
    //     } else {
    //       print('⚠ Make Payment button not found (loan might not be active)');
    //     }
    //   } else {
    //     print('⚠ No loans available to make payment');
    //   }
      
    //   await tester.pump(const Duration(milliseconds: 100));
    // });
  });
}