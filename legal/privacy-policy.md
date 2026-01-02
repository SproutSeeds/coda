---
title: "Privacy Policy"
version: "2025-01-02"
effectiveDate: "2025-01-02"
---

_Last updated: January 2, 2025_

## 1. Overview
This Privacy Policy explains how Coda CLI, Inc. ("Coda", "we", "us") collects, uses, and shares personal information when you use codacli.com, the Coda desktop and mobile applications, the Coda CLI, and related services (collectively, the "Service").

## 2. Information We Collect

### Information You Provide
- **Account Information:** name, email, password (hashed, optional), and profile preferences.
- **Content:** idea content, feature notes, suggestion updates, or attachments you choose to upload. If you use the meetup check-in feature we store the check-in date associated with your account.

### Financial Information (via Plaid)
When you connect your bank accounts through our integration with Plaid Inc., we receive:
- Account names, types (checking, savings, credit card), and balances
- Transaction history (date, amount, merchant name, category)
- Institution name

**Important:** We never receive or store your bank login credentials. Plaid handles all authentication directly with your financial institution.

### Information Collected Automatically
- **Device Information:** IP address, device and browser headers, device type and operating system, app version.
- **Usage Information:** timestamps, page views, search queries, error logs, and cookie identifiers tied to authentication and theme preferences.

### Information from Third Parties
- Email delivery partners that send magic links on our behalf
- Infrastructure vendors (e.g., Neon for Postgres, Vercel for hosting) acting as processors
- Plaid Inc. for bank account connectivity

## 3. How We Use Information
- Operate and secure the dashboard, CLI, desktop/mobile apps, and APIs.
- Display your financial accounts, transactions, and balances.
- Automatically categorize spending and generate financial insights.
- Authenticate users, issue magic links, and enforce rate limits (via Upstash).
- Send transactional emails (password resets, notifications) and optional product updates (opt-out available).
- Analyze aggregate usage via Vercel Analytics to improve features and detect abuse.
- Comply with legal obligations, enforce the Terms, and protect the Service and users.

## 4. Data Storage and Security

### Local-First Architecture
Financial data from the Coda desktop and mobile applications is stored locally on your device, not on our servers. This means:
- Your transaction history stays on your phone/computer
- You maintain control of your data
- Financial data is not accessible to us or third parties

### Encryption
- **In Transit:** All data transmitted uses TLS 1.2+ encryption.
- **At Rest:** Sensitive data (such as access tokens) is encrypted using AES-256-GCM encryption.
- **Bank Credentials:** We never receive, transmit, or store your bank username or password.

### General Security
We implement encryption in transit, role-based access controls, logging, and periodic security reviews. No system is infallible; notify us immediately of suspected unauthorized access at cody@codacli.com.

## 5. Sharing
We share personal data only with:
- **Infrastructure providers** such as Vercel (hosting/CDN), Neon (Postgres database), and Upstash (Redis rate limiting).
- **Financial data providers** such as Plaid Inc. for bank account connectivity.
- **Email delivery services** we use to send magic links and notifications.
- **Authorities** or legal counsel when required by law or to protect rights.

We do not sell personal data or use it for third-party advertising.

## 6. Third-Party Services

### Plaid
We use Plaid Inc. to connect your bank accounts. When you connect an account:
- You authenticate directly with Plaid
- Plaid retrieves your financial data from your bank
- We receive only the data necessary to provide our services

Plaid's handling of your data is governed by their privacy policy at [https://plaid.com/legal/](https://plaid.com/legal/)

## 7. Cookies & Tracking
We use cookies, local storage, and similar technologies for authentication and user preferences. No optional analytics or advertising cookies are set today. Browser settings may limit cookies; disabling essential cookies can affect functionality. See our [Cookie Policy](/legal/cookie-policy) for details.

## 8. Data Retention
- **Active Accounts:** We retain personal information while your account is active.
- **Deleted Accounts:** If you close your account, we delete or anonymize personal data within 30 days unless legal, security, or audit requirements mandate longer retention (e.g., backup snapshots retained up to 90 days).
- **Disconnected Banks:** When you disconnect a bank account, you can choose to retain or delete the associated historical data.

## 9. Your Rights and Choices
Depending on your jurisdiction, you may have rights to:
- **Access** your personal data
- **Correct** inaccurate information
- **Delete** your data
- **Export** your data in a portable format
- **Restrict** or object to certain processing
- **Disconnect** bank accounts at any time

Submit requests to cody@codacli.com. We will verify your identity and respond within 30 days unless a longer period is permitted by law.

## 10. International Transfers
We operate primarily in the United States using sub-processors listed in our Data Processing Addendum. For EU/UK transfers we rely on Standard Contractual Clauses or equivalent safeguards.

## 11. Children
The Service is not directed to individuals under 18. If we learn we collected data from a minor, we will delete it.

## 12. California Privacy Rights (CCPA)
If you are a California resident, you have the right to:
- **Know** what personal information we collect and how it's used
- **Delete** your personal information
- **Opt-Out** of the sale of personal information (we do not sell your data)
- **Non-Discrimination** for exercising your privacy rights

## 13. Changes
We may update this policy. Material changes will be announced via email or in-app notice. Continued use after the effective date indicates acceptance.

## 14. Contact
- **Email:** cody@codacli.com
- **Website:** codacli.com

## Summary

| What | Our Practice |
|------|-------------|
| Bank credentials | Never collected or stored |
| Financial data | Stored locally on your device (desktop/mobile apps) |
| Data encryption | TLS 1.2+ in transit, AES-256 at rest |
| Data selling | Never - we don't sell your data |
| Your control | Access, export, or delete anytime |
