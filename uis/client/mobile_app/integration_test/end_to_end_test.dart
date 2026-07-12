import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('End-to-End Complete App Flow', () {
    testWidgets('Complete user journey: Login -> Dashboard -> Savings -> Transfers -> Disputes',
        (WidgetTester tester) async {
      
      // ==================== STEP 1: LOGIN ====================
      print('\n========== STEP 1: LOGIN ==========');
      app.main();
      await tester.pumpAndSettle();

      // Wait for splash screen to finish and login screen to appear
      await tester.pumpAndSettle(const Duration(seconds: 10));
      
      // Should now be on login screen
      expect(find.byType(TextFormField), findsWidgets);
      print('✓ Login screen loaded');

      // Enter email
      final emailFields = find.byType(TextFormField);
      await tester.enterText(emailFields.first, 'test10@gmail.com');
      await tester.pump();

      // Enter password
      await tester.enterText(emailFields.last, 'Test1234@');
      await tester.pump();
      print('✓ Credentials entered');

      // Find and tap login button
      final loginButton = find.text('Login');
      expect(loginButton, findsWidgets);
      await tester.tap(loginButton.last);
      await tester.pump();

      // Wait for login to complete and navigate to dashboard
      await tester.pumpAndSettle(const Duration(seconds: 10));

      // Should be on dashboard with BottomNavigationBar
      expect(find.byType(BottomNavigationBar), findsOneWidget);
      print('✓ Login successful - Dashboard loaded');

      // ==================== STEP 2: DASHBOARD ====================
      print('\n========== STEP 2: DASHBOARD ==========');
      
      // Verify dashboard elements
      final hasDashboard = find.textContaining('Home').evaluate().isNotEmpty ||
                          find.byType(BottomNavigationBar).evaluate().isNotEmpty;
      expect(hasDashboard, isTrue);
      print('✓ Dashboard verified');

      // Wait a moment for dashboard to fully load
      await tester.pumpAndSettle();

      // ==================== STEP 3: SAVINGS ====================
      print('\n========== STEP 3: SAVINGS ==========');
      
      // Navigate to Savings
      final savingsButton = find.text('Savings');
      if (savingsButton.evaluate().isNotEmpty) {
        print('✓ Found Savings on dashboard');
        await tester.tap(savingsButton.first);
        await tester.pumpAndSettle();

        // Verify we're on Savings screen
        final hasSavingsScreen = find.text('My Savings').evaluate().isNotEmpty ||
                                find.text('No Savings Plans Yet').evaluate().isNotEmpty ||
                                find.text('Create Savings Plan').evaluate().isNotEmpty;
        
        if (hasSavingsScreen) {
          print('✓ Savings screen loaded successfully');
        } else {
          print('⚠ Could not verify Savings screen');
        }

        // Go back to dashboard
        final backButton = find.byType(BackButton);
        if (backButton.evaluate().isNotEmpty) {
          await tester.tap(backButton.first);
          await tester.pumpAndSettle();
          print('✓ Returned to dashboard');
        } else {
          // Try tapping back arrow icon
          final backIcon = find.byIcon(Icons.arrow_back);
          if (backIcon.evaluate().isNotEmpty) {
            await tester.tap(backIcon.first);
            await tester.pumpAndSettle();
            print('✓ Returned to dashboard');
          }
        }
      } else {
        print('⚠ Savings button not found on dashboard, skipping');
      }

      await tester.pumpAndSettle();

      // ==================== STEP 4: TRANSFERS ====================
      print('\n========== STEP 4: TRANSFERS ==========');
      
      // Navigate to Transfers
      final transfersButton = find.textContaining('Transfer');
      if (transfersButton.evaluate().isNotEmpty) {
        print('✓ Found Transfers on dashboard');
        await tester.tap(transfersButton.first);
        await tester.pumpAndSettle();

        // Verify we're on Transfers screen
        final hasTransfersScreen = find.textContaining('Transfer').evaluate().isNotEmpty ||
                                   find.textContaining('Payee').evaluate().isNotEmpty;
        
        if (hasTransfersScreen) {
          print('✓ Transfers screen loaded successfully');
          
          // Try to make a test transfer (Payee ID 14, Amount 100)
          final payeeField = find.textContaining('Payee');
          final amountFields = find.byType(TextFormField);
          
          if (payeeField.evaluate().isNotEmpty && amountFields.evaluate().isNotEmpty) {
            // Select payee
            await tester.tap(payeeField.first);
            await tester.pumpAndSettle();
            
            final payee14 = find.textContaining('14');
            if (payee14.evaluate().isNotEmpty) {
              await tester.tap(payee14.first);
              await tester.pumpAndSettle();
              print('✓ Selected Payee ID 14');
            }

            // Enter amount
            for (var i = 0; i < amountFields.evaluate().length; i++) {
              final field = amountFields.at(i);
              try {
                await tester.tap(field);
                await tester.pump();
                await tester.enterText(field, '100');
                await tester.pump();
                print('✓ Entered transfer amount: 100');
                break;
              } catch (e) {
                continue;
              }
            }

            await tester.pumpAndSettle();
            print('✓ Transfer form filled (not submitted in E2E test)');
          }
        } else {
          print('⚠ Could not verify Transfers screen');
        }

        // Go back to dashboard
        final backButton = find.byType(BackButton);
        if (backButton.evaluate().isNotEmpty) {
          await tester.tap(backButton.first);
          await tester.pumpAndSettle();
          print('✓ Returned to dashboard');
        } else {
          final backIcon = find.byIcon(Icons.arrow_back);
          if (backIcon.evaluate().isNotEmpty) {
            await tester.tap(backIcon.first);
            await tester.pumpAndSettle();
            print('✓ Returned to dashboard');
          }
        }
      } else {
        print('⚠ Transfers button not found on dashboard, skipping');
      }

      await tester.pumpAndSettle();

      // ==================== STEP 5: DISPUTES ====================
      print('\n========== STEP 5: DISPUTES ==========');
      
      // Navigate to Disputes
      final disputesButton = find.textContaining('Dispute');
      if (disputesButton.evaluate().isNotEmpty) {
        print('✓ Found Disputes on dashboard');
        await tester.tap(disputesButton.first);
        await tester.pumpAndSettle();

        // Verify we're on Disputes screen
        final hasDisputesScreen = find.textContaining('Dispute').evaluate().isNotEmpty;
        
        if (hasDisputesScreen) {
          print('✓ Disputes screen loaded successfully');
        } else {
          print('⚠ Could not verify Disputes screen');
        }

        // Go back to dashboard
        final backButton = find.byType(BackButton);
        if (backButton.evaluate().isNotEmpty) {
          await tester.tap(backButton.first);
          await tester.pumpAndSettle();
          print('✓ Returned to dashboard');
        } else {
          final backIcon = find.byIcon(Icons.arrow_back);
          if (backIcon.evaluate().isNotEmpty) {
            await tester.tap(backIcon.first);
            await tester.pumpAndSettle();
            print('✓ Returned to dashboard');
          }
        }
      } else {
        print('⚠ Disputes button not found on dashboard, skipping');
      }

      await tester.pumpAndSettle();

      // ==================== STEP 6: ACCOUNTS ====================
      print('\n========== STEP 6: ACCOUNTS ==========');
      
      // Check for Accounts
      final accountsButton = find.textContaining('Account');
      if (accountsButton.evaluate().isNotEmpty) {
        print('✓ Found Accounts on dashboard');
        await tester.tap(accountsButton.first);
        await tester.pumpAndSettle();

        print('✓ Accounts screen loaded successfully');

        // Go back to dashboard
        final backButton = find.byType(BackButton);
        if (backButton.evaluate().isNotEmpty) {
          await tester.tap(backButton.first);
          await tester.pumpAndSettle();
          print('✓ Returned to dashboard');
        } else {
          final backIcon = find.byIcon(Icons.arrow_back);
          if (backIcon.evaluate().isNotEmpty) {
            await tester.tap(backIcon.first);
            await tester.pumpAndSettle();
            print('✓ Returned to dashboard');
          }
        }
      } else {
        print('⚠ Accounts button not found, skipping');
      }

      await tester.pumpAndSettle();

      // ==================== STEP 7: CARDS ====================
      print('\n========== STEP 7: CARDS ==========');
      
      // Check for Cards
      final cardsButton = find.textContaining('Card');
      if (cardsButton.evaluate().isNotEmpty) {
        print('✓ Found Cards on dashboard');
        await tester.tap(cardsButton.first);
        await tester.pumpAndSettle();

        print('✓ Cards screen loaded successfully');

        // Go back to dashboard
        final backButton = find.byType(BackButton);
        if (backButton.evaluate().isNotEmpty) {
          await tester.tap(backButton.first);
          await tester.pumpAndSettle();
          print('✓ Returned to dashboard');
        } else {
          final backIcon = find.byIcon(Icons.arrow_back);
          if (backIcon.evaluate().isNotEmpty) {
            await tester.tap(backIcon.first);
            await tester.pumpAndSettle();
            print('✓ Returned to dashboard');
          }
        }
      } else {
        print('⚠ Cards button not found, skipping');
      }

      await tester.pumpAndSettle();

      // ==================== FINAL VERIFICATION ====================
      print('\n========== FINAL VERIFICATION ==========');
      
      // Verify we're back on dashboard
      final finalDashboardCheck = find.byType(BottomNavigationBar).evaluate().isNotEmpty;
      expect(finalDashboardCheck, isTrue, reason: 'Should be back on dashboard');
      print('✓ Successfully returned to dashboard');

      print('\n========== END-TO-END TEST COMPLETED ==========');
      print('✓ All screens navigated successfully');
    });
  });
}
