import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';
import '../../../config/app_theme.dart';
import '../../../services/api_service.dart';

class DocumentUploadScreen extends StatefulWidget {
  const DocumentUploadScreen({super.key});

  @override
  State<DocumentUploadScreen> createState() => _DocumentUploadScreenState();
}

class _DocumentUploadScreenState extends State<DocumentUploadScreen> {
  // Track uploaded documents with file paths
  Map<String, Map<String, dynamic>> uploadedDocs = {
    'passport': {'uploaded': false, 'file': null, 'path': null},
    'nin': {'uploaded': false, 'file': null, 'path': null},
    'drivers_license': {'uploaded': false, 'file': null, 'path': null},
    'cac': {'uploaded': false, 'file': null, 'path': null},
  };

  @override
  Widget build(BuildContext context) {
    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    final accountType = args?['accountType'] ?? 'individual';

    // Business requires CAC
    final docList = accountType == 'business'
        ? ['International Passport', 'NIN', "Driver's License", 'CAC Certificate']
        : ['International Passport', 'NIN', "Driver's License"];

    final docKeys = accountType == 'business'
        ? ['passport', 'nin', 'drivers_license', 'cac']
        : ['passport', 'nin', 'drivers_license'];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Identity Documents'),
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),
              Text(
                'Upload Identity Documents',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.getTextPrimary(context),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Upload at least one valid ID for CBN compliance',
                style: TextStyle(
                  fontSize: 14,
                  color: AppTheme.getTextSecondary(context),
                ),
              ),
              const SizedBox(height: 24),
              // Document cards
              ...List.generate(docList.length, (i) {
                final key = docKeys[i];
                final doc = docList[i];
                final docData = uploadedDocs[key]!;
                final isUploaded = docData['uploaded'] as bool;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _buildDocumentCard(
                    title: doc,
                    isUploaded: isUploaded,
                    fileName: docData['file']?.toString().split('/').last,
                    onTap: () => _uploadDocument(key, doc),
                    onView: isUploaded ? () => _viewDocument(key) : null,
                    onRemove: isUploaded ? () => _removeDocument(key) : null,
                  ),
                );
              }),
              const SizedBox(height: 32),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.amber[50],
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.amber[200]!),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning_outlined, color: Colors.amber[700]),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Ensure documents are clear, readable, and not expired',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.amber[900],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: uploadedDocs.values.any((v) => v['uploaded'] as bool)
                      ? () {
                          // Check if this is KYC completion from settings
                          final isKycCompletion = args?['isKycCompletion'] == true;
                          
                          Navigator.pushReplacementNamed(
                            context,
                            '/kyc-address',
                            arguments: {
                              'accountType': accountType,
                              'isKycCompletion': isKycCompletion,
                            },
                          );
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('Continue'),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDocumentCard({
    required String title,
    required bool isUploaded,
    String? fileName,
    required VoidCallback onTap,
    VoidCallback? onView,
    VoidCallback? onRemove,
  }) {
    return InkWell(
      onTap: isUploaded ? null : onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isUploaded ? Colors.green[50] : Colors.grey[50],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isUploaded ? Colors.green[300]! : Colors.grey[300]!,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: isUploaded ? Colors.green[700] : Colors.grey[400],
                shape: BoxShape.circle,
              ),
              child: Icon(
                isUploaded ? Icons.check_circle : Icons.file_upload_outlined,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    isUploaded ? (fileName ?? 'Uploaded ✓') : 'Tap to upload',
                    style: TextStyle(
                      fontSize: 13,
                      color: isUploaded 
                          ? Colors.green[700] 
                          : Theme.of(context).textTheme.bodyMedium?.color?.withOpacity(0.7),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (isUploaded) ...[
              IconButton(
                onPressed: onView,
                icon: const Icon(Icons.visibility_outlined),
                color: Colors.blue[600],
                tooltip: 'View',
              ),
              IconButton(
                onPressed: onRemove,
                icon: const Icon(Icons.close),
                color: Colors.red[600],
                tooltip: 'Remove',
              ),
            ] else
              Icon(
                Icons.arrow_forward_ios,
                color: Colors.grey[400],
                size: 16,
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _uploadDocument(String key, String docName) async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
      );

      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: const Text('File size must be less than 10MB'),
                backgroundColor: Colors.red[600],
              ),
            );
          }
          return;
        }

        // Show uploading dialog
        if (mounted) {
          showDialog(
            context: context,
            barrierDismissible: false,
            builder: (context) => const AlertDialog(
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Uploading document...'),
                ],
              ),
            ),
          );
        }

        final api = context.read<ApiService>();
        final MultipartFile multipartFile;
        if (file.path != null) {
          multipartFile = await MultipartFile.fromFile(file.path!, filename: file.name);
        } else if (file.bytes != null) {
          multipartFile = MultipartFile.fromBytes(file.bytes!, filename: file.name);
        } else {
          throw Exception('No file data available');
        }
        final formData = FormData.fromMap({
          'document_type': key,
          'file': multipartFile,
        });
        await api.post('/document-management/v1/documents', data: formData);

        if (mounted) {
          Navigator.pop(context); // Close uploading dialog

          setState(() {
            uploadedDocs[key] = {
              'uploaded': true,
              'file': file.name,
              'path': file.path,
            };
          });

          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Document uploaded successfully'),
              backgroundColor: Colors.green,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: Colors.red[600],
          ),
        );
      }
    }
  }

  void _viewDocument(String key) {
    final docData = uploadedDocs[key]!;
    final filePath = docData['path'] as String?;
    
    if (filePath != null) {
      // Show preview dialog
      showDialog(
        context: context,
        builder: (context) => Dialog(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppBar(
                title: const Text('Document Preview'),
                automaticallyImplyLeading: false,
                actions: [
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              Expanded(
                child: filePath.toLowerCase().endsWith('.pdf')
                    ? const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.picture_as_pdf, size: 64, color: Colors.red),
                            SizedBox(height: 16),
                            Text('PDF Document'),
                            Text('Preview not available'),
                          ],
                        ),
                      )
                    : const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.image, size: 64, color: Colors.grey),
                            SizedBox(height: 16),
                            Text('Image Document'),
                            Text('Preview not available on web'),
                          ],
                        ),
                      ),
              ),
            ],
          ),
        ),
      );
    }
  }

  void _removeDocument(String key) {
    setState(() {
      uploadedDocs[key] = {'uploaded': false, 'file': null, 'path': null};
    });
    
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Document removed'),
        backgroundColor: Colors.orange,
      ),
    );
  }
}
