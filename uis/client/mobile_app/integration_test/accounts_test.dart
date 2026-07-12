import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Accounts Screen Tests', () {
    Future<void> loginHelper(WidgetTester tester) async {      app.main();
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

      // Find and tap login button (it's a GestureDetector with Container)
      final loginButton = find.text('Login');
      expect(loginButton, findsWidgets);
      await tester.tap(loginButton.last); // Use last to avoid conflict with nav items
      await tester.pump();

      // Wait for login to complete
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle(const Duration(seconds: 5));
    }

    testWidgets('View accounts list', (WidgetTester tester) async {
      await loginHelper(tester);

      final accountsButton = find.textContaining('Account');
      if (accountsButton.evaluate().isNotEmpty) {
        await tester.tap(accountsButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 3));

        // Verify accounts screen loaded
        expect(find.textContaining('Account'), findsWidgets);

        // Check for account cards or list items
        expect(find.byType(Card), findsWidgets);
      }
    });

    testWidgets('View account details', (WidgetTester tester) async {
      await loginHelper(tester);

      final accountsButton = find.textContaining('Account');
      if (accountsButton.evaluate().isNotEmpty) {
        await tester.tap(accountsButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 3));

        // Tap on first account card if available
        final accountCard = find.byType(Card);
        if (accountCard.evaluate().isNotEmpty) {
          await tester.tap(accountCard.first);
          await tester.pumpAndSettle(const Duration(seconds: 3));

          // Verify we navigated to account details
          expect(
            find.textContaining('Balance'),
            findsAny,
          );
        }
      }
    });

    testWidgets('View transaction history', (WidgetTester tester) async {
      await loginHelper(tester);

      final accountsButton = find.textContaining('Account');
      if (accountsButton.evaluate().isNotEmpty) {
        await tester.tap(accountsButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 3));

        // Look for transactions tab or button
        final transactionsButton = find.textContaining('Transaction');
        if (transactionsButton.evaluate().isNotEmpty) {
          await tester.tap(transactionsButton.first);
          await tester.pumpAndSettle(const Duration(seconds: 3));

          expect(find.textContaining('Transaction'), findsWidgets);
        }
      }
    });

    testWidgets('Create new account flow', (WidgetTester tester) async {
      await loginHelper(tester);

      final accountsButton = find.textContaining('Account');
      if (accountsButton.evaluate().isNotEmpty) {
        await tester.tap(accountsButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 3));

        // Look for add/create account button
        final addButton = find.byIcon(Icons.add);
        if (addButton.evaluate().isNotEmpty) {
          await tester.tap(addButton.first);
          await tester.pumpAndSettle(const Duration(seconds: 2));

          // Verify navigation to create account screen
          expect(
            find.textContaining('Create'),
            findsAny,
          );
        }
      }
    });
  });
}
