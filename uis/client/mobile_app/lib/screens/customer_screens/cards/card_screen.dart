import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb, debugPrint;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;
import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../providers/tenant_provider.dart';
import '../../../services/card_service.dart';
import '../../../services/api_service.dart';
import '../../../models/transaction.dart';
import '../../../services/wallet_service.dart';

class CardScreen extends StatefulWidget {
  const CardScreen({super.key});

  @override
  State<CardScreen> createState() => _CardScreenState();
}

class _CardScreenState extends State<CardScreen> {
  final CardService _cardService = CardService(ApiService());
  final WalletService _walletService = WalletService(ApiService());
  
  bool showDetails = false;
  int selectedCard = 0;
  bool loading = true;
  String? error;
  
  List<Map<String, dynamic>> cards = [];
  List<Transaction> transactions = [];
  String? _accountId; // Loaded from localStorage
  double? _walletBalance; // Wallet balance to display on card

  @override
  void initState() {
    super.initState();
    _initializeData();
  }

  /// Initialize data by loading account_id first, then cards and transactions
  Future<void> _initializeData() async {
    await _loadAccountId();
    await _loadData();
  }

  /// Load account_id from localStorage/SharedPreferences (matching dashboard and transfer)
  Future<void> _loadAccountId() async {
    try {
      String? accountId;
      
      if (kIsWeb) {
        try {
          accountId = html.window.localStorage['account_id'];
          if (accountId == null) {
            // Fallback: try to get from account object
            final accountJson = html.window.localStorage['account'];
            if (accountJson != null) {
              final accountData = jsonDecode(accountJson);
              accountId = accountData['id']?.toString();
            }
          }
          debugPrint('[CardScreen] Web - account_id from localStorage: $accountId');
        } catch (e) {
          debugPrint('[CardScreen] Web - Failed to load account_id: $e');
        }
      } else {
        try {
          final prefs = await SharedPreferences.getInstance();
          accountId = prefs.getString('account_id');
          if (accountId == null) {
            // Fallback: try to get from account object
            final accountJson = prefs.getString('account');
            if (accountJson != null) {
              final accountData = jsonDecode(accountJson);
              accountId = accountData['id']?.toString();
            }
          }
          debugPrint('[CardScreen] Mobile - account_id from SharedPreferences: $accountId');
        } catch (e) {
          debugPrint('[CardScreen] Mobile - Failed to load account_id: $e');
        }
      }

      setState(() {
        _accountId = accountId;
      });
      
      if (accountId == null) {
        debugPrint('[CardScreen] ⚠️ WARNING: No account_id found in storage');
      } else {
        debugPrint('[CardScreen] ✓ Successfully loaded account_id: $accountId');
      }
    } catch (e) {
      debugPrint('[CardScreen] ❌ ERROR loading account_id: $e');
      setState(() {
        _accountId = null;
      });
    }
  }

  Future<void> _loadData() async {
    setState(() {
      loading = true;
      error = null;
    });

    try {
      // Load cards, transactions, and wallet balance in parallel
      final results = await Future.wait([
        _cardService.getCustomerCards(),
        _walletService.getTransactions(limit: 5, type: 'debit'),
        _walletService.getBalance().catchError((e) => 0.0),
      ]);

      final cardsResult = results[0] as Map<String, dynamic>;
      final transactionsResult = results[1] as List<Transaction>;
      final balance = results[2] as double;

      if (cardsResult['success'] == true) {
        setState(() {
          cards = List<Map<String, dynamic>>.from(cardsResult['data'] ?? []);
          transactions = transactionsResult;
          _walletBalance = balance;
          loading = false;
        });
      } else {
        setState(() {
          error = cardsResult['message'] ?? 'Failed to load cards';
          loading = false;
        });
      }
    } catch (e) {
      setState(() {
        error = e.toString();
        loading = false;
      });
    }
  }

  Future<void> _handleRefresh() async {
    await _loadData();
  }

  void handleBlock(String cardId, bool isCurrentlyBlocked) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isCurrentlyBlocked ? 'Unblock Card' : 'Block Card'),
        content: Text(isCurrentlyBlocked 
          ? 'Are you sure you want to unblock this card? It will be able to process transactions again.' 
          : 'Are you sure you want to block this card? It will not be able to process transactions until unblocked.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(isCurrentlyBlocked ? 'Unblock' : 'Block'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final result = isCurrentlyBlocked 
        ? await _cardService.unblockCard(cardId)
        : await _cardService.blockCard(cardId);

      if (mounted) {
        final tenantProvider = context.read<TenantProvider>();
        if (result['success'] == true) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? (isCurrentlyBlocked ? 'Card unblocked successfully' : 'Card blocked successfully')),
              backgroundColor: tenantProvider.successColor,
            ),
          );
          _loadData();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? 'Operation failed'),
              backgroundColor: tenantProvider.errorColor,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        final tenantProvider = context.read<TenantProvider>();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: tenantProvider.errorColor,
          ),
        );
      }
    }
  }

  void handleFreeze(String cardId, bool isCurrentlyFrozen) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isCurrentlyFrozen ? 'Unfreeze Card' : 'Freeze Card'),
        content: Text(isCurrentlyFrozen 
          ? 'Are you sure you want to unfreeze this card? It will be able to process transactions again.' 
          : 'Are you sure you want to freeze this card? It will temporarily stop processing transactions until unfrozen.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(isCurrentlyFrozen ? 'Unfreeze' : 'Freeze'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final result = isCurrentlyFrozen 
        ? await _cardService.unfreezeCard(cardId)
        : await _cardService.freezeCard(cardId);

      if (mounted) {
        final tenantProvider = context.read<TenantProvider>();
        if (result['success'] == true) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? (isCurrentlyFrozen ? 'Card unfrozen successfully' : 'Card frozen successfully')),
              backgroundColor: tenantProvider.successColor,
            ),
          );
          _loadData();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? 'Operation failed'),
              backgroundColor: tenantProvider.errorColor,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        final tenantProvider = context.read<TenantProvider>();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: tenantProvider.errorColor,
          ),
        );
      }
    }
  }

  Future<void> _promptSetPinAfterCreation(String cardId) async {
    String? pin;
    String? confirmPin;

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false, // Prevent dismissing without setting PIN
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            title: const Text('Set Card PIN'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Please set a 4-digit PIN for your new card',
                  style: TextStyle(fontSize: 14),
                ),
                const SizedBox(height: 16),
                TextField(
                  autofocus: true,
                  decoration: const InputDecoration(
                    labelText: 'Enter 4-digit PIN',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  obscureText: true,
                  onChanged: (value) {
                    pin = value;
                    setDialogState(() {});
                  },
                ),
                const SizedBox(height: 16),
                TextField(
                  decoration: const InputDecoration(
                    labelText: 'Confirm PIN',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  obscureText: true,
                  onChanged: (value) {
                    confirmPin = value;
                    setDialogState(() {});
                  },
                ),
              ],
            ),
            actions: [
              Consumer<TenantProvider>(
                builder: (context, tenantProvider, _) {
                  return TextButton(
                    onPressed: () {
                      if (pin == null || pin!.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: const Text('Please enter a 4-digit PIN'),
                            backgroundColor: tenantProvider.warningColor,
                          ),
                        );
                        return;
                      }
                      if (pin!.length != 4) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: const Text('PIN must be exactly 4 digits'),
                            backgroundColor: tenantProvider.warningColor,
                          ),
                        );
                        return;
                      }
                      if (pin != confirmPin) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: const Text('PINs do not match'),
                            backgroundColor: tenantProvider.warningColor,
                          ),
                        );
                        return;
                      }
                      Navigator.pop(context, true);
                    },
                    child: const Text('Set PIN'),
                  );
                },
              ),
            ],
          );
        },
      ),
    );

    if (confirmed != true || pin == null || pin!.length != 4) {
      // If user didn't set PIN, show warning and try again
      if (mounted) {
        final retry = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('PIN Required'),
            content: const Text('You must set a PIN for your card to use it. Would you like to set it now?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Later'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Set PIN Now'),
              ),
            ],
          ),
        );
        
        if (retry == true && mounted) {
          await _promptSetPinAfterCreation(cardId);
        }
      }
      return;
    }

    if (pin != confirmPin) {
      if (mounted) {
        final tenantProvider = context.read<TenantProvider>();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('PINs do not match. Please try again.'),
            backgroundColor: tenantProvider.errorColor,
          ),
        );
        // Retry
        await _promptSetPinAfterCreation(cardId);
      }
      return;
    }

    try {
      final result = await _cardService.setCardPin(cardId: cardId, pin: pin!);

      if (mounted) {
        final tenantProvider = context.read<TenantProvider>();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? (result['success'] == true ? 'PIN set successfully' : 'Failed to set PIN')),
            backgroundColor: result['success'] == true ? tenantProvider.successColor : tenantProvider.errorColor,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        final tenantProvider = context.read<TenantProvider>();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error setting PIN: ${e.toString()}'),
            backgroundColor: tenantProvider.errorColor,
          ),
        );
      }
    }
  }

  void handleSetPin(String cardId) async {
    String? pin;
    String? confirmPin;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Set Card PIN'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              decoration: const InputDecoration(
                labelText: 'Enter 4-digit PIN',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
              maxLength: 4,
              obscureText: true,
              onChanged: (value) => pin = value,
            ),
            const SizedBox(height: 16),
            TextField(
              decoration: const InputDecoration(
                labelText: 'Confirm PIN',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
              maxLength: 4,
              obscureText: true,
              onChanged: (value) => confirmPin = value,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              if (pin == null || pin!.length != 4) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('PIN must be 4 digits')),
                );
                return;
              }
              if (pin != confirmPin) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('PINs do not match')),
                );
                return;
              }
              Navigator.pop(context, true);
            },
            child: const Text('Set PIN'),
          ),
        ],
      ),
    );

    if (confirmed != true || pin == null) return;

    try {
      final result = await _cardService.setCardPin(cardId: cardId, pin: pin!);

      if (mounted) {
        final tenantProvider = context.read<TenantProvider>();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? (result['success'] == true ? 'PIN set successfully' : 'Failed to set PIN')),
            backgroundColor: result['success'] == true ? tenantProvider.successColor : tenantProvider.errorColor,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        final tenantProvider = context.read<TenantProvider>();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: tenantProvider.errorColor,
          ),
        );
      }
    }
  }

  void handleRequestNew() async {
    // Check if account_id is available
    if (_accountId == null || _accountId!.isEmpty) {
      final tenantProvider = context.read<TenantProvider>();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Account ID not found. Please ensure you have an active account.'),
          backgroundColor: tenantProvider.errorColor,
        ),
      );
      return;
    }

    String? nameOnCard;
    String cardType = 'virtual';

    final result = await showDialog<Map<String, String>?>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setState) {
          return AlertDialog(
            title: const Text('Request New Card'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Display Account ID (read-only)
                  TextFormField(
                    initialValue: _accountId,
                    enabled: false,
                    decoration: const InputDecoration(
                      labelText: 'Account ID',
                      border: OutlineInputBorder(),
                      hintText: 'Your account ID',
                      suffixIcon: Icon(Icons.lock, size: 18),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    decoration: const InputDecoration(
                      labelText: 'Name on Card',
                      border: OutlineInputBorder(),
                      hintText: 'Enter name as it should appear on card',
                    ),
                    onChanged: (value) => nameOnCard = value,
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: cardType,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Card Type',
                      border: OutlineInputBorder(),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'virtual', child: Text('Virtual Card')),
                      DropdownMenuItem(value: 'debit', child: Text('Debit Card')),
                      DropdownMenuItem(value: 'credit', child: Text('Credit Card')),
                    ],
                    onChanged: (value) {
                      if (value != null) {
                        setState(() {
                          cardType = value;
                        });
                      }
                    },
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, null),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () {
                  if (nameOnCard == null || nameOnCard!.isEmpty) {
                    ScaffoldMessenger.of(dialogContext).showSnackBar(
                      const SnackBar(content: Text('Please enter Name on Card')),
                    );
                    return;
                  }
                  Navigator.pop(dialogContext, {
                    'nameOnCard': nameOnCard!,
                    'cardType': cardType,
                  });
                },
                child: const Text('Request'),
              ),
            ],
          );
        },
      ),
    );

    if (result == null) return;

    nameOnCard = result['nameOnCard'];
    cardType = result['cardType'] ?? 'virtual';

    try {
      final result = await _cardService.issueCard(
        cardType: cardType,
        accountId: _accountId!,
        nameOnCard: nameOnCard!,
      );

      if (mounted) {
        final tenantProvider = context.read<TenantProvider>();
        if (result['success'] == true) {
          // Show success message first
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? 'Card created successfully'),
              backgroundColor: tenantProvider.successColor,
            ),
          );
          
          // Reload data to get the newly created card
          await _loadData();
          
          // Extract card ID from response
          // Response structure: { "status": "issued", "card_id": "CRD1766218237", "card_number": "...", "expiry_date": "..." }
          final cardData = result['data'];
          String? cardId;
          
          debugPrint('Card creation response data: $cardData');
          
          if (cardData != null && cardData is Map<String, dynamic>) {
            // The response data is a Map with card_id directly
            cardId = cardData['card_id']?.toString();
            debugPrint('Extracted card ID from response: $cardId');
            
            // If still not found, try alternative field names
            if (cardId == null || cardId.isEmpty) {
              cardId = cardData['id']?.toString() ?? 
                       cardData['cardId']?.toString();
            }
          }
          
          // If card ID not found in response, try to get it from the cards list (most recent card)
          if ((cardId == null || cardId.isEmpty) && cards.isNotEmpty) {
            final latestCard = cards.first;
            debugPrint('Getting card ID from cards list. Latest card keys: ${latestCard.keys}');
            cardId = latestCard['card_id']?.toString() ?? 
                     latestCard['id']?.toString() ?? 
                     latestCard['cardId']?.toString();
            debugPrint('Extracted card ID from cards list: $cardId');
          }
          
          debugPrint('Final card ID to use for PIN setup: $cardId');
          
          // If we have a card ID, immediately prompt for PIN setup
          if (cardId != null && cardId.isNotEmpty) {
            // Wait a moment for the UI to update
            await Future.delayed(const Duration(milliseconds: 800));
            
            if (mounted) {
              await _promptSetPinAfterCreation(cardId);
            }
          } else {
            // Card ID not found - show message but don't block
            debugPrint('Card ID not found in response. Response data: ${result['data']}');
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: const Text('Card created. Please set PIN from card settings.'),
                  backgroundColor: tenantProvider.warningColor,
                  duration: const Duration(seconds: 3),
                ),
              );
            }
          }
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? 'Card request failed'),
              backgroundColor: tenantProvider.errorColor,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        final tenantProvider = context.read<TenantProvider>();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: tenantProvider.errorColor,
          ),
        );
      }
    }
  }

  String _maskCardNumber(String cardNumber) {
    if (cardNumber.length < 4) return cardNumber;
    // Handle already masked numbers like "****9149"
    if (cardNumber.startsWith('****')) {
      return cardNumber.replaceAll('****', '**** **** ****');
    }
    final lastFour = cardNumber.substring(cardNumber.length - 4);
    return '**** **** **** $lastFour';
  }

  String _formatExpiryDate(String? expiryDate) {
    if (expiryDate == null || expiryDate.isEmpty) return 'MM/YY';
    
    try {
      // Handle format like "2028-12-18" -> "12/28"
      if (expiryDate.contains('-')) {
        final parts = expiryDate.split('-');
        if (parts.length >= 2) {
          final month = parts[1];
          final year = parts[0].length >= 4 ? parts[0].substring(2) : parts[0];
          return '$month/$year';
        }
      }
      // If already in MM/YY format, return as is
      return expiryDate;
    } catch (e) {
      return expiryDate;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('My Cards'),
        ),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (error != null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('My Cards'),
        ),
        body: Consumer<TenantProvider>(
          builder: (context, tenantProvider, _) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline, size: 64, color: tenantProvider.errorColor),
                  const SizedBox(height: 16),
                  const Text(
                    'Error loading cards',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(error!, textAlign: TextAlign.center),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: _handleRefresh,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Retry'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: tenantProvider.primaryColor,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      );
    }

    if (cards.isEmpty) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('My Cards'),
        ),
        body: Consumer<TenantProvider>(
          builder: (context, tenantProvider, _) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.credit_card_off, size: 80, color: tenantProvider.textSecondaryColor),
                  const SizedBox(height: 16),
                  const Text(
                    'No Cards Yet',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text('Request a new card to get started'),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: handleRequestNew,
                    icon: const Icon(Icons.add_card),
                    label: const Text('Request Card'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: tenantProvider.primaryColor,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      );
    }

    final currentCard = cards[selectedCard];

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _handleRefresh,
        child: CustomScrollView(
          slivers: [
            // Custom App Bar with gradient
            Consumer<TenantProvider>(
              builder: (context, tenantProvider, _) {
                return SliverAppBar(
                  expandedHeight: 500,
                  pinned: true,
                  elevation: 0,
                  backgroundColor: tenantProvider.primaryColor,
                  flexibleSpace: FlexibleSpaceBar(
                    background: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            tenantProvider.primaryColor,
                            tenantProvider.secondaryColor,
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: SafeArea(
                        child: Column(
                          children: [
                      Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Row(
                          children: [
                            const SizedBox(width: 40), // Space for back button
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'My Cards',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 24,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Manage your debit cards',
                                    style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 14),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(
                                Icons.credit_card,
                                color: Colors.white,
                                size: 24,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Card Display
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Stack(
                            children: [
                              Container(
                                margin: const EdgeInsets.only(top: 20, bottom: 10),
                                padding: const EdgeInsets.all(24),
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: (currentCard['card_type']?.toString().toLowerCase() ?? 'mastercard').contains('visa')
                                        ? [const Color(0xFF1A237E), const Color(0xFF283593), const Color(0xFF3949AB)]
                                        : [const Color(0xFF263238), const Color(0xFF37474F), const Color(0xFF455A64)],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(20),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.4),
                                      blurRadius: 24,
                                      offset: const Offset(0, 12),
                                      spreadRadius: 2,
                                    ),
                                  ],
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                'Available Balance',
                                                style: TextStyle(
                                                  color: Colors.white.withOpacity(0.8),
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w500,
                                                  letterSpacing: 0.5,
                                                ),
                                              ),
                                              const SizedBox(height: 8),
                                              Text(
                                                '₦${NumberFormat('#,##0.00').format(_walletBalance ?? 0)}',
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 30,
                                                  fontWeight: FontWeight.bold,
                                                  letterSpacing: 0.5,
                                                  height: 1.1,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        if ((currentCard['card_type']?.toString().toLowerCase() ?? '').contains('visa'))
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                            decoration: BoxDecoration(
                                              color: Colors.white.withOpacity(0.15),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: const Text(
                                              'VISA',
                                              style: TextStyle(
                                                color: Colors.white,
                                                fontSize: 22,
                                                fontWeight: FontWeight.bold,
                                                letterSpacing: 2,
                                              ),
                                            ),
                                          ),
                                        if ((currentCard['card_type']?.toString().toLowerCase() ?? 'mastercard').contains('master'))
                                          Container(
                                            padding: const EdgeInsets.all(8),
                                            decoration: BoxDecoration(
                                              color: Colors.white.withOpacity(0.15),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: SizedBox(
                                              width: 50,
                                              height: 30,
                                              child: Stack(
                                                children: [
                                                  Positioned(
                                                    left: 0,
                                                    child: Container(
                                                      width: 30,
                                                      height: 30,
                                                      decoration: const BoxDecoration(
                                                        color: Colors.red,
                                                        shape: BoxShape.circle,
                                                      ),
                                                    ),
                                                  ),
                                                  Positioned(
                                                    left: 20,
                                                    child: Container(
                                                      width: 30,
                                                      height: 30,
                                                      decoration: BoxDecoration(
                                                        color: Colors.orange.shade700,
                                                        shape: BoxShape.circle,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 32),
                                    // Card Number Section
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Card Number',
                                          style: TextStyle(
                                            color: Colors.white.withOpacity(0.8),
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500,
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          showDetails
                                              ? (currentCard['card_number']?.toString() ?? '****')
                                              : _maskCardNumber(currentCard['card_number']?.toString() ?? '****'),
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 22,
                                            letterSpacing: 4,
                                            fontWeight: FontWeight.w600,
                                            fontFamily: 'monospace',
                                            height: 1.2,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const Spacer(),
                                    // Bottom Details Row
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        // Card Holder
                                        Expanded(
                                          flex: 2,
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                'Card Holder',
                                                style: TextStyle(
                                                  color: Colors.white.withOpacity(0.8),
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w500,
                                                  letterSpacing: 0.5,
                                                ),
                                              ),
                                              const SizedBox(height: 6),
                                              Text(
                                                (currentCard['name_on_card']?.toString() ?? 'CARD HOLDER').toUpperCase(),
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 15,
                                                  fontWeight: FontWeight.w600,
                                                  letterSpacing: 1,
                                                  height: 1.2,
                                                ),
                                                overflow: TextOverflow.ellipsis,
                                                maxLines: 1,
                                              ),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(width: 16),
                                        // Expiry Date
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'Expires',
                                              style: TextStyle(
                                                color: Colors.white.withOpacity(0.8),
                                                fontSize: 11,
                                                fontWeight: FontWeight.w500,
                                                letterSpacing: 0.5,
                                              ),
                                            ),
                                            const SizedBox(height: 6),
                                            Text(
                                              _formatExpiryDate(currentCard['expiry_date']?.toString()),
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 15,
                                                fontWeight: FontWeight.w600,
                                                letterSpacing: 1,
                                                height: 1.2,
                                              ),
                                            ),
                                          ],
                                        ),
                                        // CVV (only shown when details are visible)
                                        if (showDetails) ...[
                                          const SizedBox(width: 16),
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                'CVV',
                                                style: TextStyle(
                                                  color: Colors.white.withOpacity(0.8),
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w500,
                                                  letterSpacing: 0.5,
                                                ),
                                              ),
                                              const SizedBox(height: 6),
                                              Text(
                                                currentCard['cvv']?.toString() ?? '***',
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 15,
                                                  fontWeight: FontWeight.w600,
                                                  letterSpacing: 1,
                                                  height: 1.2,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              Positioned(
                                bottom: 200,
                                right: 20,
                                child: Material(
                                  elevation: 4,
                                  borderRadius: BorderRadius.circular(12),
                                  child: InkWell(
                                    onTap: () {
                                      setState(() {
                                        showDetails = !showDetails;
                                      });
                                    },
                                    borderRadius: BorderRadius.circular(12),
                                    child: Container(
                                      padding: const EdgeInsets.all(5),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Consumer<TenantProvider>(
                                        builder: (context, tenantProvider, _) {
                                          return Icon(
                                            showDetails ? Icons.visibility_off : Icons.visibility,
                                            color: tenantProvider.primaryColor,
                                            size: 20,
                                          );
                                        },
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      // Card Selector
                      if (cards.length > 1)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              // Left Arrow
                              IconButton(
                                onPressed: selectedCard > 0
                                    ? () {
                                        setState(() {
                                          selectedCard--;
                                        });
                                      }
                                    : null,
                                icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
                                style: IconButton.styleFrom(
                                  backgroundColor: Colors.white.withOpacity(0.2),
                                  disabledBackgroundColor: Colors.white.withOpacity(0.1),
                                ),
                              ),
                              const SizedBox(width: 8),
                              // Dots Indicator
                              ...List.generate(
                                cards.length,
                                (index) => GestureDetector(
                                  onTap: () {
                                    setState(() {
                                      selectedCard = index;
                                    });
                                  },
                                  child: Container(
                                    margin: const EdgeInsets.symmetric(horizontal: 4),
                                    width: index == selectedCard ? 32 : 8,
                                    height: 8,
                                    decoration: BoxDecoration(
                                      color: index == selectedCard ? Colors.white : Colors.white.withOpacity(0.5),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              // Right Arrow
                              IconButton(
                                onPressed: selectedCard < cards.length - 1
                                    ? () {
                                        setState(() {
                                          selectedCard++;
                                        });
                                      }
                                    : null,
                                icon: const Icon(Icons.arrow_forward_ios, color: Colors.white, size: 20),
                                style: IconButton.styleFrom(
                                  backgroundColor: Colors.white.withOpacity(0.2),
                                  disabledBackgroundColor: Colors.white.withOpacity(0.1),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
                );
              },
            ),

          // Quick Actions and Transactions
          SliverToBoxAdapter(
            child: Column(
              children: [
                // Quick Actions
                Transform.translate(
                  offset: const Offset(0, -35),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.08),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
                        child: Consumer<TenantProvider>(
                          builder: (context, tenantProvider, _) {
                            return Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: [
                                _QuickActionButton(
                                  icon: (currentCard['status']?.toString().toLowerCase() ?? '') == 'frozen' 
                                    ? Icons.ac_unit 
                                    : Icons.ac_unit_outlined,
                                  label: (currentCard['status']?.toString().toLowerCase() ?? '') == 'frozen' 
                                    ? 'Unfreeze' 
                                    : 'Freeze Card',
                                  color: (currentCard['status']?.toString().toLowerCase() ?? '') == 'frozen' 
                                    ? tenantProvider.primaryColor 
                                    : tenantProvider.secondaryColor,
                                  onTap: () => handleFreeze(
                                    currentCard['card_id']?.toString() ?? currentCard['id']?.toString() ?? '',
                                    (currentCard['status']?.toString().toLowerCase() ?? '') == 'frozen',
                                  ),
                                ),
                                Container(
                                  width: 1,
                                  height: 40,
                                  color: tenantProvider.textSecondaryColor.withOpacity(0.3),
                                ),
                                _QuickActionButton(
                                  icon: Icons.add_card_outlined,
                                  label: 'New Card',
                                  color: tenantProvider.successColor,
                                  onTap: handleRequestNew,
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                    ),
                  ),
                ),

                // Recent Transactions
                Consumer<TenantProvider>(
                  builder: (context, tenantProvider, _) {
                    return Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Transactions',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: Theme.of(context).textTheme.bodyMedium?.color,
                                ),
                              ),
                              TextButton.icon(
                                onPressed: () {
                                  Navigator.pushNamed(context, '/transaction-history');
                                },
                                icon: Text(
                                  'See All',
                                  style: TextStyle(color: tenantProvider.primaryColor),
                                ),
                                label: Icon(
                                  Icons.arrow_forward_ios,
                                  size: 14,
                                  color: tenantProvider.primaryColor,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          transactions.isEmpty
                            ? Container(
                                padding: const EdgeInsets.all(32),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.05),
                                      blurRadius: 10,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Center(
                                  child: Column(
                                    children: [
                                      Icon(
                                        Icons.receipt_long_outlined,
                                        size: 48,
                                        color: tenantProvider.textSecondaryColor,
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        'No recent transactions',
                                        style: TextStyle(
                                          color: tenantProvider.textSecondaryColor,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              )
                            : Container(
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.05),
                                      blurRadius: 10,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Column(
                                  children: transactions.asMap().entries.map((entry) {
                                    final index = entry.key;
                                    final tx = entry.value;
                                    final isLast = index == transactions.length - 1;
                                    return Column(
                                      children: [
                                        ListTile(
                                          contentPadding: const EdgeInsets.symmetric(
                                            horizontal: 16,
                                            vertical: 8,
                                          ),
                                          leading: Container(
                                            padding: const EdgeInsets.all(10),
                                            decoration: BoxDecoration(
                                              color: tenantProvider.errorColor.withOpacity(0.1),
                                              borderRadius: BorderRadius.circular(12),
                                            ),
                                            child: Icon(
                                              Icons.shopping_bag_outlined,
                                              color: tenantProvider.errorColor,
                                              size: 24,
                                            ),
                                          ),
                                          title: Text(
                                            tx.description ?? tx.category.replaceAll('_', ' ').toUpperCase(),
                                            style: TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 15,
                                              color: Theme.of(context).textTheme.bodyMedium?.color,
                                            ),
                                          ),
                                          subtitle: Padding(
                                            padding: const EdgeInsets.only(top: 4),
                                            child: Text(
                                              DateFormat('MMM dd, yyyy').format(tx.createdAt),
                                              style: TextStyle(
                                                fontSize: 13,
                                                color: tenantProvider.textSecondaryColor,
                                              ),
                                            ),
                                          ),
                                          trailing: Text(
                                            '- ${tx.currency} ${NumberFormat('#,##0.00').format(tx.amount)}',
                                            style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 16,
                                              color: tenantProvider.errorColor,
                                            ),
                                          ),
                                        ),
                                        if (!isLast)
                                          Divider(
                                            height: 1,
                                            indent: 72,
                                            endIndent: 16,
                                            color: tenantProvider.textSecondaryColor.withOpacity(0.2),
                                          ),
                                      ],
                                    );
                                  }).toList(),
                                ),
                              ),
                        ],
                      ),
                    );
                  },
                ),

                // Info Card
                Consumer<TenantProvider>(
                  builder: (context, tenantProvider, _) {
                    return Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              tenantProvider.primaryColor.withOpacity(0.1),
                              tenantProvider.primaryColor.withOpacity(0.2),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: tenantProvider.primaryColor.withOpacity(0.3),
                            width: 1.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: tenantProvider.primaryColor.withOpacity(0.1),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: tenantProvider.primaryColor,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(
                                    Icons.security,
                                    color: Colors.white,
                                    size: 20,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  'Card Security Tips',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 17,
                                    color: Theme.of(context).textTheme.bodyMedium?.color,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            _buildSecurityTip(
                              context,
                              tenantProvider,
                              Icons.shield_outlined,
                              'Never share your PIN or CVV with anyone',
                            ),
                            _buildSecurityTip(
                              context,
                              tenantProvider,
                              Icons.notifications_active_outlined,
                              'Enable transaction notifications',
                            ),
                            _buildSecurityTip(
                              context,
                              tenantProvider,
                              Icons.report_outlined,
                              'Report suspicious activity immediately',
                            ),
                            _buildSecurityTip(
                              context,
                              tenantProvider,
                              Icons.ac_unit_outlined,
                              'Freeze your card if lost or stolen',
                            ),
                          ],
                        ),
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
    );
  }

  Widget _buildSecurityTip(
    BuildContext context,
    TenantProvider tenantProvider,
    IconData icon,
    String text,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            size: 18,
            color: tenantProvider.primaryColor,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: Theme.of(context).textTheme.bodyMedium?.color,
                fontSize: 14,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: color.withOpacity(0.2),
                    width: 1,
                  ),
                ),
                child: Icon(icon, color: color, size: 26),
              ),
              const SizedBox(height: 10),
              Flexible(  // Add Flexible here
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).textTheme.bodyMedium?.color,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}