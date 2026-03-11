"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recoverViaWebAuthn, recoverViaPassphrase } from "@/lib/keyBackup";
import { ShieldAlert, KeyRound, Fingerprint, Lock } from "lucide-react";

export function RecoveryFlow({
  backupInfo,
  onRecovered,
  onCancel,
}: {
  backupInfo: any;
  onRecovered: (privateKey: CryptoKey, publicKeyBase64: string) => void;
  onCancel: () => void;
}) {
  const [method, setMethod] = useState<"choose" | "prf" | "passphrase">(
    "choose",
  );
  const [passphrase, setPassphrase] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If the server says PRF was used, offer it. Otherwise skip to passphrase.
  const hasPrf = backupInfo?.backup_method === "prf";

  const handlePrfRecovery = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { privateKey, publicKeyBase64 } = await recoverViaWebAuthn(
        backupInfo.encrypted_blob,
        backupInfo.prf_credential_id,
      );
      onRecovered(privateKey, publicKeyBase64);
    } catch (err: any) {
      setError(err.message || "Face ID / Windows Hello recovery failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePassphraseRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { privateKey, publicKeyBase64 } = await recoverViaPassphrase(
        backupInfo.encrypted_blob,
        backupInfo.salt,
        passphrase,
      );
      onRecovered(privateKey, publicKeyBase64);
    } catch (err: any) {
      setError("Incorrect backup passphrase. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (method === "choose") {
    return (
      <div className="flex flex-col space-y-4">
        <div className="text-center mb-4">
          <ShieldAlert className="w-12 h-12 mx-auto text-blue-500 mb-2" />
          <h2 className="text-xl font-bold">Account Recovery</h2>
          <p className="text-sm text-zinc-400 mt-2">
            This device doesn't have your encryption keys. Restore them from
            your secure backup.
          </p>
        </div>

        {hasPrf && (
          <Button
            onClick={handlePrfRecovery}
            disabled={isLoading}
            className="w-full h-12 flex items-center justify-center gap-2"
          >
            <Fingerprint className="w-5 h-5" />
            Recover with Face ID / Windows Hello
          </Button>
        )}

        {backupInfo?.backup_method === "passphrase" && (
          <Button
            onClick={() => setMethod("passphrase")}
            variant="noShadow"
            className="w-full h-12"
          >
            <Lock className="w-5 h-5 mr-2" />
            Recover with Passphrase
          </Button>
        )}

        {hasPrf && (
          <Button
            onClick={() => setMethod("passphrase")}
            variant="neutral"
            className="w-full text-zinc-400"
          >
            Passkey not working? Try Passphrase
          </Button>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <Button onClick={onCancel} variant="neutral" className="mt-4">
          Cancel
        </Button>
      </div>
    );
  }

  if (method === "passphrase") {
    return (
      <form
        onSubmit={handlePassphraseRecovery}
        onKeyDown={(e) => e.stopPropagation()}
        className="flex flex-col space-y-4"
      >
        <h2 className="text-xl font-bold text-center">
          Enter Backup Passphrase
        </h2>
        <Input
          type="password"
          placeholder="Your Backup Passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          required
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex justify-between mt-4">
          <Button
            type="button"
            variant="noShadow"
            onClick={() => setMethod("choose")}
          >
            Back
          </Button>
          <Button type="submit" disabled={isLoading || !passphrase}>
            Recover
          </Button>
        </div>
      </form>
    );
  }
}
