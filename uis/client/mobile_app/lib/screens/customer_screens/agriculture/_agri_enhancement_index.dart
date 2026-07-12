import 'package:flutter/material.dart';
import 'crud_scaffold.dart';

// Agriculture Enhancement — screens without dedicated files use CrudScaffold
// Screens that have dedicated files are in their own dart files

class InteractiveUssdAgriScreen extends StatelessWidget {
  const InteractiveUssdAgriScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'USSD Agriculture',
      apiPath: '/api/agriculture-enhancement/interactive-ussd-agri/list',
    );
  }
}

class CommodityExchangeScreen extends StatelessWidget {
  const CommodityExchangeScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Commodity Exchange',
      apiPath: '/api/agriculture-enhancement/commodity-exchange/list',
    );
  }
}

class CommodityPriceIntelligenceScreen extends StatelessWidget {
  const CommodityPriceIntelligenceScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Price Intelligence',
      apiPath: '/api/agriculture-enhancement/commodity-price-intelligence/list',
    );
  }
}

class WarehouseManagementScreen extends StatelessWidget {
  const WarehouseManagementScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Warehouse Mgmt',
      apiPath: '/api/agriculture-enhancement/warehouse-management/list',
    );
  }
}

class AgentFarmerOnboardingScreen extends StatelessWidget {
  const AgentFarmerOnboardingScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Agent Onboarding',
      apiPath: '/api/agriculture-enhancement/agent-farmer-onboarding/list',
    );
  }
}

class EquipmentLeasingScreen extends StatelessWidget {
  const EquipmentLeasingScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Equipment Leasing',
      apiPath: '/api/agriculture-enhancement/equipment-leasing/list',
    );
  }
}

class CbnAgriReturnsScreen extends StatelessWidget {
  const CbnAgriReturnsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'CBN Agri Returns',
      apiPath: '/api/agriculture-enhancement/cbn-agri-returns/list',
    );
  }
}

class QualityCertificationScreen extends StatelessWidget {
  const QualityCertificationScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Quality Grading',
      apiPath: '/api/agriculture-enhancement/quality-certification/list',
    );
  }
}

class CrossborderAgriTradeScreen extends StatelessWidget {
  const CrossborderAgriTradeScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Cross-Border Trade',
      apiPath: '/api/agriculture-enhancement/crossborder-agri-trade/list',
    );
  }
}

class InsurancePortfolioAnalyticsScreen extends StatelessWidget {
  const InsurancePortfolioAnalyticsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Insurance Analytics',
      apiPath: '/api/agriculture-enhancement/insurance-portfolio-analytics/list',
    );
  }
}

class ParametricInsuranceIotScreen extends StatelessWidget {
  const ParametricInsuranceIotScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Parametric Insurance',
      apiPath: '/api/agriculture-enhancement/parametric-insurance-iot/list',
    );
  }
}

class PostHarvestLossTrackerScreen extends StatelessWidget {
  const PostHarvestLossTrackerScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Post-Harvest Loss',
      apiPath: '/api/agriculture-enhancement/post-harvest-loss-tracker/list',
    );
  }
}

class AggregationCenterScreen extends StatelessWidget {
  const AggregationCenterScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Aggregation Center',
      apiPath: '/api/agriculture-enhancement/aggregation-center/list',
    );
  }
}

class CbnAgsmeisScreen extends StatelessWidget {
  const CbnAgsmeisScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'CBN AGSMEIS',
      apiPath: '/api/agriculture-enhancement/cbn-agsmeis/list',
    );
  }
}

class AcgsfGuaranteeScreen extends StatelessWidget {
  const AcgsfGuaranteeScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'ACGSF Guarantee',
      apiPath: '/api/agriculture-enhancement/acgsf-guarantee/list',
    );
  }
}
