# SMS Gateway Service
Routes SMS through Nigerian telco APIs (MTN, Airtel, Glo, 9mobile) with auto-detection.

## Endpoints
- POST `/v1/sms-gateway/send` — Send single SMS
- POST `/v1/sms-gateway/send-otp` — Send OTP via SMS
- GET `/v1/sms-gateway/stats` — Delivery stats by telco
- GET `/v1/sms-gateway/log` — Recent message log
