import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../../services/education_loan_service.dart';
import '../../models/error_response.dart';
import '../../widgets/error_snackbar.dart';
import '../../widgets/csc_picker.dart';

class EducationLoanApplyScreen extends StatefulWidget {
  const EducationLoanApplyScreen({super.key});

  @override
  State<EducationLoanApplyScreen> createState() => _EducationLoanApplyScreenState();
}

class _EducationLoanApplyScreenState extends State<EducationLoanApplyScreen> {
  final _formKey = GlobalKey<FormState>();
  final _studentIdController = TextEditingController();
  final _studentNameController = TextEditingController();
  final _studentBVNController = TextEditingController();
  final _studentNINController = TextEditingController();
  final _studentEmailController = TextEditingController();
  final _studentPhoneController = TextEditingController();
  DateTime? _dateOfBirth;
  String? _gender;
  final _stateOfOriginController = TextEditingController();
  final _lgaController = TextEditingController();
  String? _loanType;
  final _institutionIdController = TextEditingController();
  final _institutionNameController = TextEditingController();
  String? _institutionType;
  bool _nucAccredited = false;
  final _accreditationNumberController = TextEditingController();
  String? _institutionCountry;
  String? _institutionState;
  String? _institutionCity;
  final _institutionAddressController = TextEditingController();
  final _institutionBankAccountController = TextEditingController();
  final _institutionBankNameController = TextEditingController();
  final _institutionBankCodeController = TextEditingController();
  final _institutionContactPersonController = TextEditingController();
  final _institutionContactEmailController = TextEditingController();
  final _institutionContactPhoneController = TextEditingController();
  final _programNameController = TextEditingController();
  final _programDurationController = TextEditingController();
  final _currentYearController = TextEditingController();
  final _admissionNumberController = TextEditingController();
  final _admissionLetterIdController = TextEditingController();
  DateTime? _expectedGraduation;
  final _tuitionFeePerYearController = TextEditingController();
  final _accommodationPerYearController = TextEditingController();
  final _booksAndMaterialsController = TextEditingController();
  final _livingExpensesController = TextEditingController();
  final _requestedAmountController = TextEditingController();
  String? _repaymentType;
  final _moratoriumMonthsController = TextEditingController();
  final _repaymentTenorMonthsController = TextEditingController();
  bool _loading = false;

  Future<void> _apply() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; });
    final service = EducationLoanService();
    try {
      final response = await service.applyForLoan({
        'student_id': _studentIdController.text,
        'student_name': _studentNameController.text,
        'student_bvn': _studentBVNController.text,
        'student_nin': _studentNINController.text,
        'student_email': _studentEmailController.text,
        'student_phone': _studentPhoneController.text,
        'date_of_birth': _dateOfBirth?.toIso8601String() ?? '',
        'gender': _gender ?? '',
        'state_of_origin': _stateOfOriginController.text,
        'lga': _lgaController.text,
        'loan_type': _loanType,
        'institution': {
          'id': _institutionIdController.text,
          'name': _institutionNameController.text,
          'type': _institutionType ?? '',
          'nuc_accredited': _nucAccredited,
          'accreditation_number': _accreditationNumberController.text,
          'country': _institutionCountry ?? '',
          'state': _institutionState ?? '',
          'city': _institutionCity ?? '',
          'address': _institutionAddressController.text,
          'bank_account_number': _institutionBankAccountController.text,
          'bank_name': _institutionBankNameController.text,
          'bank_code': _institutionBankCodeController.text,
          'contact_person': _institutionContactPersonController.text,
          'contact_email': _institutionContactEmailController.text,
          'contact_phone': _institutionContactPhoneController.text,
          'verification_status': '',
        },
        'program_name': _programNameController.text,
        'program_duration_years': int.tryParse(_programDurationController.text) ?? 0,
        'current_year': int.tryParse(_currentYearController.text) ?? 0,
        'admission_number': _admissionNumberController.text,
        'admission_letter_id': _admissionLetterIdController.text,
        'expected_graduation': _expectedGraduation?.toIso8601String() ?? '',
        'tuition_fee_per_year': double.tryParse(_tuitionFeePerYearController.text) ?? 0,
        'accommodation_per_year': double.tryParse(_accommodationPerYearController.text) ?? 0,
        'books_and_materials': double.tryParse(_booksAndMaterialsController.text) ?? 0,
        'living_expenses': double.tryParse(_livingExpensesController.text) ?? 0,
        'requested_amount': double.tryParse(_requestedAmountController.text) ?? 0,
        'repayment_type': _repaymentType,
        'moratorium_months': int.tryParse(_moratoriumMonthsController.text) ?? 0,
        'repayment_tenor_months': int.tryParse(_repaymentTenorMonthsController.text) ?? 0,
      });
      if (response.statusCode == 200 || response.statusCode == 201) {
        if (mounted) {
          ErrorSnackbar.showSuccess(context, 'Education loan application submitted successfully!');
          Navigator.pop(context, true);
        }
      } else {
        if (mounted) {
          ErrorSnackbar.show(context, 'Failed to apply for loan.');
        }
      }
    } on DioException catch (e) {
      if (mounted) {
        // Parse error response with detail structure
        if (e.response?.data != null) {
          try {
            final errorResponse = ErrorResponse.fromJson(e.response!.data);
            ErrorSnackbar.showError(
              context,
              errorResponse,
              showErrorCode: true,
            );
          } catch (_) {
            // Fallback if parsing fails
            ErrorSnackbar.show(context, e.message ?? 'Failed to apply for loan.');
          }
        } else {
          ErrorSnackbar.show(context, e.message ?? 'Network error. Please try again.');
        }
      }
    } catch (e) {
      if (mounted) {
        ErrorSnackbar.show(context, e.toString());
      }
    } finally {
      if (mounted) {
        setState(() { _loading = false; });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Apply for Education Loan')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 8),
                Text('Student Information', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                  TextFormField(
                    controller: _studentIdController,
                    decoration: const InputDecoration(labelText: 'Student ID '),
                  ),
                  TextFormField(
                    controller: _studentNameController,
                    decoration: const InputDecoration(labelText: 'Student Name'),
                  ),
                TextFormField(
                  controller: _studentBVNController,
                  decoration: const InputDecoration(labelText: 'Student BVN (optional)'),
                ),
                TextFormField(
                  controller: _studentNINController,
                  decoration: const InputDecoration(labelText: 'Student NIN (optional)'),
                ),
                TextFormField(
                  controller: _studentEmailController,
                  decoration: const InputDecoration(labelText: 'Student Email'),
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) => v == null || v.isEmpty ? 'Enter Student Email' : null,
                ),
                TextFormField(
                  controller: _studentPhoneController,
                  decoration: const InputDecoration(labelText: 'Student Phone'),
                  keyboardType: TextInputType.phone,
                  validator: (v) => v == null || v.isEmpty ? 'Enter Student Phone' : null,
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: _dateOfBirth ?? DateTime.now().subtract(const Duration(days: 6570)),
                      firstDate: DateTime(1950),
                      lastDate: DateTime.now(),
                    );
                    if (date != null) setState(() => _dateOfBirth = date);
                  },
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Date of Birth (optional)'),
                    child: Text(_dateOfBirth != null ? '${_dateOfBirth!.day}/${_dateOfBirth!.month}/${_dateOfBirth!.year}' : 'Tap to select'),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _gender,
                  decoration: const InputDecoration(labelText: 'Gender (optional)'),
                  items: const [
                    DropdownMenuItem(value: 'male', child: Text('Male')),
                    DropdownMenuItem(value: 'female', child: Text('Female')),
                    DropdownMenuItem(value: 'other', child: Text('Other')),
                  ],
                  onChanged: (val) => setState(() => _gender = val),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _stateOfOriginController,
                  decoration: const InputDecoration(labelText: 'State of Origin (optional)'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _lgaController,
                  decoration: const InputDecoration(labelText: 'LGA (optional)'),
                ),
                const SizedBox(height: 16),
                Text('Loan Details', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: _loanType,
                  decoration: const InputDecoration(labelText: 'Loan Type'),
                  items: const [
                    DropdownMenuItem(value: 'school', child: Text('School')),
                    DropdownMenuItem(value: 'personal', child: Text('Personal')),
                  ],
                  onChanged: (val) => setState(() => _loanType = val),
                  validator: (v) => v == null || v.isEmpty ? 'Select Loan Type' : null,
                ),
                const SizedBox(height: 16),
                Text('Institution Details', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _institutionIdController,
                  decoration: const InputDecoration(labelText: 'Institution ID (optional)'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionNameController,
                  decoration: const InputDecoration(labelText: 'Institution Name'),
                  validator: (v) => v == null || v.isEmpty ? 'Enter Institution Name' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _institutionType,
                  decoration: const InputDecoration(labelText: 'Institution Type'),
                  items: const [
                    DropdownMenuItem(value: 'university', child: Text('University')),
                    DropdownMenuItem(value: 'polytechnic', child: Text('Polytechnic')),
                    DropdownMenuItem(value: 'college', child: Text('College')),
                    DropdownMenuItem(value: 'vocational', child: Text('Vocational School')),
                    DropdownMenuItem(value: 'other', child: Text('Other')),
                  ],
                  onChanged: (val) => setState(() => _institutionType = val),
                  validator: (v) => v == null || v.isEmpty ? 'Select Institution Type' : null,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Checkbox(
                      value: _nucAccredited,
                      onChanged: (val) => setState(() => _nucAccredited = val ?? false),
                    ),
                    const Text('NUC Accredited'),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _accreditationNumberController,
                  decoration: const InputDecoration(labelText: 'Accreditation Number (optional)'),
                ),
                const SizedBox(height: 12),
                Text('Institution Location', style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500)),
                const SizedBox(height: 8),
                CSCPicker(
                  onCountryChanged: (country) => setState(() => _institutionCountry = country),
                  onStateChanged: (state) => setState(() => _institutionState = state),
                  onCityChanged: (city) => setState(() => _institutionCity = city),
                  defaultCountry: _institutionCountry,
                  defaultState: _institutionState,
                  defaultCity: _institutionCity,
                  countryLabel: 'Institution Country',
                  stateLabel: 'Institution State',
                  cityLabel: 'Institution City',
                  countryRequired: true,
                  stateRequired: true,
                  cityRequired: true,
                  spacing: 12,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionAddressController,
                  decoration: const InputDecoration(labelText: 'Institution Address'),
                  maxLines: 2,
                  validator: (v) => v == null || v.isEmpty ? 'Enter Address' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionBankAccountController,
                  decoration: const InputDecoration(labelText: 'Institution Bank Account (optional)'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionBankNameController,
                  decoration: const InputDecoration(labelText: 'Institution Bank Name (optional)'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionBankCodeController,
                  decoration: const InputDecoration(labelText: 'Institution Bank Code (optional)'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionContactPersonController,
                  decoration: const InputDecoration(labelText: 'Contact Person (optional)'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionContactEmailController,
                  decoration: const InputDecoration(labelText: 'Contact Email (optional)'),
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionContactPhoneController,
                  decoration: const InputDecoration(labelText: 'Contact Phone (optional)'),
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 16),
                Text('Program Details', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _programNameController,
                  decoration: const InputDecoration(labelText: 'Program Name'),
                  validator: (v) => v == null || v.isEmpty ? 'Enter Program Name' : null,
                ),
                TextFormField(
                  controller: _programDurationController,
                  decoration: const InputDecoration(labelText: 'Program Duration (years)'),
                  keyboardType: TextInputType.number,
                  validator: (v) => v == null || v.isEmpty ? 'Enter Program Duration' : null,
                ),
                TextFormField(
                  controller: _currentYearController,
                  decoration: const InputDecoration(labelText: 'Current Year (optional)'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _admissionNumberController,
                  decoration: const InputDecoration(labelText: 'Admission Number (optional)'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _admissionLetterIdController,
                  decoration: const InputDecoration(labelText: 'Admission Letter ID (optional)'),
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: _expectedGraduation ?? DateTime.now().add(const Duration(days: 1095)),
                      firstDate: DateTime.now(),
                      lastDate: DateTime(2050),
                    );
                    if (date != null) setState(() => _expectedGraduation = date);
                  },
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Expected Graduation (optional)'),
                    child: Text(_expectedGraduation != null ? '${_expectedGraduation!.day}/${_expectedGraduation!.month}/${_expectedGraduation!.year}' : 'Tap to select'),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _tuitionFeePerYearController,
                  decoration: const InputDecoration(labelText: 'Tuition Fee Per Year'),
                  keyboardType: TextInputType.number,
                  validator: (v) => v == null || v.isEmpty ? 'Enter Tuition Fee Per Year' : null,
                ),
                  TextFormField(
                    controller: _accommodationPerYearController,
                    decoration: const InputDecoration(labelText: 'Accommodation Per Year (optional)'),
                    keyboardType: TextInputType.number,
                  ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _booksAndMaterialsController,
                  decoration: const InputDecoration(labelText: 'Books and Materials (optional)'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _livingExpensesController,
                  decoration: const InputDecoration(labelText: 'Living Expenses (optional)'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _requestedAmountController,
                  decoration: const InputDecoration(labelText: 'Requested Amount'),
                  keyboardType: TextInputType.number,
                  validator: (v) => v == null || v.isEmpty ? 'Enter Requested Amount' : null,
                ),
                DropdownButtonFormField<String>(
                  initialValue: _repaymentType,
                  decoration: const InputDecoration(labelText: 'Repayment Type (optional)'),
                  items: const [
                    DropdownMenuItem(value: 'monthly', child: Text('Monthly')),
                    DropdownMenuItem(value: 'quarterly', child: Text('Quarterly')),
                    DropdownMenuItem(value: 'yearly', child: Text('Yearly')),
                  ],
                  onChanged: (val) => setState(() => _repaymentType = val),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _moratoriumMonthsController,
                  decoration: const InputDecoration(labelText: 'Moratorium Months (optional)'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _repaymentTenorMonthsController,
                  decoration: const InputDecoration(labelText: 'Repayment Tenor Months (optional)'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _apply,
                    child: _loading ? const CircularProgressIndicator() : const Text('Apply'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
