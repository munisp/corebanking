import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/widgets/csc_picker.dart';
import 'package:mobile_app/utils/csc_data.dart';

void main() {
  group('CSC Picker Tests', () {
    testWidgets('CSC Picker renders all three dropdowns', (WidgetTester tester) async {
      String? selectedCountry;
      String? selectedState;
      String? selectedCity;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CSCPicker(
              onCountryChanged: (value) => selectedCountry = value,
              onStateChanged: (value) => selectedState = value,
              onCityChanged: (value) => selectedCity = value,
            ),
          ),
        ),
      );

      // Should have three dropdown buttons
      expect(find.byType(DropdownButtonFormField<String>), findsNWidgets(3));
    });

    testWidgets('Selecting country enables state dropdown', (WidgetTester tester) async {
      String? selectedCountry;
      String? selectedState;
      String? selectedCity;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CSCPicker(
              onCountryChanged: (value) => selectedCountry = value,
              onStateChanged: (value) => selectedState = value,
              onCityChanged: (value) => selectedCity = value,
            ),
          ),
        ),
      );

      // Find and tap the country dropdown
      await tester.tap(find.byType(DropdownButtonFormField<String>).first);
      await tester.pumpAndSettle();

      // Select Nigeria
      await tester.tap(find.text('Nigeria').last);
      await tester.pumpAndSettle();

      expect(selectedCountry, 'Nigeria');
    });

    test('CSCData returns correct countries', () {
      final countries = CSCData.getCountries();
      
      expect(countries, isNotEmpty);
      expect(countries, contains('Nigeria'));
      expect(countries, contains('United States'));
      expect(countries, contains('United Kingdom'));
      expect(countries, contains('Ghana'));
    });

    test('CSCData returns states for Nigeria', () {
      final states = CSCData.getStates('Nigeria');
      
      expect(states, isNotEmpty);
      expect(states, contains('Lagos'));
      expect(states, contains('FCT'));
      expect(states, contains('Kano'));
    });

    test('CSCData returns cities for Lagos state in Nigeria', () {
      final cities = CSCData.getCities('Nigeria', 'Lagos');
      
      expect(cities, isNotEmpty);
      expect(cities, contains('Ikeja'));
      expect(cities, contains('Lagos Island'));
      expect(cities, contains('Lekki'));
    });

    test('CSCData validation methods work correctly', () {
      expect(CSCData.hasCountry('Nigeria'), true);
      expect(CSCData.hasCountry('Invalid Country'), false);
      
      expect(CSCData.hasState('Nigeria', 'Lagos'), true);
      expect(CSCData.hasState('Nigeria', 'Invalid State'), false);
      
      expect(CSCData.hasCity('Nigeria', 'Lagos', 'Ikeja'), true);
      expect(CSCData.hasCity('Nigeria', 'Lagos', 'Invalid City'), false);
    });

    test('Hierarchical data structure works for multiple countries', () {
      // Test US
      final usStates = CSCData.getStates('United States');
      expect(usStates, contains('California'));
      
      final caCities = CSCData.getCities('United States', 'California');
      expect(caCities, contains('Los Angeles'));
      expect(caCities, contains('San Francisco'));
      
      // Test UK
      final ukStates = CSCData.getStates('United Kingdom');
      expect(ukStates, contains('England'));
      
      final englandCities = CSCData.getCities('United Kingdom', 'England');
      expect(englandCities, contains('London'));
      expect(englandCities, contains('Manchester'));
    });
  });
}
