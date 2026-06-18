import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;
import '../../../config/app_theme.dart';
import '../../../providers/wallet_provider.dart';
import '../../../providers/tenant_provider.dart';
import '../../../utils/tenant_utils.dart';
import '../../../services/payment_service.dart';
import '../../../services/api_service.dart';
import '../../../services/tenant_service.dart';
import 'package:provider/provider.dart';

class QRCodeScreen extends StatefulWidget {
  const QRCodeScreen({super.key});

  @override
  State<QRCodeScreen> createState() => _QRCodeScreenState();
}

class _QRCodeScreenState extends State<QRCodeScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  
  // For Generate QR Tab
  final PaymentService _paymentService = PaymentService(ApiService());
  final _amountController = TextEditingController();
  final _noteController = TextEditingController();
  String _currency = 'NGN';
  String? _generatedQRData;
  bool _isGenerating = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  void _shareAccountDetails(String accountNumber, String accountName) {
    Share.share(
      'My pup Account Details:\n\n'
      'Account Number: $accountNumber\n'
      'Account Name: $accountName\n'
      'Bank: pup',
      subject: 'pup Account Details',
    );
  }

  @override
  Widget build(BuildContext context) {
    final walletProvider = context.watch<WalletProvider>();
    final wallet = walletProvider.wallet;
    final accountNumber = wallet?.accountNumber ?? '';
    final accountName = wallet?.userId ?? 'Unknown User';

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        backgroundColor: AppTheme.getCardBackground(context),
        elevation: 0,
        title: Text(
          'QR Code',
          style: TextStyle(
            color: AppTheme.getTextPrimary(context),
            fontWeight: FontWeight.w600,
          ),
        ),
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back,
            color: AppTheme.getTextPrimary(context),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: Icon(
              Icons.share_outlined,
              color: AppTheme.getTextPrimary(context),
            ),
            onPressed: () => _shareAccountDetails(accountNumber, accountName),
            tooltip: 'Share',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Tab Bar
            Container(
              color: AppTheme.getCardBackground(context),
              child: Consumer<TenantProvider>(
                builder: (context, tenantProvider, _) {
                  return TabBar(
                    controller: _tabController,
                    labelColor: tenantProvider.primaryColor,
                    unselectedLabelColor: AppTheme.getTextSecondary(context),
                    indicatorColor: tenantProvider.primaryColor,
                    indicatorWeight: 3,
                    labelStyle: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                    tabs: const [
                      Tab(text: 'My QR Code'),
                      Tab(text: 'Scan QR'),
                    ],
                  );
                },
              ),
            ),

            // Tab Content
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  // My QR Code Tab
                  _buildMyQRCodeTab(accountNumber, accountName),

                  // Scan QR Tab
                  _buildScanQRTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _generateQRCode() async {
    if (_amountController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter an amount'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    final amount = double.tryParse(_amountController.text);
    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid amount'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isGenerating = true);

    final walletProvider = context.read<WalletProvider>();
    final accountNumber = walletProvider.wallet?.accountNumber ?? '';

    try {
      final response = await _paymentService.generateQR(
        recipient: accountNumber,
        amount: amount,
        currency: _currency,
        note: _noteController.text.trim(),
      );

      if (response['success'] == true) {
        // Response structure: { "message": "success", "qr_code_data": "base64_image" }
        // The qr_code_data is a base64 encoded PNG image
        final qrCodeData = response['data']?['qr_code_data'] ?? response['qr_code_data'];
        
        // Get tenant ID and account ID for QR code JSON
        final tenantId = await TenantService.getTenantId() ?? 'pup';
        String? accountId;
        if (kIsWeb) {
          accountId = html.window.localStorage['account_id'];
          if (accountId == null) {
            final accountJson = html.window.localStorage['account'];
            if (accountJson != null) {
              final accountData = jsonDecode(accountJson);
              accountId = accountData['id']?.toString();
            }
          }
        } else {
          final prefs = await SharedPreferences.getInstance();
          accountId = prefs.getString('account_id');
          if (accountId == null) {
            final accountJson = prefs.getString('account');
            if (accountJson != null) {
              final accountData = jsonDecode(accountJson);
              accountId = accountData['id']?.toString();
            }
          }
        }
        
        // Construct QR code JSON data (this is what should be encoded in the QR code)
        // The API returns a base64 image, but we need the JSON data for the QR code
        final qrJson = {
          'recipient': accountNumber,
          'amount': amount.toString(),
          'currency': _currency,
          'note': _noteController.text.trim(),
          'expiry': DateTime.now().add(const Duration(days: 30)).toIso8601String(),
          'signature': qrCodeData ?? '', // Use base64 as signature placeholder
          'tenant': tenantId,
          'ledger': int.tryParse(accountId ?? '1') ?? 1,
        };
        
        setState(() {
          // Store the JSON data to display as QR code
          _generatedQRData = jsonEncode(qrJson);
          _isGenerating = false;
        });
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('QR Code generated successfully'),
              backgroundColor: AppTheme.successColor,
            ),
          );
        }
      } else {
        setState(() => _isGenerating = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(response['message'] ?? 'Failed to generate QR'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      setState(() => _isGenerating = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Widget _buildMyQRCodeTab(String accountNumber, String accountName) {
    return Container(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            const SizedBox(height: 16),

            // Header with gradient background
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.blue.shade50.withOpacity(0.3),
                    Colors.purple.shade50.withOpacity(0.3),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  Text(
                    'Generate Payment QR Code',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.getTextPrimary(context),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Enter payment details to generate QR code',
                    style: TextStyle(
                      fontSize: 16,
                      color: AppTheme.getTextSecondary(context),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Input Fields with enhanced shadow
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.getCardBackground(context),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
                border: Border.all(
                  color: AppTheme.getBorderColor(context).withOpacity(0.5),
                  width: 1,
                ),
              ),
            child: Column(
              children: [
                // Amount Input
                TextField(
                  controller: _amountController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Amount',
                    prefixIcon: const Icon(Icons.attach_money),
                    suffixText: _currency,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                
                // Currency Dropdown
                DropdownButtonFormField<String>(
                  initialValue: _currency,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: 'Currency',
                    prefixIcon: const Icon(Icons.money),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  items: ['NGN', 'USD', 'EUR', 'GBP'].map((currency) {
                    return DropdownMenuItem(
                      value: currency,
                      child: Text(currency),
                    );
                  }).toList(),
                  onChanged: (value) {
                    setState(() => _currency = value!);
                  },
                ),
                const SizedBox(height: 16),
                
                // Note Input
                TextField(
                  controller: _noteController,
                  decoration: InputDecoration(
                    labelText: 'Note (Optional)',
                    prefixIcon: const Icon(Icons.note),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  maxLines: 2,
                ),
                const SizedBox(height: 20),
                
                // Generate Button
                Consumer<TenantProvider>(
                  builder: (context, tenantProvider, _) {
                    return SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton.icon(
                        onPressed: _isGenerating ? null : _generateQRCode,
                        icon: _isGenerating
                            ? SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: TenantUtils.getContrastingTextColor(tenantProvider.primaryColor),
                                ),
                              )
                            : const Icon(Icons.qr_code),
                        label: Text(_isGenerating ? 'Generating...' : 'Generate QR Code'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: tenantProvider.primaryColor,
                          foregroundColor: TenantUtils.getContrastingTextColor(tenantProvider.primaryColor),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),

          if (_generatedQRData != null) ...[
            const SizedBox(height: 32),

            // Generated QR Code Container
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppTheme.getCardBackground(context),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: AppTheme.getBorderColor(context),
                  width: 1,
                ),
              ),
              child: Column(
                children: [
                  // QR Code with enhanced gradient border and glow effect
                  Consumer<TenantProvider>(
                    builder: (context, tenantProvider, _) {
                      return Container(
                        padding: const EdgeInsets.all(3),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              tenantProvider.primaryColor,
                              tenantProvider.secondaryColor,
                              tenantProvider.primaryColor.withOpacity(0.8),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: tenantProvider.primaryColor.withOpacity(0.3),
                              blurRadius: 20,
                              spreadRadius: 2,
                              offset: const Offset(0, 5),
                            ),
                          ],
                        ),
                        child: Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: AppTheme.getCardBackground(context),
                            borderRadius: BorderRadius.circular(21),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.05),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: QrImageView(
                            data: _generatedQRData!,
                            version: QrVersions.auto,
                            size: 200,
                            gapless: true,
                            eyeStyle: QrEyeStyle(
                              eyeShape: QrEyeShape.square,
                              color: tenantProvider.primaryColor,
                            ),
                            dataModuleStyle: const QrDataModuleStyle(
                              dataModuleShape: QrDataModuleShape.square,
                              color: Colors.black,
                            ),
                            errorCorrectionLevel: QrErrorCorrectLevel.H,
                          ),
                        ),
                      );
                    },
                  ),

                  const SizedBox(height: 24),

                  // Payment Details with gradient background
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppTheme.getCardBackground(context),
                          AppTheme.getCardBackground(context).withOpacity(0.7),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.03),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Consumer<TenantProvider>(
                      builder: (context, tenantProvider, _) {
                        return Column(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Amount:',
                                  style: TextStyle(
                                    fontSize: 16,
                                    color: AppTheme.getTextSecondary(context),
                                  ),
                                ),
                                Text(
                                  '$_currency ${_amountController.text}',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: tenantProvider.primaryColor,
                                  ),
                                ),
                              ],
                            ),
                            if (_noteController.text.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Divider(
                                color: AppTheme.getBorderColor(context),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Note:',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: AppTheme.getTextSecondary(context),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _noteController.text,
                                      style: TextStyle(
                                        fontSize: 14,
                                        color: AppTheme.getTextPrimary(context),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        );
                      },
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Share Button
                  Consumer<TenantProvider>(
                    builder: (context, tenantProvider, _) {
                      return SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () => _shareAccountDetails(accountNumber, accountName),
                          icon: const Icon(Icons.share),
                          label: const Text('Share QR Code'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: tenantProvider.primaryColor,
                            foregroundColor: TenantUtils.getContrastingTextColor(tenantProvider.primaryColor),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      );
                    },
                  ),

                  const SizedBox(height: 24),

                  // Info Card with enhanced background
                  Consumer<TenantProvider>(
                    builder: (context, tenantProvider, _) {
                      return Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              tenantProvider.primaryColor.withOpacity(0.05),
                              tenantProvider.secondaryColor.withOpacity(0.05),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.03),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: tenantProvider.primaryColor,
                            width: 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.info_outline,
                              color: tenantProvider.primaryColor,
                              size: 24,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'Anyone with this QR code can send money to your account',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: AppTheme.getTextSecondary(context),
                                  height: 1.4,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
          ],
      )),
    );
  }

  Widget _buildScanQRTab() {
    return _QRScannerWidget(paymentService: _paymentService);
  }
}

class _QRScannerWidget extends StatefulWidget {
  final PaymentService paymentService;
  
  const _QRScannerWidget({required this.paymentService});

  @override
  State<_QRScannerWidget> createState() => _QRScannerWidgetState();
}

class _QRScannerWidgetState extends State<_QRScannerWidget> {
  final TextEditingController qrController = TextEditingController();
  final TextEditingController pinController = TextEditingController();
  final MobileScannerController scannerController = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: [BarcodeFormat.qrCode],
  );
  bool isProcessing = false;
  bool isScanning = true;
  String? scannedData;

  @override
  void initState() {
    super.initState();
    // Start the scanner when the widget is initialized
    WidgetsBinding.instance.addPostFrameCallback((_) {
      scannerController.start();
    });
  }

  @override
  void dispose() {
    scannerController.dispose();
    qrController.dispose();
    pinController.dispose();
    super.dispose();
  }

  void _onQRCodeDetect(BarcodeCapture capture) {
    if (!isScanning) return;
    
    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isNotEmpty) {
      final barcode = barcodes.first;
      if (barcode.rawValue != null) {
        setState(() {
          scannedData = barcode.rawValue;
          qrController.text = scannedData!;
          isScanning = false;
        });
        scannerController.stop();
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('QR Code scanned successfully!'),
            backgroundColor: AppTheme.successColor,
            duration: Duration(seconds: 2),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            const SizedBox(height: 16),

            // Header with gradient background
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.blue.shade50.withOpacity(0.3),
                    Colors.purple.shade50.withOpacity(0.3),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  Text(
                    'Scan & Pay with QR Code',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.getTextPrimary(context),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Scan QR code or enter manually',
                    style: TextStyle(
                      fontSize: 16,
                      color: AppTheme.getTextSecondary(context),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),

            // Camera Scanner with enhanced styling
            Consumer<TenantProvider>(
              builder: (context, tenantProvider, _) {
                return Container(
                  height: 320,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        tenantProvider.primaryColor.withOpacity(0.1),
                        tenantProvider.secondaryColor.withOpacity(0.1),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: tenantProvider.primaryColor.withOpacity(0.2),
                        blurRadius: 20,
                        spreadRadius: 2,
                        offset: const Offset(0, 5),
                      ),
                    ],
                  ),
                  padding: const EdgeInsets.all(3),
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(21),
                      border: Border.all(
                        color: tenantProvider.primaryColor,
                        width: 2,
                      ),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(18),
                      child: Stack(
                        children: [
                          if (isScanning)
                            MobileScanner(
                              controller: scannerController,
                              onDetect: _onQRCodeDetect,
                            )
                          else
                            Container(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    Colors.green.shade900,
                                    Colors.green.shade700,
                                  ],
                                ),
                              ),
                              child: Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(
                                        color: tenantProvider.primaryColor.withOpacity(0.2),
                                        shape: BoxShape.circle,
                                      ),
                                      child: Icon(
                                        Icons.check_circle,
                                        size: 60,
                                        color: tenantProvider.primaryColor,
                                      ),
                                    ),
                                    const SizedBox(height: 16),
                                    Text(
                                      'QR Code Scanned',
                                      style: TextStyle(
                                        color: AppTheme.getTextPrimary(context),
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      'Successfully captured',
                                      style: TextStyle(
                                        color: AppTheme.getTextSecondary(context),
                                        fontSize: 14,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                  // Scanner overlay
                  if (isScanning)
                    Positioned.fill(
                      child: CustomPaint(
                        painter: _ScannerOverlayPainter(primaryColor: tenantProvider.primaryColor),
                      ),
                    ),
                          // Rescan button with shadow
                          if (!isScanning)
                            Positioned(
                              bottom: 16,
                              right: 16,
                              child: Container(
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(30),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.3),
                                      blurRadius: 10,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: ElevatedButton.icon(
                                  onPressed: () {
                                    setState(() {
                                      isScanning = true;
                                      scannedData = null;
                                      qrController.clear();
                                    });
                                    scannerController.start();
                                  },
                                  icon: const Icon(Icons.refresh),
                                  label: const Text('Scan Again'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: tenantProvider.primaryColor,
                                    foregroundColor: TenantUtils.getContrastingTextColor(tenantProvider.primaryColor),
                                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(30),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                );
            },
          ),

            const SizedBox(height: 32),

            // Manual QR Input with enhanced background
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.getCardBackground(context),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
                border: Border.all(
                  color: AppTheme.getBorderColor(context).withOpacity(0.5),
                  width: 1,
                ),
              ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Or Enter QR Code Data',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                
                // QR Code Input
                TextField(
                  controller: qrController,
                  decoration: InputDecoration(
                    labelText: 'QR Code Data',
                    prefixIcon: const Icon(Icons.qr_code),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                
                // PIN Input
                TextField(
                  controller: pinController,
                  obscureText: true,
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  decoration: InputDecoration(
                    labelText: 'Transaction PIN',
                    prefixIcon: const Icon(Icons.lock),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    counterText: '',
                  ),
                ),
                const SizedBox(height: 20),
                
                // Process Button
                Consumer<TenantProvider>(
                  builder: (context, tenantProvider, _) {
                    return StatefulBuilder(
                      builder: (context, setButtonState) {
                        return SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton.icon(
                            onPressed: isProcessing
                                ? null
                                : () async {
                                if (qrController.text.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Please enter QR code data'),
                                      backgroundColor: Colors.red,
                                    ),
                                  );
                                  return;
                                }

                                if (pinController.text.isEmpty || pinController.text.length != 4) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Please enter 4-digit PIN'),
                                      backgroundColor: Colors.red,
                                    ),
                                  );
                                  return;
                                }

                                setButtonState(() => isProcessing = true);

                                try {
                                  // Parse QR code JSON
                                  final qrData = qrController.text.trim();
                                  Map<String, dynamic> qrJson;
                                  
                                  try {
                                    qrJson = jsonDecode(qrData) as Map<String, dynamic>;
                                  } catch (e) {
                                    setButtonState(() => isProcessing = false);
                                    if (!mounted) return;
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Invalid QR code format. Please scan a valid QR code.'),
                                        backgroundColor: Colors.red,
                                      ),
                                    );
                                    return;
                                  }

                                  // Extract required fields from QR code
                                  final recipient = qrJson['recipient']?.toString() ?? '';
                                  final amount = qrJson['amount']?.toString() ?? '';
                                  final currency = qrJson['currency']?.toString() ?? 'NGN';
                                  final note = qrJson['note']?.toString();
                                  final expiry = qrJson['expiry']?.toString() ?? '';
                                  final signature = qrJson['signature']?.toString() ?? '';
                                  final tenant = qrJson['tenant']?.toString() ?? '';

                                  // Validate required fields
                                  if (recipient.isEmpty || amount.isEmpty || expiry.isEmpty || signature.isEmpty) {
                                    setButtonState(() => isProcessing = false);
                                    if (!mounted) return;
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('QR code is missing required fields'),
                                        backgroundColor: Colors.red,
                                      ),
                                    );
                                    return;
                                  }

                                  // Get tenant ID (use from QR or fallback to stored/default)
                                  String? tenantId = tenant.isNotEmpty 
                                      ? tenant 
                                      : await TenantService.getTenantId();
                                  
                                  if (tenantId == null || tenantId.isEmpty) {
                                    tenantId = 'pup'; // Fallback to default
                                  }

                                  // Get account_id (ledger) from storage
                                  String? accountId;
                                  if (kIsWeb) {
                                    accountId = html.window.localStorage['account_id'];
                                    if (accountId == null) {
                                      final accountJson = html.window.localStorage['account'];
                                      if (accountJson != null) {
                                        final accountData = jsonDecode(accountJson);
                                        accountId = accountData['id']?.toString();
                                      }
                                    }
                                  } else {
                                    final prefs = await SharedPreferences.getInstance();
                                    accountId = prefs.getString('account_id');
                                    if (accountId == null) {
                                      final accountJson = prefs.getString('account');
                                      if (accountJson != null) {
                                        final accountData = jsonDecode(accountJson);
                                        accountId = accountData['id']?.toString();
                                      }
                                    }
                                  }

                                  if (accountId == null || accountId.isEmpty) {
                                    setButtonState(() => isProcessing = false);
                                    if (!mounted) return;
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Account ID not found. Please ensure you have an active account.'),
                                        backgroundColor: Colors.red,
                                      ),
                                    );
                                    return;
                                  }

                                  // Parse ledger (should be int, default to 1 if not provided)
                                  int ledger = qrJson['ledger'] is int 
                                      ? qrJson['ledger'] as int
                                      : (qrJson['ledger'] != null 
                                          ? int.tryParse(qrJson['ledger'].toString()) ?? 1
                                          : int.tryParse(accountId) ?? 1);

                                  // Call validateQR with parsed data
                                  final response = await widget.paymentService.validateQR(
                                    recipient: recipient,
                                    amount: amount,
                                    currency: currency,
                                    note: note,
                                    expiry: expiry,
                                    signature: signature,
                                    tenant: tenantId,
                                    ledger: ledger,
                                    pin: pinController.text.trim(),
                                  );

                                  setButtonState(() => isProcessing = false);

                                  if (!mounted) return;

                                  if (response['success'] == true) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Payment successful!'),
                                        backgroundColor: AppTheme.successColor,
                                      ),
                                    );
                                    qrController.clear();
                                    pinController.clear();
                                  } else {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(response['message'] ?? 'Payment failed'),
                                        backgroundColor: Colors.red,
                                      ),
                                    );
                                  }
                                } catch (e) {
                                  setButtonState(() => isProcessing = false);
                                  if (!mounted) return;
                                  
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Error: ${e.toString()}'),
                                      backgroundColor: Colors.red,
                                    ),
                                  );
                                }
                              },
                            icon: isProcessing
                                ? SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: TenantUtils.getContrastingTextColor(tenantProvider.primaryColor),
                                    ),
                                  )
                                : const Icon(Icons.payment),
                            label: Text(isProcessing ? 'Processing...' : 'Process Payment'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: tenantProvider.primaryColor,
                              foregroundColor: TenantUtils.getContrastingTextColor(tenantProvider.primaryColor),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Info text
          Text(
            'Scan or enter QR code to quickly send money',
            style: TextStyle(
              fontSize: 14,
              color: AppTheme.getTextSecondary(context),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ));
  }
}

// Scanner Overlay Painter
class _ScannerOverlayPainter extends CustomPainter {
  final Color primaryColor;
  
  _ScannerOverlayPainter({required this.primaryColor});
  
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black.withOpacity(0.5)
      ..style = PaintingStyle.fill;

    final scanAreaSize = size.width * 0.7;
    final scanAreaLeft = (size.width - scanAreaSize) / 2;
    final scanAreaTop = (size.height - scanAreaSize) / 2;
    final scanArea = Rect.fromLTWH(
      scanAreaLeft,
      scanAreaTop,
      scanAreaSize,
      scanAreaSize,
    );

    // Draw overlay
    final path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final cutoutPath = Path()
      ..addRRect(
        RRect.fromRectAndRadius(scanArea, const Radius.circular(20)),
      );
    final overlayPath = Path.combine(
      PathOperation.difference,
      path,
      cutoutPath,
    );
    canvas.drawPath(overlayPath, paint);

    // Draw corner borders
    final borderPaint = Paint()
      ..color = primaryColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4;

    final cornerLength = 30.0;
    final cornerRadius = 8.0;

    // Top-left corner
    canvas.drawLine(
      Offset(scanAreaLeft, scanAreaTop + cornerRadius),
      Offset(scanAreaLeft, scanAreaTop + cornerLength),
      borderPaint,
    );
    canvas.drawLine(
      Offset(scanAreaLeft + cornerRadius, scanAreaTop),
      Offset(scanAreaLeft + cornerLength, scanAreaTop),
      borderPaint,
    );

    // Top-right corner
    canvas.drawLine(
      Offset(scanAreaLeft + scanAreaSize - cornerLength, scanAreaTop),
      Offset(scanAreaLeft + scanAreaSize - cornerRadius, scanAreaTop),
      borderPaint,
    );
    canvas.drawLine(
      Offset(scanAreaLeft + scanAreaSize, scanAreaTop + cornerRadius),
      Offset(scanAreaLeft + scanAreaSize, scanAreaTop + cornerLength),
      borderPaint,
    );

    // Bottom-left corner
    canvas.drawLine(
      Offset(scanAreaLeft, scanAreaTop + scanAreaSize - cornerLength),
      Offset(scanAreaLeft, scanAreaTop + scanAreaSize - cornerRadius),
      borderPaint,
    );
    canvas.drawLine(
      Offset(scanAreaLeft + cornerRadius, scanAreaTop + scanAreaSize),
      Offset(scanAreaLeft + cornerLength, scanAreaTop + scanAreaSize),
      borderPaint,
    );

    // Bottom-right corner
    canvas.drawLine(
      Offset(scanAreaLeft + scanAreaSize - cornerLength, scanAreaTop + scanAreaSize),
      Offset(scanAreaLeft + scanAreaSize - cornerRadius, scanAreaTop + scanAreaSize),
      borderPaint,
    );
    canvas.drawLine(
      Offset(scanAreaLeft + scanAreaSize, scanAreaTop + scanAreaSize - cornerLength),
      Offset(scanAreaLeft + scanAreaSize, scanAreaTop + scanAreaSize - cornerRadius),
      borderPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}