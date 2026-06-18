import 'package:flutter/material.dart';
import 'crud_scaffold.dart';

// Agriculture Enhancement — 40 Flutter screens (ports 8589-8628)

class CooperativeManagementScreen extends StatelessWidget {
  const CooperativeManagementScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Cooperative Management',
      apiPath: '/api/agriculture-enhancement/cooperative-management/list',
    );
  }
}

class LivestockManagementScreen extends StatelessWidget {
  const LivestockManagementScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Livestock Management',
      apiPath: '/api/agriculture-enhancement/livestock-management/list',
    );
  }
}

class AgriInputMarketplaceScreen extends StatelessWidget {
  const AgriInputMarketplaceScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Input Marketplace',
      apiPath: '/api/agriculture-enhancement/agri-input-marketplace/list',
    );
  }
}

class NirsalCreditGuaranteeScreen extends StatelessWidget {
  const NirsalCreditGuaranteeScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'NIRSAL Credit Guarantee',
      apiPath: '/api/agriculture-enhancement/nirsal-credit-guarantee/list',
    );
  }
}

class CbnAnchorBorrowersScreen extends StatelessWidget {
  const CbnAnchorBorrowersScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'CBN Anchor Borrowers',
      apiPath: '/api/agriculture-enhancement/cbn-anchor-borrowers/list',
    );
  }
}

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

class AgriSavingsCyclesScreen extends StatelessWidget {
  const AgriSavingsCyclesScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Savings Cycles',
      apiPath: '/api/agriculture-enhancement/agri-savings-cycles/list',
    );
  }
}

class LivestockFinanceScreen extends StatelessWidget {
  const LivestockFinanceScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Livestock Finance',
      apiPath: '/api/agriculture-enhancement/livestock-finance/list',
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

class AgriEvoucherScreen extends StatelessWidget {
  const AgriEvoucherScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Agri E-Voucher',
      apiPath: '/api/agriculture-enhancement/agri-evoucher/list',
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

class SatelliteCropMonitorScreen extends StatelessWidget {
  const SatelliteCropMonitorScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Satellite Monitor',
      apiPath: '/api/agriculture-enhancement/satellite-crop-monitor/list',
    );
  }
}

class CooperativeCreditScoringScreen extends StatelessWidget {
  const CooperativeCreditScoringScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'CoopScore',
      apiPath: '/api/agriculture-enhancement/cooperative-credit-scoring/list',
    );
  }
}

class FisheriesAquacultureScreen extends StatelessWidget {
  const FisheriesAquacultureScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Fisheries Banking',
      apiPath: '/api/agriculture-enhancement/fisheries-aquaculture/list',
    );
  }
}

class FarmBoundaryMappingScreen extends StatelessWidget {
  const FarmBoundaryMappingScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Farm Mapping',
      apiPath: '/api/agriculture-enhancement/farm-boundary-mapping/list',
    );
  }
}

class AreaYieldIndexInsuranceScreen extends StatelessWidget {
  const AreaYieldIndexInsuranceScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'AYII Insurance',
      apiPath: '/api/agriculture-enhancement/area-yield-index-insurance/list',
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

class LivestockInsuranceScreen extends StatelessWidget {
  const LivestockInsuranceScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Livestock Insurance',
      apiPath: '/api/agriculture-enhancement/livestock-insurance/list',
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

class CropYieldPredictionScreen extends StatelessWidget {
  const CropYieldPredictionScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Yield Prediction',
      apiPath: '/api/agriculture-enhancement/crop-yield-prediction/list',
    );
  }
}

class MultiPerilCropInsuranceScreen extends StatelessWidget {
  const MultiPerilCropInsuranceScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'MPCI Insurance',
      apiPath: '/api/agriculture-enhancement/multi-peril-crop-insurance/list',
    );
  }
}

class AgriLogisticsScreen extends StatelessWidget {
  const AgriLogisticsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Agri Logistics',
      apiPath: '/api/agriculture-enhancement/agri-logistics/list',
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

class AnimalIdTraceabilityScreen extends StatelessWidget {
  const AnimalIdTraceabilityScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Animal Traceability',
      apiPath: '/api/agriculture-enhancement/animal-id-traceability/list',
    );
  }
}

class NirsalAgroGeocoopScreen extends StatelessWidget {
  const NirsalAgroGeocoopScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'NIRSAL Geo-Coop',
      apiPath: '/api/agriculture-enhancement/nirsal-agro-geocoop/list',
    );
  }
}

class AgriIotSensorScreen extends StatelessWidget {
  const AgriIotSensorScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'IoT Sensors',
      apiPath: '/api/agriculture-enhancement/agri-iot-sensor/list',
    );
  }
}

class AgriReinsuranceScreen extends StatelessWidget {
  const AgriReinsuranceScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Agri Reinsurance',
      apiPath: '/api/agriculture-enhancement/agri-reinsurance/list',
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

class AgriEsgImpactScreen extends StatelessWidget {
  const AgriEsgImpactScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'ESG Impact',
      apiPath: '/api/agriculture-enhancement/agri-esg-impact/list',
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

class CooperativeMeetingsScreen extends StatelessWidget {
  const CooperativeMeetingsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Coop Meetings',
      apiPath: '/api/agriculture-enhancement/cooperative-meetings/list',
    );
  }
}

class CooperativeFinancialsScreen extends StatelessWidget {
  const CooperativeFinancialsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Coop Financials',
      apiPath: '/api/agriculture-enhancement/cooperative-financials/list',
    );
  }
}

class SoilAnalysisScreen extends StatelessWidget {
  const SoilAnalysisScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return CrudScaffold(
      title: 'Soil Analysis',
      apiPath: '/api/agriculture-enhancement/soil-analysis/list',
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
