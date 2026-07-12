import 'package:flutter/material.dart';
import '../../models/education_loan_application.dart';
import '../../providers/education_loan_provider.dart';
import '../../widgets/error_snackbar.dart';
import 'package:provider/provider.dart';

class EducationLoanUpdateScreen extends StatefulWidget {
  final EducationLoanApplication application;
  const EducationLoanUpdateScreen({super.key, required this.application});

  @override
  State<EducationLoanUpdateScreen> createState() => _EducationLoanUpdateScreenState();
}

class _EducationLoanUpdateScreenState extends State<EducationLoanUpdateScreen> {
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
  final _institutionCountryController = TextEditingController();
  final _institutionStateController = TextEditingController();
  final _institutionCityController = TextEditingController();
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

  @override
  void initState() {
    super.initState();
    // Pre-populate with existing application data
    final app = widget.application;
    _studentIdController.text = app.studentId;
    _studentNameController.text = app.applicantName;
    _studentBVNController.text = app.studentBvn;
    _studentNINController.text = app.studentNin;
    _studentEmailController.text = app.studentEmail;
    _studentPhoneController.text = app.studentPhone;
    _dateOfBirth = app.dateOfBirth?.year != 1 ? app.dateOfBirth : null;
    _gender = app.gender.isNotEmpty ? app.gender : null;
    _stateOfOriginController.text = app.stateOfOrigin;
    _lgaController.text = app.lga;
    _loanType = app.loanType.isNotEmpty ? app.loanType : null;
    _institutionIdController.text = app.institution.id;
    _institutionNameController.text = app.institution.name;
    _institutionType = app.institution.type.isNotEmpty ? app.institution.type : null;
    _nucAccredited = app.institution.nucAccredited;
    _accreditationNumberController.text = app.institution.accreditationNumber;
    _institutionCountryController.text = app.institution.country;
    _institutionStateController.text = app.institution.state;
    _institutionCityController.text = app.institution.city;
    _institutionAddressController.text = app.institution.address;
    _institutionBankAccountController.text = app.institution.bankAccountNumber;
    _institutionBankNameController.text = app.institution.bankName;
    _institutionBankCodeController.text = app.institution.bankCode;
    _institutionContactPersonController.text = app.institution.contactPerson;
    _institutionContactEmailController.text = app.institution.contactEmail;
    _institutionContactPhoneController.text = app.institution.contactPhone;
    _programNameController.text = app.programName;
    _programDurationController.text = app.programDurationYears > 0 ? app.programDurationYears.toString() : '';
    _currentYearController.text = app.currentYear > 0 ? app.currentYear.toString() : '';
    _admissionNumberController.text = app.admissionNumber;
    _admissionLetterIdController.text = app.admissionLetterId;
    _expectedGraduation = app.expectedGraduation?.year != 1 ? app.expectedGraduation : null;
    _tuitionFeePerYearController.text = app.tuitionFeePerYear > 0 ? app.tuitionFeePerYear.toString() : '';
    _accommodationPerYearController.text = app.accommodationPerYear > 0 ? app.accommodationPerYear.toString() : '';
    _booksAndMaterialsController.text = app.booksAndMaterials > 0 ? app.booksAndMaterials.toString() : '';
    _livingExpensesController.text = app.livingExpenses > 0 ? app.livingExpenses.toString() : '';
    _requestedAmountController.text = app.amount > 0 ? app.amount.toString() : '';
    _repaymentType = app.repaymentType.isNotEmpty ? app.repaymentType : null;
    _moratoriumMonthsController.text = app.moratoriumMonths > 0 ? app.moratoriumMonths.toString() : '';
    _repaymentTenorMonthsController.text = app.repaymentTenorMonths > 0 ? app.repaymentTenorMonths.toString() : '';
  }

  @override
  void dispose() {
    _studentIdController.dispose();
    _studentNameController.dispose();
    _studentBVNController.dispose();
    _studentNINController.dispose();
    _studentEmailController.dispose();
    _studentPhoneController.dispose();
    _stateOfOriginController.dispose();
    _lgaController.dispose();
    _institutionIdController.dispose();
    _institutionNameController.dispose();
    _accreditationNumberController.dispose();
    _institutionCountryController.dispose();
    _institutionStateController.dispose();
    _institutionCityController.dispose();
    _institutionAddressController.dispose();
    _institutionBankAccountController.dispose();
    _institutionBankNameController.dispose();
    _institutionBankCodeController.dispose();
    _institutionContactPersonController.dispose();
    _institutionContactEmailController.dispose();
    _institutionContactPhoneController.dispose();
    _programNameController.dispose();
    _programDurationController.dispose();
    _currentYearController.dispose();
    _admissionNumberController.dispose();
    _admissionLetterIdController.dispose();
    _tuitionFeePerYearController.dispose();
    _accommodationPerYearController.dispose();
    _booksAndMaterialsController.dispose();
    _livingExpensesController.dispose();
    _requestedAmountController.dispose();
    _moratoriumMonthsController.dispose();
    _repaymentTenorMonthsController.dispose();
    super.dispose();
  }

  Future<void> _update() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; });
    final provider = Provider.of<EducationLoanProvider>(context, listen: false);
    final result = await provider.updateApplication(
      widget.application.id,
      {
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
          'country': _institutionCountryController.text,
          'state': _institutionStateController.text,
          'city': _institutionCityController.text,
          'address': _institutionAddressController.text,
          'bank_account_number': _institutionBankAccountController.text,
          'bank_name': _institutionBankNameController.text,
          'bank_code': _institutionBankCodeController.text,
          'contact_person': _institutionContactPersonController.text,
          'contact_email': _institutionContactEmailController.text,
          'contact_phone': _institutionContactPhoneController.text,
          'verification_status': widget.application.institution.verificationStatus,
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
      },
    );
    setState(() { _loading = false; });
    
    if (!mounted) return;
    
    if (result['success'] == true) {
      ErrorSnackbar.showSuccess(context, 'Application updated successfully');
      Navigator.pop(context, true);
    } else {
      if (result['error'] != null) {
        ErrorSnackbar.showError(
          context,
          result['error'],
          showErrorCode: true,
        );
      } else {
        ErrorSnackbar.show(context, result['message'] ?? 'Failed to update application.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Update Application'),
        elevation: 0,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Theme.of(context).colorScheme.primary.withOpacity(0.05),
                Theme.of(context).colorScheme.primary.withOpacity(0.02),
              ],
            ),
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 8),
                Text(
                  'Student Information',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _studentIdController,
                  decoration: const InputDecoration(
                    labelText: 'Student ID',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _studentNameController,
                  decoration: const InputDecoration(
                    labelText: 'Student Name',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v == null || v.isEmpty ? 'Enter Student Name' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _studentBVNController,
                  decoration: const InputDecoration(
                    labelText: 'Student BVN (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _studentNINController,
                  decoration: const InputDecoration(
                    labelText: 'Student NIN (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _studentEmailController,
                  decoration: const InputDecoration(
                    labelText: 'Student Email',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) => v == null || v.isEmpty ? 'Enter Student Email' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _studentPhoneController,
                  decoration: const InputDecoration(
                    labelText: 'Student Phone',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.phone,
                  validator: (v) => v == null || v.isEmpty ? 'Enter Student Phone' : null,
                ),
                const SizedBox(height: 24),
                Text(
                  'Loan Details',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: _loanType,
                  decoration: const InputDecoration(
                    labelText: 'Loan Type',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'school', child: Text('School')),
                    DropdownMenuItem(value: 'personal', child: Text('Personal')),
                  ],
                  onChanged: (val) => setState(() => _loanType = val),
                  validator: (v) => v == null || v.isEmpty ? 'Select Loan Type' : null,
                ),
                const SizedBox(height: 12),
                Text(
                  'Institution Information',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _institutionIdController,
                  decoration: const InputDecoration(
                    labelText: 'Institution ID',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v == null || v.isEmpty ? 'Enter Institution ID' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionNameController,
                  decoration: const InputDecoration(
                    labelText: 'Institution Name',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v == null || v.isEmpty ? 'Enter Institution Name' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _institutionType,
                  decoration: const InputDecoration(
                    labelText: 'Institution Type',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'university', child: Text('University')),
                    DropdownMenuItem(value: 'polytechnic', child: Text('Polytechnic')),
                    DropdownMenuItem(value: 'college', child: Text('College')),
                    DropdownMenuItem(value: 'other', child: Text('Other')),
                  ],
                  onChanged: (val) => setState(() => _institutionType = val),
                  validator: (v) => v == null || v.isEmpty ? 'Select Institution Type' : null,
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  title: const Text('NUC Accredited'),
                  value: _nucAccredited,
                  onChanged: (val) => setState(() => _nucAccredited = val),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _accreditationNumberController,
                  decoration: const InputDecoration(
                    labelText: 'Accreditation Number',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionCountryController,
                  decoration: const InputDecoration(
                    labelText: 'Country',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v == null || v.isEmpty ? 'Enter Country' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionStateController,
                  decoration: const InputDecoration(
                    labelText: 'State',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v == null || v.isEmpty ? 'Enter State' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionCityController,
                  decoration: const InputDecoration(
                    labelText: 'City',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v == null || v.isEmpty ? 'Enter City' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionAddressController,
                  decoration: const InputDecoration(
                    labelText: 'Address',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v == null || v.isEmpty ? 'Enter Address' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionBankAccountController,
                  decoration: const InputDecoration(
                    labelText: 'Bank Account Number',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionBankNameController,
                  decoration: const InputDecoration(
                    labelText: 'Bank Name',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionBankCodeController,
                  decoration: const InputDecoration(
                    labelText: 'Bank Code',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionContactPersonController,
                  decoration: const InputDecoration(
                    labelText: 'Contact Person',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionContactEmailController,
                  decoration: const InputDecoration(
                    labelText: 'Contact Email',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _institutionContactPhoneController,
                  decoration: const InputDecoration(
                    labelText: 'Contact Phone',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 24),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _programNameController,
                  decoration: const InputDecoration(
                    labelText: 'Program Name',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v == null || v.isEmpty ? 'Enter Program Name' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _programDurationController,
                  decoration: const InputDecoration(
                    labelText: 'Program Duration (years)',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                  validator: (v) => v == null || v.isEmpty ? 'Enter Program Duration' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _currentYearController,
                  decoration: const InputDecoration(
                    labelText: 'Current Year (optional)',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _tuitionFeePerYearController,
                  decoration: const InputDecoration(
                    labelText: 'Tuition Fee Per Year',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                  validator: (v) => v == null || v.isEmpty ? 'Enter Tuition Fee Per Year' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _accommodationPerYearController,
                  decoration: const InputDecoration(
                    labelText: 'Accommodation Per Year (optional)',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _requestedAmountController,
                  decoration: const InputDecoration(
                    labelText: 'Requested Amount',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                  validator: (v) => v == null || v.isEmpty ? 'Enter Requested Amount' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _repaymentType,
                  decoration: const InputDecoration(
                    labelText: 'Repayment Type (optional)',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'monthly', child: Text('Monthly')),
                    DropdownMenuItem(value: 'quarterly', child: Text('Quarterly')),
                    DropdownMenuItem(value: 'yearly', child: Text('Yearly')),
                  ],
                  onChanged: (val) => setState(() => _repaymentType = val),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _update,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _loading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text(
                            'Update Application',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
