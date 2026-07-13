import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ha.dart';
import 'app_localizations_ig.dart';
import 'app_localizations_yo.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('ha'),
    Locale('ig'),
    Locale('yo')
  ];

  /// The name of the application
  ///
  /// In en, this message translates to:
  /// **'FiveFour Bank'**
  String get appName;

  /// Welcome message
  ///
  /// In en, this message translates to:
  /// **'Welcome'**
  String get welcome;

  /// No description provided for @login.
  ///
  /// In en, this message translates to:
  /// **'Login'**
  String get login;

  /// No description provided for @loginToYourAccount.
  ///
  /// In en, this message translates to:
  /// **'Login to your account'**
  String get loginToYourAccount;

  /// No description provided for @dontHaveAccountSignUp.
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account? '**
  String get dontHaveAccountSignUp;

  /// No description provided for @register.
  ///
  /// In en, this message translates to:
  /// **'Register'**
  String get register;

  /// No description provided for @email.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @confirmPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm Password'**
  String get confirmPassword;

  /// No description provided for @forgotPassword.
  ///
  /// In en, this message translates to:
  /// **'Forgot Password?'**
  String get forgotPassword;

  /// No description provided for @dontHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account?'**
  String get dontHaveAccount;

  /// No description provided for @alreadyHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'Already have an account?'**
  String get alreadyHaveAccount;

  /// No description provided for @signUp.
  ///
  /// In en, this message translates to:
  /// **'Sign Up'**
  String get signUp;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get signIn;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logout;

  /// No description provided for @dashboard.
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get dashboard;

  /// No description provided for @home.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get home;

  /// No description provided for @accounts.
  ///
  /// In en, this message translates to:
  /// **'Accounts'**
  String get accounts;

  /// No description provided for @cards.
  ///
  /// In en, this message translates to:
  /// **'Cards'**
  String get cards;

  /// No description provided for @transactions.
  ///
  /// In en, this message translates to:
  /// **'Transactions'**
  String get transactions;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @notifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notifications;

  /// No description provided for @profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// No description provided for @balance.
  ///
  /// In en, this message translates to:
  /// **'Balance'**
  String get balance;

  /// No description provided for @availableBalance.
  ///
  /// In en, this message translates to:
  /// **'Available Balance'**
  String get availableBalance;

  /// No description provided for @accountNumber.
  ///
  /// In en, this message translates to:
  /// **'Account Number'**
  String get accountNumber;

  /// No description provided for @accountName.
  ///
  /// In en, this message translates to:
  /// **'Account Name'**
  String get accountName;

  /// No description provided for @accountType.
  ///
  /// In en, this message translates to:
  /// **'Account Type'**
  String get accountType;

  /// No description provided for @transfer.
  ///
  /// In en, this message translates to:
  /// **'Transfer'**
  String get transfer;

  /// No description provided for @deposit.
  ///
  /// In en, this message translates to:
  /// **'Deposit'**
  String get deposit;

  /// No description provided for @withdraw.
  ///
  /// In en, this message translates to:
  /// **'Withdraw'**
  String get withdraw;

  /// No description provided for @sendMoney.
  ///
  /// In en, this message translates to:
  /// **'Send Money'**
  String get sendMoney;

  /// No description provided for @receiveMoney.
  ///
  /// In en, this message translates to:
  /// **'Receive Money'**
  String get receiveMoney;

  /// No description provided for @amount.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get amount;

  /// No description provided for @enterAmount.
  ///
  /// In en, this message translates to:
  /// **'Enter amount'**
  String get enterAmount;

  /// No description provided for @recipient.
  ///
  /// In en, this message translates to:
  /// **'Recipient'**
  String get recipient;

  /// No description provided for @description.
  ///
  /// In en, this message translates to:
  /// **'Description'**
  String get description;

  /// No description provided for @reference.
  ///
  /// In en, this message translates to:
  /// **'Reference'**
  String get reference;

  /// No description provided for @date.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get date;

  /// No description provided for @time.
  ///
  /// In en, this message translates to:
  /// **'Time'**
  String get time;

  /// No description provided for @status.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get status;

  /// No description provided for @pending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get pending;

  /// No description provided for @completed.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get completed;

  /// No description provided for @failed.
  ///
  /// In en, this message translates to:
  /// **'Failed'**
  String get failed;

  /// No description provided for @cancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get cancelled;

  /// No description provided for @loans.
  ///
  /// In en, this message translates to:
  /// **'Loans'**
  String get loans;

  /// No description provided for @applyLoan.
  ///
  /// In en, this message translates to:
  /// **'Apply for Loan'**
  String get applyLoan;

  /// No description provided for @activeLoans.
  ///
  /// In en, this message translates to:
  /// **'Active Loans'**
  String get activeLoans;

  /// No description provided for @loanAmount.
  ///
  /// In en, this message translates to:
  /// **'Loan Amount'**
  String get loanAmount;

  /// No description provided for @loanDuration.
  ///
  /// In en, this message translates to:
  /// **'Loan Duration'**
  String get loanDuration;

  /// No description provided for @interestRate.
  ///
  /// In en, this message translates to:
  /// **'Interest Rate'**
  String get interestRate;

  /// No description provided for @monthlyPayment.
  ///
  /// In en, this message translates to:
  /// **'Monthly Payment'**
  String get monthlyPayment;

  /// No description provided for @savings.
  ///
  /// In en, this message translates to:
  /// **'Savings'**
  String get savings;

  /// No description provided for @createSavings.
  ///
  /// In en, this message translates to:
  /// **'Create Savings'**
  String get createSavings;

  /// No description provided for @savingsGoal.
  ///
  /// In en, this message translates to:
  /// **'Savings Goal'**
  String get savingsGoal;

  /// No description provided for @targetAmount.
  ///
  /// In en, this message translates to:
  /// **'Target Amount'**
  String get targetAmount;

  /// No description provided for @currentAmount.
  ///
  /// In en, this message translates to:
  /// **'Current Amount'**
  String get currentAmount;

  /// No description provided for @bills.
  ///
  /// In en, this message translates to:
  /// **'Bills'**
  String get bills;

  /// No description provided for @payBills.
  ///
  /// In en, this message translates to:
  /// **'Pay Bills'**
  String get payBills;

  /// No description provided for @airtime.
  ///
  /// In en, this message translates to:
  /// **'Airtime'**
  String get airtime;

  /// No description provided for @data.
  ///
  /// In en, this message translates to:
  /// **'Data'**
  String get data;

  /// No description provided for @electricity.
  ///
  /// In en, this message translates to:
  /// **'Electricity'**
  String get electricity;

  /// No description provided for @water.
  ///
  /// In en, this message translates to:
  /// **'Water'**
  String get water;

  /// No description provided for @cable.
  ///
  /// In en, this message translates to:
  /// **'Cable TV'**
  String get cable;

  /// No description provided for @support.
  ///
  /// In en, this message translates to:
  /// **'Support'**
  String get support;

  /// No description provided for @help.
  ///
  /// In en, this message translates to:
  /// **'Help'**
  String get help;

  /// No description provided for @faq.
  ///
  /// In en, this message translates to:
  /// **'FAQ'**
  String get faq;

  /// No description provided for @contactUs.
  ///
  /// In en, this message translates to:
  /// **'Contact Us'**
  String get contactUs;

  /// No description provided for @termsAndConditions.
  ///
  /// In en, this message translates to:
  /// **'Terms and Conditions'**
  String get termsAndConditions;

  /// No description provided for @privacyPolicy.
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get privacyPolicy;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @changeLanguage.
  ///
  /// In en, this message translates to:
  /// **'Change Language'**
  String get changeLanguage;

  /// No description provided for @theme.
  ///
  /// In en, this message translates to:
  /// **'Theme'**
  String get theme;

  /// No description provided for @lightMode.
  ///
  /// In en, this message translates to:
  /// **'Light Mode'**
  String get lightMode;

  /// No description provided for @darkMode.
  ///
  /// In en, this message translates to:
  /// **'Dark Mode'**
  String get darkMode;

  /// No description provided for @success.
  ///
  /// In en, this message translates to:
  /// **'Success'**
  String get success;

  /// No description provided for @error.
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get error;

  /// No description provided for @warning.
  ///
  /// In en, this message translates to:
  /// **'Warning'**
  String get warning;

  /// No description provided for @info.
  ///
  /// In en, this message translates to:
  /// **'Information'**
  String get info;

  /// No description provided for @confirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get confirm;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @ok.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get ok;

  /// No description provided for @yes.
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get yes;

  /// No description provided for @no.
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get no;

  /// No description provided for @save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// No description provided for @delete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// No description provided for @edit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get edit;

  /// No description provided for @update.
  ///
  /// In en, this message translates to:
  /// **'Update'**
  String get update;

  /// No description provided for @submit.
  ///
  /// In en, this message translates to:
  /// **'Submit'**
  String get submit;

  /// No description provided for @continueButton.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueButton;

  /// No description provided for @back.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get back;

  /// No description provided for @next.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get next;

  /// No description provided for @done.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get done;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @search.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get search;

  /// No description provided for @filter.
  ///
  /// In en, this message translates to:
  /// **'Filter'**
  String get filter;

  /// No description provided for @sort.
  ///
  /// In en, this message translates to:
  /// **'Sort'**
  String get sort;

  /// No description provided for @refresh.
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get refresh;

  /// No description provided for @disputes.
  ///
  /// In en, this message translates to:
  /// **'Disputes'**
  String get disputes;

  /// No description provided for @raiseDispute.
  ///
  /// In en, this message translates to:
  /// **'Raise Dispute'**
  String get raiseDispute;

  /// No description provided for @disputeDetails.
  ///
  /// In en, this message translates to:
  /// **'Dispute Details'**
  String get disputeDetails;

  /// No description provided for @qrCode.
  ///
  /// In en, this message translates to:
  /// **'QR Code'**
  String get qrCode;

  /// No description provided for @scanQR.
  ///
  /// In en, this message translates to:
  /// **'Scan QR Code'**
  String get scanQR;

  /// No description provided for @myQRCode.
  ///
  /// In en, this message translates to:
  /// **'My QR Code'**
  String get myQRCode;

  /// No description provided for @pin.
  ///
  /// In en, this message translates to:
  /// **'PIN'**
  String get pin;

  /// No description provided for @createPin.
  ///
  /// In en, this message translates to:
  /// **'Create PIN'**
  String get createPin;

  /// No description provided for @enterPin.
  ///
  /// In en, this message translates to:
  /// **'Enter PIN'**
  String get enterPin;

  /// No description provided for @confirmPin.
  ///
  /// In en, this message translates to:
  /// **'Confirm PIN'**
  String get confirmPin;

  /// No description provided for @changePin.
  ///
  /// In en, this message translates to:
  /// **'Change PIN'**
  String get changePin;

  /// No description provided for @forgotPin.
  ///
  /// In en, this message translates to:
  /// **'Forgot PIN?'**
  String get forgotPin;

  /// No description provided for @otp.
  ///
  /// In en, this message translates to:
  /// **'OTP'**
  String get otp;

  /// No description provided for @enterOtp.
  ///
  /// In en, this message translates to:
  /// **'Enter OTP'**
  String get enterOtp;

  /// No description provided for @resendOtp.
  ///
  /// In en, this message translates to:
  /// **'Resend OTP'**
  String get resendOtp;

  /// No description provided for @verifyOtp.
  ///
  /// In en, this message translates to:
  /// **'Verify OTP'**
  String get verifyOtp;

  /// No description provided for @bvn.
  ///
  /// In en, this message translates to:
  /// **'BVN'**
  String get bvn;

  /// No description provided for @enterBvn.
  ///
  /// In en, this message translates to:
  /// **'Enter BVN'**
  String get enterBvn;

  /// No description provided for @verifyBvn.
  ///
  /// In en, this message translates to:
  /// **'Verify BVN'**
  String get verifyBvn;

  /// No description provided for @kyc.
  ///
  /// In en, this message translates to:
  /// **'KYC'**
  String get kyc;

  /// No description provided for @completeKyc.
  ///
  /// In en, this message translates to:
  /// **'Complete KYC'**
  String get completeKyc;

  /// No description provided for @kycVerification.
  ///
  /// In en, this message translates to:
  /// **'KYC Verification'**
  String get kycVerification;

  /// No description provided for @uploadDocument.
  ///
  /// In en, this message translates to:
  /// **'Upload Document'**
  String get uploadDocument;

  /// No description provided for @cheques.
  ///
  /// In en, this message translates to:
  /// **'Cheques'**
  String get cheques;

  /// No description provided for @requestCheque.
  ///
  /// In en, this message translates to:
  /// **'Request Cheque'**
  String get requestCheque;

  /// No description provided for @chequeBook.
  ///
  /// In en, this message translates to:
  /// **'Cheque Book'**
  String get chequeBook;

  /// No description provided for @insurance.
  ///
  /// In en, this message translates to:
  /// **'Insurance'**
  String get insurance;

  /// No description provided for @investments.
  ///
  /// In en, this message translates to:
  /// **'Investments'**
  String get investments;

  /// No description provided for @pensions.
  ///
  /// In en, this message translates to:
  /// **'Pensions'**
  String get pensions;

  /// No description provided for @fx.
  ///
  /// In en, this message translates to:
  /// **'Foreign Exchange'**
  String get fx;

  /// No description provided for @carbonCredits.
  ///
  /// In en, this message translates to:
  /// **'Carbon Credits'**
  String get carbonCredits;

  /// No description provided for @transactionHistory.
  ///
  /// In en, this message translates to:
  /// **'Transaction History'**
  String get transactionHistory;

  /// No description provided for @viewAll.
  ///
  /// In en, this message translates to:
  /// **'View All'**
  String get viewAll;

  /// No description provided for @viewDetails.
  ///
  /// In en, this message translates to:
  /// **'View Details'**
  String get viewDetails;

  /// No description provided for @downloadReceipt.
  ///
  /// In en, this message translates to:
  /// **'Download Receipt'**
  String get downloadReceipt;

  /// No description provided for @shareReceipt.
  ///
  /// In en, this message translates to:
  /// **'Share Receipt'**
  String get shareReceipt;

  /// No description provided for @networkError.
  ///
  /// In en, this message translates to:
  /// **'Network Error'**
  String get networkError;

  /// No description provided for @tryAgain.
  ///
  /// In en, this message translates to:
  /// **'Try Again'**
  String get tryAgain;

  /// No description provided for @loading.
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get loading;

  /// No description provided for @noData.
  ///
  /// In en, this message translates to:
  /// **'No Data Available'**
  String get noData;

  /// No description provided for @scheduledPayments.
  ///
  /// In en, this message translates to:
  /// **'Scheduled Payments'**
  String get scheduledPayments;

  /// No description provided for @schedulePayment.
  ///
  /// In en, this message translates to:
  /// **'Schedule Payment'**
  String get schedulePayment;

  /// No description provided for @moreActions.
  ///
  /// In en, this message translates to:
  /// **'More Actions'**
  String get moreActions;

  /// No description provided for @bankStatement.
  ///
  /// In en, this message translates to:
  /// **'Bank Statement'**
  String get bankStatement;

  /// No description provided for @welcomeBack.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get welcomeBack;

  /// No description provided for @totalBalance.
  ///
  /// In en, this message translates to:
  /// **'Total Balance'**
  String get totalBalance;

  /// No description provided for @accountDetails.
  ///
  /// In en, this message translates to:
  /// **'Account Details'**
  String get accountDetails;

  /// No description provided for @hideDetails.
  ///
  /// In en, this message translates to:
  /// **'Hide Details'**
  String get hideDetails;

  /// No description provided for @showDetails.
  ///
  /// In en, this message translates to:
  /// **'Show Details'**
  String get showDetails;

  /// No description provided for @quickActions.
  ///
  /// In en, this message translates to:
  /// **'Quick Actions'**
  String get quickActions;

  /// No description provided for @recentTransactions.
  ///
  /// In en, this message translates to:
  /// **'Recent Transactions'**
  String get recentTransactions;

  /// No description provided for @seeAll.
  ///
  /// In en, this message translates to:
  /// **'See All'**
  String get seeAll;

  /// No description provided for @noRecentTransactions.
  ///
  /// In en, this message translates to:
  /// **'No recent transactions'**
  String get noRecentTransactions;

  /// No description provided for @transferMoney.
  ///
  /// In en, this message translates to:
  /// **'Transfer Money'**
  String get transferMoney;

  /// No description provided for @transferToAnyBank.
  ///
  /// In en, this message translates to:
  /// **'Transfer to any bank account'**
  String get transferToAnyBank;

  /// No description provided for @fromAccount.
  ///
  /// In en, this message translates to:
  /// **'From Account'**
  String get fromAccount;

  /// No description provided for @fromAccountId.
  ///
  /// In en, this message translates to:
  /// **'From Account ID'**
  String get fromAccountId;

  /// No description provided for @toAccount.
  ///
  /// In en, this message translates to:
  /// **'To Account'**
  String get toAccount;

  /// No description provided for @payeeAccountId.
  ///
  /// In en, this message translates to:
  /// **'Payee Account ID'**
  String get payeeAccountId;

  /// No description provided for @enterPayeeAccountId.
  ///
  /// In en, this message translates to:
  /// **'Enter payee account ID (e.g., 35)'**
  String get enterPayeeAccountId;

  /// No description provided for @pleaseEnterPayeeAccountId.
  ///
  /// In en, this message translates to:
  /// **'Please enter payee account ID'**
  String get pleaseEnterPayeeAccountId;

  /// No description provided for @pleaseEnterAmount.
  ///
  /// In en, this message translates to:
  /// **'Please enter amount'**
  String get pleaseEnterAmount;

  /// No description provided for @pleaseEnterPin.
  ///
  /// In en, this message translates to:
  /// **'Please enter PIN'**
  String get pleaseEnterPin;

  /// No description provided for @pinMustBe4Digits.
  ///
  /// In en, this message translates to:
  /// **'PIN must be 4 digits'**
  String get pinMustBe4Digits;

  /// No description provided for @note.
  ///
  /// In en, this message translates to:
  /// **'Note'**
  String get note;

  /// No description provided for @addNote.
  ///
  /// In en, this message translates to:
  /// **'Add a note (optional)'**
  String get addNote;

  /// No description provided for @transactionPin.
  ///
  /// In en, this message translates to:
  /// **'Transaction PIN'**
  String get transactionPin;

  /// No description provided for @enter4DigitPin.
  ///
  /// In en, this message translates to:
  /// **'Enter your 4-digit PIN'**
  String get enter4DigitPin;

  /// No description provided for @ensureDetailsCorrect.
  ///
  /// In en, this message translates to:
  /// **'Ensure the account details are correct before proceeding'**
  String get ensureDetailsCorrect;

  /// No description provided for @savedBeneficiaries.
  ///
  /// In en, this message translates to:
  /// **'Saved Beneficiaries'**
  String get savedBeneficiaries;

  /// No description provided for @confirmTransfer.
  ///
  /// In en, this message translates to:
  /// **'Confirm Transfer'**
  String get confirmTransfer;

  /// No description provided for @processing.
  ///
  /// In en, this message translates to:
  /// **'Processing...'**
  String get processing;

  /// No description provided for @transferSuccessful.
  ///
  /// In en, this message translates to:
  /// **'Transfer Successful'**
  String get transferSuccessful;

  /// No description provided for @transferFailed.
  ///
  /// In en, this message translates to:
  /// **'Transfer Failed'**
  String get transferFailed;

  /// No description provided for @unableToLoadAccount.
  ///
  /// In en, this message translates to:
  /// **'Unable to load your account. Please try again.'**
  String get unableToLoadAccount;

  /// No description provided for @addAccount.
  ///
  /// In en, this message translates to:
  /// **'Add Account'**
  String get addAccount;

  /// No description provided for @createNewAccount.
  ///
  /// In en, this message translates to:
  /// **'Create a New Account'**
  String get createNewAccount;

  /// No description provided for @selectAccountType.
  ///
  /// In en, this message translates to:
  /// **'Select Account Type'**
  String get selectAccountType;

  /// No description provided for @enterAccountName.
  ///
  /// In en, this message translates to:
  /// **'Enter a name for this account'**
  String get enterAccountName;

  /// No description provided for @pleaseEnterAccountName.
  ///
  /// In en, this message translates to:
  /// **'Please enter an account name'**
  String get pleaseEnterAccountName;

  /// No description provided for @accountNameMinLength.
  ///
  /// In en, this message translates to:
  /// **'Account name must be at least 3 characters'**
  String get accountNameMinLength;

  /// No description provided for @accountCreatedInstantly.
  ///
  /// In en, this message translates to:
  /// **'Your new account will be created instantly and ready to use.'**
  String get accountCreatedInstantly;

  /// No description provided for @createAccount.
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get createAccount;

  /// No description provided for @accountCreatedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Account created successfully!'**
  String get accountCreatedSuccess;

  /// No description provided for @accountCreationFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to create account. Please try again.'**
  String get accountCreationFailed;

  /// No description provided for @savingsAccount.
  ///
  /// In en, this message translates to:
  /// **'Savings Account'**
  String get savingsAccount;

  /// No description provided for @savingsAccountDesc.
  ///
  /// In en, this message translates to:
  /// **'Personal saving account with competitive interest rates'**
  String get savingsAccountDesc;

  /// No description provided for @currentAccount.
  ///
  /// In en, this message translates to:
  /// **'Current Account'**
  String get currentAccount;

  /// No description provided for @currentAccountDesc.
  ///
  /// In en, this message translates to:
  /// **'Business transactions with unlimited operations'**
  String get currentAccountDesc;

  /// No description provided for @fixedDeposit.
  ///
  /// In en, this message translates to:
  /// **'Fixed Deposit'**
  String get fixedDeposit;

  /// No description provided for @fixedDepositDesc.
  ///
  /// In en, this message translates to:
  /// **'Long-term investment with higher returns'**
  String get fixedDepositDesc;

  /// No description provided for @recurringDeposit.
  ///
  /// In en, this message translates to:
  /// **'Recurring Deposit'**
  String get recurringDeposit;

  /// No description provided for @recurringDepositDesc.
  ///
  /// In en, this message translates to:
  /// **'Monthly saving with guaranteed returns'**
  String get recurringDepositDesc;

  /// No description provided for @domiciliaryAccount.
  ///
  /// In en, this message translates to:
  /// **'Domiciliary Account'**
  String get domiciliaryAccount;

  /// No description provided for @domiciliaryAccountDesc.
  ///
  /// In en, this message translates to:
  /// **'Foreign currency account'**
  String get domiciliaryAccountDesc;

  /// No description provided for @jointAccount.
  ///
  /// In en, this message translates to:
  /// **'Joint Account'**
  String get jointAccount;

  /// No description provided for @jointAccountDesc.
  ///
  /// In en, this message translates to:
  /// **'Shared account for multiple users'**
  String get jointAccountDesc;

  /// No description provided for @studentAccount.
  ///
  /// In en, this message translates to:
  /// **'Student Account'**
  String get studentAccount;

  /// No description provided for @studentAccountDesc.
  ///
  /// In en, this message translates to:
  /// **'Special account for students'**
  String get studentAccountDesc;

  /// No description provided for @salaryAccount.
  ///
  /// In en, this message translates to:
  /// **'Salary Account'**
  String get salaryAccount;

  /// No description provided for @salaryAccountDesc.
  ///
  /// In en, this message translates to:
  /// **'For salaried employees'**
  String get salaryAccountDesc;

  /// No description provided for @businessAccount.
  ///
  /// In en, this message translates to:
  /// **'Business Account'**
  String get businessAccount;

  /// No description provided for @businessAccountDesc.
  ///
  /// In en, this message translates to:
  /// **'For small and medium enterprises'**
  String get businessAccountDesc;

  /// No description provided for @corporateAccount.
  ///
  /// In en, this message translates to:
  /// **'Corporate Account'**
  String get corporateAccount;

  /// No description provided for @corporateAccountDesc.
  ///
  /// In en, this message translates to:
  /// **'For large companies and enterprises'**
  String get corporateAccountDesc;

  /// No description provided for @digitalAccount.
  ///
  /// In en, this message translates to:
  /// **'Digital Account'**
  String get digitalAccount;

  /// No description provided for @digitalAccountDesc.
  ///
  /// In en, this message translates to:
  /// **'Online banking with exclusive digital features'**
  String get digitalAccountDesc;

  /// No description provided for @activeLoansSub.
  ///
  /// In en, this message translates to:
  /// **'View your loan applications'**
  String get activeLoansSub;

  /// No description provided for @activeLpos.
  ///
  /// In en, this message translates to:
  /// **'Active LPOs'**
  String get activeLpos;

  /// No description provided for @activeLposSub.
  ///
  /// In en, this message translates to:
  /// **'View your LPO applications'**
  String get activeLposSub;

  /// No description provided for @savingsSub.
  ///
  /// In en, this message translates to:
  /// **'Manage your savings plans'**
  String get savingsSub;

  /// No description provided for @disputesSub.
  ///
  /// In en, this message translates to:
  /// **'Manage transaction disputes'**
  String get disputesSub;

  /// No description provided for @billsSub.
  ///
  /// In en, this message translates to:
  /// **'Pay your bills'**
  String get billsSub;

  /// No description provided for @chequesSub.
  ///
  /// In en, this message translates to:
  /// **'Manage your cheques'**
  String get chequesSub;

  /// No description provided for @rewardsSub.
  ///
  /// In en, this message translates to:
  /// **'View and redeem rewards'**
  String get rewardsSub;

  /// No description provided for @fxSub.
  ///
  /// In en, this message translates to:
  /// **'Foreign exchange services'**
  String get fxSub;

  /// No description provided for @insuranceSub.
  ///
  /// In en, this message translates to:
  /// **'Protect your assets'**
  String get insuranceSub;

  /// No description provided for @investmentsSub.
  ///
  /// In en, this message translates to:
  /// **'Manage your investments'**
  String get investmentsSub;

  /// No description provided for @bankStatementSub.
  ///
  /// In en, this message translates to:
  /// **'Download your statement'**
  String get bankStatementSub;

  /// No description provided for @carbonCreditsSub.
  ///
  /// In en, this message translates to:
  /// **'View your carbon credits'**
  String get carbonCreditsSub;

  /// No description provided for @cardsSub.
  ///
  /// In en, this message translates to:
  /// **'Manage your cards'**
  String get cardsSub;

  /// No description provided for @transactionHistorySub.
  ///
  /// In en, this message translates to:
  /// **'View all transactions'**
  String get transactionHistorySub;

  /// No description provided for @qrCodeSub.
  ///
  /// In en, this message translates to:
  /// **'Scan or show your QR'**
  String get qrCodeSub;

  /// No description provided for @escrowBanking.
  ///
  /// In en, this message translates to:
  /// **'Escrow Banking'**
  String get escrowBanking;

  /// No description provided for @escrowBankingSub.
  ///
  /// In en, this message translates to:
  /// **'Secure third-party transactions'**
  String get escrowBankingSub;

  /// No description provided for @mortgageBanking.
  ///
  /// In en, this message translates to:
  /// **'Mortgage Banking'**
  String get mortgageBanking;

  /// No description provided for @mortgageBankingSub.
  ///
  /// In en, this message translates to:
  /// **'Home loan solutions'**
  String get mortgageBankingSub;

  /// No description provided for @educationBanking.
  ///
  /// In en, this message translates to:
  /// **'Education Banking'**
  String get educationBanking;

  /// No description provided for @educationBankingSub.
  ///
  /// In en, this message translates to:
  /// **'Finance your education'**
  String get educationBankingSub;

  /// No description provided for @agricultureBanking.
  ///
  /// In en, this message translates to:
  /// **'Agriculture Banking'**
  String get agricultureBanking;

  /// No description provided for @agricultureBankingSub.
  ///
  /// In en, this message translates to:
  /// **'Farm and agribusiness loans'**
  String get agricultureBankingSub;

  /// No description provided for @esusuBanking.
  ///
  /// In en, this message translates to:
  /// **'Esusu (Rotating Savings)'**
  String get esusuBanking;

  /// No description provided for @esusuBankingSub.
  ///
  /// In en, this message translates to:
  /// **'Join or create savings groups'**
  String get esusuBankingSub;

  /// No description provided for @vanManagement.
  ///
  /// In en, this message translates to:
  /// **'Virtual Account Numbers'**
  String get vanManagement;

  /// No description provided for @vanManagementSub.
  ///
  /// In en, this message translates to:
  /// **'Manage virtual accounts'**
  String get vanManagementSub;

  /// No description provided for @noActionsAvailable.
  ///
  /// In en, this message translates to:
  /// **'No actions available'**
  String get noActionsAvailable;

  /// No description provided for @searchActions.
  ///
  /// In en, this message translates to:
  /// **'Search actions...'**
  String get searchActions;

  /// No description provided for @amountSent.
  ///
  /// In en, this message translates to:
  /// **'Amount Sent'**
  String get amountSent;

  /// No description provided for @narration.
  ///
  /// In en, this message translates to:
  /// **'Narration'**
  String get narration;

  /// No description provided for @dateTime.
  ///
  /// In en, this message translates to:
  /// **'Date & Time'**
  String get dateTime;

  /// No description provided for @downloadStatement.
  ///
  /// In en, this message translates to:
  /// **'Download Statement'**
  String get downloadStatement;

  /// No description provided for @backToDashboard.
  ///
  /// In en, this message translates to:
  /// **'Back to Dashboard'**
  String get backToDashboard;

  /// No description provided for @rewards.
  ///
  /// In en, this message translates to:
  /// **'Rewards'**
  String get rewards;

  /// No description provided for @welcomeTo.
  ///
  /// In en, this message translates to:
  /// **'Welcome to {appName}!'**
  String welcomeTo(String appName);

  /// No description provided for @firstName.
  ///
  /// In en, this message translates to:
  /// **'First Name'**
  String get firstName;

  /// No description provided for @lastName.
  ///
  /// In en, this message translates to:
  /// **'Last Name'**
  String get lastName;

  /// No description provided for @businessName.
  ///
  /// In en, this message translates to:
  /// **'Business Name (optional)'**
  String get businessName;

  /// No description provided for @enterFirstName.
  ///
  /// In en, this message translates to:
  /// **'Enter your first name'**
  String get enterFirstName;

  /// No description provided for @enterLastName.
  ///
  /// In en, this message translates to:
  /// **'Enter your last name'**
  String get enterLastName;

  /// No description provided for @enterBusinessName.
  ///
  /// In en, this message translates to:
  /// **'Enter your business name (optional)'**
  String get enterBusinessName;

  /// No description provided for @phoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Phone Number'**
  String get phoneNumber;

  /// No description provided for @enterPhoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Enter your phone number'**
  String get enterPhoneNumber;

  /// No description provided for @nationalIdentificationNumber.
  ///
  /// In en, this message translates to:
  /// **'National Identification Number'**
  String get nationalIdentificationNumber;

  /// No description provided for @enterNIN.
  ///
  /// In en, this message translates to:
  /// **'Enter 11-digit NIN'**
  String get enterNIN;

  /// No description provided for @createPassword.
  ///
  /// In en, this message translates to:
  /// **'Create a password'**
  String get createPassword;

  /// No description provided for @reEnterPassword.
  ///
  /// In en, this message translates to:
  /// **'Re-enter your password'**
  String get reEnterPassword;

  /// No description provided for @agreeToTerms.
  ///
  /// In en, this message translates to:
  /// **'Please agree to terms and conditions'**
  String get agreeToTerms;

  /// No description provided for @passwordUpdatedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Password updated successfully'**
  String get passwordUpdatedSuccess;

  /// No description provided for @updatePassword.
  ///
  /// In en, this message translates to:
  /// **'Update Password'**
  String get updatePassword;

  /// No description provided for @forgotCurrentPassword.
  ///
  /// In en, this message translates to:
  /// **'Forgot current password?'**
  String get forgotCurrentPassword;

  /// No description provided for @emailVerification.
  ///
  /// In en, this message translates to:
  /// **'Email Verification'**
  String get emailVerification;

  /// No description provided for @verifyEmail.
  ///
  /// In en, this message translates to:
  /// **'Verify Email'**
  String get verifyEmail;

  /// No description provided for @verify.
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get verify;

  /// No description provided for @resendCode.
  ///
  /// In en, this message translates to:
  /// **'Resend code'**
  String get resendCode;

  /// No description provided for @enterOtpCode.
  ///
  /// In en, this message translates to:
  /// **'Enter 6-digit code'**
  String get enterOtpCode;

  /// No description provided for @resendCodeComingSoon.
  ///
  /// In en, this message translates to:
  /// **'Resend code functionality coming soon'**
  String get resendCodeComingSoon;

  /// No description provided for @passwordCreatedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Password Created Successfully'**
  String get passwordCreatedSuccess;

  /// No description provided for @backToLogin.
  ///
  /// In en, this message translates to:
  /// **'Back to Login'**
  String get backToLogin;

  /// No description provided for @gotIt.
  ///
  /// In en, this message translates to:
  /// **'Got It'**
  String get gotIt;

  /// No description provided for @checkYourEmail.
  ///
  /// In en, this message translates to:
  /// **'Check Your Email'**
  String get checkYourEmail;

  /// No description provided for @resetPasswordEmailSent.
  ///
  /// In en, this message translates to:
  /// **'We\'ve sent a password reset link to'**
  String get resetPasswordEmailSent;

  /// No description provided for @resetPassword.
  ///
  /// In en, this message translates to:
  /// **'Reset Password'**
  String get resetPassword;

  /// No description provided for @enterEmailForReset.
  ///
  /// In en, this message translates to:
  /// **'Enter your email address and we\'ll send you a link to reset your password'**
  String get enterEmailForReset;

  /// No description provided for @emailAddress.
  ///
  /// In en, this message translates to:
  /// **'Email Address'**
  String get emailAddress;

  /// No description provided for @enterYourEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter your email'**
  String get enterYourEmail;

  /// No description provided for @requestFailed.
  ///
  /// In en, this message translates to:
  /// **'Request failed'**
  String get requestFailed;

  /// No description provided for @startOnboarding.
  ///
  /// In en, this message translates to:
  /// **'Start Onboarding'**
  String get startOnboarding;

  /// No description provided for @alreadyHaveAccountLogin.
  ///
  /// In en, this message translates to:
  /// **'Already have an account? '**
  String get alreadyHaveAccountLogin;

  /// No description provided for @identityDocuments.
  ///
  /// In en, this message translates to:
  /// **'Identity Documents'**
  String get identityDocuments;

  /// No description provided for @fileSizeTooLarge.
  ///
  /// In en, this message translates to:
  /// **'File size must be less than 10MB'**
  String get fileSizeTooLarge;

  /// No description provided for @documentPreview.
  ///
  /// In en, this message translates to:
  /// **'Document Preview'**
  String get documentPreview;

  /// No description provided for @bvnVerification.
  ///
  /// In en, this message translates to:
  /// **'BVN Verification'**
  String get bvnVerification;

  /// No description provided for @skipForNow.
  ///
  /// In en, this message translates to:
  /// **'Skip for now'**
  String get skipForNow;

  /// No description provided for @addressVerification.
  ///
  /// In en, this message translates to:
  /// **'Address Verification'**
  String get addressVerification;

  /// No description provided for @kycCompleteSuccess.
  ///
  /// In en, this message translates to:
  /// **'KYC Complete - Success'**
  String get kycCompleteSuccess;

  /// No description provided for @goToDashboard.
  ///
  /// In en, this message translates to:
  /// **'Go to Dashboard'**
  String get goToDashboard;

  /// No description provided for @viewAccountSettings.
  ///
  /// In en, this message translates to:
  /// **'View Account Settings'**
  String get viewAccountSettings;

  /// No description provided for @minLengthError.
  ///
  /// In en, this message translates to:
  /// **'{field} must be at least {length} characters'**
  String minLengthError(String field, int length);

  /// No description provided for @pleaseEnter.
  ///
  /// In en, this message translates to:
  /// **'Please enter {field}'**
  String pleaseEnter(String field);

  /// No description provided for @invalidEmail.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid email'**
  String get invalidEmail;

  /// No description provided for @invalidPhone.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid phone number'**
  String get invalidPhone;

  /// No description provided for @passwordsDoNotMatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match'**
  String get passwordsDoNotMatch;

  /// No description provided for @passwordRequirements.
  ///
  /// In en, this message translates to:
  /// **'Password Requirements:'**
  String get passwordRequirements;

  /// No description provided for @rememberMe.
  ///
  /// In en, this message translates to:
  /// **'Remember me'**
  String get rememberMe;

  /// No description provided for @enterEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter email'**
  String get enterEmail;

  /// No description provided for @enterPassword.
  ///
  /// In en, this message translates to:
  /// **'Enter password'**
  String get enterPassword;

  /// No description provided for @noAccountYet.
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account yet?'**
  String get noAccountYet;

  /// No description provided for @createOne.
  ///
  /// In en, this message translates to:
  /// **'Create one'**
  String get createOne;

  /// No description provided for @languageChangedTo.
  ///
  /// In en, this message translates to:
  /// **'Language changed to {language}'**
  String languageChangedTo(String language);

  /// No description provided for @hide.
  ///
  /// In en, this message translates to:
  /// **'Hide'**
  String get hide;

  /// No description provided for @show.
  ///
  /// In en, this message translates to:
  /// **'Show'**
  String get show;

  /// No description provided for @goodMorning.
  ///
  /// In en, this message translates to:
  /// **'Good Morning'**
  String get goodMorning;

  /// No description provided for @goodAfternoon.
  ///
  /// In en, this message translates to:
  /// **'Good Afternoon'**
  String get goodAfternoon;

  /// No description provided for @goodEvening.
  ///
  /// In en, this message translates to:
  /// **'Good Evening'**
  String get goodEvening;

  /// No description provided for @user.
  ///
  /// In en, this message translates to:
  /// **'User'**
  String get user;

  /// No description provided for @later.
  ///
  /// In en, this message translates to:
  /// **'Later'**
  String get later;

  /// No description provided for @startKYC.
  ///
  /// In en, this message translates to:
  /// **'Start KYC'**
  String get startKYC;

  /// No description provided for @kycRequiredDocuments.
  ///
  /// In en, this message translates to:
  /// **'You\'ll need ID documents and proof of address'**
  String get kycRequiredDocuments;

  /// No description provided for @bankNetworkMonitor.
  ///
  /// In en, this message translates to:
  /// **'Bank Network Monitor'**
  String get bankNetworkMonitor;

  /// No description provided for @comingSoon.
  ///
  /// In en, this message translates to:
  /// **'{feature} functionality coming soon'**
  String comingSoon(String feature);

  /// No description provided for @completeKYC.
  ///
  /// In en, this message translates to:
  /// **'Complete KYC'**
  String get completeKYC;

  /// No description provided for @bvnVerificationTitle.
  ///
  /// In en, this message translates to:
  /// **'BVN Verification'**
  String get bvnVerificationTitle;

  /// No description provided for @updateOrVerifyBVN.
  ///
  /// In en, this message translates to:
  /// **'Update or verify BVN'**
  String get updateOrVerifyBVN;

  /// No description provided for @account.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get account;

  /// No description provided for @changePassword.
  ///
  /// In en, this message translates to:
  /// **'Change Password'**
  String get changePassword;

  /// No description provided for @financialServices.
  ///
  /// In en, this message translates to:
  /// **'Financial Services'**
  String get financialServices;

  /// No description provided for @myCards.
  ///
  /// In en, this message translates to:
  /// **'My Cards'**
  String get myCards;

  /// No description provided for @manageDebitCards.
  ///
  /// In en, this message translates to:
  /// **'Manage debit cards'**
  String get manageDebitCards;

  /// No description provided for @carbonOffsetProgram.
  ///
  /// In en, this message translates to:
  /// **'Carbon offset program'**
  String get carbonOffsetProgram;

  /// No description provided for @appearance.
  ///
  /// In en, this message translates to:
  /// **'Appearance'**
  String get appearance;

  /// No description provided for @appLanguage.
  ///
  /// In en, this message translates to:
  /// **'App language'**
  String get appLanguage;

  /// No description provided for @security.
  ///
  /// In en, this message translates to:
  /// **'Security'**
  String get security;

  /// No description provided for @biometricLogin.
  ///
  /// In en, this message translates to:
  /// **'Biometric Login'**
  String get biometricLogin;

  /// No description provided for @fingerprintOrFaceID.
  ///
  /// In en, this message translates to:
  /// **'Fingerprint or face ID'**
  String get fingerprintOrFaceID;

  /// No description provided for @accountID.
  ///
  /// In en, this message translates to:
  /// **'Account ID'**
  String get accountID;

  /// No description provided for @yourAccountID.
  ///
  /// In en, this message translates to:
  /// **'Your account ID'**
  String get yourAccountID;

  /// No description provided for @selectBank.
  ///
  /// In en, this message translates to:
  /// **'Select Bank'**
  String get selectBank;

  /// No description provided for @chooseBank.
  ///
  /// In en, this message translates to:
  /// **'Choose a bank'**
  String get chooseBank;

  /// No description provided for @deleteBeneficiary.
  ///
  /// In en, this message translates to:
  /// **'Delete Beneficiary'**
  String get deleteBeneficiary;

  /// No description provided for @removeConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to remove {name} from your saved beneficiaries?'**
  String removeConfirmation(String name);

  /// No description provided for @beneficiaryRemoved.
  ///
  /// In en, this message translates to:
  /// **'{name} removed'**
  String beneficiaryRemoved(String name);

  /// No description provided for @addBeneficiary.
  ///
  /// In en, this message translates to:
  /// **'Add Beneficiary'**
  String get addBeneficiary;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @applyForLoan.
  ///
  /// In en, this message translates to:
  /// **'Apply for Loan'**
  String get applyForLoan;

  /// No description provided for @months.
  ///
  /// In en, this message translates to:
  /// **'months'**
  String get months;

  /// No description provided for @selectPurpose.
  ///
  /// In en, this message translates to:
  /// **'Select Purpose'**
  String get selectPurpose;

  /// No description provided for @specifyPurpose.
  ///
  /// In en, this message translates to:
  /// **'Specify Purpose'**
  String get specifyPurpose;

  /// No description provided for @loanDetails.
  ///
  /// In en, this message translates to:
  /// **'Loan Details'**
  String get loanDetails;

  /// No description provided for @makePayment.
  ///
  /// In en, this message translates to:
  /// **'Make Payment'**
  String get makePayment;

  /// No description provided for @loanRepaymentSuccessful.
  ///
  /// In en, this message translates to:
  /// **'Loan repayment successful!'**
  String get loanRepaymentSuccessful;

  /// No description provided for @loanRepaymentFailed.
  ///
  /// In en, this message translates to:
  /// **'Loan repayment failed'**
  String get loanRepaymentFailed;

  /// No description provided for @mySavings.
  ///
  /// In en, this message translates to:
  /// **'My Savings'**
  String get mySavings;

  /// No description provided for @createSavingsPlan.
  ///
  /// In en, this message translates to:
  /// **'Create Savings Plan'**
  String get createSavingsPlan;

  /// No description provided for @newSavings.
  ///
  /// In en, this message translates to:
  /// **'New Savings'**
  String get newSavings;

  /// No description provided for @failedToCreateSavings.
  ///
  /// In en, this message translates to:
  /// **'Failed to create savings'**
  String get failedToCreateSavings;

  /// No description provided for @makeContribution.
  ///
  /// In en, this message translates to:
  /// **'Make Contribution'**
  String get makeContribution;

  /// No description provided for @contribute.
  ///
  /// In en, this message translates to:
  /// **'Contribute'**
  String get contribute;

  /// No description provided for @failedToMakeContribution.
  ///
  /// In en, this message translates to:
  /// **'Failed to make contribution'**
  String get failedToMakeContribution;

  /// No description provided for @withdrawFromSavings.
  ///
  /// In en, this message translates to:
  /// **'Withdraw from Savings'**
  String get withdrawFromSavings;

  /// No description provided for @failedToWithdraw.
  ///
  /// In en, this message translates to:
  /// **'Failed to withdraw'**
  String get failedToWithdraw;

  /// No description provided for @pauseSavings.
  ///
  /// In en, this message translates to:
  /// **'Pause Savings'**
  String get pauseSavings;

  /// No description provided for @pause.
  ///
  /// In en, this message translates to:
  /// **'Pause'**
  String get pause;

  /// No description provided for @savingsPlanPaused.
  ///
  /// In en, this message translates to:
  /// **'Savings plan paused'**
  String get savingsPlanPaused;

  /// No description provided for @failedToPauseSavings.
  ///
  /// In en, this message translates to:
  /// **'Failed to pause savings'**
  String get failedToPauseSavings;

  /// No description provided for @savingsPlanResumed.
  ///
  /// In en, this message translates to:
  /// **'Savings plan resumed'**
  String get savingsPlanResumed;

  /// No description provided for @failedToResumeSavings.
  ///
  /// In en, this message translates to:
  /// **'Failed to resume savings'**
  String get failedToResumeSavings;

  /// No description provided for @completeSavings.
  ///
  /// In en, this message translates to:
  /// **'Complete Savings'**
  String get completeSavings;

  /// No description provided for @complete.
  ///
  /// In en, this message translates to:
  /// **'Complete'**
  String get complete;

  /// No description provided for @failedToCompleteSavings.
  ///
  /// In en, this message translates to:
  /// **'Failed to complete savings'**
  String get failedToCompleteSavings;

  /// No description provided for @deleteSavings.
  ///
  /// In en, this message translates to:
  /// **'Delete Savings'**
  String get deleteSavings;

  /// No description provided for @savingsPlanDeleted.
  ///
  /// In en, this message translates to:
  /// **'Savings plan deleted'**
  String get savingsPlanDeleted;

  /// No description provided for @failedToDeleteSavings.
  ///
  /// In en, this message translates to:
  /// **'Failed to delete savings'**
  String get failedToDeleteSavings;

  /// No description provided for @savingsDetails.
  ///
  /// In en, this message translates to:
  /// **'Savings Details'**
  String get savingsDetails;

  /// No description provided for @addFunds.
  ///
  /// In en, this message translates to:
  /// **'Add Funds'**
  String get addFunds;

  /// No description provided for @resumeSavings.
  ///
  /// In en, this message translates to:
  /// **'Resume Savings'**
  String get resumeSavings;

  /// No description provided for @markAsCompleted.
  ///
  /// In en, this message translates to:
  /// **'Mark as Completed'**
  String get markAsCompleted;

  /// No description provided for @receiptDownloadComingSoon.
  ///
  /// In en, this message translates to:
  /// **'Receipt download feature coming soon'**
  String get receiptDownloadComingSoon;

  /// No description provided for @verificationAndLimits.
  ///
  /// In en, this message translates to:
  /// **'Verification & Limits'**
  String get verificationAndLimits;

  /// No description provided for @increaseLimitsUnlockFeatures.
  ///
  /// In en, this message translates to:
  /// **'Increase limits & unlock features'**
  String get increaseLimitsUnlockFeatures;

  /// No description provided for @actionRequired.
  ///
  /// In en, this message translates to:
  /// **'Action Required'**
  String get actionRequired;

  /// No description provided for @lightAndDarkTheme.
  ///
  /// In en, this message translates to:
  /// **'Light & dark theme'**
  String get lightAndDarkTheme;

  /// No description provided for @manageYourPin.
  ///
  /// In en, this message translates to:
  /// **'Manage your PIN'**
  String get manageYourPin;

  /// No description provided for @pushNotifications.
  ///
  /// In en, this message translates to:
  /// **'Push Notifications'**
  String get pushNotifications;

  /// No description provided for @receiveTransactionAlerts.
  ///
  /// In en, this message translates to:
  /// **'Receive transaction alerts'**
  String get receiveTransactionAlerts;

  /// No description provided for @supportAndInfo.
  ///
  /// In en, this message translates to:
  /// **'Support & Info'**
  String get supportAndInfo;

  /// No description provided for @commonQuestions.
  ///
  /// In en, this message translates to:
  /// **'Common questions'**
  String get commonQuestions;

  /// No description provided for @contactSupport.
  ///
  /// In en, this message translates to:
  /// **'Contact Support'**
  String get contactSupport;

  /// No description provided for @getHelpFromUs.
  ///
  /// In en, this message translates to:
  /// **'Get help from us'**
  String get getHelpFromUs;

  /// No description provided for @networkStatus.
  ///
  /// In en, this message translates to:
  /// **'Network Status'**
  String get networkStatus;

  /// No description provided for @serviceStatus.
  ///
  /// In en, this message translates to:
  /// **'Service status'**
  String get serviceStatus;

  /// No description provided for @aboutpup.
  ///
  /// In en, this message translates to:
  /// **'About pup'**
  String get aboutpup;

  /// No description provided for @appInformation.
  ///
  /// In en, this message translates to:
  /// **'App information'**
  String get appInformation;

  /// No description provided for @secureDigitalBanking.
  ///
  /// In en, this message translates to:
  /// **'Secure digital banking made simple.'**
  String get secureDigitalBanking;

  /// No description provided for @iAgreeToThe.
  ///
  /// In en, this message translates to:
  /// **'I agree to the '**
  String get iAgreeToThe;

  /// No description provided for @or.
  ///
  /// In en, this message translates to:
  /// **'OR'**
  String get or;

  /// No description provided for @atLeast8Characters.
  ///
  /// In en, this message translates to:
  /// **'At least 8 characters'**
  String get atLeast8Characters;

  /// No description provided for @atLeastOneNumber.
  ///
  /// In en, this message translates to:
  /// **'At least one number'**
  String get atLeastOneNumber;

  /// No description provided for @atLeastOneUppercase.
  ///
  /// In en, this message translates to:
  /// **'At least one uppercase letter'**
  String get atLeastOneUppercase;

  /// No description provided for @atLeastOneLowercase.
  ///
  /// In en, this message translates to:
  /// **'At least one lowercase letter'**
  String get atLeastOneLowercase;

  /// No description provided for @atLeastOneSpecialChar.
  ///
  /// In en, this message translates to:
  /// **'At least one special character'**
  String get atLeastOneSpecialChar;

  /// No description provided for @passwordsMustMatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords must match'**
  String get passwordsMustMatch;

  /// No description provided for @savingsPlanCreatedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Savings plan created successfully!'**
  String get savingsPlanCreatedSuccess;

  /// No description provided for @areYouSurePauseSavings.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to pause this savings plan?'**
  String get areYouSurePauseSavings;

  /// No description provided for @areYouSureCompleteSavings.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to complete this savings plan? The funds will be transferred to your main account.'**
  String get areYouSureCompleteSavings;

  /// No description provided for @areYouSureDeleteSavings.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to delete this savings plan? This action cannot be undone.'**
  String get areYouSureDeleteSavings;

  /// No description provided for @approve.
  ///
  /// In en, this message translates to:
  /// **'Approve'**
  String get approve;

  /// No description provided for @reject.
  ///
  /// In en, this message translates to:
  /// **'Reject'**
  String get reject;

  /// No description provided for @activeLPOs.
  ///
  /// In en, this message translates to:
  /// **'Active LPOs'**
  String get activeLPOs;

  /// No description provided for @applyForLPO.
  ///
  /// In en, this message translates to:
  /// **'Apply for LPO'**
  String get applyForLPO;

  /// No description provided for @lpoDetails.
  ///
  /// In en, this message translates to:
  /// **'LPO Details'**
  String get lpoDetails;

  /// No description provided for @pleaseUploadLPODocument.
  ///
  /// In en, this message translates to:
  /// **'Please upload LPO document'**
  String get pleaseUploadLPODocument;

  /// No description provided for @chooseSupplier.
  ///
  /// In en, this message translates to:
  /// **'Choose a supplier'**
  String get chooseSupplier;

  /// No description provided for @escrowAccount.
  ///
  /// In en, this message translates to:
  /// **'Escrow Account'**
  String get escrowAccount;

  /// No description provided for @activeEscrows.
  ///
  /// In en, this message translates to:
  /// **'Active Escrows'**
  String get activeEscrows;

  /// No description provided for @createEscrow.
  ///
  /// In en, this message translates to:
  /// **'Create Escrow'**
  String get createEscrow;

  /// No description provided for @escrowDetails.
  ///
  /// In en, this message translates to:
  /// **'Escrow Details'**
  String get escrowDetails;

  /// No description provided for @buyer.
  ///
  /// In en, this message translates to:
  /// **'Buyer'**
  String get buyer;

  /// No description provided for @seller.
  ///
  /// In en, this message translates to:
  /// **'Seller'**
  String get seller;

  /// No description provided for @agent.
  ///
  /// In en, this message translates to:
  /// **'Agent'**
  String get agent;

  /// No description provided for @releaseConditions.
  ///
  /// In en, this message translates to:
  /// **'Release Conditions'**
  String get releaseConditions;

  /// No description provided for @releaseFunds.
  ///
  /// In en, this message translates to:
  /// **'Release Funds'**
  String get releaseFunds;

  /// No description provided for @escrowStatus.
  ///
  /// In en, this message translates to:
  /// **'Escrow Status'**
  String get escrowStatus;

  /// No description provided for @fundEscrow.
  ///
  /// In en, this message translates to:
  /// **'Fund Escrow'**
  String get fundEscrow;

  /// No description provided for @escrowType.
  ///
  /// In en, this message translates to:
  /// **'Escrow Type'**
  String get escrowType;

  /// No description provided for @propertyTransaction.
  ///
  /// In en, this message translates to:
  /// **'Property Transaction'**
  String get propertyTransaction;

  /// No description provided for @servicePayment.
  ///
  /// In en, this message translates to:
  /// **'Service Payment'**
  String get servicePayment;

  /// No description provided for @contractDeposit.
  ///
  /// In en, this message translates to:
  /// **'Contract Deposit'**
  String get contractDeposit;

  /// No description provided for @mortgageLoans.
  ///
  /// In en, this message translates to:
  /// **'Mortgage Loans'**
  String get mortgageLoans;

  /// No description provided for @applyForMortgage.
  ///
  /// In en, this message translates to:
  /// **'Apply for Mortgage'**
  String get applyForMortgage;

  /// No description provided for @mortgageCalculator.
  ///
  /// In en, this message translates to:
  /// **'Mortgage Calculator'**
  String get mortgageCalculator;

  /// No description provided for @mortgageDetails.
  ///
  /// In en, this message translates to:
  /// **'Mortgage Details'**
  String get mortgageDetails;

  /// No description provided for @propertyValue.
  ///
  /// In en, this message translates to:
  /// **'Property Value'**
  String get propertyValue;

  /// No description provided for @downPayment.
  ///
  /// In en, this message translates to:
  /// **'Down Payment'**
  String get downPayment;

  /// No description provided for @loanTerm.
  ///
  /// In en, this message translates to:
  /// **'Loan Term'**
  String get loanTerm;

  /// No description provided for @totalInterest.
  ///
  /// In en, this message translates to:
  /// **'Total Interest'**
  String get totalInterest;

  /// No description provided for @propertyAddress.
  ///
  /// In en, this message translates to:
  /// **'Property Address'**
  String get propertyAddress;

  /// No description provided for @propertyType.
  ///
  /// In en, this message translates to:
  /// **'Property Type'**
  String get propertyType;

  /// No description provided for @apartment.
  ///
  /// In en, this message translates to:
  /// **'Apartment'**
  String get apartment;

  /// No description provided for @house.
  ///
  /// In en, this message translates to:
  /// **'House'**
  String get house;

  /// No description provided for @commercial.
  ///
  /// In en, this message translates to:
  /// **'Commercial'**
  String get commercial;

  /// No description provided for @land.
  ///
  /// In en, this message translates to:
  /// **'Land'**
  String get land;

  /// No description provided for @educationLoans.
  ///
  /// In en, this message translates to:
  /// **'Education Loans'**
  String get educationLoans;

  /// No description provided for @applyForEducationLoan.
  ///
  /// In en, this message translates to:
  /// **'Apply for Education Loan'**
  String get applyForEducationLoan;

  /// No description provided for @educationLoanDetails.
  ///
  /// In en, this message translates to:
  /// **'Education Loan Details'**
  String get educationLoanDetails;

  /// No description provided for @institution.
  ///
  /// In en, this message translates to:
  /// **'Institution'**
  String get institution;

  /// No description provided for @courseOfStudy.
  ///
  /// In en, this message translates to:
  /// **'Course of Study'**
  String get courseOfStudy;

  /// No description provided for @studyLevel.
  ///
  /// In en, this message translates to:
  /// **'Study Level'**
  String get studyLevel;

  /// No description provided for @undergraduate.
  ///
  /// In en, this message translates to:
  /// **'Undergraduate'**
  String get undergraduate;

  /// No description provided for @postgraduate.
  ///
  /// In en, this message translates to:
  /// **'Postgraduate'**
  String get postgraduate;

  /// No description provided for @vocational.
  ///
  /// In en, this message translates to:
  /// **'Vocational'**
  String get vocational;

  /// No description provided for @tuitionFees.
  ///
  /// In en, this message translates to:
  /// **'Tuition Fees'**
  String get tuitionFees;

  /// No description provided for @livingExpenses.
  ///
  /// In en, this message translates to:
  /// **'Living Expenses'**
  String get livingExpenses;

  /// No description provided for @booksMaterials.
  ///
  /// In en, this message translates to:
  /// **'Books & Materials'**
  String get booksMaterials;

  /// No description provided for @agricultureLoans.
  ///
  /// In en, this message translates to:
  /// **'Agriculture Loans'**
  String get agricultureLoans;

  /// No description provided for @applyForAgriLoan.
  ///
  /// In en, this message translates to:
  /// **'Apply for Agriculture Loan'**
  String get applyForAgriLoan;

  /// No description provided for @agriLoanDetails.
  ///
  /// In en, this message translates to:
  /// **'Agriculture Loan Details'**
  String get agriLoanDetails;

  /// No description provided for @farmSize.
  ///
  /// In en, this message translates to:
  /// **'Farm Size'**
  String get farmSize;

  /// No description provided for @cropType.
  ///
  /// In en, this message translates to:
  /// **'Crop Type'**
  String get cropType;

  /// No description provided for @livestockType.
  ///
  /// In en, this message translates to:
  /// **'Livestock Type'**
  String get livestockType;

  /// No description provided for @equipment.
  ///
  /// In en, this message translates to:
  /// **'Equipment'**
  String get equipment;

  /// No description provided for @seeds.
  ///
  /// In en, this message translates to:
  /// **'Seeds'**
  String get seeds;

  /// No description provided for @fertilizer.
  ///
  /// In en, this message translates to:
  /// **'Fertilizer'**
  String get fertilizer;

  /// No description provided for @irrigation.
  ///
  /// In en, this message translates to:
  /// **'Irrigation'**
  String get irrigation;

  /// No description provided for @harvestSeason.
  ///
  /// In en, this message translates to:
  /// **'Harvest Season'**
  String get harvestSeason;

  /// No description provided for @farmLocation.
  ///
  /// In en, this message translates to:
  /// **'Farm Location'**
  String get farmLocation;

  /// No description provided for @applicationSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Application Submitted'**
  String get applicationSubmitted;

  /// No description provided for @applicationPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get applicationPending;

  /// No description provided for @applicationApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get applicationApproved;

  /// No description provided for @applicationRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get applicationRejected;

  /// No description provided for @applicationInReview.
  ///
  /// In en, this message translates to:
  /// **'In Review'**
  String get applicationInReview;

  /// No description provided for @viewApplication.
  ///
  /// In en, this message translates to:
  /// **'View Application'**
  String get viewApplication;

  /// No description provided for @submitApplication.
  ///
  /// In en, this message translates to:
  /// **'Submit Application'**
  String get submitApplication;

  /// No description provided for @calculatePayment.
  ///
  /// In en, this message translates to:
  /// **'Calculate Payment'**
  String get calculatePayment;

  /// No description provided for @paymentSchedule.
  ///
  /// In en, this message translates to:
  /// **'Payment Schedule'**
  String get paymentSchedule;

  /// No description provided for @nextPayment.
  ///
  /// In en, this message translates to:
  /// **'Next Payment'**
  String get nextPayment;

  /// No description provided for @totalAmount.
  ///
  /// In en, this message translates to:
  /// **'Total Amount'**
  String get totalAmount;

  /// No description provided for @remainingBalance.
  ///
  /// In en, this message translates to:
  /// **'Remaining Balance'**
  String get remainingBalance;

  /// No description provided for @loanPurpose.
  ///
  /// In en, this message translates to:
  /// **'Loan Purpose'**
  String get loanPurpose;

  /// No description provided for @createAccountInSteps.
  ///
  /// In en, this message translates to:
  /// **'Create your account in 3 easy steps'**
  String get createAccountInSteps;

  /// No description provided for @bankGradeSecurity.
  ///
  /// In en, this message translates to:
  /// **'Bank-Grade Security'**
  String get bankGradeSecurity;

  /// No description provided for @pleaseEnterFirstName.
  ///
  /// In en, this message translates to:
  /// **'Please enter your first name'**
  String get pleaseEnterFirstName;

  /// No description provided for @pleaseEnterLastName.
  ///
  /// In en, this message translates to:
  /// **'Please enter your last name'**
  String get pleaseEnterLastName;

  /// No description provided for @pleaseEnterBusinessName.
  ///
  /// In en, this message translates to:
  /// **'Please enter your business name (if business)'**
  String get pleaseEnterBusinessName;

  /// No description provided for @pleaseEnterEmail.
  ///
  /// In en, this message translates to:
  /// **'Please enter your email'**
  String get pleaseEnterEmail;

  /// No description provided for @pleaseEnterValidEmail.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid email address'**
  String get pleaseEnterValidEmail;

  /// No description provided for @pleaseEnterPhoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Please enter your phone number'**
  String get pleaseEnterPhoneNumber;

  /// No description provided for @pleaseEnterValidPhoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid phone number'**
  String get pleaseEnterValidPhoneNumber;

  /// No description provided for @pleaseEnterValidNigerianNumber.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid Nigerian phone number'**
  String get pleaseEnterValidNigerianNumber;

  /// No description provided for @pleaseEnterPassword.
  ///
  /// In en, this message translates to:
  /// **'Please enter your password'**
  String get pleaseEnterPassword;

  /// No description provided for @stepPersonal.
  ///
  /// In en, this message translates to:
  /// **'Personal'**
  String get stepPersonal;

  /// No description provided for @stepContact.
  ///
  /// In en, this message translates to:
  /// **'Contact'**
  String get stepContact;

  /// No description provided for @stepSecurity.
  ///
  /// In en, this message translates to:
  /// **'Security'**
  String get stepSecurity;

  /// No description provided for @voiceBanking.
  ///
  /// In en, this message translates to:
  /// **'Voice Banking'**
  String get voiceBanking;

  /// No description provided for @voiceBankingSub.
  ///
  /// In en, this message translates to:
  /// **'Use voice commands to manage your account'**
  String get voiceBankingSub;

  /// No description provided for @transferPending.
  ///
  /// In en, this message translates to:
  /// **'Transfer Pending'**
  String get transferPending;

  /// No description provided for @transactionDetails.
  ///
  /// In en, this message translates to:
  /// **'Transaction Details'**
  String get transactionDetails;

  /// No description provided for @senderInformation.
  ///
  /// In en, this message translates to:
  /// **'Sender Information'**
  String get senderInformation;

  /// No description provided for @recipientInformation.
  ///
  /// In en, this message translates to:
  /// **'Recipient Information'**
  String get recipientInformation;

  /// No description provided for @transactionInformation.
  ///
  /// In en, this message translates to:
  /// **'Transaction Information'**
  String get transactionInformation;

  /// No description provided for @name.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get name;

  /// No description provided for @bank.
  ///
  /// In en, this message translates to:
  /// **'Bank'**
  String get bank;

  /// No description provided for @failedToLoadReceipt.
  ///
  /// In en, this message translates to:
  /// **'Failed to Load Receipt'**
  String get failedToLoadReceipt;

  /// No description provided for @referenceCopied.
  ///
  /// In en, this message translates to:
  /// **'Reference copied to clipboard'**
  String get referenceCopied;

  /// No description provided for @copiedToClipboard.
  ///
  /// In en, this message translates to:
  /// **'Copied to clipboard'**
  String get copiedToClipboard;

  /// No description provided for @downloadFeatureComingSoon.
  ///
  /// In en, this message translates to:
  /// **'Download feature coming soon'**
  String get downloadFeatureComingSoon;

  /// No description provided for @welcomeMessage.
  ///
  /// In en, this message translates to:
  /// **'Welcome to {appName}'**
  String welcomeMessage(String appName);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'ha', 'ig', 'yo'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'ha':
      return AppLocalizationsHa();
    case 'ig':
      return AppLocalizationsIg();
    case 'yo':
      return AppLocalizationsYo();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
