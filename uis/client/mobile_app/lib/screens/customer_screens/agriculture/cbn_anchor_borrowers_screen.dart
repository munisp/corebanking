import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CbnAnchorBorrowersScreen extends StatelessWidget {
  const CbnAnchorBorrowersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CBN Anchor Borrowers',
      apiPath: '/api/agriculture-enhancement/cbn-anchor-borrowers/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
