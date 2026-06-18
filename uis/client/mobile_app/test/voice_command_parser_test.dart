import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/services/voice_command_parser.dart';

void main() {
  group('VoiceCommandParser', () {
    group('Balance Commands', () {
      test('should recognize "check my balance"', () {
        final command = VoiceCommandParser.parseCommand('check my balance');
        expect(command.type, equals(VoiceCommandType.checkBalance));
      });

      test('should recognize "what is my balance"', () {
        final command = VoiceCommandParser.parseCommand('what is my balance');
        expect(command.type, equals(VoiceCommandType.checkBalance));
      });

      test('should recognize "show balance"', () {
        final command = VoiceCommandParser.parseCommand('show balance');
        expect(command.type, equals(VoiceCommandType.checkBalance));
      });
    });

    group('Transfer Commands', () {
      test('should recognize basic transfer command', () {
        final command = VoiceCommandParser.parseCommand('transfer money');
        expect(command.type, equals(VoiceCommandType.transfer));
      });

      test('should extract amount from transfer command', () {
        final command = VoiceCommandParser.parseCommand('transfer 1000');
        expect(command.type, equals(VoiceCommandType.transfer));
        expect(command.parameters['amount'], equals(1000.0));
      });

      test('should extract amount and account from transfer command', () {
        final command = VoiceCommandParser.parseCommand(
          'transfer 500 to account 1234567890',
        );
        expect(command.type, equals(VoiceCommandType.transfer));
        expect(command.parameters['amount'], equals(500.0));
        expect(command.parameters['accountNumber'], equals('1234567890'));
      });
    });

    group('Bill Payment Commands', () {
      test('should recognize electricity bill payment', () {
        final command = VoiceCommandParser.parseCommand('pay electricity bill');
        expect(command.type, equals(VoiceCommandType.payBill));
        expect(command.parameters['billType'], equals('electricity'));
      });

      test('should recognize water bill payment', () {
        final command = VoiceCommandParser.parseCommand('pay water bill');
        expect(command.type, equals(VoiceCommandType.payBill));
        expect(command.parameters['billType'], equals('water'));
      });

      test('should extract amount from bill payment', () {
        final command = VoiceCommandParser.parseCommand('pay 2000 for electricity bill');
        expect(command.type, equals(VoiceCommandType.payBill));
        expect(command.parameters['amount'], equals(2000.0));
        expect(command.parameters['billType'], equals('electricity'));
      });
    });

    group('Transaction Commands', () {
      test('should recognize transaction history command', () {
        final command = VoiceCommandParser.parseCommand('show my transactions');
        expect(command.type, equals(VoiceCommandType.viewTransactions));
      });

      test('should recognize recent transactions', () {
        final command = VoiceCommandParser.parseCommand('view recent transactions');
        expect(command.type, equals(VoiceCommandType.viewTransactions));
      });
    });

    group('Loan Commands', () {
      test('should recognize loan application', () {
        final command = VoiceCommandParser.parseCommand('apply for a loan');
        expect(command.type, equals(VoiceCommandType.applyLoan));
      });

      test('should extract loan amount', () {
        final command = VoiceCommandParser.parseCommand('I need a loan of 50000');
        expect(command.type, equals(VoiceCommandType.applyLoan));
        expect(command.parameters['amount'], equals(50000.0));
      });
    });

    group('Savings Commands', () {
      test('should recognize savings account creation', () {
        final command = VoiceCommandParser.parseCommand('open a savings account');
        expect(command.type, equals(VoiceCommandType.openSavings));
      });

      test('should extract savings amount', () {
        final command = VoiceCommandParser.parseCommand('create savings with 10000');
        expect(command.type, equals(VoiceCommandType.openSavings));
        expect(command.parameters['amount'], equals(10000.0));
      });
    });

    group('Help Commands', () {
      test('should recognize help command', () {
        final command = VoiceCommandParser.parseCommand('help');
        expect(command.type, equals(VoiceCommandType.help));
      });

      test('should recognize "what can you do"', () {
        final command = VoiceCommandParser.parseCommand('what can you do');
        expect(command.type, equals(VoiceCommandType.help));
      });
    });

    group('Unknown Commands', () {
      test('should return unknown for unrecognized command', () {
        final command = VoiceCommandParser.parseCommand('make me coffee');
        expect(command.type, equals(VoiceCommandType.unknown));
      });

      test('should preserve original text', () {
        final command = VoiceCommandParser.parseCommand('random text here');
        expect(command.originalText, equals('random text here'));
      });
    });

    group('Case Insensitivity', () {
      test('should handle uppercase commands', () {
        final command = VoiceCommandParser.parseCommand('CHECK MY BALANCE');
        expect(command.type, equals(VoiceCommandType.checkBalance));
      });

      test('should handle mixed case commands', () {
        final command = VoiceCommandParser.parseCommand('TrAnSfEr MoNeY');
        expect(command.type, equals(VoiceCommandType.transfer));
      });
    });

    group('Decimal Amounts', () {
      test('should parse decimal amounts', () {
        final command = VoiceCommandParser.parseCommand('transfer 1500.50');
        expect(command.parameters['amount'], equals(1500.50));
      });

      test('should handle amounts with two decimal places', () {
        final command = VoiceCommandParser.parseCommand('pay 299.99 for phone bill');
        expect(command.parameters['amount'], equals(299.99));
      });
    });

    group('Help Text', () {
      test('should return help text', () {
        final helpText = VoiceCommandParser.getHelpText();
        expect(helpText, isNotEmpty);
        expect(helpText, contains('Balance'));
        expect(helpText, contains('Transfers'));
        expect(helpText, contains('Bill Payments'));
      });
    });
  });
}
