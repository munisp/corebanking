// 54Bank Public Status Page
import React, { useState, useEffect } from 'react';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'outage' | 'maintenance';
  latency?: number;
  uptime30d?: number;
}

const SERVICE_GROUPS = [
  {
    name: 'Core Banking',
    services: ['Account Management', 'Transaction Processing', 'General Ledger', 'Interest Engine']
  },
  {
    name: 'Payments',
    services: ['NIP Gateway', 'RTGS Engine', 'Bill Payments', 'NQR Payments']
  },
  {
    name: 'Identity & Compliance',
    services: ['KYC/KYB Verification', 'AML Screening', 'NFIU Reporting', 'NDPR Compliance']
  },
  {
    name: 'Digital Channels',
    services: ['Web App (PWA)', 'Mobile App', 'API Gateway', 'Real-Time Notifications']
  },
  {
    name: 'AI/ML',
    services: ['Fraud Detection', 'Credit Scoring', 'AML Scorer', 'Chatbot']
  },
];

export default function StatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);

  return (
    <div className="min-h-screen bg-gray-50" role="main" aria-label="54Bank System Status">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold">54Bank System Status</h1>
        <p className="text-green-600 font-medium" role="status">All Systems Operational</p>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">
        {SERVICE_GROUPS.map(group => (
          <section key={group.name} className="mb-8" aria-labelledby={`group-${group.name}`}>
            <h2 id={`group-${group.name}`} className="text-lg font-semibold mb-3">{group.name}</h2>
            <div className="bg-white rounded-lg shadow divide-y">
              {group.services.map(svc => (
                <div key={svc} className="flex items-center justify-between px-4 py-3">
                  <span>{svc}</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                        role="status" aria-label={`${svc} is operational`}>
                    Operational
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
        <section aria-labelledby="uptime-history">
          <h2 id="uptime-history" className="text-lg font-semibold mb-3">90-Day Uptime</h2>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex gap-0.5" aria-label="Uptime bars for last 90 days">
              {Array.from({ length: 90 }, (_, i) => (
                <div key={i} className="flex-1 h-8 bg-green-400 rounded-sm" title={`Day ${90 - i}: 100% uptime`} />
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">99.99% uptime over the last 90 days</p>
          </div>
        </section>
      </main>
    </div>
  );
}
