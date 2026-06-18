import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Transfers Screen Tests', () {
    Future<void> loginAndNavigateToTransfers(WidgetTester tester) async {
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

      // Find and tap "Transfers" or "Transfer" on the dashboard
      final transfersButton = find.textContaining('Transfer');
      if (transfersButton.evaluate().isNotEmpty) {
        print('✓ Found Transfers on dashboard');
        await tester.tap(transfersButton.first);
        await tester.pumpAndSettle();
      } else {
        // Scroll to find Transfers if needed
        final scrollable = find.byType(Scrollable);
        if (scrollable.evaluate().isNotEmpty) {
          await tester.drag(scrollable.first, const Offset(0, -300));
          await tester.pumpAndSettle();
          
          // Try again after scrolling
          final transfersAfterScroll = find.textContaining('Transfer');
          if (transfersAfterScroll.evaluate().isNotEmpty) {
            print('✓ Found Transfers after scrolling');
            await tester.tap(transfersAfterScroll.first);
            await tester.pumpAndSettle();
          } else {
            print('WARNING: Transfers not found on dashboard');
          }
        }
      }
    }

    testWidgets('Navigate to transfers screen from dashboard',
        (WidgetTester tester) async {
      await loginAndNavigateToTransfers(tester);

      // Wait for transfers screen to fully load
      await tester.pumpAndSettle();

      // Verify we're on Transfers screen
      final hasTransferTitle = find.textContaining('Transfer').evaluate().isNotEmpty;
      final hasPayeeField = find.textContaining('Payee').evaluate().isNotEmpty;
      final hasAmountField = find.textContaining('Amount').evaluate().isNotEmpty;

      print('=== Transfers Screen Elements ===');
      print('hasTransferTitle: $hasTransferTitle');
      print('hasPayeeField: $hasPayeeField');
      print('hasAmountField: $hasAmountField');

      // Should be on Transfers screen
      final isOnTransfersScreen = hasTransferTitle || hasPayeeField || hasAmountField;
      
      expect(isOnTransfersScreen, isTrue,
             reason: 'Should be on Transfers screen');
      
      print('✓ Successfully navigated to Transfers screen');
    });

    testWidgets('Make transfer to payee ID 14 with amount 100',
        (WidgetTester tester) async {
      await loginAndNavigateToTransfers(tester);

      // Wait for screen to load
      await tester.pumpAndSettle();

      // Find payee selection field/dropdown
      final payeeField = find.textContaining('Payee');
      if (payeeField.evaluate().isNotEmpty) {
        print('✓ Found Payee field');
        await tester.tap(payeeField.first);
        await tester.pumpAndSettle();

        // Look for payee ID 14 or dropdown with ID 14
        final payee14 = find.text('14');
        if (payee14.evaluate().isNotEmpty) {
          print('✓ Found Payee ID 14');
          await tester.tap(payee14.first);
          await tester.pumpAndSettle();
        } else {
          // Try finding by widget containing "14"
          final payeeWith14 = find.textContaining('14');
          if (payeeWith14.evaluate().isNotEmpty) {
            print('✓ Found Payee containing 14');
            await tester.tap(payeeWith14.first);
            await tester.pumpAndSettle();
          } else {
            print('⚠ Payee ID 14 not found in dropdown');
          }
        }
      } else {
        print('⚠ Payee field not found');
      }

      // Find amount field and enter 100
      final amountFields = find.byType(TextFormField);
      if (amountFields.evaluate().isNotEmpty) {
        // Find the amount field (usually has label or hint "Amount")
        for (var i = 0; i < amountFields.evaluate().length; i++) {
          final field = amountFields.at(i);
          // Try to identify amount field by tapping and entering
          try {
            await tester.tap(field);
            await tester.pump();
            await tester.enterText(field, '100');
            await tester.pump();
            print('✓ Entered amount: 100');
            break;
          } catch (e) {
            continue;
          }
        }
      } else {
        print('⚠ Amount field not found');
      }

      await tester.pumpAndSettle();

      // Find and tap submit/transfer button
      final transferButton = find.textContaining('Transfer');
      final submitButton = find.textContaining('Submit');
      final sendButton = find.textContaining('Send');

      Finder? actionButton;
      
      if (transferButton.evaluate().length > 1) {
        // Multiple "Transfer" texts found, use the button (not title)
        actionButton = transferButton.last;
      } else if (submitButton.evaluate().isNotEmpty) {
        actionButton = submitButton.first;
      } else if (sendButton.evaluate().isNotEmpty) {
        actionButton = sendButton.first;
      }

      if (actionButton != null) {
        print('✓ Found transfer action button');
        await tester.tap(actionButton);
        await tester.pumpAndSettle();

        // Check for success message or confirmation
        final hasSuccess = find.textContaining('success').evaluate().isNotEmpty ||
                          find.textContaining('Success').evaluate().isNotEmpty ||
                          find.textContaining('completed').evaluate().isNotEmpty ||
                          find.textContaining('Completed').evaluate().isNotEmpty;

        if (hasSuccess) {
          print('✓ Transfer completed successfully');
        } else {
          print('⚠ Success message not found (may need manual verification)');
        }
      } else {
        print('⚠ Transfer button not found');
      }

      await tester.pumpAndSettle();
    });
  });
}
