/// Esusu Screen for Flutter
/// Main screen for Esusu (rotating savings) groups management
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../services/esusu_service.dart';
import '../../../config/app_theme.dart';
import '../../../providers/tenant_provider.dart';
import 'dart:convert';

class EsusuScreen extends StatefulWidget {
  const EsusuScreen({super.key});

  @override
  State<EsusuScreen> createState() => _EsusuScreenState();
}

class _EsusuScreenState extends State<EsusuScreen> with SingleTickerProviderStateMixin {
  final EsusuService _esusuService = EsusuService.instance;
  late TabController _tabController;
  
  EsusuStats _stats = EsusuStats(
    totalGroups: 0,
    activeGroups: 0,
    totalMembers: 0,
    totalContributions: 0,
    totalPayouts: 0,
    myGroups: 0,
    myContributions: 0,
    myPayouts: 0,
  );
  List<EsusuGroup> _myGroups = [];
  List<EsusuGroup> _availableGroups = [];
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final myGroups = await _esusuService.getGroups(myGroups: true);
      final availableGroups = await _esusuService.getGroups(status: EsusuGroupStatus.active);

      if (!mounted) return;

      double myContributions = 0;
      double myPayouts = 0;
      int activeGroupsCount = 0;

      for (var group in myGroups) {
        if (group.status == EsusuGroupStatus.active) {
          activeGroupsCount++;
        }
      }

      setState(() {
        _myGroups = myGroups;
        _availableGroups = availableGroups;
        _stats = EsusuStats(
          totalGroups: myGroups.length + availableGroups.length,
          activeGroups: activeGroupsCount,
          totalMembers: myGroups.fold(0, (sum, group) => sum + group.currentMembers),
          totalContributions: 0,
          totalPayouts: 0,
          myGroups: myGroups.length,
          myContributions: myContributions,
          myPayouts: myPayouts,
        );
        _isLoading = false;
      });
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load data: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  String _formatCurrency(double amount) {
    if (amount >= 1000000) {
      return '₦${(amount / 1000000).toStringAsFixed(1)}M';
    }
    if (amount >= 1000) {
      return '₦${(amount / 1000).toStringAsFixed(1)}K';
    }
    return '₦${amount.toStringAsFixed(0)}';
  }

  Color _getStatusColor(EsusuGroupStatus status) {
    switch (status) {
      case EsusuGroupStatus.pending:
        return Colors.orange;
      case EsusuGroupStatus.active:
        return Colors.green;
      case EsusuGroupStatus.completed:
        return Colors.blue;
      case EsusuGroupStatus.cancelled:
        return Colors.red;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tenantProvider = Provider.of<TenantProvider>(context, listen: false);
    
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Esusu'),
        backgroundColor: tenantProvider.primaryColor,
        foregroundColor: Colors.white,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: const [
            Tab(text: 'My Groups'),
            Tab(text: 'Discover'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateGroupDialog,
        backgroundColor: tenantProvider.primaryColor,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading && _myGroups.isEmpty && _availableGroups.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && _myGroups.isEmpty && _availableGroups.isEmpty) {
      // Try to parse error as JSON for code, message, status, details
      String code = '';
      String message = '';
      String status = '';
      String details = '';
      try {
        final err = _error!;
        final json = err.contains('{') ? err.substring(err.indexOf('{')) : '';
        if (json.isNotEmpty) {
          final map = jsonDecode(json);
          code = map['code']?.toString() ?? '';
          message = map['message']?.toString() ?? '';
          status = map['status']?.toString() ?? '';
          details = map['details']?.toString() ?? '';
        } else {
          message = err;
        }
      } catch (_) {
        message = _error!;
      }
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.red.shade300),
              const SizedBox(height: 16),
              if (code.isNotEmpty) 
                Text('Code: $code', 
                  style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
              if (status.isNotEmpty) 
                Text('Status: $status', 
                  style: const TextStyle(color: Colors.red),
                  textAlign: TextAlign.center,
                ),
              if (message.isNotEmpty) 
                Text('Message: $message', 
                  style: const TextStyle(color: Colors.red),
                  textAlign: TextAlign.center,
                ),
              if (details.isNotEmpty) 
                Padding(
                  padding: const EdgeInsets.only(top: 8.0),
                  child: Text('Details: $details', 
                    style: const TextStyle(color: Colors.red, fontSize: 12),
                    textAlign: TextAlign.center,
                  ),
                ),
              if (code.isEmpty && status.isEmpty && message.isEmpty && details.isEmpty)
                Text(_error!, 
                  style: const TextStyle(color: Colors.red),
                  textAlign: TextAlign.center,
                ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _loadData, 
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        _buildStatsCard(),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildMyGroupsTab(),
              _buildDiscoverTab(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatsCard() {
    final tenantProvider = Provider.of<TenantProvider>(context, listen: false);
    
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [tenantProvider.primaryColor, tenantProvider.primaryColor.withOpacity(0.8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStatItem('My Groups', '${_stats.myGroups}'),
              _buildStatItem('Contributed', _formatCurrency(_stats.myContributions)),
              _buildStatItem('Received', _formatCurrency(_stats.myPayouts)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.white70)),
      ],
    );
  }

  Widget _buildMyGroupsTab() {
    if (_myGroups.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.group_off, size: 64, color: AppTheme.getTextSecondary(context)),
            const SizedBox(height: 16),
            Text('No groups yet', style: TextStyle(fontSize: 18, color: AppTheme.getTextPrimary(context))),
            const SizedBox(height: 8),
            Text('Create or join an Esusu group to get started', 
              style: TextStyle(color: AppTheme.getTextSecondary(context)),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      physics: const AlwaysScrollableScrollPhysics(),
      cacheExtent: 100,
      itemCount: _myGroups.length,
      itemBuilder: (context, index) => _buildGroupCard(_myGroups[index], isMyGroup: true),
    );
  }

  Widget _buildDiscoverTab() {
    if (_availableGroups.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: AppTheme.getTextSecondary(context)),
            const SizedBox(height: 16),
            Text('No groups available', style: TextStyle(fontSize: 18, color: AppTheme.getTextPrimary(context))),
            const SizedBox(height: 8),
            Text('Check back later for new groups', 
              style: TextStyle(color: AppTheme.getTextSecondary(context)),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      physics: const AlwaysScrollableScrollPhysics(),
      cacheExtent: 100,
      itemCount: _availableGroups.length,
      itemBuilder: (context, index) => _buildGroupCard(_availableGroups[index], isMyGroup: false),
    );
  }

  Widget _buildGroupCard(EsusuGroup group, {required bool isMyGroup}) {
    final statusColor = _getStatusColor(group.status);
    final progress = group.totalRounds > 0 ? group.currentRound / group.totalRounds : 0.0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.getCardBackground(context),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: AppTheme.getBorderColor(context).withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(group.name, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.getTextPrimary(context))),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  group.status.value.toUpperCase(),
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: statusColor),
                ),
              ),
            ],
          ),
          if (group.description != null && group.description!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(group.description!, style: TextStyle(fontSize: 12, color: AppTheme.getTextSecondary(context))),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              _buildGroupStat('Contribution', _formatCurrency(group.contributionAmount)),
              const SizedBox(width: 16),
              _buildGroupStat('Frequency', group.frequency.value),
              const SizedBox(width: 16),
              _buildGroupStat('Members', '${group.currentMembers}/${group.maxMembers}'),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Round ${group.currentRound}/${group.totalRounds}', style: TextStyle(fontSize: 12, color: AppTheme.getTextSecondary(context))),
                    const SizedBox(height: 4),
                    LinearProgressIndicator(
                      value: progress,
                      backgroundColor: AppTheme.getBorderColor(context),
                      valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Text(
                  'Created by ${group.creatorName}',
                  style: TextStyle(fontSize: 12, color: AppTheme.getTextSecondary(context)),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (isMyGroup)
                Consumer<TenantProvider>(
                  builder: (context, tenantProvider, _) => TextButton(
                    onPressed: () => _showGroupDetails(group),
                    style: TextButton.styleFrom(foregroundColor: tenantProvider.primaryColor),
                    child: const Text('View Details'),
                  ),
                )
              else if (group.currentMembers < group.maxMembers)
                Flexible(
                  child: Consumer<TenantProvider>(
                    builder: (context, tenantProvider, _) => ElevatedButton(
                      onPressed: () => _joinGroup(group.id),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: tenantProvider.primaryColor,
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('Join'),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildGroupStat(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 10, color: AppTheme.getTextSecondary(context))),
        Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.getTextPrimary(context))),
      ],
    );
  }

  Future<void> _joinGroup(String groupId) async {
    try {
      // Replace with actual user data from your auth/user provider
      
      await _esusuService.joinGroup(
        groupId
      );
      _loadData();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Successfully joined group')),
      );
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: ${e.toString()}')),
      );
    }
  }

  void _showGroupDetails(EsusuGroup group) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => _GroupDetailsSheet(
          group: group,
          esusuService: _esusuService,
          scrollController: scrollController,
        ),
      ),
    );
  }

  void _showCreateGroupDialog() {
    final nameController = TextEditingController();
    final descriptionController = TextEditingController();
    final amountController = TextEditingController();
    final membersController = TextEditingController();
    ContributionFrequency selectedFrequency = ContributionFrequency.monthly;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Create Esusu Group'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'Group Name'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descriptionController,
                  decoration: const InputDecoration(labelText: 'Description (optional)'),
                  maxLines: 2,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amountController,
                  decoration: const InputDecoration(labelText: 'Contribution Amount (₦)', prefixText: '₦'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: membersController,
                  decoration: const InputDecoration(labelText: 'Max Members'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<ContributionFrequency>(
                  initialValue: selectedFrequency,
                  decoration: const InputDecoration(labelText: 'Frequency'),
                  items: ContributionFrequency.values.map((freq) => DropdownMenuItem(
                    value: freq,
                    child: Text(freq.value),
                  )).toList(),
                  onChanged: (value) {
                    if (value != null) {
                      setDialogState(() {
                        selectedFrequency = value;
                      });
                    }
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (nameController.text.isEmpty || amountController.text.isEmpty || membersController.text.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please fill in all required fields')),
                  );
                  return;
                }
                Navigator.pop(context);
                try {
                  await _esusuService.createGroup(
                    name: nameController.text,
                    description: descriptionController.text.isNotEmpty ? descriptionController.text : null,
                    contributionAmount: double.parse(amountController.text),
                    frequency: selectedFrequency,
                    maxMembers: int.parse(membersController.text),
                    startDate: DateTime.now().add(const Duration(days: 7)),
                  );
                  _loadData();
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Group created successfully')),
                  );
                } on Exception catch (e) {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error: ${e.toString()}')),
                  );
                }
              },
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
  }
}

class _GroupDetailsSheet extends StatefulWidget {
  final EsusuGroup group;
  final EsusuService esusuService;
  final ScrollController scrollController;

  const _GroupDetailsSheet({
    required this.group,
    required this.esusuService,
    required this.scrollController,
  });

  @override
  State<_GroupDetailsSheet> createState() => _GroupDetailsSheetState();
}

class _GroupDetailsSheetState extends State<_GroupDetailsSheet> {
  List<EsusuContribution> contributions = [];
  bool isLoading = false;

  @override
  void initState() {
    super.initState();
    loadDetails();
  }

  Future<void> loadDetails() async {
    setState(() => isLoading = true);
    try {
      // Only load contributions - members are already in widget.group
      final loadedContributions = await widget.esusuService.getContributions(widget.group.id);
      
      if (!mounted) return;
      setState(() {
        contributions = loadedContributions;
        isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Use members directly from the group object
    final members = widget.group.members;
    
    return Container(
      padding: const EdgeInsets.all(16),
      child: ListView(
        controller: widget.scrollController,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(widget.group.name, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.getTextPrimary(context))),
          const SizedBox(height: 16),
          Text('Members', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.getTextPrimary(context))),
          const SizedBox(height: 8),
          if (members.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16.0),
              child: Text('No members yet', textAlign: TextAlign.center),
            )
          else
            ...members.map((member) => ListTile(
              leading: CircleAvatar(
                child: Text(
                  member.fullName.isNotEmpty ? member.fullName[0].toUpperCase() : '?',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
              title: Text(member.fullName.isNotEmpty ? member.fullName : 'Unknown Member'),
              subtitle: Text('Position: ${member.position}'),
              trailing: member.hasReceivedPayout
                  ? const Icon(Icons.check_circle, color: Colors.green)
                  : null,
            )),
          const SizedBox(height: 16),
          if (isLoading)
            const Center(child: CircularProgressIndicator())
          else if (contributions.isNotEmpty) ...[
            Text('Recent Contributions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.getTextPrimary(context))),
            const SizedBox(height: 8),
            ...contributions.take(5).map((contribution) => ListTile(
              leading: const Icon(Icons.payment),
              title: Text(contribution.memberName),
              subtitle: Text('Round ${contribution.round}'),
              trailing: Text('₦${contribution.amount.toStringAsFixed(0)}'),
            )),
          ],
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () async {
              try {
                final amount = widget.group.contributionAmount;
                final expectedDate = DateTime.now();
                const paymentMethod = 'bank_transfer';
                await widget.esusuService.makeContribution(
                  widget.group.id,
                  amount: amount,
                  expectedDate: expectedDate,
                  paymentMethod: paymentMethod,
                );
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Contribution made successfully')),
                );
                loadDetails();
              } on Exception catch (e) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Error: ${e.toString()}')),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Provider.of<TenantProvider>(context, listen: false).primaryColor,
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 48),
            ),
            child: const Text('Make Contribution'),
          ),
        ],
      ),
    );
  }
}