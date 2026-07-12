
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:mobile_app/services/agriculture_service.dart';

class AgricultureDashboardScreen extends StatefulWidget {
  const AgricultureDashboardScreen({super.key});

  @override
  State<AgricultureDashboardScreen> createState() =>
      _AgricultureDashboardScreenState();
}

class _AgricultureDashboardScreenState
    extends State<AgricultureDashboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final service = AgricultureService.instance;

  bool loading = true;

  List farmers = [];
  List farms = [];
  List loans = [];
  List coops = [];
  List crops = [];
  List livestock = [];
  List programs = [];
  List partners = [];
  List suppliers = [];
  List offTakers = [];

  Map<String, dynamic>? portfolio;
  Map<String, dynamic>? risk;

  final Color primary = const Color(0xFF2E7D32);
  final Color secondary = const Color(0xFFE8F5E9);

  final farmerName = TextEditingController();
  final farmerPhone = TextEditingController();

  final farmName = TextEditingController();
  final farmLocation = TextEditingController();

  final loanAmount = TextEditingController();
  final loanPurpose = TextEditingController();

  final coopName = TextEditingController();

  final partnerName = TextEditingController();
  final partnerType = TextEditingController();

  final supplierName = TextEditingController();
  final supplierLocation = TextEditingController();

  final offTakerName = TextEditingController();
  final offTakerCommodity = TextEditingController();

  final programName = TextEditingController();
  final programDescription = TextEditingController();

  @override
  void initState() {
    super.initState();

    _tabController = TabController(length: 12, vsync: this);

    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() => loading = true);

    try {
      await Future.wait([
        _loadFarmers(),
        _loadFarms(),
        _loadLoans(),
        _loadCoops(),
        _loadCrops(),
        _loadLivestock(),
        _loadPrograms(),
        _loadPartners(),
        _loadAnalytics(),
      ]);
    } catch (e) {
      debugPrint("❌ LOAD ERROR: $e");
    } finally {
      setState(() => loading = false);
    }
  }

  List _safeList(dynamic res, List keys) {
    if (res == null) return [];

    if (res is String) {
      try {
        res = jsonDecode(res);
      } catch (_) {
        return [];
      }
    }

    if (res is! Map) return [];

    for (final k in keys) {
      final val = res[k];
      if (val is List) return val;
    }

    return [];
  }

  Future<void> _loadFarmers() async {
    final res = await service.listFarmers();

    setState(() {
      farmers = _safeList(res, ["farmers", "data", "result"]);
    });
  }

  Future<void> _loadFarms() async {
    final res = await service.listFarms();

    setState(() {
      farms = _safeList(res, ["farms", "data", "result"]);
    });
  }

  Future<void> _loadLoans() async {
    final res = await service.listLoans();

    setState(() {
      loans = _safeList(res, ["loans", "data", "result"]);
    });
  }

  Future<void> _loadCoops() async {
    final res = await service.listCooperatives();

    setState(() {
      coops = _safeList(res, ["cooperatives", "data", "result"]);
    });
  }

  Future<void> _loadCrops() async {
    final res = await service.listCrops();

    setState(() {
      crops = _safeList(res, ["crops", "data", "result"]);
    });
  }

  Future<void> _loadLivestock() async {
    final res = await service.listLivestock();

    setState(() {
      livestock = _safeList(res, ["livestock", "data", "result"]);
    });
  }

  Future<void> _loadPrograms() async {
    final res = await service.listPrograms();

    setState(() {
      programs = _safeList(res, ["programs", "data", "result"]);
    });
  }

  Future<void> _loadPartners() async {
    final res = await service.listPartners();

    setState(() {
      partners = _safeList(res, ["partners", "data", "result"]);
    });
  }

  Future<void> _loadAnalytics() async {
    final p = await service.portfolioAnalytics();
    final r = await service.riskAnalytics();

    setState(() {
      portfolio = p;
      risk = r;
    });
  }

  Widget _input(
    TextEditingController controller,
    String label, {
    TextInputType? keyboardType,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextField(
        controller: controller,
        keyboardType: keyboardType,
        decoration: InputDecoration(
          labelText: label,
          filled: true,
          fillColor: Colors.grey.shade100,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }

  void _openModal(
    String title,
    List<Widget> fields,
    VoidCallback onSubmit,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(30),
        ),
      ),
      builder: (_) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 24,
            bottom: MediaQuery.of(context).viewInsets.bottom + 24,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 20),
                ...fields,
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    onPressed: () {
                      Navigator.pop(context);
                      onSubmit();
                    },
                    child: const Text("Submit"),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _formatKey(String value) {
    return value
        .replaceAll("_", " ")
        .split(" ")
        .map(
          (word) => word.isEmpty
              ? word
              : "${word[0].toUpperCase()}${word.substring(1).toLowerCase()}",
        )
        .join(" ");
  }

  Color _statusColor(String value) {
    final v = value.toLowerCase();

    if (v.contains("approved") || v.contains("active")) {
      return Colors.green;
    }

    if (v.contains("pending")) {
      return Colors.orange;
    }

    if (v.contains("rejected")) {
      return Colors.red;
    }

    return Colors.blueGrey;
  }

  Widget _statCard(String title, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          colors: [
            primary,
            primary.withOpacity(0.8),
          ],
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: Colors.white.withOpacity(0.2),
            child: Icon(icon, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 24,
                ),
              ),
              Text(
                title,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.9),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _mobileCardList(List data, List<String> keys) {
    if (data.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(40),
        child: const Center(
          child: Text("No data available"),
        ),
      );
    }

    return Column(
      children: data.map((item) {
        final titleKey = keys.first;

        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                blurRadius: 10,
                color: Colors.black.withOpacity(0.05),
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: ExpansionTile(
            tilePadding: const EdgeInsets.symmetric(
              horizontal: 20,
              vertical: 10,
            ),
            childrenPadding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            title: Text(
              item[titleKey]?.toString() ?? "Record",
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
            subtitle: item["status"] != null
                ? Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: _statusColor(item["status"].toString())
                            .withOpacity(0.12),
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: Text(
                        item["status"].toString(),
                        style: TextStyle(
                          color: _statusColor(item["status"].toString()),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  )
                : null,
            children: keys.map((k) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 2,
                      child: Text(
                        _formatKey(k),
                        style: TextStyle(
                          color: Colors.grey.shade700,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Expanded(
                      flex: 3,
                      child: Text(
                        item[k]?.toString() ?? "-",
                        style: const TextStyle(
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildTab(
    String title,
    List data,
    List<String> keys,
    VoidCallback onRefresh,
  ) {
    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 18),
          _statCard(
            "Total $title",
            data.length.toString(),
            Icons.analytics_outlined,
          ),
          const SizedBox(height: 20),
          _mobileCardList(data, keys),
        ],
      ),
    );
  }

  Widget _analyticsCard(
    String title,
    Map<String, dynamic>? data,
    IconData icon,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            blurRadius: 10,
            color: Colors.black.withOpacity(0.05),
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: secondary,
                child: Icon(icon, color: primary),
              ),
              const SizedBox(width: 12),
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          ...(data ?? {}).entries.map(
            (e) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(_formatKey(e.key)),
                  Text(
                    e.value.toString(),
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _tabController.dispose();

    farmerName.dispose();
    farmerPhone.dispose();

    farmName.dispose();
    farmLocation.dispose();

    loanAmount.dispose();
    loanPurpose.dispose();

    coopName.dispose();

    partnerName.dispose();
    partnerType.dispose();

    supplierName.dispose();
    supplierLocation.dispose();

    offTakerName.dispose();
    offTakerCommodity.dispose();

    programName.dispose();
    programDescription.dispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: primary,
        foregroundColor: Colors.white,
        title: const Text(
          "Agriculture Banking",
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: Colors.white,
          labelStyle: const TextStyle(
            fontWeight: FontWeight.bold,
          ),
          tabs: const [
            Tab(text: "Farmers"),
            Tab(text: "Farms"),
            Tab(text: "Loans"),
            Tab(text: "Programs"),
            Tab(text: "Partners"),
            Tab(text: "Suppliers"),
            Tab(text: "Off-Takers"),
            Tab(text: "Coops"),
            Tab(text: "Crops"),
            Tab(text: "Livestock"),
            Tab(text: "Portfolio"),
            Tab(text: "Risk"),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text("Create"),
        onPressed: () {
          final i = _tabController.index;

          if (i == 0) {
            _openModal(
              "Add Farmer",
              [
                _input(farmerName, "Full Name"),
                _input(
                  farmerPhone,
                  "Phone Number",
                  keyboardType: TextInputType.phone,
                ),
              ],
              () async {
                await service.registerFarmer({
                  "name": farmerName.text,
                  "phone": farmerPhone.text,
                });

                _loadFarmers();
              },
            );
          }

          if (i == 1) {
            _openModal(
              "Register Farm",
              [
                _input(farmName, "Farm Name"),
                _input(farmLocation, "Location"),
              ],
              () async {
                await service.registerFarm({
                  "name": farmName.text,
                  "location": farmLocation.text,
                });

                _loadFarms();
              },
            );
          }

          if (i == 2) {
            _openModal(
              "Apply Loan",
              [
                _input(
                  loanAmount,
                  "Loan Amount",
                  keyboardType: TextInputType.number,
                ),
                _input(loanPurpose, "Purpose"),
              ],
              () async {
                await service.applyLoan({
                  "amount": loanAmount.text,
                  "purpose": loanPurpose.text,
                });

                _loadLoans();
              },
            );
          }

          if (i == 3) {
            _openModal(
              "Create Program",
              [
                _input(programName, "Program Name"),
                _input(programDescription, "Description"),
              ],
              () async {
                await service.createProgram({
                  "name": programName.text,
                  "description": programDescription.text,
                });

                _loadPrograms();
              },
            );
          }

          if (i == 4) {
            _openModal(
              "Register Partner",
              [
                _input(partnerName, "Partner Name"),
                _input(partnerType, "Partner Type"),
              ],
              () async {
                await service.registerPartner({
                  "name": partnerName.text,
                  "partner_type": partnerType.text,
                });

                _loadPartners();
              },
            );
          }

          if (i == 7) {
            _openModal(
              "Create Cooperative",
              [
                _input(coopName, "Cooperative Name"),
              ],
              () async {
                await service.registerCooperative({
                  "name": coopName.text,
                });

                _loadCoops();
              },
            );
          }
        },
      ),
      body: loading
          ? Center(
              child: CircularProgressIndicator(color: primary),
            )
          : TabBarView(
              controller: _tabController,
              children: [
                _buildTab(
                  "Farmers",
                  farmers,
                  [
                    "id",
                    "full_name",
                    "phone_number",
                    "status",
                  ],
                  _loadFarmers,
                ),
                _buildTab(
                  "Farms",
                  farms,
                  [
                    "id",
                    "farm_name",
                    "location",
                    "status",
                  ],
                  _loadFarms,
                ),
                _buildTab(
                  "Loans",
                  loans,
                  [
                    "id",
                    "loan_amount",
                    "status",
                    "crop_type",
                  ],
                  _loadLoans,
                ),
                _buildTab(
                  "Programs",
                  programs,
                  [
                    "id",
                    "name",
                    "description",
                    "status",
                  ],
                  _loadPrograms,
                ),
                _buildTab(
                  "Partners",
                  partners,
                  [
                    "id",
                    "name",
                    "partner_type",
                  ],
                  _loadPartners,
                ),
                _buildTab(
                  "Suppliers",
                  suppliers,
                  [
                    "id",
                    "name",
                    "location",
                  ],
                  () {},
                ),
                _buildTab(
                  "Off-Takers",
                  offTakers,
                  [
                    "id",
                    "name",
                    "commodity",
                  ],
                  () {},
                ),
                _buildTab(
                  "Cooperatives",
                  coops,
                  [
                    "id",
                    "name",
                  ],
                  _loadCoops,
                ),
                _buildTab(
                  "Crops",
                  crops,
                  [
                    "crop_type",
                    "market_price",
                    "risk_level",
                  ],
                  _loadCrops,
                ),
                _buildTab(
                  "Livestock",
                  livestock,
                  [
                    "livestock_type",
                    "market_price",
                    "risk_level",
                  ],
                  _loadLivestock,
                ),
                ListView(
                  padding: const EdgeInsets.all(18),
                  children: [
                    _analyticsCard(
                      "Portfolio Analytics",
                      portfolio,
                      Icons.pie_chart_outline,
                    ),
                  ],
                ),
                ListView(
                  padding: const EdgeInsets.all(18),
                  children: [
                    _analyticsCard(
                      "Risk Analytics",
                      risk,
                      Icons.warning_amber_rounded,
                    ),
                  ],
                ),
              ],
            ),
    );
  }
}
