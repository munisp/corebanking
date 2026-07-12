import 'package:flutter/material.dart';
import 'my_policies_screen.dart';
import 'insurance_claims_screen_new.dart';
import 'all_policies_screen.dart';

class InsuranceScreen extends StatefulWidget {
  const InsuranceScreen({super.key});

  @override
  State<InsuranceScreen> createState() => _InsuranceScreenState();
}

class _InsuranceScreenState extends State<InsuranceScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Insurance'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(
              icon: Icon(Icons.view_list),
              text: 'All Policies',
            ),
            Tab(
              icon: Icon(Icons.policy),
              text: 'My Policies',
            ),
            Tab(
              icon: Icon(Icons.file_copy),
              text: 'Claims',
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          AllPoliciesScreen(),
          InsurancePoliciesScreen(),
          InsuranceClaimsScreenNew(),
        ],
      ),
    );
  }
}
