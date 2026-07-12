import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../providers/tenant_provider.dart';
import 'carbon_projects_screen.dart';
import 'carbon_credits_list_screen.dart';
import 'carbon_trades_screen.dart';
import 'carbon_footprints_screen.dart';

class CarbonCreditsScreen extends StatefulWidget {
  const CarbonCreditsScreen({super.key});

  @override
  State<CarbonCreditsScreen> createState() => _CarbonCreditsScreenState();
}

class _CarbonCreditsScreenState extends State<CarbonCreditsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tenantProvider = Provider.of<TenantProvider>(context, listen: false);
    if (!tenantProvider.isFeatureEnabled('carbon_credits')) {
      return Scaffold(
        appBar: AppBar(title: const Text('Carbon Credits')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.eco, size: 64, color: Colors.green),
                SizedBox(height: 16),
                Text('Carbon Credits Not Available', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                SizedBox(height: 8),
                Text('The carbon credits feature is not enabled for your account. Contact support to enable this feature.', textAlign: TextAlign.center),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Carbon Credits'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(
              icon: Icon(Icons.park),
              text: 'Projects',
            ),
            Tab(
              icon: Icon(Icons.eco),
              text: 'Credits',
            ),
            Tab(
              icon: Icon(Icons.swap_horiz),
              text: 'Trades',
            ),
            Tab(
              icon: Icon(Icons.co2),
              text: 'Footprint',
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          CarbonProjectsScreen(),
          CarbonCreditsListScreen(),
          CarbonTradesScreen(),
          CarbonFootprintsScreen(),
        ],
      ),
    );
  }
}
