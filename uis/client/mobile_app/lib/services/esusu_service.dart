library;
import 'api_service.dart';
import 'dart:async';
import '../models/user.dart';
import 'user_service.dart';

class EsusuService {
    /// Get user details from local storage
    Future<User?> getLocalUser() async {
      final userService = UserService();
      return await userService.getStoredUserII();
    }
  static EsusuService? _instance;
  static EsusuService get instance => _instance ??= EsusuService._();

  final ApiService _apiClient = ApiService();
  EsusuService._();

  // Cache to store group data with members
  final Map<String, EsusuGroup> _groupCache = {};

  Future<List<EsusuGroup>> getGroups({
    EsusuGroupStatus? status,
    bool? myGroups,
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        // if (status != null) 'status': status.value,
        if (myGroups == true) 'my_groups': true,
        'page': page,
        'limit': pageSize,
      };

      final response = await _apiClient.get(
        '/esusu/api/v1/esusu/groups',
        queryParameters: queryParams,
      );

      // Handle different response structures
      List<dynamic> itemsRaw;
      if (response.data is List) {
        itemsRaw = response.data as List;
      } else if (response.data is Map) {
        final dataMap = response.data as Map<String, dynamic>;
        itemsRaw = (dataMap['groups'] ?? dataMap['data'] ?? []) as List;
      } else {
        itemsRaw = [];
      }

      final List<EsusuGroup> groups = [];
      for (var i = 0; i < itemsRaw.length; i++) {
        try {
          final item = itemsRaw[i];
          if (item is Map<String, dynamic>) {
            final group = EsusuGroup.fromJson(item);
            groups.add(group);
            _groupCache[group.id] = group;
          }
        } catch (itemError) {
          // Skip malformed items
        }
      }

      return groups;
    } catch (e) {
      return [];
    }
  }

  Future<EsusuGroup> getGroup(String groupId) async {
    final response = await _apiClient.get('/esusu/api/v1/esusu/groups/$groupId');
    final group = EsusuGroup.fromJson(response.data as Map<String, dynamic>);
    _groupCache[groupId] = group;
    return group;
  }

  Future<EsusuGroup> createGroup({
    required String name,
    String? description,
    required double contributionAmount,
    required ContributionFrequency frequency,
    required int maxMembers,
    required DateTime startDate,
    String? creatorId,
    String? creatorName,
  }) async {
    User? user;
    if (creatorId == null || creatorName == null) {
      user = await getLocalUser();
    }
    final payload = {
      'name': name,
      'description': description,
      'contribution_amount': contributionAmount,
      'frequency': frequency.value,
      'max_members': maxMembers,
      'start_date': startDate.toUtc().toIso8601String(),
      'created_by': creatorId ?? user?.id,
      'creator_name': creatorName ?? user?.fullName,
    };
    final response = await _apiClient.post('/esusu/api/v1/esusu/groups', data: payload);
    final group = EsusuGroup.fromJson(response.data as Map<String, dynamic>);
    _groupCache[group.id] = group;
    return group;
  }

  Future<EsusuMember> joinGroup(
    String groupId) async {
    User? user;
      user = await getLocalUser();
      if (user == null || user.id.isEmpty || user.fullName.isEmpty || user.phoneNumber == null || user.phoneNumber!.isEmpty) {

        throw Exception('No valid local user found, $user');
      }

    final payload = {
      'user_id':  user.id,
      'name':  user.fullName,
      'phone': user.phoneNumber,

    };
    final response = await _apiClient.post(
      '/esusu/api/v1/esusu/groups/$groupId/join',
      data: payload,
    );
    _groupCache.remove(groupId);
    return EsusuMember.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get members from group data
  /// Since members are included in the group response, we just fetch the group
  Future<List<EsusuMember>> getGroupMembers(String groupId) async {
    try {
      final group = await getGroup(groupId);
      return group.members;
    } catch (e) {
      return [];
    }
  }

  Future<EsusuContribution> makeContribution(
    String groupId, {
    String? memberId,
    double? amount,
    required DateTime expectedDate,
    required String paymentMethod,
  }) async {
    User? user;
      user = await getLocalUser();
      if (user == null || user.id.isEmpty) {
        throw Exception('No valid local user found, $user');
      }
    final payload = {
      'member_id':  user.id,
      'amount': amount ?? 0.0,
      'expected_date': expectedDate.toUtc().toIso8601String(),
      'payment_method': paymentMethod,
    };
    final response = await _apiClient.post(
      '/esusu/api/v1/esusu/groups/$groupId/contributions',
      data: payload,
    );
    return EsusuContribution.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<EsusuContribution>> getContributions(String groupId, {int? round}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (round != null) queryParams['round'] = round;

      final response = await _apiClient.get(
        '/esusu/api/v1/esusu/groups/$groupId/contributions',
        queryParameters: queryParams,
      );

      List<dynamic> itemsRaw;
      if (response.data is List) {
        itemsRaw = response.data as List;
      } else if (response.data is Map) {
        final dataMap = response.data as Map<String, dynamic>;
        itemsRaw = (dataMap['contributions'] ?? dataMap['data'] ?? []) as List;
      } else {
        itemsRaw = [];
      }

      final List<EsusuContribution> contributions = [];
      for (var item in itemsRaw) {
        if (item is Map<String, dynamic>) {
          contributions.add(EsusuContribution.fromJson(item));
        }
      }

      return contributions;
    } catch (e) {
      return [];
    }
  }

  Future<List<EsusuPayout>> getPayouts(String groupId) async {
    try {
      final response = await _apiClient.get(
        '/esusu/api/v1/esusu/groups/$groupId/payouts',
      );

      List<dynamic> itemsRaw;
      if (response.data is List) {
        itemsRaw = response.data as List;
      } else if (response.data is Map) {
        final dataMap = response.data as Map<String, dynamic>;
        itemsRaw = (dataMap['payouts'] ?? dataMap['data'] ?? []) as List;
      } else {
        itemsRaw = [];
      }

      final List<EsusuPayout> payouts = [];
      for (var item in itemsRaw) {
        if (item is Map<String, dynamic>) {
          payouts.add(EsusuPayout.fromJson(item));
        }
      }

      return payouts;
    } catch (e) {
      return [];
    }
  }

  Future<EsusuPayout> processPayout(String groupId) async {
    final response = await _apiClient.post('/esusu/api/v1/esusu/groups/$groupId/payout');
    return EsusuPayout.fromJson(response.data as Map<String, dynamic>);
  }

  /// Clear cache for a specific group or all groups
  void clearCache([String? groupId]) {
    if (groupId != null) {
      _groupCache.remove(groupId);
    } else {
      _groupCache.clear();
    }
  }
}

/// Esusu group status types
enum EsusuGroupStatus {
  pending,
  active,
  completed,
  cancelled,
}

extension EsusuGroupStatusExtension on EsusuGroupStatus {
  String get value {
    switch (this) {
      case EsusuGroupStatus.pending:
        return 'pending';
      case EsusuGroupStatus.active:
        return 'active';
      case EsusuGroupStatus.completed:
        return 'completed';
      case EsusuGroupStatus.cancelled:
        return 'cancelled';
    }
  }

  static EsusuGroupStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'pending':
        return EsusuGroupStatus.pending;
      case 'active':
        return EsusuGroupStatus.active;
      case 'completed':
        return EsusuGroupStatus.completed;
      case 'cancelled':
        return EsusuGroupStatus.cancelled;
      default:
        return EsusuGroupStatus.pending;
    }
  }
}

/// Esusu member status types
enum EsusuMemberStatus {
  pending,
  active,
  defaulted,
  completed,
}

extension EsusuMemberStatusExtension on EsusuMemberStatus {
  String get value {
    switch (this) {
      case EsusuMemberStatus.pending:
        return 'pending';
      case EsusuMemberStatus.active:
        return 'active';
      case EsusuMemberStatus.defaulted:
        return 'defaulted';
      case EsusuMemberStatus.completed:
        return 'completed';
    }
  }

  static EsusuMemberStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'pending':
        return EsusuMemberStatus.pending;
      case 'active':
        return EsusuMemberStatus.active;
      case 'defaulted':
        return EsusuMemberStatus.defaulted;
      case 'completed':
        return EsusuMemberStatus.completed;
      default:
        return EsusuMemberStatus.pending;
    }
  }
}

/// Contribution frequency types
enum ContributionFrequency {
  daily,
  weekly,
  biweekly,
  monthly,
}

extension ContributionFrequencyExtension on ContributionFrequency {
  String get value {
    switch (this) {
      case ContributionFrequency.daily:
        return 'daily';
      case ContributionFrequency.weekly:
        return 'weekly';
      case ContributionFrequency.biweekly:
        return 'biweekly';
      case ContributionFrequency.monthly:
        return 'monthly';
    }
  }

  static ContributionFrequency fromString(String value) {
    switch (value.toLowerCase()) {
      case 'daily':
        return ContributionFrequency.daily;
      case 'weekly':
        return ContributionFrequency.weekly;
      case 'biweekly':
        return ContributionFrequency.biweekly;
      case 'monthly':
        return ContributionFrequency.monthly;
      default:
        return ContributionFrequency.monthly;
    }
  }
}

/// Esusu group model
class EsusuGroup {
  final String id;
  final String name;
  final String? description;
  final EsusuGroupStatus status;
  final double contributionAmount;
  final ContributionFrequency frequency;
  final int maxMembers;
  final int currentMembers;
  final int currentRound;
  final int totalRounds;
  final DateTime startDate;
  final DateTime? endDate;
  final String creatorId;
  final String creatorName;
  final DateTime createdAt;
  final List<EsusuMember> members; // Members are included in group data

  EsusuGroup({
    required this.id,
    required this.name,
    this.description,
    required this.status,
    required this.contributionAmount,
    required this.frequency,
    required this.maxMembers,
    required this.currentMembers,
    required this.currentRound,
    required this.totalRounds,
    required this.startDate,
    this.endDate,
    required this.creatorId,
    required this.creatorName,
    required this.createdAt,
    required this.members,
  });

  factory EsusuGroup.fromJson(Map<String, dynamic> json) {
    final List<EsusuMember> membersList = [];
    if (json['members'] != null && json['members'] is List) {
      final membersData = json['members'] as List;
      for (var i = 0; i < membersData.length; i++) {
        try {
          final memberItem = membersData[i];
          if (memberItem is Map<String, dynamic>) {
            membersList.add(EsusuMember.fromJson(memberItem));
          }
        } catch (_) {
          // Skip malformed member
        }
      }
    }

    return EsusuGroup(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString(),
      status: EsusuGroupStatusExtension.fromString(
        (json['status'] ?? 'pending').toString(),
      ),
      contributionAmount: (json['contribution_amount'] ?? json['contributionAmount'] ?? 0).toDouble(),
      frequency: ContributionFrequencyExtension.fromString(
        (json['frequency'] ?? 'monthly').toString(),
      ),
      maxMembers: (json['max_members'] ?? json['maxMembers'] ?? 0) as int,
      currentMembers: membersList.length,
      currentRound: (json['current_cycle'] ?? json['currentRound'] ?? 0) as int,
      totalRounds: (json['total_cycles'] ?? json['totalRounds'] ?? 0) as int,
      startDate: json['start_date'] != null
          ? DateTime.parse(json['start_date'].toString())
          : DateTime.now(),
      endDate: json['end_date'] != null
          ? DateTime.parse(json['end_date'].toString())
          : null,
      creatorId: json['created_by']?.toString() ?? json['creator_id']?.toString() ?? '',
      // creator_name takes priority over admin_id (which is an ID, not a display name)
      creatorName: json['creator_name']?.toString() ?? json['admin_name']?.toString() ?? 'Unknown',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'].toString())
          : DateTime.now(),
      members: membersList,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      if (description != null) 'description': description,
      'status': status.value,
      'contribution_amount': contributionAmount,
      'frequency': frequency.value,
      'max_members': maxMembers,
      'current_members': currentMembers,
      'current_round': currentRound,
      'total_rounds': totalRounds,
      'start_date': startDate.toIso8601String(),
      if (endDate != null) 'end_date': endDate!.toIso8601String(),
      'creator_id': creatorId,
      'creator_name': creatorName,
      'created_at': createdAt.toIso8601String(),
      'members': members.map((m) => m.toJson()).toList(),
    };
  }
}

/// Esusu member model
class EsusuMember {
  final String id;
  final String groupId;
  final String userId;
  final String fullName;
  final String phone;
  final EsusuMemberStatus status;
  final int position;
  final double totalContributed;
  final double totalReceived;
  final bool hasReceivedPayout;
  final DateTime joinedAt;

  EsusuMember({
    required this.id,
    required this.groupId,
    required this.userId,
    required this.fullName,
    required this.phone,
    required this.status,
    required this.position,
    required this.totalContributed,
    required this.totalReceived,
    required this.hasReceivedPayout,
    required this.joinedAt,
  });

  factory EsusuMember.fromJson(Map<String, dynamic> json) {
    return EsusuMember(
      id: json['id']?.toString() ?? '',
      groupId: json['group_id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? '',
      fullName: json['full_name']?.toString() ?? json['name']?.toString() ?? 'Unknown',
      phone: json['phone']?.toString() ?? '',
      status: EsusuMemberStatusExtension.fromString(
        (json['status'] ?? 'pending').toString(),
      ),
      position: (json['position'] ?? 0) as int,
      totalContributed: (json['total_contributed'] ?? 0).toDouble(),
      totalReceived: (json['total_received'] ?? 0).toDouble(),
      hasReceivedPayout: json['has_received_payout'] == true,
      joinedAt: json['joined_at'] != null
          ? DateTime.parse(json['joined_at'].toString())
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'group_id': groupId,
      'user_id': userId,
      'full_name': fullName,
      'phone': phone,
      'status': status.value,
      'position': position,
      'total_contributed': totalContributed,
      'total_received': totalReceived,
      'has_received_payout': hasReceivedPayout,
      'joined_at': joinedAt.toIso8601String(),
    };
  }
}

/// Esusu contribution model
class EsusuContribution {
  final String id;
  final String groupId;
  final String memberId;
  final String memberName;
  final int round;
  final double amount;
  final DateTime contributedAt;
  final String? transactionRef;

  EsusuContribution({
    required this.id,
    required this.groupId,
    required this.memberId,
    required this.memberName,
    required this.round,
    required this.amount,
    required this.contributedAt,
    this.transactionRef,
  });

  factory EsusuContribution.fromJson(Map<String, dynamic> json) {
    return EsusuContribution(
      id: json['id']?.toString() ?? '',
      groupId: json['group_id']?.toString() ?? '',
      memberId: json['member_id']?.toString() ?? '',
      memberName: json['member_name']?.toString() ?? '',
      round: (json['round'] ?? 0) as int,
      amount: (json['amount'] ?? 0).toDouble(),
      contributedAt: json['contributed_at'] != null
          ? DateTime.parse(json['contributed_at'].toString())
          : DateTime.now(),
      transactionRef: json['transaction_ref']?.toString(),
    );
  }
}

/// Esusu payout model
class EsusuPayout {
  final String id;
  final String groupId;
  final String memberId;
  final String memberName;
  final int round;
  final double amount;
  final DateTime paidAt;
  final String? transactionRef;

  EsusuPayout({
    required this.id,
    required this.groupId,
    required this.memberId,
    required this.memberName,
    required this.round,
    required this.amount,
    required this.paidAt,
    this.transactionRef,
  });

  factory EsusuPayout.fromJson(Map<String, dynamic> json) {
    return EsusuPayout(
      id: json['id']?.toString() ?? '',
      groupId: json['group_id']?.toString() ?? '',
      memberId: json['member_id']?.toString() ?? '',
      memberName: json['member_name']?.toString() ?? '',
      round: (json['round'] ?? 0) as int,
      amount: (json['amount'] ?? 0).toDouble(),
      paidAt: json['paid_at'] != null
          ? DateTime.parse(json['paid_at'].toString())
          : DateTime.now(),
      transactionRef: json['transaction_ref']?.toString(),
    );
  }
}

/// Esusu stats model
class EsusuStats {
  final int totalGroups;
  final int activeGroups;
  final int totalMembers;
  final double totalContributions;
  final double totalPayouts;
  final int myGroups;
  final double myContributions;
  final double myPayouts;

  EsusuStats({
    required this.totalGroups,
    required this.activeGroups,
    required this.totalMembers,
    required this.totalContributions,
    required this.totalPayouts,
    required this.myGroups,
    required this.myContributions,
    required this.myPayouts,
  });

  factory EsusuStats.fromJson(Map<String, dynamic> json) {
    return EsusuStats(
      totalGroups: (json['total_groups'] ?? 0) as int,
      activeGroups: (json['active_groups'] ?? 0) as int,
      totalMembers: (json['total_members'] ?? 0) as int,
      totalContributions: (json['total_contributions'] ?? 0).toDouble(),
      totalPayouts: (json['total_payouts'] ?? 0).toDouble(),
      myGroups: (json['my_groups'] ?? 0) as int,
      myContributions: (json['my_contributions'] ?? 0).toDouble(),
      myPayouts: (json['my_payouts'] ?? 0).toDouble(),
    );
  }
}
