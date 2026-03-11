"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck,
  Fingerprint,
  Lock,
  Copy,
  CheckCircle,
} from "lucide-react";
import {
  createBackupViaPRF,
  createBackupViaPassphrase,
} from "@/lib/keyBackup";
import { getPrivateKey } from "@/lib/keyStore";

export function BackupSetup({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<
    "intro" | "prf" | "passphrase" | "recovery_code"
  >("intro");
  const [passphrase, setPassphrase] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recovery code state
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");

  const handlePrfSetup = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const deviceId = localStorage.getItem("device_id");
      if (!deviceId) throw new Error("Device ID not found.");
      const privateKey = await getPrivateKey(deviceId);
      if (!privateKey) throw new Error("Private Key not found.");

      const userId = localStorage.getItem("user_id");
      const username = localStorage.getItem("username");
      if (!userId || !username) throw new Error("User identity not found.");

      const publicKey = localStorage.getItem("device_public_key");
      if (!publicKey) throw new Error("Public Key not found in local storage.");

      const res = await createBackupViaPRF(
        userId,
        username,
        privateKey,
        publicKey,
      );

      if (!res.supported) {
        // Fallback to passphrase
        setStep("passphrase");
      } else {
        // PRF success
        onComplete();
      }
    } catch (err: any) {
      setError(err.message || "Failed to setup Passkey backup.");
      // Fallback
      setStep("passphrase");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePassphraseSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const deviceId = localStorage.getItem("device_id");
      if (!deviceId) throw new Error("Device ID not found.");
      const privateKey = await getPrivateKey(deviceId);
      if (!privateKey) throw new Error("Private Key not found.");

      const publicKey = localStorage.getItem("device_public_key");
      if (!publicKey) throw new Error("Public Key not found in local storage.");

      await createBackupViaPassphrase(privateKey, passphrase, publicKey);
      onComplete();
    } catch (err: any) {
      setError(err.message || "Failed to setup passphrase backup.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === "intro") {
    return (
      <div className="flex flex-col space-y-4 text-center max-w-sm mx-auto">
        <ShieldCheck className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
        <h2 className="text-xl font-bold">Secure Your Account</h2>
        <p className="text-sm text-zinc-400">
          AtriumVerse uses end-to-end encryption. Your messages are locked by a
          key only this device has.
        </p>
        <p className="text-sm text-zinc-400 bg-zinc-900/50 p-4 rounded-md border border-zinc-800">
          If you lose this device, you{" "}
          <strong>will lose all your messages permanently</strong> unless you
          create a secure backup.
        </p>

        <Button
          onClick={handlePrfSetup}
          disabled={isProcessing}
          className="w-full mt-4 h-12 gap-2"
        >
          <Fingerprint className="w-5 h-5" />
          Setup Auto-Recovery (Passkey)
        </Button>
        <p className="text-xs text-zinc-500">
          Uses Face ID / Windows Hello. The most secure option.
        </p>

        <Button
          variant="neutral"
          onClick={() => setStep("passphrase")}
          className="text-zinc-400"
        >
          Use a Backup Passphrase Instead
        </Button>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  if (step === "passphrase") {
    return (
      <form
        onSubmit={handlePassphraseSetup}
        onKeyDown={(e) => e.stopPropagation()}
        className="flex flex-col space-y-4 text-center max-w-sm mx-auto"
      >
        <Lock className="w-12 h-12 mx-auto text-zinc-400 mb-2" />
        <h2 className="text-xl font-bold">Create a Passphrase</h2>
        <p className="text-sm text-zinc-400">
          Your device doesn't support Passkey backups. Create a strong
          passphrase to encrypt your backup on the server.
        </p>

        <Input
          type="password"
          placeholder="At least 8 characters"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          className="mt-4"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}

        <Button
          type="submit"
          disabled={isProcessing || passphrase.length < 8}
          className="mt-4"
        >
          Save Backup
        </Button>
      </form>
    );
  }

  if (step === "recovery_code") {
    const isCodeValid = verifyCode === recoveryCode?.slice(-4);

    return (
      <div className="flex flex-col space-y-4 text-center max-w-sm mx-auto">
        <h2 className="text-xl font-bold">Final Step: Recovery Code</h2>
        <p className="text-sm text-zinc-400 text-left">
          If you lose access to all your devices AND your passkey/passphrase,
          this code is the <strong>absolute only way</strong> to recover your
          account.
        </p>

        <div className="bg-zinc-900 p-4 font-mono text-lg tracking-wider border border-zinc-700 rounded-md">
          {recoveryCode}
        </div>

        <Button
          variant="neutral"
          onClick={() => navigator.clipboard.writeText(recoveryCode || "")}
          className="gap-2 mx-auto w-max"
        >
          <Copy className="w-4 h-4" /> Copy to Clipboard
        </Button>

        <div className="mt-6 border-t border-zinc-800 pt-6 text-left">
          <p className="text-sm text-zinc-300 font-medium mb-2">
            Type the last 4 characters below to verify you saved it:
          </p>
          <Input
            type="text"
            placeholder="XXXX"
            maxLength={4}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
            className="uppercase font-mono text-center text-lg w-24 tracking-widest"
          />
        </div>

        <Button
          onClick={onComplete}
          disabled={!isCodeValid}
          className="mt-6 gap-2"
        >
          <CheckCircle className="w-5 h-5" /> Complete Setup
        </Button>
      </div>
    );
  }
}
