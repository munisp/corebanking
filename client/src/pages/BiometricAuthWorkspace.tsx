/**
 * BiometricAuthWorkspace — WebAuthn/FIDO2 biometric authentication.
 * Device enrollment, fingerprint/face/voice auth, device binding.
 */

import { useState, useCallback } from "react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import {
  Fingerprint, Shield, Smartphone, CheckCircle2, XCircle,
  Loader2, ArrowLeft, Plus, Key, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AuthResult {
  id: string;
  type: string;
  device: string;
  confidence: number;
  passed: boolean;
  timestamp: string;
}

function WebAuthnUI({ onBack }: { onBack: () => void }) {
  const [enrolling, setEnrolling] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enroll = useCallback(async () => {
    setEnrolling(true); setError(null);
    try {
      if (!window.PublicKeyCredential) {
        setError("WebAuthn not supported on this browser");
        setEnrolling(false);
        return;
      }
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "54Bank", id: window.location.hostname },
          user: { id: userId, name: "customer@54bank.ng", displayName: "54Bank Customer" },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
        },
      });
      if (credential) {
        setEnrolled(true);
        await fetch("/api/platform/biometric-auth/v1/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: `CUST-${Date.now().toString(36).toUpperCase()}`,
            credentialId: credential.id,
            biometricType: "webauthn_platform",
            deviceInfo: navigator.userAgent,
          }),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrollment failed — user cancelled or device not supported");
    } finally { setEnrolling(false); }
  }, []);

  const authenticate = useCallback(async () => {
    setAuthenticating(true); setError(null); setAuthResult(null);
    try {
      if (!window.PublicKeyCredential) {
        setError("WebAuthn not supported");
        setAuthenticating(false);
        return;
      }
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: "required",
          timeout: 60000,
        },
      });
      if (assertion) {
        const res = await fetch("/api/platform/biometric-auth/v1/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credentialId: assertion.id,
            customerId: `CUST-${Date.now().toString(36).toUpperCase()}`,
            deviceInfo: navigator.userAgent,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setAuthResult({
            id: data.id ?? assertion.id,
            type: "webauthn_platform",
            device: navigator.userAgent.slice(0, 50),
            confidence: data.confidence_score ?? 0.98,
            passed: data.auth_result === "passed" || data.passed !== false,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication cancelled");
    } finally { setAuthenticating(false); }
  }, []);

  return (
    <div className="p-4">
      <Button variant="ghost" onClick={onBack} className="mb-4"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><Key className="w-4 h-4" /> Device Enrollment</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-4">
            <div className="text-center py-6">
              {enrolled ? (
                <>
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                  <p className="text-sm font-semibold text-green-600 mt-2">Device Enrolled</p>
                  <p className="text-xs text-gray-500">Your biometric credential is registered</p>
                </>
              ) : (
                <>
                  <Fingerprint className="w-16 h-16 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-500 mt-2">Register your device biometric</p>
                  <p className="text-xs text-gray-400">Uses your device fingerprint sensor or face recognition</p>
                </>
              )}
            </div>
            <Button className="w-full" onClick={enroll} disabled={enrolling || enrolled}>
              {enrolling ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              {enrolled ? "Already Enrolled" : "Enroll Biometric"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><Lock className="w-4 h-4" /> Authenticate</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-4">
            {authResult ? (
              <div className="text-center py-6">
                {authResult.passed
                  ? <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                  : <XCircle className="w-16 h-16 text-red-500 mx-auto" />}
                <p className={`text-sm font-semibold mt-2 ${authResult.passed ? "text-green-600" : "text-red-600"}`}>
                  {authResult.passed ? "AUTHENTICATED" : "FAILED"}
                </p>
                <p className="text-xs text-gray-500 mt-1">Confidence: {(authResult.confidence * 100).toFixed(0)}%</p>
              </div>
            ) : (
              <div className="text-center py-6">
                <Shield className="w-16 h-16 text-gray-300 mx-auto" />
                <p className="text-sm text-gray-500 mt-2">Verify your identity</p>
                <p className="text-xs text-gray-400">Uses your enrolled biometric</p>
              </div>
            )}
            <Button className="w-full" onClick={authenticate} disabled={authenticating}>
              {authenticating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Fingerprint className="w-4 h-4 mr-1" />}
              Authenticate
            </Button>
          </CardContent>
        </Card>
      </div>
      {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
    </div>
  );
}

const crudConfig: CrudConfig = {
  domainKey: "biometric-auth",
  title: "Biometric Auth",
  subtitle: "Fingerprint, facial, voice, iris biometric authentication (Rust :8189)",
  icon: Fingerprint, accentColor: "pink",
  idField: "id", statusField: "auth_result",
  searchFields: ["customer_name", "biometric_type", "device"],
  apiBase: "/api/db/accounts", pageSize: 25,
  columns: [
    { key: "id", label: "Record ID" },
    { key: "customer_name", label: "Customer", sortable: true },
    { key: "biometric_type", label: "Type", sortable: true },
    { key: "device", label: "Device", sortable: true },
    { key: "confidence_score", label: "Confidence %", sortable: true },
    { key: "auth_result", label: "Result", sortable: true },
  ],
  fields: [],
};

export default function BiometricAuthWorkspace() {
  const [mode, setMode] = useState<"list" | "auth">("list");

  if (mode === "auth") {
    return <WebAuthnUI onBack={() => setMode("list")} />;
  }

  return (
    <div>
      <div className="flex justify-end p-4 pb-0">
        <Button onClick={() => setMode("auth")}><Fingerprint className="w-4 h-4 mr-1" /> Biometric Auth Demo</Button>
      </div>
      <CrudWorkspace config={crudConfig} />
    </div>
  );
}
