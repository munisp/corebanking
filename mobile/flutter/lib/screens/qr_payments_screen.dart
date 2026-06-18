import 'package:flutter/material.dart';

/// NQR Payments — Generate and scan QR codes for instant payments (CBN NQR Standard)
class QrPaymentsScreen extends StatefulWidget {
  const QrPaymentsScreen({super.key});
  @override
  State<QrPaymentsScreen> createState() => _QrPaymentsScreenState();
}

class _QrPaymentsScreenState extends State<QrPaymentsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _amountController = TextEditingController();
  bool _isGenerating = false;
  bool _isScanning = false;
  String? _generatedQR;
  String? _scannedMerchant;
  double? _scannedAmount;

  // NQR EMV tag structure
  final _merchantInfo = {
    'name': '54Bank Customer',
    'merchantId': 'NQR54B001234',
    'mcc': '6012', // Financial Institutions
    'countryCode': 'NG',
    'currencyCode': '566', // NGN
  };

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('QR Payments'),
        bottom: TabBar(controller: _tabController, tabs: const [
          Tab(icon: Icon(Icons.qr_code), text: 'Generate'),
          Tab(icon: Icon(Icons.qr_code_scanner), text: 'Scan & Pay'),
        ]),
      ),
      body: TabBarView(controller: _tabController, children: [
        _buildGenerateTab(),
        _buildScanTab(),
      ]),
    );
  }

  Widget _buildGenerateTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(children: [
                const Icon(Icons.qr_code_2, size: 80, color: Colors.green),
                const SizedBox(height: 16),
                Text(_merchantInfo['name']!, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                Text('Merchant ID: ${_merchantInfo['merchantId']}', style: const TextStyle(color: Colors.grey)),
                const SizedBox(height: 8),
                // Show generated QR placeholder
                if (_generatedQR != null) Container(
                  width: 200, height: 200,
                  decoration: BoxDecoration(border: Border.all(color: Colors.green, width: 2), borderRadius: BorderRadius.circular(12)),
                  child: Center(child: Text('NQR Code\n₦${_amountController.text}', textAlign: TextAlign.center,
                      style: const TextStyle(fontWeight: FontWeight.bold))),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _amountController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Amount (₦)',
              prefixText: '₦ ',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              helperText: 'Leave empty for open amount (customer enters)',
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            icon: _isGenerating ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.qr_code),
            label: Text(_isGenerating ? 'Generating...' : 'Generate NQR Code'),
            onPressed: _isGenerating ? null : _generateQR,
            style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16)),
          ),
          const SizedBox(height: 24),
          const Text('NQR Standard (CBN)', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          _infoTile(Icons.security, 'EMV QR compliant with CRC-16 checksum'),
          _infoTile(Icons.timelapse, 'QR expires after 5 minutes'),
          _infoTile(Icons.account_balance, 'Direct settlement to your 54Bank account'),
        ],
      ),
    );
  }

  Widget _buildScanTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Camera preview placeholder
          Container(
            height: 300,
            decoration: BoxDecoration(
              color: Colors.black87,
              borderRadius: BorderRadius.circular(16),
            ),
            child: _isScanning
                ? const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    CircularProgressIndicator(color: Colors.white),
                    SizedBox(height: 16),
                    Text('Scanning...', style: TextStyle(color: Colors.white)),
                  ]))
                : _scannedMerchant != null
                    ? _buildScannedResult()
                    : const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Icon(Icons.qr_code_scanner, size: 64, color: Colors.white54),
                        SizedBox(height: 16),
                        Text('Point camera at NQR code', style: TextStyle(color: Colors.white70)),
                      ])),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            icon: const Icon(Icons.camera_alt),
            label: Text(_isScanning ? 'Cancel' : 'Start Scanning'),
            onPressed: () => setState(() {
              if (_isScanning) { _isScanning = false; }
              else { _isScanning = true; _simulateScan(); }
            }),
            style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16)),
          ),
          if (_scannedMerchant != null) ...[
            const SizedBox(height: 24),
            Card(
              child: Padding(padding: const EdgeInsets.all(16), child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Pay $_scannedMerchant', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  if (_scannedAmount != null) Text('Amount: ₦${_scannedAmount!.toStringAsFixed(0)}', style: const TextStyle(fontSize: 24, color: Colors.green)),
                  const SizedBox(height: 16),
                  if (_scannedAmount == null) TextField(
                    controller: _amountController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Enter Amount', prefixText: '₦ '),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(width: double.infinity, child: ElevatedButton(
                    onPressed: () {},
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.green, padding: const EdgeInsets.all(16)),
                    child: const Text('Confirm Payment', style: TextStyle(color: Colors.white, fontSize: 16)),
                  )),
                ],
              )),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildScannedResult() {
    return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.check_circle, color: Colors.green, size: 64),
      const SizedBox(height: 8),
      const Text('QR Code Scanned!', style: TextStyle(color: Colors.white, fontSize: 18)),
    ]));
  }

  Widget _infoTile(IconData icon, String text) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [Icon(icon, size: 16, color: Colors.grey), const SizedBox(width: 8), Expanded(child: Text(text, style: const TextStyle(fontSize: 13)))]),
  );

  void _generateQR() {
    setState(() => _isGenerating = true);
    Future.delayed(const Duration(seconds: 1), () {
      setState(() { _isGenerating = false; _generatedQR = 'NQR-${DateTime.now().millisecondsSinceEpoch}'; });
    });
  }

  void _simulateScan() {
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted && _isScanning) {
        setState(() { _isScanning = false; _scannedMerchant = 'ShopRite Nigeria'; _scannedAmount = 15750; });
      }
    });
  }
}
