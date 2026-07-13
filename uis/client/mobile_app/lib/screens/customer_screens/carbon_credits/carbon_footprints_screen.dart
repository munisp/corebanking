import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../../models/carbon_footprint.dart';
import '../../../services/carbon_service.dart';
import '../../../services/error_handler_service.dart';

class CarbonFootprintsScreen extends StatefulWidget {
  const CarbonFootprintsScreen({super.key});

  @override
  State<CarbonFootprintsScreen> createState() => _CarbonFootprintsScreenState();
}

class _CarbonFootprintsScreenState extends State<CarbonFootprintsScreen> {
  final CarbonService _carbonService = CarbonService();
  
  bool _isLoading = true;
  String? _errorMessage;
  List<CarbonFootprint> _footprints = [];

  @override
  void initState() {
    super.initState();
    _loadFootprints();
  }

  Future<void> _loadFootprints() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final footprints = await _carbonService.getFootprints();
      setState(() {
        _footprints = footprints;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = ErrorHandlerService.handleError(e);
        _isLoading = false;
      });
    }
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }

  double get _totalEmissions => _footprints.fold(0.0, (sum, fp) => sum + fp.totalEmissions);
  
  double get _averageEmissions => _footprints.isEmpty ? 0.0 : _totalEmissions / _footprints.length;

  List<PieChartSectionData> _getBreakdownSections(Map<String, dynamic>? breakdown) {
    if (breakdown == null || breakdown.isEmpty) {
      return [];
    }

    final colors = [
      Colors.blue,
      Colors.green,
      Colors.orange,
      Colors.red,
      Colors.purple,
      Colors.teal,
      Colors.amber,
      Colors.pink,
    ];

    int index = 0;
    return breakdown.entries.map((entry) {
      final value = (entry.value as num).toDouble();
      final color = colors[index % colors.length];
      index++;
      
      return PieChartSectionData(
        color: color,
        value: value,
        title: '${entry.key}\n${value.toStringAsFixed(1)}',
        radius: 100,
        titleStyle: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      );
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 60, color: Colors.red),
                      const SizedBox(height: 16),
                      Text(
                        _errorMessage!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.red),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadFootprints,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _footprints.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.eco_outlined, size: 60, color: Colors.grey),
                          SizedBox(height: 16),
                          Text(
                            'No carbon footprint data available',
                            style: TextStyle(fontSize: 16, color: Colors.grey),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadFootprints,
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        child: Column(
                          children: [
                            // Summary Cards
                            Container(
                              padding: const EdgeInsets.all(16),
                              color: Colors.orange[50],
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Card(
                                      child: Padding(
                                        padding: const EdgeInsets.all(16),
                                        child: Column(
                                          children: [
                                            const Icon(Icons.co2, size: 32, color: Colors.orange),
                                            const SizedBox(height: 8),
                                            Text(
                                              _totalEmissions.toStringAsFixed(1),
                                              style: const TextStyle(
                                                fontSize: 24,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                            const Text('Total Emissions (tons CO₂)'),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Card(
                                      child: Padding(
                                        padding: const EdgeInsets.all(16),
                                        child: Column(
                                          children: [
                                            const Icon(Icons.analytics, size: 32, color: Colors.blue),
                                            const SizedBox(height: 8),
                                            Text(
                                              _averageEmissions.toStringAsFixed(1),
                                              style: const TextStyle(
                                                fontSize: 24,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                            const Text('Average (tons CO₂)'),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            
                            // Latest Footprint Breakdown Chart
                            if (_footprints.isNotEmpty && _footprints.first.breakdown != null)
                              Padding(
                                padding: const EdgeInsets.all(16),
                                child: Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text(
                                          'Latest Emissions Breakdown',
                                          style: TextStyle(
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        const SizedBox(height: 16),
                                        SizedBox(
                                          height: 250,
                                          child: _getBreakdownSections(_footprints.first.breakdown).isEmpty
                                              ? const Center(
                                                  child: Text(
                                                    'No breakdown data',
                                                    style: TextStyle(color: Colors.grey),
                                                  ),
                                                )
                                              : PieChart(
                                                  PieChartData(
                                                    sections: _getBreakdownSections(_footprints.first.breakdown),
                                                    centerSpaceRadius: 0,
                                                    sectionsSpace: 2,
                                                  ),
                                                ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            
                            // Footprint History
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Footprint History',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  ListView.builder(
                                    shrinkWrap: true,
                                    physics: const NeverScrollableScrollPhysics(),
                                    itemCount: _footprints.length,
                                    itemBuilder: (context, index) {
                                      final footprint = _footprints[index];
                                      return Card(
                                        margin: const EdgeInsets.only(bottom: 12),
                                        child: ExpansionTile(
                                          leading: const Icon(Icons.calendar_today, color: Colors.orange),
                                          title: Text(
                                            footprint.period,
                                            style: const TextStyle(fontWeight: FontWeight.bold),
                                          ),
                                          subtitle: Text(
                                            '${footprint.totalEmissions.toStringAsFixed(2)} tons CO₂',
                                            style: const TextStyle(color: Colors.orange),
                                          ),
                                          trailing: Text(
                                            _formatDate(footprint.createdAt),
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.grey[600],
                                            ),
                                          ),
                                          children: [
                                            if (footprint.breakdown != null && footprint.breakdown!.isNotEmpty)
                                              Padding(
                                                padding: const EdgeInsets.all(16),
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    const Text(
                                                      'Emissions Breakdown:',
                                                      style: TextStyle(
                                                        fontWeight: FontWeight.bold,
                                                        fontSize: 14,
                                                      ),
                                                    ),
                                                    const SizedBox(height: 8),
                                                    ...footprint.breakdown!.entries.map((entry) {
                                                      final value = (entry.value as num).toDouble();
                                                      final percentage = (value / footprint.totalEmissions * 100);
                                                      
                                                      return Padding(
                                                        padding: const EdgeInsets.symmetric(vertical: 4),
                                                        child: Row(
                                                          children: [
                                                            Expanded(
                                                              flex: 2,
                                                              child: Text(
                                                                entry.key,
                                                                style: const TextStyle(fontSize: 13),
                                                              ),
                                                            ),
                                                            Expanded(
                                                              flex: 3,
                                                              child: Column(
                                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                                children: [
                                                                  Row(
                                                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                                    children: [
                                                                      Text(
                                                                        '${value.toStringAsFixed(2)} tons',
                                                                        style: const TextStyle(
                                                                          fontSize: 13,
                                                                          fontWeight: FontWeight.w600,
                                                                        ),
                                                                      ),
                                                                      Text(
                                                                        '${percentage.toStringAsFixed(1)}%',
                                                                        style: TextStyle(
                                                                          fontSize: 12,
                                                                          color: Colors.grey[600],
                                                                        ),
                                                                      ),
                                                                    ],
                                                                  ),
                                                                  const SizedBox(height: 4),
                                                                  LinearProgressIndicator(
                                                                    value: percentage / 100,
                                                                    backgroundColor: Colors.grey[300],
                                                                    valueColor: const AlwaysStoppedAnimation<Color>(
                                                                      Colors.orange,
                                                                    ),
                                                                  ),
                                                                ],
                                                              ),
                                                            ),
                                                          ],
                                                        ),
                                                      );
                                                    }),
                                                  ],
                                                ),
                                              )
                                            else
                                              const Padding(
                                                padding: EdgeInsets.all(16),
                                                child: Text(
                                                  'No breakdown data available',
                                                  style: TextStyle(
                                                    fontStyle: FontStyle.italic,
                                                    color: Colors.grey,
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
                        ),
                      ),
                    ),
    );
  }
}
