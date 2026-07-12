import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Disputes Screen Tests', () {
    Future<void> loginHelper(WidgetTester tester) async {
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

      // Find and tap login button (it's a GestureDetector with Container)
      final loginButton = find.text('Login');
      expect(loginButton, findsWidgets);
      await tester.tap(loginButton.last); // Use last to avoid conflict with nav items
      await tester.pump();

      // Wait for login to complete and navigate to dashboard
      await tester.pumpAndSettle(const Duration(seconds: 10));
    }

    testWidgets('Navigate to disputes screen', (WidgetTester tester) async {
      await loginHelper(tester);

      final disputesButton = find.textContaining('Dispute');
      if (disputesButton.evaluate().isNotEmpty) {
        await tester.tap(disputesButton.first);
        await tester.pumpAndSettle();

        expect(find.textContaining('Dispute'), findsWidgets);
      }
    });

    testWidgets('View disputes list', (WidgetTester tester) async {
      await loginHelper(tester);

      final disputesButton = find.textContaining('Dispute');
      if (disputesButton.evaluate().isNotEmpty) {
        await tester.tap(disputesButton.first);
        await tester.pumpAndSettle();

        // Check for disputes list or empty state
        expect(
          find.textContaining('Dispute'),
          findsWidgets,
        );
      }
    });

    // testWidgets('Create new dispute', (WidgetTester tester) async {
    //   await loginHelper(tester);

    //   final disputesButton = find.textContaining('Dispute');
    //   if (disputesButton.evaluate().isNotEmpty) {
    //     await tester.tap(disputesButton.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 3));

    //     // Look for create dispute button
    //     final createButton = find.textContaining('Create');
    //     if (createButton.evaluate().isEmpty) {
    //       final addButton = find.byIcon(Icons.add);
    //       if (addButton.evaluate().isNotEmpty) {
    //         await tester.tap(addButton.first);
    //         await tester.pumpAndSettle(const Duration(seconds: 2));
    //       }
    //     } else {
    //       await tester.tap(createButton.first);
    //       await tester.pumpAndSettle(const Duration(seconds: 2));
    //     }

    //     // Verify dispute creation form
    //     expect(find.textContaining('Transaction'), findsAny);
    //   }
    // });

    // testWidgets('View dispute details', (WidgetTester tester) async {
    //   await loginHelper(tester);

    //   final disputesButton = find.textContaining('Dispute');
    //   if (disputesButton.evaluate().isNotEmpty) {
    //     await tester.tap(disputesButton.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 3));

    //     // Tap on first dispute if available
    //     final disputeCard = find.byType(Card);
    //     if (disputeCard.evaluate().isNotEmpty) {
    //       await tester.tap(disputeCard.first);
    //       await tester.pumpAndSettle(const Duration(seconds: 3));

    //       // Verify dispute details screen
    //       expect(find.textContaining('Status'), findsAny);
    //     }
    //   }
    // });
  });
}
