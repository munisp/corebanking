import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Cards Screen Tests', () {
    Future<void> loginAndNavigateToCards(WidgetTester tester) async {
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

        // After reaching More Actions screen, add extra wait
        await tester.pump(const Duration(seconds: 2));
        await tester.pumpAndSettle();

        // Debug: Check what's on screen
        expect(find.text('More Actions'), findsWidgets);

        // Try scrolling down in case Cards is below the fold
        final listView = find.byType(ListView);
        if (listView.evaluate().isNotEmpty) {
          await tester.drag(listView.first, const Offset(0, -300));
          await tester.pumpAndSettle();
        }

        // Now look for Cards
        final cardsListTile = find.ancestor(
          of: find.text('Cards'),
          matching: find.byType(ListTile),
        );

        if (cardsListTile.evaluate().isNotEmpty) {
          await tester.tap(cardsListTile.first);
          await tester.pumpAndSettle(const Duration(seconds: 3));
        } else {
          print('WARNING: Cards not found in More Actions');
        }
      }
    }

    testWidgets('Navigate to cards screen from More Actions',
        (WidgetTester tester) async {
      await loginAndNavigateToCards(tester);

      // Wait for Cards screen to fully load and render
      await tester.pumpAndSettle(const Duration(seconds: 3));
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();

      // Cards screen uses CustomScrollView with SliverAppBar
      expect(find.byType(CustomScrollView), findsOneWidget,
          reason: 'Cards screen should have CustomScrollView');

      expect(find.byType(SliverAppBar), findsOneWidget,
          reason: 'Cards screen should have SliverAppBar');

      // Should NOT be on More Actions anymore
      expect(find.text('More Actions'), findsNothing);

      // Verify key Cards screen text is present
      expect(find.text('My Cards'), findsOneWidget);
      expect(find.text('Transactions'), findsOneWidget);

      print('✓ Successfully navigated to Cards screen');

      // Give widgets time to settle before test ends
      await tester.pump(const Duration(milliseconds: 100));
    });

    // testWidgets('View cards list', (WidgetTester tester) async {
    //   await loginAndNavigateToCards(tester);

    //   // Check for cards list or empty state
    //   final hasCards = find.byType(Card).evaluate().isNotEmpty;
    //   final hasEmptyState = find.textContaining('No card').evaluate().isNotEmpty;

    //   expect(hasCards || hasEmptyState, isTrue);
    // });

    // testWidgets('Request/Create new card', (WidgetTester tester) async {
    //   await loginAndNavigateToCards(tester);

    //   // Look for add/request card button
    //   final addButton = find.byIcon(Icons.add);
    //   final requestButton = find.textContaining('Request');
    //   final createButton = find.textContaining('Create');

    //   if (addButton.evaluate().isNotEmpty) {
    //     await tester.tap(addButton.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 2));

    //     // Verify navigation to create card screen
    //     expect(
    //       find.textContaining('Request').evaluate().isNotEmpty ||
    //           find.textContaining('Create').evaluate().isNotEmpty ||
    //           find.textContaining('New').evaluate().isNotEmpty,
    //       isTrue,
    //     );
    //   } else if (requestButton.evaluate().isNotEmpty) {
    //     await tester.tap(requestButton.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 2));
    //   } else if (createButton.evaluate().isNotEmpty) {
    //     await tester.tap(createButton.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 2));
    //   }
    // });

    // testWidgets('Freeze card functionality', (WidgetTester tester) async {
    //   await loginAndNavigateToCards(tester);

    //   // Look for freeze button/option
    //   final freezeButton = find.textContaining('Freeze');
    //   final blockButton = find.textContaining('Block');

    //   if (freezeButton.evaluate().isNotEmpty) {
    //     await tester.tap(freezeButton.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 2));

    //     // Check for confirmation dialog or freeze action
    //     final confirmButton = find.text('Confirm');
    //     final yesButton = find.text('Yes');

    //     if (confirmButton.evaluate().isNotEmpty) {
    //       await tester.tap(confirmButton);
    //       await tester.pumpAndSettle(const Duration(seconds: 2));
    //     } else if (yesButton.evaluate().isNotEmpty) {
    //       await tester.tap(yesButton);
    //       await tester.pumpAndSettle(const Duration(seconds: 2));
    //     }
    //   } else if (blockButton.evaluate().isNotEmpty) {
    //     await tester.tap(blockButton.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 2));
    //   }
    // });

    // testWidgets('Unfreeze card functionality', (WidgetTester tester) async {
    //   await loginAndNavigateToCards(tester);

    //   // Look for unfreeze button/option
    //   final unfreezeButton = find.textContaining('Unfreeze');
    //   final activateButton = find.textContaining('Activate');

    //   if (unfreezeButton.evaluate().isNotEmpty) {
    //     await tester.tap(unfreezeButton.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 2));

    //     // Check for confirmation
    //     final confirmButton = find.text('Confirm');
    //     if (confirmButton.evaluate().isNotEmpty) {
    //       await tester.tap(confirmButton);
    //       await tester.pumpAndSettle(const Duration(seconds: 2));
    //     }
    //   } else if (activateButton.evaluate().isNotEmpty) {
    //     await tester.tap(activateButton.first);
    //     await tester.pumpAndSettle(const Duration(seconds: 2));
    //   }
    // });
  });
}
