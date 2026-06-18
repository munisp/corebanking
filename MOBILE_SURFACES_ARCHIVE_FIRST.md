# 54Bank mobile surfaces: archive-first integration note

The recovered Google Drive archive remains the canonical source for both mobile clients. The active web project is now aligned to treat those mobile applications as first-class platform surfaces rather than as admin substitutes.

| Surface | Canonical archive path | Current recovered state | Immediate integration posture |
| --- | --- | --- | --- |
| React Native banking client | `/home/ubuntu/54bank_original_drive_extract/54bank_platform/54bank-complete-platform/mobile/react-native-app` | Service layer, storage, auth, wallet, payment, and Redux store foundations are recovered. The source tree is still lighter on screen inventory than Flutter. | Keep archive directory as the base. Next work should add the recovered navigation and UI layer while reusing the same platform API contracts already used by the web surface. |
| Flutter banking client | `/home/ubuntu/54bank_original_drive_extract/54bank_platform/54bank-complete-platform/mobile/flutter-app` | Runnable shell, providers, auth, dashboard, transfers, bills, settings, and service clients are present. | Treat this as the archive-first Flutter base and validate parity against the active customer PWA flows rather than building a replacement shell. |

The archive comparison during this pass confirmed that the active web project had progressed farther on customer and admin surfaces than on the mobile applications. For that reason, the immediate implementation work in this pass focused on restoring missing archive admin routes and strengthening the customer PWA transfer flow with review and OTP confirmation, while this note keeps the mobile merge strategy explicit inside the active project.

The next mobile implementation pass should work from the archive directories above, then layer the active platform enhancements on top. Those enhancements include shared authentication context, persisted transaction history, real API contract alignment, and feature-parity checks across transfers, bill payments, statements, notifications, beneficiaries, and operator escalation paths.
