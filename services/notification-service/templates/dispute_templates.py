"""
54link-dev Dispute and Account Restriction Notification Templates
SMS, Email, and Push notification templates for dispute lifecycle events
"""

from typing import Dict, Any, Optional
from datetime import datetime
from enum import Enum


class NotificationChannel(str, Enum):
    SMS = "sms"
    EMAIL = "email"
    PUSH = "push"
    IN_APP = "in_app"


# ============================================================================
# DISPUTE NOTIFICATION TEMPLATES
# ============================================================================

DISPUTE_TEMPLATES = {
    # Dispute Created
    "dispute_created": {
        "sms": """54link-dev: Your dispute #{dispute_id} has been logged. Amount: NGN {amount:,.2f}. Category: {category}. We'll update you within 24 hours. Ref: {dispute_id}""",
        
        "email": {
            "subject": "Dispute #{dispute_id} Received - 54link-dev",
            "body": """
Dear Customer,

We have received your dispute and it has been logged in our system.

**Dispute Details:**
- Dispute ID: {dispute_id}
- Category: {category}
- Amount: NGN {amount:,.2f}
- Transaction ID: {transaction_id}
- Date Submitted: {created_at}

**What happens next:**
1. Our team will review your dispute within 24 hours
2. We may contact you for additional information
3. You will receive updates via SMS and email

**Expected Resolution Time:**
Based on the dispute category, we aim to resolve this within {sla_hours} hours.

You can track your dispute status in the 54link-dev app or by calling our customer service line.

If you have any questions, please contact us at support@54link-dev.com or call 0800-54-BANK.

Best regards,
54link-dev Dispute Resolution Team
"""
        },
        
        "push": {
            "title": "Dispute Received",
            "body": "Your dispute #{dispute_id} for NGN {amount:,.2f} has been logged. We'll update you soon."
        },
        
        "in_app": {
            "title": "Dispute Logged",
            "message": "Your dispute has been received and is being reviewed.",
            "action": "view_dispute",
            "action_data": {"dispute_id": "{dispute_id}"}
        }
    },
    
    # Dispute Under Investigation
    "dispute_investigating": {
        "sms": """54link-dev: Your dispute #{dispute_id} is now under investigation. We'll update you once complete. Ref: {dispute_id}""",
        
        "email": {
            "subject": "Dispute #{dispute_id} Under Investigation - 54link-dev",
            "body": """
Dear Customer,

We are actively investigating your dispute.

**Dispute Details:**
- Dispute ID: {dispute_id}
- Status: Under Investigation
- Assigned To: {assigned_to}

Our team is working to resolve this as quickly as possible. We may contact you if we need additional information.

Best regards,
54link-dev Dispute Resolution Team
"""
        },
        
        "push": {
            "title": "Dispute Under Investigation",
            "body": "We're actively investigating your dispute #{dispute_id}."
        }
    },
    
    # Dispute Resolved - Customer Favor
    "dispute_resolved_customer": {
        "sms": """54link-dev: Good news! Your dispute #{dispute_id} has been resolved in your favor. NGN {resolution_amount:,.2f} has been credited to your account. Ref: {dispute_id}""",
        
        "email": {
            "subject": "Dispute #{dispute_id} Resolved in Your Favor - 54link-dev",
            "body": """
Dear Customer,

Great news! Your dispute has been resolved in your favor.

**Resolution Details:**
- Dispute ID: {dispute_id}
- Resolution: {resolution_type}
- Amount Credited: NGN {resolution_amount:,.2f}
- Resolution Date: {resolved_at}

The credited amount should reflect in your account balance immediately.

**Resolution Notes:**
{resolution_notes}

Thank you for your patience. If you have any questions, please contact us.

Best regards,
54link-dev Dispute Resolution Team
"""
        },
        
        "push": {
            "title": "Dispute Resolved",
            "body": "Your dispute #{dispute_id} has been resolved. NGN {resolution_amount:,.2f} credited to your account."
        }
    },
    
    # Dispute Resolved - Merchant Favor
    "dispute_resolved_merchant": {
        "sms": """54link-dev: Your dispute #{dispute_id} has been reviewed. After investigation, no error was found. Contact us for details. Ref: {dispute_id}""",
        
        "email": {
            "subject": "Dispute #{dispute_id} Resolution - 54link-dev",
            "body": """
Dear Customer,

We have completed our investigation of your dispute.

**Resolution Details:**
- Dispute ID: {dispute_id}
- Resolution: No Error Found
- Resolution Date: {resolved_at}

**Investigation Findings:**
{resolution_notes}

If you believe this decision is incorrect, you may:
1. Provide additional evidence within 7 days
2. Escalate to our complaints department
3. Contact the CBN Consumer Protection Department

We understand this may not be the outcome you expected. Please contact us if you have questions.

Best regards,
54link-dev Dispute Resolution Team
"""
        },
        
        "push": {
            "title": "Dispute Reviewed",
            "body": "Your dispute #{dispute_id} has been reviewed. Please check your email for details."
        }
    },
    
    # Dispute Escalated
    "dispute_escalated": {
        "sms": """54link-dev: Your dispute #{dispute_id} has been escalated for priority review. We'll update you soon. Ref: {dispute_id}""",
        
        "email": {
            "subject": "Dispute #{dispute_id} Escalated - 54link-dev",
            "body": """
Dear Customer,

Your dispute has been escalated for priority review.

**Dispute Details:**
- Dispute ID: {dispute_id}
- New Priority: {priority}
- Escalated To: {escalated_to}

Our senior team is now handling your case. You will receive an update within 24 hours.

Best regards,
54link-dev Dispute Resolution Team
"""
        },
        
        "push": {
            "title": "Dispute Escalated",
            "body": "Your dispute #{dispute_id} has been escalated for priority review."
        }
    },
    
    # SLA Breach Notification
    "dispute_sla_breach": {
        "sms": """54link-dev: We apologize for the delay in resolving your dispute #{dispute_id}. Our team is prioritizing your case. Ref: {dispute_id}""",
        
        "email": {
            "subject": "Update on Dispute #{dispute_id} - 54link-dev",
            "body": """
Dear Customer,

We apologize for the delay in resolving your dispute.

**Dispute Details:**
- Dispute ID: {dispute_id}
- Original SLA: {sla_hours} hours
- Current Status: {status}

Your case has been escalated and is being handled with priority. We will provide an update within 24 hours.

We sincerely apologize for any inconvenience caused.

Best regards,
54link-dev Dispute Resolution Team
"""
        },
        
        "push": {
            "title": "Dispute Update",
            "body": "We apologize for the delay on dispute #{dispute_id}. Your case is being prioritized."
        }
    },
    
    # Additional Information Required
    "dispute_info_required": {
        "sms": """54link-dev: We need more information for your dispute #{dispute_id}. Please check your email or app. Ref: {dispute_id}""",
        
        "email": {
            "subject": "Additional Information Required - Dispute #{dispute_id}",
            "body": """
Dear Customer,

We need additional information to process your dispute.

**Dispute Details:**
- Dispute ID: {dispute_id}
- Category: {category}

**Information Required:**
{required_info}

Please provide this information within 7 days to avoid delays in processing your dispute.

You can:
1. Reply to this email with the required documents
2. Upload documents through the 54link-dev app
3. Visit any 54link-dev branch

Best regards,
54link-dev Dispute Resolution Team
"""
        },
        
        "push": {
            "title": "Information Required",
            "body": "We need more information for dispute #{dispute_id}. Please check your email."
        }
    }
}


# ============================================================================
# ACCOUNT RESTRICTION NOTIFICATION TEMPLATES
# ============================================================================

ACCOUNT_RESTRICTION_TEMPLATES = {
    # Account Frozen
    "account_frozen": {
        "sms": """54link-dev ALERT: Your account {account_masked} has been temporarily restricted. Reason: {reason}. Contact us immediately at 0800-54-BANK.""",
        
        "email": {
            "subject": "Important: Account Restriction Notice - 54link-dev",
            "body": """
Dear Customer,

This is to inform you that your account has been temporarily restricted.

**Account Details:**
- Account: {account_masked}
- Restriction Type: {scope}
- Reason: {reason}
- Effective Date: {created_at}

**What this means:**
{restriction_explanation}

**What you should do:**
1. Contact our customer service immediately at 0800-54-BANK
2. Visit your nearest 54link-dev branch with valid ID
3. Provide any requested documentation

If you believe this restriction was made in error, please contact us immediately.

**Important:** Do not share your account details or OTP with anyone claiming to help resolve this issue.

Best regards,
54link-dev Security Team
"""
        },
        
        "push": {
            "title": "Account Restricted",
            "body": "Your account has been temporarily restricted. Please contact us immediately."
        },
        
        "in_app": {
            "title": "Account Restricted",
            "message": "Your account has been temporarily restricted. Tap to learn more.",
            "action": "contact_support",
            "priority": "high"
        }
    },
    
    # Account Unfrozen
    "account_unfrozen": {
        "sms": """54link-dev: Good news! The restriction on your account {account_masked} has been lifted. You can now transact normally.""",
        
        "email": {
            "subject": "Account Restriction Lifted - 54link-dev",
            "body": """
Dear Customer,

We are pleased to inform you that the restriction on your account has been lifted.

**Account Details:**
- Account: {account_masked}
- Restriction Lifted: {lifted_at}
- Lifted By: {lifted_by}

Your account is now fully operational and you can perform all transactions normally.

If you have any questions, please contact us.

Best regards,
54link-dev Security Team
"""
        },
        
        "push": {
            "title": "Account Restored",
            "body": "The restriction on your account has been lifted. You can now transact normally."
        },
        
        "in_app": {
            "title": "Account Restored",
            "message": "Your account restriction has been lifted. All services are now available.",
            "action": "dismiss",
            "priority": "normal"
        }
    },
    
    # Partial Restriction
    "account_partial_restriction": {
        "sms": """54link-dev: Your account {account_masked} has a partial restriction. {restriction_details}. Contact us for details.""",
        
        "email": {
            "subject": "Partial Account Restriction Notice - 54link-dev",
            "body": """
Dear Customer,

A partial restriction has been placed on your account.

**Account Details:**
- Account: {account_masked}
- Restriction Scope: {scope}
- Reason: {reason}

**What you CAN do:**
{allowed_transactions}

**What you CANNOT do:**
{blocked_transactions}

To resolve this restriction, please contact our customer service.

Best regards,
54link-dev Security Team
"""
        },
        
        "push": {
            "title": "Partial Account Restriction",
            "body": "Some transactions on your account are restricted. Tap for details."
        }
    },
    
    # Restriction Expiring Soon
    "restriction_expiring": {
        "sms": """54link-dev: The restriction on your account {account_masked} will expire on {expires_at}. No action needed unless you want to extend.""",
        
        "email": {
            "subject": "Account Restriction Expiring Soon - 54link-dev",
            "body": """
Dear Customer,

The temporary restriction on your account will expire soon.

**Account Details:**
- Account: {account_masked}
- Restriction Expires: {expires_at}

After expiry, your account will be fully operational unless a new restriction is placed.

If you have any questions, please contact us.

Best regards,
54link-dev Security Team
"""
        },
        
        "push": {
            "title": "Restriction Expiring",
            "body": "Your account restriction will expire on {expires_at}."
        }
    }
}


# ============================================================================
# TEMPLATE RENDERING
# ============================================================================

def get_restriction_explanation(scope: str) -> str:
    """Get explanation text for restriction scope"""
    explanations = {
        "full_freeze": "All transactions (debits and credits) are blocked. You cannot make payments, transfers, or receive funds.",
        "debit_only": "Debit transactions are blocked. You cannot make payments or transfers, but you can still receive funds.",
        "credit_only": "Credit transactions are blocked. You cannot receive funds, but you can still make payments.",
        "card_only": "Card transactions are blocked. You cannot use your debit/credit card, but other channels work normally.",
        "online_only": "Online transactions are blocked. You cannot use internet/mobile banking, but branch and ATM services work."
    }
    return explanations.get(scope, "Some account functions are restricted.")


def get_allowed_transactions(scope: str) -> str:
    """Get list of allowed transactions for a scope"""
    allowed = {
        "full_freeze": "None - all transactions are blocked",
        "debit_only": "Receiving transfers, salary credits, refunds",
        "credit_only": "Payments, transfers, bill payments, withdrawals",
        "card_only": "Bank transfers, USSD transactions, branch transactions",
        "online_only": "ATM withdrawals, branch transactions, card payments at POS"
    }
    return allowed.get(scope, "Contact customer service for details")


def get_blocked_transactions(scope: str) -> str:
    """Get list of blocked transactions for a scope"""
    blocked = {
        "full_freeze": "All debits and credits",
        "debit_only": "Payments, transfers, bill payments, withdrawals",
        "credit_only": "Receiving transfers, salary credits, refunds",
        "card_only": "ATM withdrawals, POS payments, online card payments",
        "online_only": "Mobile app transactions, internet banking, USSD"
    }
    return blocked.get(scope, "Contact customer service for details")


def mask_account_number(account_number: str) -> str:
    """Mask account number for security"""
    if len(account_number) <= 4:
        return "****"
    return f"****{account_number[-4:]}"


def render_template(
    template_name: str,
    channel: NotificationChannel,
    data: Dict[str, Any],
    template_type: str = "dispute"
) -> Dict[str, Any]:
    """
    Render a notification template with data
    
    Args:
        template_name: Name of the template (e.g., "dispute_created")
        channel: Notification channel (sms, email, push, in_app)
        data: Data to populate the template
        template_type: "dispute" or "restriction"
    
    Returns:
        Rendered template content
    """
    templates = DISPUTE_TEMPLATES if template_type == "dispute" else ACCOUNT_RESTRICTION_TEMPLATES
    
    if template_name not in templates:
        raise ValueError(f"Template '{template_name}' not found")
    
    template = templates[template_name]
    
    if channel.value not in template:
        raise ValueError(f"Channel '{channel.value}' not available for template '{template_name}'")
    
    channel_template = template[channel.value]
    
    # Add computed fields
    if "account_id" in data:
        data["account_masked"] = mask_account_number(data.get("account_id", ""))
    
    if "scope" in data:
        data["restriction_explanation"] = get_restriction_explanation(data["scope"])
        data["allowed_transactions"] = get_allowed_transactions(data["scope"])
        data["blocked_transactions"] = get_blocked_transactions(data["scope"])
    
    # Render template
    if isinstance(channel_template, str):
        # Simple string template (SMS)
        return {"content": channel_template.format(**data)}
    
    elif isinstance(channel_template, dict):
        # Complex template (email, push, in_app)
        rendered = {}
        for key, value in channel_template.items():
            if isinstance(value, str):
                rendered[key] = value.format(**data)
            else:
                rendered[key] = value
        return rendered
    
    return channel_template


def get_notification_channels(template_name: str, template_type: str = "dispute") -> list:
    """Get available channels for a template"""
    templates = DISPUTE_TEMPLATES if template_type == "dispute" else ACCOUNT_RESTRICTION_TEMPLATES
    
    if template_name not in templates:
        return []
    
    return list(templates[template_name].keys())


# ============================================================================
# NOTIFICATION BUILDER
# ============================================================================

class NotificationBuilder:
    """Builder for creating multi-channel notifications"""
    
    def __init__(self, template_name: str, template_type: str = "dispute"):
        self.template_name = template_name
        self.template_type = template_type
        self.data = {}
        self.channels = []
    
    def with_data(self, **kwargs) -> "NotificationBuilder":
        """Add data to the notification"""
        self.data.update(kwargs)
        return self
    
    def for_channels(self, *channels: NotificationChannel) -> "NotificationBuilder":
        """Specify channels to send to"""
        self.channels = list(channels)
        return self
    
    def for_all_channels(self) -> "NotificationBuilder":
        """Send to all available channels"""
        self.channels = [NotificationChannel(c) for c in get_notification_channels(
            self.template_name, self.template_type
        )]
        return self
    
    def build(self) -> Dict[str, Any]:
        """Build the notification payload"""
        notifications = {}
        
        for channel in self.channels:
            try:
                notifications[channel.value] = render_template(
                    self.template_name,
                    channel,
                    self.data,
                    self.template_type
                )
            except Exception as e:
                print(f"Failed to render {channel.value} template: {e}")
        
        return {
            "template": self.template_name,
            "channels": notifications,
            "data": self.data,
            "created_at": datetime.now().isoformat()
        }


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

"""
Example 1: Send dispute created notification

notification = NotificationBuilder("dispute_created", "dispute") \
    .with_data(
        dispute_id="DSP123456",
        amount=50000,
        category="ATM Non-Dispense",
        transaction_id="TXN789",
        created_at="2024-01-15 10:30:00",
        sla_hours=48
    ) \
    .for_all_channels() \
    .build()


Example 2: Send account frozen notification

notification = NotificationBuilder("account_frozen", "restriction") \
    .with_data(
        account_id="1234567890",
        scope="debit_only",
        reason="Suspected fraudulent activity",
        created_at="2024-01-15 10:30:00"
    ) \
    .for_channels(NotificationChannel.SMS, NotificationChannel.EMAIL, NotificationChannel.PUSH) \
    .build()


Example 3: Render single template

sms_content = render_template(
    "dispute_resolved_customer",
    NotificationChannel.SMS,
    {
        "dispute_id": "DSP123456",
        "resolution_amount": 50000
    },
    "dispute"
)
"""
