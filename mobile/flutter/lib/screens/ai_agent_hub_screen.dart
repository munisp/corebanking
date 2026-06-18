import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/tenant_service.dart';

class AiAgentHubScreen extends StatefulWidget {
  const AiAgentHubScreen({Key? key}) : super(key: key);

  @override
  State<AiAgentHubScreen> createState() => _AiAgentHubScreenState();
}

class _AiAgentHubScreenState extends State<AiAgentHubScreen> {
  String? selectedAgent;
  final TextEditingController _queryController = TextEditingController();
  List<Map<String, dynamic>> conversation = [];
  bool isThinking = false;

  final List<Map<String, dynamic>> agents = [
    {'id': 'nl-reporting', 'name': 'Financial Reporting', 'icon': Icons.bar_chart, 'color': Color(0xFF1A237E), 'desc': 'Ask financial questions in plain English', 'examples': ['What is our net interest margin?', 'Compare Q1 vs Q2 revenue', 'Show deposit growth trend']},
    {'id': 'account-opening', 'name': 'Account Opening', 'icon': Icons.person_add, 'color': Color(0xFF1B5E20), 'desc': 'AI-guided account opening', 'examples': ['Open savings account for Adebayo', 'Check BVN status', 'Recommend product for SME']},
    {'id': 'transaction-investigation', 'name': 'Transaction Investigation', 'icon': Icons.search, 'color': Color(0xFFC62828), 'desc': 'Trace & investigate transactions', 'examples': ['Trace funds from account 1301', 'Investigate flagged transaction', 'Show transaction flow graph']},
    {'id': 'regulatory-returns', 'name': 'Regulatory Returns', 'icon': Icons.description, 'color': Color(0xFF00695C), 'desc': 'Prepare CBN MBR, SRF, eFASS', 'examples': ['Prepare MBR001 for April', 'Check Basel III compliance', 'Generate eFASS return']},
    {'id': 'loan-origination', 'name': 'Loan Origination', 'icon': Icons.credit_card, 'color': Color(0xFF4A148C), 'desc': 'Risk assessment & credit memo', 'examples': ['Assess 500M term loan', 'Check sector exposure', 'Generate credit memo']},
    {'id': 'customer-360', 'name': 'Customer 360', 'icon': Icons.people, 'color': Color(0xFF0D47A1), 'desc': 'Unified customer view', 'examples': ['Show profile for Dangote Group', 'Find similar customers', 'Cross-sell opportunities']},
    {'id': 'dormancy-prevention', 'name': 'Dormancy Prevention', 'icon': Icons.notifications_active, 'color': Color(0xFFE65100), 'desc': 'Churn risk & retention', 'examples': ['List at-risk accounts', 'Generate retention offer', 'Churn risk analysis']},
    {'id': 'cash-management', 'name': 'Cash Management', 'icon': Icons.account_balance_wallet, 'color': Color(0xFF2E7D32), 'desc': 'Liquidity & CRR monitoring', 'examples': ['Current liquidity position', 'CRR compliance check', 'Cash forecast this week']},
    {'id': 'fraud-detection', 'name': 'Fraud Detection', 'icon': Icons.security, 'color': Color(0xFF880E4F), 'desc': 'Pattern detection & network analysis', 'examples': ['Detect structuring patterns', 'Analyze mule networks', 'Risk score for entity']},
    {'id': 'reconciliation', 'name': 'Reconciliation', 'icon': Icons.check_circle, 'color': Color(0xFF4E342E), 'desc': 'GL to sub-ledger reconciliation', 'examples': ['Reconcile GL today', 'Classify open breaks', 'Auto-resolve timing items']},
  ];

  Future<void> _sendQuery(String query) async {
    if (query.isEmpty || selectedAgent == null) return;
    setState(() {
      conversation.add({'role': 'user', 'text': query});
      isThinking = true;
    });
    _queryController.clear();

    try {
      final result = await ApiService.post('/v1/agent/${selectedAgent}/query', {'query': query});
      setState(() {
        conversation.add({'role': 'agent', 'text': result.toString(), 'agent': selectedAgent});
        isThinking = false;
      });
    } catch (e) {
      setState(() {
        conversation.add({
          'role': 'agent',
          'text': 'Agent "$selectedAgent" processed your query: "$query"\n\n'
              'This is a demo response. Connect to the agent service for live AI analysis.\n\n'
              'Tools used: neo4j_graph, gl_engine, qdrant_search\n'
              'Confidence: 0.85',
          'agent': selectedAgent,
        });
        isThinking = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(selectedAgent != null ? agents.firstWhere((a) => a['id'] == selectedAgent)['name'] : 'AI Banking Agents'),
        backgroundColor: selectedAgent != null ? agents.firstWhere((a) => a['id'] == selectedAgent)['color'] : const Color(0xFF1A237E),
        foregroundColor: Colors.white,
        leading: selectedAgent != null
            ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() { selectedAgent = null; conversation.clear(); }))
            : null,
      ),
      body: selectedAgent != null ? _buildAgentChat() : _buildAgentGrid(),
    );
  }

  Widget _buildAgentGrid() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('10 specialized AI agents for core banking operations', style: TextStyle(fontSize: 15, color: Colors.grey)),
        const SizedBox(height: 16),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 1.1),
          itemCount: agents.length,
          itemBuilder: (ctx, i) {
            final agent = agents[i];
            final tenant = TenantService();
            final isAllowed = tenant.isAgentAllowed(agent['id']);
            return InkWell(
              onTap: isAllowed
                  ? () => setState(() => selectedAgent = agent['id'])
                  : () => ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('${agent['name']} is not available on your ${tenant.tier} plan. Contact your administrator to upgrade.'), backgroundColor: Colors.orange)),
              child: Stack(children: [
                Card(
                  elevation: 2,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  child: Opacity(
                    opacity: isAllowed ? 1.0 : 0.45,
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        CircleAvatar(radius: 24, backgroundColor: agent['color'], child: Icon(agent['icon'], color: Colors.white, size: 24)),
                        const SizedBox(height: 8),
                        Text(agent['name'], textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        const SizedBox(height: 4),
                        Text(agent['desc'], textAlign: TextAlign.center, style: const TextStyle(fontSize: 10, color: Colors.grey), maxLines: 2, overflow: TextOverflow.ellipsis),
                      ]),
                    ),
                  ),
                ),
                if (!isAllowed) Positioned(top: 8, right: 8, child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: Colors.orange, borderRadius: BorderRadius.circular(8)),
                  child: const Text('Upgrade', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                )),
              ]),
            );
          },
        ),
      ],
    );
  }

  Widget _buildAgentChat() {
    final agent = agents.firstWhere((a) => a['id'] == selectedAgent);
    final examples = (agent['examples'] as List<String>?) ?? [];

    return Column(children: [
      Expanded(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (conversation.isEmpty) ...[
              Card(
                color: (agent['color'] as Color).withOpacity(0.05),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Try asking:', style: TextStyle(fontWeight: FontWeight.bold, color: agent['color'])),
                    const SizedBox(height: 8),
                    ...examples.map((ex) => InkWell(
                      onTap: () => _sendQuery(ex),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(children: [
                          Icon(Icons.arrow_forward_ios, size: 12, color: agent['color']),
                          const SizedBox(width: 8),
                          Expanded(child: Text(ex, style: const TextStyle(fontSize: 14))),
                        ]),
                      ),
                    )),
                  ]),
                ),
              ),
            ],
            ...conversation.map((msg) {
              final isUser = msg['role'] == 'user';
              return Align(
                alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
                  decoration: BoxDecoration(
                    color: isUser ? const Color(0xFF1A237E) : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(msg['text'], style: TextStyle(color: isUser ? Colors.white : Colors.black87, fontSize: 14)),
                ),
              );
            }),
            if (isThinking) const Align(alignment: Alignment.centerLeft, child: Padding(padding: EdgeInsets.all(8), child: CircularProgressIndicator(strokeWidth: 2))),
          ],
        ),
      ),
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 4)]),
        child: Row(children: [
          Expanded(child: TextField(
            controller: _queryController,
            decoration: InputDecoration(hintText: 'Ask ${agent['name']}...', border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)), contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12)),
            onSubmitted: _sendQuery,
          )),
          const SizedBox(width: 8),
          CircleAvatar(
            backgroundColor: agent['color'],
            child: IconButton(icon: const Icon(Icons.send, color: Colors.white, size: 20), onPressed: () => _sendQuery(_queryController.text)),
          ),
        ]),
      ),
    ]);
  }
}
