import 'dart:ui';
import 'models/education_loan_application.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:mobile_app/services/savings_service.dart';
import 'package:mobile_app/screens/customer_screens/loans/loan_details_screen.dart';
import 'package:mobile_app/screens/customer_screens/loans/loans_application_screen.dart';
import 'package:mobile_app/screens/customer_screens/loans/active_loans_screen.dart';
import 'package:mobile_app/screens/customer_screens/lpos/lpo_application_screen.dart';
// BNPL screens
import 'screens/bnpl/bnpl_list_screen.dart' as bnpl;
import 'screens/bnpl/bnpl_apply_screen.dart' as bnpl;
import 'screens/bnpl/bnpl_details_screen.dart' as bnpl;
// Trade Finance screens
import 'screens/trade_finance/trade_finance_dashboard_screen.dart' as tf;
import 'screens/trade_finance/lc_list_screen.dart' as tf;
import 'screens/trade_finance/lc_apply_screen.dart' as tf;
import 'screens/trade_finance/lc_details_screen.dart' as tf;
import 'screens/trade_finance/bank_guarantee_list_screen.dart' as tf;
import 'screens/trade_finance/bank_guarantee_apply_screen.dart' as tf;
import 'screens/trade_finance/factoring_list_screen.dart' as tf;
import 'screens/trade_finance/factoring_apply_screen.dart' as tf;
import 'models/trade_finance.dart' as tf_models;
// Education banking screens (single import with prefix to avoid ambiguity)
import 'screens/education_banking/education_loan_detail_screen.dart' as edu_loan_detail;
import 'screens/education_banking/education_loan_list_screen.dart' as edu_banking;
import 'screens/education_banking/education_loan_apply_screen.dart' as edu_banking;
import 'package:mobile_app/screens/customer_screens/lpos/lpo_details_screen.dart';
import 'package:mobile_app/screens/customer_screens/lpos/active_lpos_screen.dart';
import 'package:mobile_app/screens/customer_screens/qrcode/qrcode_screen.dart';
import 'package:mobile_app/screens/customer_screens/transaction/transaction_history.dart';
import 'package:mobile_app/screens/customer_screens/pin/create_pin.dart';
import 'package:mobile_app/screens/customer_screens/pin/forgot_pin.dart';
import 'package:mobile_app/screens/customer_screens/pin/pin_created.dart';
import 'package:mobile_app/screens/customer_screens/pin/input_pin.dart';
import 'package:mobile_app/screens/customer_screens/otp/login_otp.dart';
import 'package:mobile_app/screens/customer_screens/face_verification/face_verification_screen.dart';
import 'package:mobile_app/screens/customer_screens/face_verification/face_scanning_screen.dart';
import 'package:mobile_app/screens/customer_screens/face_verification/face_verification_sucess.dart';
import 'package:mobile_app/screens/customer_screens/cards/card_screen.dart';
import 'package:mobile_app/screens/customer_screens/carbon_credits/carbon_credits_screen.dart';
import 'package:mobile_app/screens/customer_screens/disputes/disputes_list_screen.dart';
import 'package:mobile_app/screens/customer_screens/settings/support_screen.dart';
import 'package:mobile_app/screens/customer_screens/settings/faq_screen.dart';
import 'package:mobile_app/screens/customer_screens/settings/network_monitor_screen.dart';
import 'package:mobile_app/screens/customer_screens/savings/savings_list_screen.dart';
import 'package:mobile_app/screens/customer_screens/credit/credits_rewards_screen.dart';
import 'package:mobile_app/screens/customer_screens/transaction/receipt_screen.dart';
import 'package:mobile_app/screens/customer_screens/transaction/bank_statement_screen.dart';
import 'package:mobile_app/screens/customer_screens/transfers/transfer_receipt_screen.dart';
import 'package:mobile_app/screens/customer_screens/account/complete_profile_screen.dart';
import 'package:mobile_app/screens/customer_screens/account/bvn_screen.dart';
import 'package:mobile_app/screens/auth/password_created_screen.dart';
import 'package:mobile_app/screens/auth/email_otp_screen.dart';
import 'package:mobile_app/screens/onboarding/onboarding_start_screen.dart';
import 'package:mobile_app/screens/onboarding/account_type_screen.dart';
import 'package:mobile_app/screens/onboarding/business_details_screen.dart';
import 'package:mobile_app/screens/onboarding/bvn_verification_screen.dart';
import 'package:mobile_app/screens/onboarding/document_upload_screen.dart';
import 'package:mobile_app/screens/onboarding/address_verification_screen.dart';
import 'package:mobile_app/screens/onboarding/onboarding_completion_screen.dart';
import 'package:mobile_app/screens/onboarding/kyc_complete_success_screen.dart';
import 'package:provider/provider.dart';
import 'package:mobile_app/screens/customer_screens/fx/fx_screen.dart';
import 'package:mobile_app/screens/customer_screens/pensions/pensions_screen.dart';
import 'package:mobile_app/screens/customer_screens/investments/investments_screen.dart';
import 'dart:async';
import 'package:mobile_app/l10n/app_localizations.dart';
import 'package:mobile_app/l10n/fallback_material_localizations.dart';

// Services
import 'services/api_service.dart';
import 'services/cheque_service.dart';
import 'services/connectivity_service.dart';
import 'services/scheduled_payment_service.dart';

// Configuration

// Providers
import 'providers/auth_provider.dart';
import 'providers/wallet_provider.dart';
import 'providers/tier_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/tenant_provider.dart';
import 'providers/savings_provider.dart';
import 'providers/dispute_provider.dart';
import 'providers/account_provider.dart';
import 'providers/cheque_provider.dart';
import 'providers/scheduled_payment_provider.dart';
import 'providers/language_provider.dart';
import 'providers/voice_banking_provider.dart';
import 'providers/education_loan_provider.dart';

// Screens
import 'screens/splash_screen.dart';

// Auth Screens
import 'screens/auth/premium_login_screen.dart';
// import 'screens/auth/register_screen.dart'; // Deprecated - using multi-step registration
import 'screens/auth/register_step1_screen.dart';
import 'screens/auth/register_step2_screen.dart';
import 'screens/auth/register_step3_screen.dart';
import 'screens/auth/forgot_password_screen.dart';
import 'screens/auth/reset_password_screen.dart';
import 'screens/auth/change_password_screen.dart';
import 'models/registration_data.dart';

// Other Screens
import 'screens/customer_screens/dashboard/main_navigation_screen.dart';
import 'screens/customer_screens/dashboard/more_actions_screen.dart';
import 'screens/customer_screens/settings/settings_screen.dart';
import 'screens/customer_screens/settings/language_selection_screen.dart';
import 'screens/customer_screens/transfers/transfer_screen.dart';
import 'screens/customer_screens/transfers/bulk_transfer_screen.dart';
import 'screens/customer_screens/notification/notification_screen.dart';
import 'screens/customer_screens/accounts/add_account_screen.dart';
import 'screens/customer_screens/cheques/cheques_screen.dart';
import 'screens/customer_screens/scheduled_payments/scheduled_payments_screen.dart';
import 'screens/customer_screens/bills/bill_payment_screen.dart';
import 'screens/customer_screens/insurance/insurance_screen.dart';
import 'screens/customer_screens/voice_banking/voice_assistant_screen.dart';
import 'screens/customer_screens/escrow/escrow_list_screen.dart';
import 'screens/customer_screens/mortgage/mortgage_list_screen.dart';
import 'screens/customer_screens/agriculture/agriculture_dashboard_screen.dart';
import 'screens/customer_screens/agriculture/agri_evoucher_screen.dart';
import 'screens/customer_screens/agriculture/agri_input_marketplace_screen.dart';
import 'screens/customer_screens/agriculture/agri_iot_sensor_screen.dart';
import 'screens/customer_screens/agriculture/agri_logistics_screen.dart';
import 'screens/customer_screens/agriculture/agri_reinsurance_screen.dart';
import 'screens/customer_screens/agriculture/agri_savings_cycles_screen.dart';
import 'screens/customer_screens/agriculture/agri_esg_impact_screen.dart';
import 'screens/customer_screens/agriculture/animal_id_traceability_screen.dart';
import 'screens/customer_screens/agriculture/area_yield_index_insurance_screen.dart';
import 'screens/customer_screens/agriculture/cbn_anchor_borrowers_screen.dart';
import 'screens/customer_screens/agriculture/cooperative_credit_scoring_screen.dart';
import 'screens/customer_screens/agriculture/cooperative_financials_screen.dart';
import 'screens/customer_screens/agriculture/cooperative_management_screen.dart';
import 'screens/customer_screens/agriculture/cooperative_meetings_screen.dart';
import 'screens/customer_screens/agriculture/crop_yield_prediction_screen.dart';
import 'screens/customer_screens/agriculture/farm_boundary_mapping_screen.dart';
import 'screens/customer_screens/agriculture/livestock_finance_screen.dart';
import 'screens/customer_screens/agriculture/livestock_insurance_screen.dart';
import 'screens/customer_screens/agriculture/livestock_management_screen.dart';
import 'screens/customer_screens/agriculture/multi_peril_crop_insurance_screen.dart';
import 'screens/customer_screens/agriculture/nirsal_agro_geocoop_screen.dart';
import 'screens/customer_screens/agriculture/nirsal_credit_guarantee_screen.dart';
import 'screens/customer_screens/agriculture/satellite_crop_monitor_screen.dart';
import 'screens/customer_screens/agriculture/soil_analysis_screen.dart';
import 'screens/customer_screens/agriculture/fisheries_aquaculture_screen.dart';
import 'screens/customer_screens/agriculture/equipment_leasing_apply_screen.dart';
import 'screens/customer_screens/loans/project_finance_apply_screen.dart';
import 'screens/customer_screens/diaspora/diaspora_banking_screen.dart';
import 'screens/customer_screens/cbdc/enaira_cbdc_screen.dart';
import 'screens/customer_screens/wealth/wealth_mgmt_screen.dart';
import 'screens/customer_screens/remittance/remittance_screen.dart';
import 'screens/customer_screens/voice_banking/voice_asr_nigerian_screen.dart';
import 'screens/customer_screens/voice_banking/voice_tts_nigerian_screen.dart';
import 'screens/customer_screens/voice_banking/voice_biometric_auth_screen.dart';
import 'screens/customer_screens/biometric/biometric_enrollment_screen.dart';
import 'screens/customer_screens/open_banking/open_banking_consent_screen.dart';
import 'screens/customer_screens/voice_banking/voice_ivr_menu_screen.dart';
import 'screens/customer_screens/voice_banking/voice_nlu_banking_screen.dart';
import 'screens/customer_screens/voice_banking/voice_banking_gateway_screen.dart';
import 'screens/customer_screens/voice_banking/voice_agent_escalation_screen.dart';

import 'screens/customer_screens/esusu/esusu_screen.dart';
import 'screens/customer_screens/van/van_management_screen.dart';
import 'screens/customer_screens/islamic_banking/islamic_banking_screen.dart';
import 'screens/customer_screens/islamic_banking/murabaha_screen.dart';
import 'screens/customer_screens/islamic_banking/musharaka_screen.dart';
import 'screens/customer_screens/islamic_banking/ijara_screen.dart';
import 'screens/customer_screens/islamic_banking/takaful_screen.dart';
import 'screens/customer_screens/islamic_banking/sukuk_screen.dart';

void main() async {
  // Wrap everything in error handling
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();

    // Initialize Firebase - COMMENTED OUT until properly configured
    // await Firebase.initializeApp();

    // Initialize notification service
    // await NotificationService().initialize();

    // Initialize tenant provider with error handling and timeout
    final tenantProvider = TenantProvider();

    try {
      // Add a timeout to prevent hanging forever
      await tenantProvider.initialize().timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          debugPrint('⚠️ Tenant initialization timed out - using defaults');
          // Continue with default values instead of hanging
        },
      );
      debugPrint('✅ Tenant provider initialized successfully');
    } catch (e) {
      debugPrint('⚠️ Tenant initialization error: $e - using defaults');
      // Continue with default values instead of crashing
    }
    FlutterError.onError = (FlutterErrorDetails details) {
      FlutterError.presentError(details);
      print('🔴 FLUTTER ERROR: ${details.exception}');
      print('🔴 STACK: ${details.stack}');
    };

    // Also catch async errors
    PlatformDispatcher.instance.onError = (error, stack) {
      print('🔴 PLATFORM ERROR: $error');
      print('🔴 STACK: $stack');
      return true;
    };

    runApp(FiveFourBankApp(tenantProvider: tenantProvider));
  }, (error, stack) {
    debugPrint('❌ Fatal error in main: $error');
    debugPrint('Stack trace: $stack');
  });
}

class FiveFourBankApp extends StatelessWidget {
  final TenantProvider tenantProvider;

  const FiveFourBankApp({super.key, required this.tenantProvider});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: tenantProvider),
        ChangeNotifierProvider(create: (_) => ConnectivityService()),
        Provider<ApiService>(create: (_) => ApiService()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) {
          final authProvider = AuthProvider();
          WidgetsBinding.instance.addPostFrameCallback((_) {
            authProvider.initialize();
          });
          return authProvider;
        }),
        ChangeNotifierProvider(create: (_) => WalletProvider()),
        ChangeNotifierProvider(create: (_) => TierProvider()),
        ChangeNotifierProvider(create: (_) => EducationLoanProvider()),
        ChangeNotifierProvider(create: (_) => LanguageProvider()),
        ChangeNotifierProvider(
            create: (_) => SavingsProvider(SavingsService(ApiService()))),
        ChangeNotifierProvider(create: (_) => DisputeProvider()),
        ChangeNotifierProvider(create: (_) => AccountProvider(ApiService())),
        ChangeNotifierProvider(
            create: (_) => ChequeProvider(ChequeService(ApiService()))),
        ChangeNotifierProvider(
            create: (_) => ScheduledPaymentProvider(
                ScheduledPaymentService(ApiService()))),
        // Voice Banking Provider - configured to use mock dats
       
          ChangeNotifierProvider(create: (_) => VoiceBankingProvider()),
      ],
      child: Consumer3<ThemeProvider, TenantProvider, LanguageProvider>(
        builder: (context, themeProvider, tenantProvider, languageProvider, _) {
          // Update theme with tenant sonfiguration after build completes
          WidgetsBinding.instance.addPostFrameCallback((_) {
            try {
              themeProvider.updateTenantConfig(tenantProvider.tenantConfig);
            } catch (e) {
              debugPrint('⚠️ Error updating tenant config: $e');
            }
          });

          return MaterialApp(
            title: tenantProvider.appName,

            // Localization configuration
            locale: languageProvider.locale,
            supportedLocales: const [
              Locale('en'), // English - has Material translations
              Locale('ig'), // Igbo - app translations only
              Locale('yo'), // Yoruba - app translations only
              Locale('ha'), // Hausa - app translations only
            ],
            localizationsDelegates: const [
              AppLocalizations.delegate,
              FallbackMaterialLocalizationsDelegate(),
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            localeResolutionCallback: (locale, supportedLocales) {
              // Return the requested locale if supported
              // Material widgets will fall back to English automatically for ig, yo, ha
              // since they don't have Material translations, but our app content
              // will still use the correct language via AppLocalizations
              if (locale != null) {
                for (var supportedLocale in supportedLocales) {
                  if (supportedLocale.languageCode == locale.languageCode) {
                    return supportedLocale;
                  }
                }
              }
              return const Locale('en');
            },

            debugShowCheckedModeBanner: false,
            theme: themeProvider.lightTheme,
            darkTheme: themeProvider.darkTheme,
            themeMode: themeProvider.themeMode,

            initialRoute: '/',

            routes: {
              '/': (context) => const SplashScreen(),
              '/active-loans': (context) => const ActiveLoansScreen(),
              '/active-lpos': (context) => const ActiveLPOsScreen(),
              '/add-account': (context) => const AddAccountScreen(),
              '/bank-statement': (context) => const BankStatementScreen(),
              '/bills': (context) => const BillPaymentScreen(),
              '/bvn': (context) => const BvnScreen(),
              '/bvn-verification': (context) => const BvnVerificationScreen(),
              '/carbon-credits': (context) => const CarbonCreditsScreen(),
              '/cards': (context) => const CardScreen(),
              '/cheques': (context) => const ChequesScreen(),
              '/complete-profile': (context) => const CompleteProfileScreen(),
              '/create-pin': (context) {
                final args = ModalRoute.of(context)?.settings.arguments
                    as Map<String, dynamic>?;
                final isOnboarding = args?['isOnboarding'] == true;
                return CreatePinScreen(isOnboarding: isOnboarding);
              },
              '/dashboard': (context) => const MainNavigationScreen(),
              '/bnpl': (context) => const bnpl.BNPLListScreen(),
              '/bnpl/apply': (context) => const bnpl.BNPLApplyScreen(),
              '/bnpl/details': (context) {
                final app = ModalRoute.of(context)?.settings.arguments;
                return bnpl.BNPLDetailsScreen(application: app as dynamic);
              },
              '/trade-finance': (context) => const tf.TradeFinanceDashboardScreen(),
              '/trade-finance/lc': (context) => const tf.LCListScreen(),
              '/trade-finance/lc/apply': (context) => const tf.LCApplyScreen(),
              '/trade-finance/lc/details': (context) {
                final lc = ModalRoute.of(context)?.settings.arguments;
                return tf.LCDetailsScreen(lc: lc as tf_models.LetterOfCredit);
              },
              '/trade-finance/bank-guarantees': (context) => const tf.BankGuaranteeListScreen(),
              '/trade-finance/bank-guarantees/apply': (context) => const tf.BankGuaranteeApplyScreen(),
              '/trade-finance/factoring': (context) => const tf.FactoringListScreen(),
              '/trade-finance/factoring/apply': (context) => const tf.FactoringApplyScreen(),
              '/education-loans': (context) => const edu_banking.EducationLoanListScreen(),
              '/education-loan/apply': (context) => const edu_banking.EducationLoanApplyScreen(),
              '/education-loan/detail': (context) {
                final app = ModalRoute.of(context)?.settings.arguments;
                return edu_loan_detail.EducationLoanDetailScreen(application: app as EducationLoanApplication);
              },
              '/disputes': (context) => const DisputesListScreen(),
              '/email-otp': (context) => const EmailOtpScreen(),
              '/face-scan': (context) => const FaceScanningScreen(),
              '/face-verification': (context) => const FaceVerificationScreen(),
              '/face-verification-success': (context) =>
                  const FaceVerificationSuccessScreen(),
              '/faq': (context) => const FaqScreen(),
              '/forgot-password': (context) => const ForgotPasswordScreen(),
              '/reset-password': (context) => const ResetPasswordScreen(),
              '/change-password': (context) => const ChangePasswordScreen(),
              '/forgot-pin': (context) => const ForgotPinScreen(),
              '/fx': (context) => const FXScreen(),
              '/insurance': (context) => const InsuranceScreen(),
              '/input-pin': (context) => const InputPinScreen(),
              '/investments': (context) => const InvestmentsScreen(),
              '/kyc-address': (context) => const AddressVerificationScreen(),
              '/kyc-complete-success': (context) =>
                  const KycCompleteSuccessScreen(),
              '/kyc-documents': (context) => const DocumentUploadScreen(),
              '/kyc-face-verification': (context) =>
                  const FaceVerificationScreen(),
              '/language-selection': (context) =>
                  const LanguageSelectionScreen(),
              '/loan-Application': (context) => const LoansApplicationScreen(),
              '/loan-details': (context) =>
                  const LoanApplicationDetailsScreen(),
              '/project-finance/apply': (context) =>
                  const ProjectFinanceApplyScreen(),
              '/login': (context) => const PremiumLoginScreen(),
              '/login-otp': (context) => const LoginOtpScreen(),
              '/lpo-application': (context) => const LPOApplicationScreen(),
              '/lpo-details': (context) {
                final args = ModalRoute.of(context)!.settings.arguments
                    as Map<String, dynamic>;
                final lpoId = args['lpoId'];
                return LPODetailsScreen(
                    lpoId: lpoId is String ? lpoId : lpoId.toString());
              },
              '/more-actions': (context) => const MoreActionsScreen(),
              '/network-monitor': (context) => const NetworkMonitorScreen(),
              '/notifications': (context) => const NotificationScreen(),
              '/onboarding-account-type': (context) =>
                  const AccountTypeScreen(),
              '/business-details': (context) => const BusinessDetailsScreen(),
              '/onboarding-address': (context) =>
                  const AddressVerificationScreen(),
              '/onboarding-completion': (context) =>
                  const OnboardingCompletionScreen(),
              '/onboarding-start': (context) => const OnboardingStartScreen(),
              '/password-created': (context) => const PasswordCreatedScreen(),
              '/pensions': (context) => const PensionsScreen(),
              '/pin-created': (context) {
                final args = ModalRoute.of(context)?.settings.arguments
                    as Map<String, dynamic>?;
                final isOnboarding = args?['isOnboarding'] == true;
                return PinSuccessScreen(isOnboarding: isOnboarding);
              },
              '/qrcode': (context) => const QRCodeScreen(),
              '/receipt': (context) => const ReceiptScreen(),
              '/register': (context) => const RegisterStep1Screen(),
              '/register-step1': (context) {
                final args = ModalRoute.of(context)?.settings.arguments as RegistrationData?;
                return RegisterStep1Screen(initialData: args);
              },
              '/register-step2': (context) {
                final data = ModalRoute.of(context)?.settings.arguments as RegistrationData;
                return RegisterStep2Screen(registrationData: data);
              },
              '/register-step3': (context) {
                final data = ModalRoute.of(context)?.settings.arguments as RegistrationData;
                return RegisterStep3Screen(registrationData: data);
              },
              '/rewards': (context) => const RewardsScreen(),
              '/savings': (context) => const SavingsListScreen(),
              '/escrow': (context) => const EscrowListScreen(),
              '/mortgage': (context) => const MortgageListScreen(),
              '/agriculture': (context) => AgricultureDashboardScreen(),
              '/agriculture/evoucher': (context) => const AgriEvoucherScreen(),
              '/agriculture/input-marketplace': (context) => const AgriInputMarketplaceScreen(),
              '/agriculture/iot-sensors': (context) => const AgriIotSensorScreen(),
              '/agriculture/logistics': (context) => const AgriLogisticsScreen(),
              '/agriculture/reinsurance': (context) => const AgriReinsuranceScreen(),
              '/agriculture/savings-cycles': (context) => const AgriSavingsCyclesScreen(),
              '/agriculture/esg-impact': (context) => const AgriEsgImpactScreen(),
              '/agriculture/animal-id': (context) => const AnimalIdTraceabilityScreen(),
              '/agriculture/area-yield-insurance': (context) => const AreaYieldIndexInsuranceScreen(),
              '/agriculture/cbn-anchor-borrowers': (context) => const CbnAnchorBorrowersScreen(),
              '/agriculture/cooperative-credit-scoring': (context) => const CooperativeCreditScoringScreen(),
              '/agriculture/cooperative-financials': (context) => const CooperativeFinancialsScreen(),
              '/agriculture/cooperative-management': (context) => const CooperativeManagementScreen(),
              '/agriculture/cooperative-meetings': (context) => const CooperativeMeetingsScreen(),
              '/agriculture/crop-yield-prediction': (context) => const CropYieldPredictionScreen(),
              '/agriculture/farm-boundary-mapping': (context) => const FarmBoundaryMappingScreen(),
              '/agriculture/livestock-finance': (context) => const LivestockFinanceScreen(),
              '/agriculture/livestock-insurance': (context) => const LivestockInsuranceScreen(),
              '/agriculture/livestock-management': (context) => const LivestockManagementScreen(),
              '/agriculture/multi-peril-insurance': (context) => const MultiPerilCropInsuranceScreen(),
              '/agriculture/nirsal-geocoop': (context) => const NirsalAgroGeocoopScreen(),
              '/agriculture/nirsal-credit-guarantee': (context) => const NirsalCreditGuaranteeScreen(),
              '/agriculture/satellite-monitor': (context) => const SatelliteCropMonitorScreen(),
              '/agriculture/soil-analysis': (context) => const SoilAnalysisScreen(),
              '/agriculture/fisheries': (context) => const FisheriesAquacultureScreen(),
              '/equipment-leasing/apply': (context) =>
                  const EquipmentLeasingApplyScreen(),
              '/diaspora-banking': (context) => const DiasporaBankingScreen(),
              '/cbdc': (context) => const EnairaCbdcScreen(),
              '/wealth-management': (context) => const WealthMgmtScreen(),
              '/remittance': (context) => const RemittanceScreen(),
              '/voice-asr': (context) => const VoiceAsrNigerianScreen(),
              '/voice-tts': (context) => const VoiceTtsNigerianScreen(),
              '/voice-biometric': (context) => const VoiceBiometricAuthScreen(),
              '/biometric-enrollment': (context) => const BiometricEnrollmentScreen(),
              '/settings/open-banking': (context) => const OpenBankingConsentScreen(),
              '/voice-ivr': (context) => const VoiceIvrMenuScreen(),
              '/voice-nlu': (context) => const VoiceNluBankingScreen(),
              '/voice-gateway': (context) => const VoiceBankingGatewayScreen(),
              '/voice-escalation': (context) => const VoiceAgentEscalationScreen(),

              // Example usage: To navigate to the farms list or registration screens from anywhere in your app, use:
              // Navigator.pushNamed(context, '/agriculture/farms');
              // Navigator.pushNamed(context, '/agriculture/farm-registration');

              // You can add a button in your agriculture dashboard or menu:
              // ElevatedButton(
              //   onPressed: () => Navigator.pushNamed(context, '/agriculture/farms'),
              //   child: Text('View Farms'),
              // )
              // ElevatedButton(
              //   onPressed: () => Navigator.pushNamed(context, '/agriculture/farm-registration'),
              //   child: Text('Register Farm'),
              // )
              // Don't forget to import the new screens at the top:
              
              '/esusu': (context) => const EsusuScreen(),
              '/islamic-banking': (context) => const IslamicBankingScreen(),
              '/islamic-banking/murabaha': (context) => const MurabahaScreen(),
              '/islamic-banking/musharaka': (context) => const MusharakaScreen(),
              '/islamic-banking/ijara': (context) => const IjaraScreen(),
              '/islamic-banking/takaful': (context) => const TakafulScreen(),
              '/islamic-banking/sukuk': (context) => const SukukScreen(),
              '/van': (context) => const VANManagementScreen(),
              '/scheduled-payments': (context) =>
                  const ScheduledPaymentsScreen(),
              '/settings': (context) => const SettingsScreen(),
              '/support': (context) => const SupportScreen(),
              '/transaction-history': (context) =>
                  const TransactionHistoryScreen(),
              '/transfer': (context) => const TransferScreen(),
              '/bulk-transfer': (context) => const BulkTransferScreen(),
              '/transfer-receipt': (context) {
                final transactionReference = ModalRoute.of(context)!.settings.arguments
                    as String;
                return TransferReceiptScreen(transactionReference: transactionReference);
              },
              '/voice-assistant': (context) => const VoiceAssistantScreen(),
            },
          );
        },
      ),
    );
  }
}
