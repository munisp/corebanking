import 'package:flutter/material.dart';
import '../utils/csc_data.dart';

/// A reusable widget for Country-State-City selection with hierarchical dropdowns
/// 
/// This widget provides three cascading dropdowns:
/// 1. Country selection
/// 2. State selection (filtered by selected country)
/// 3. City selection (filtered by selected state)
/// 
/// Example usage:
/// ```dart
/// CSCPicker(
///   onCountryChanged: (country) => setState(() => _country = country),
///   onStateChanged: (state) => setState(() => _state = state),
///   onCityChanged: (city) => setState(() => _city = city),
///   defaultCountry: 'Nigeria',
/// )
/// ```
class CSCPicker extends StatefulWidget {
  /// Callback when country is selected
  final void Function(String?) onCountryChanged;
  
  /// Callback when state is selected
  final void Function(String?) onStateChanged;
  
  /// Callback when city is selected
  final void Function(String?) onCityChanged;
  
  /// Default country value
  final String? defaultCountry;
  
  /// Default state value
  final String? defaultState;
  
  /// Default city value
  final String? defaultCity;
  
  /// Whether country field is required
  final bool countryRequired;
  
  /// Whether state field is required
  final bool stateRequired;
  
  /// Whether city field is required
  final bool cityRequired;
  
  /// Custom decoration for dropdowns
  final InputDecoration? countryDecoration;
  final InputDecoration? stateDecoration;
  final InputDecoration? cityDecoration;
  
  /// Whether to show labels
  final bool showLabels;
  
  /// Custom label texts
  final String countryLabel;
  final String stateLabel;
  final String cityLabel;
  
  /// Spacing between dropdowns
  final double spacing;

  const CSCPicker({
    super.key,
    required this.onCountryChanged,
    required this.onStateChanged,
    required this.onCityChanged,
    this.defaultCountry,
    this.defaultState,
    this.defaultCity,
    this.countryRequired = true,
    this.stateRequired = true,
    this.cityRequired = true,
    this.countryDecoration,
    this.stateDecoration,
    this.cityDecoration,
    this.showLabels = true,
    this.countryLabel = 'Country',
    this.stateLabel = 'State',
    this.cityLabel = 'City',
    this.spacing = 16.0,
  });

  @override
  State<CSCPicker> createState() => _CSCPickerState();
}

class _CSCPickerState extends State<CSCPicker> {
  String? _selectedCountry;
  String? _selectedState;
  String? _selectedCity;
  
  List<String> _availableStates = [];
  List<String> _availableCities = [];

  @override
  void initState() {
    super.initState();
    _selectedCountry = widget.defaultCountry;
    _selectedState = widget.defaultState;
    _selectedCity = widget.defaultCity;
    
    if (_selectedCountry != null) {
      _availableStates = CSCData.getStates(_selectedCountry!);
      if (_selectedState != null) {
        _availableCities = CSCData.getCities(_selectedCountry!, _selectedState!);
      }
    }
  }

  void _onCountryChanged(String? country) {
    setState(() {
      _selectedCountry = country;
      _selectedState = null;
      _selectedCity = null;
      _availableStates = country != null ? CSCData.getStates(country) : [];
      _availableCities = [];
    });
    widget.onCountryChanged(country);
    widget.onStateChanged(null);
    widget.onCityChanged(null);
  }

  void _onStateChanged(String? state) {
    setState(() {
      _selectedState = state;
      _selectedCity = null;
      _availableCities = (_selectedCountry != null && state != null)
          ? CSCData.getCities(_selectedCountry!, state)
          : [];
    });
    widget.onStateChanged(state);
    widget.onCityChanged(null);
  }

  void _onCityChanged(String? city) {
    setState(() {
      _selectedCity = city;
    });
    widget.onCityChanged(city);
  }

  InputDecoration _getDecoration({
    required String label,
    required IconData icon,
    String? hint,
    InputDecoration? customDecoration,
  }) {
    if (customDecoration != null) return customDecoration;
    
    return InputDecoration(
      labelText: widget.showLabels ? label : null,
      hintText: hint ?? 'Select $label',
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(
          color: Theme.of(context).colorScheme.outline.withOpacity(0.5),
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(
          color: Theme.of(context).colorScheme.primary,
          width: 2,
        ),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(
          color: Theme.of(context).colorScheme.error,
        ),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(
          color: Theme.of(context).colorScheme.error,
          width: 2,
        ),
      ),
      filled: true,
      fillColor: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.3),
      prefixIcon: Icon(
        icon,
        color: Theme.of(context).colorScheme.primary,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final countries = CSCData.getCountries();
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Country Dropdown
        DropdownButtonFormField<String>(
          initialValue: _selectedCountry,
          decoration: _getDecoration(
            label: widget.countryLabel,
            icon: Icons.public,
            customDecoration: widget.countryDecoration,
          ),
          items: countries.map((country) {
            return DropdownMenuItem(
              value: country,
              child: Text(country),
            );
          }).toList(),
          onChanged: _onCountryChanged,
          validator: widget.countryRequired
              ? (value) => value == null || value.isEmpty ? 'Please select a country' : null
              : null,
        ),
        SizedBox(height: widget.spacing),
        
        // State Dropdown
        DropdownButtonFormField<String>(
          initialValue: _selectedState,
          decoration: _getDecoration(
            label: widget.stateLabel,
            icon: Icons.location_city,
            customDecoration: widget.stateDecoration,
          ),
          items: _availableStates.map((state) {
            return DropdownMenuItem(
              value: state,
              child: Text(state),
            );
          }).toList(),
          onChanged: _selectedCountry != null ? _onStateChanged : null,
          validator: widget.stateRequired
              ? (value) => value == null || value.isEmpty ? 'Please select a state' : null
              : null,
        ),
        SizedBox(height: widget.spacing),
        
        // City Dropdown
        DropdownButtonFormField<String>(
          initialValue: _selectedCity,
          decoration: _getDecoration(
            label: widget.cityLabel,
            icon: Icons.location_on,
            customDecoration: widget.cityDecoration,
          ),
          items: _availableCities.map((city) {
            return DropdownMenuItem(
              value: city,
              child: Text(city),
            );
          }).toList(),
          onChanged: _selectedState != null ? _onCityChanged : null,
          validator: widget.cityRequired
              ? (value) => value == null || value.isEmpty ? 'Please select a city' : null
              : null,
        ),
      ],
    );
  }
}
