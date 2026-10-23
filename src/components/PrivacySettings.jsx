
import { useState } from "react";
import "./PrivacySettings.css";

export default function PrivacySettings({ onDataChanged }) {
  const [backupPassword, setBackupPassword] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function perform(action, successMessage, changed = false) {
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const result = await action();

      if (result?.canceled) {
        setMessage("Operation canceled.");
      } else {
        setMessage(successMessage);

        if (changed) {
          onDataChanged?.();
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function createBackup() {
    if (backupPassword.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }

    const password = backupPassword;
    setBackupPassword("");

    await perform(
      () => window.luna.createEncryptedBackup(password),
      "Encrypted backup saved successfully."
    );
  }

  async function restoreBackup() {
    if (restorePassword.length < 8) {
      setError("Enter your backup password.");
      return;
    }

    const password = restorePassword;
    setRestorePassword("");

    await perform(
      () => window.luna.restoreEncryptedBackup(password),
      "Backup restored successfully.",
      true
    );
  }

  async function exportJson() {
    await perform(
      () => window.luna.exportJson(),
      "JSON data exported successfully."
    );
  }

  async function importJson() {
    await perform(
      () => window.luna.importJson(),
      "JSON data imported successfully.",
      true
    );
  }

  async function eraseData() {
    const confirmation = confirmText;
    setConfirmText("");

    await perform(
      () => window.luna.eraseAllData(confirmation),
      "Local Luna records deleted.",
      true
    );
  }

  return (
    <div className="privacy-page">
      <section className="panel privacy-intro">
        <p className="privacy-eyebrow">
          LUNA / PRIVACY & DATA
        </p>

        <h2>Your Data, Your Choice 🔐</h2>

        <p>
          Your cycle and wellness records are stored
          locally on this device. Manage your backups,
          imports, exports, and stored records here.
        </p>
      </section>

      <div className="privacy-grid">
        <section className="privacy-card">
          <div className="privacy-card-icon">
            🔒
          </div>

          <h3>Create Encrypted Backup</h3>

          <p>
            Save your records to a password-protected
            .luna file. Keep both the file and its
            password somewhere safe.
          </p>

          <label>
            Backup password
            <input
              type="password"
              autoComplete="new-password"
              value={backupPassword}
              minLength={8}
              maxLength={1024}
              placeholder="At least 8 characters"
              onChange={e =>
                setBackupPassword(e.target.value)
              }
              disabled={busy}
            />
          </label>

          <button
            type="button"
            disabled={busy || backupPassword.length < 8}
            onClick={createBackup}
          >
            Save Encrypted Backup
          </button>
        </section>

        <section className="privacy-card">
          <div className="privacy-card-icon">
            📦
          </div>

          <h3>Restore Encrypted Backup</h3>

          <p>
            Recover your data from a .luna file.
            Restoring replaces all current local
            records after confirmation.
          </p>

          <label>
            Backup password
            <input
              type="password"
              autoComplete="off"
              value={restorePassword}
              maxLength={1024}
              placeholder="Password used for the backup"
              onChange={e =>
                setRestorePassword(e.target.value)
              }
              disabled={busy}
            />
          </label>

          <button
            type="button"
            disabled={busy || restorePassword.length < 8}
            onClick={restoreBackup}
          >
            Restore Backup
          </button>
        </section>

        <section className="privacy-card">
          <div className="privacy-card-icon">
            📄
          </div>

          <h3>Export JSON</h3>

          <p>
            Download a readable copy of your periods,
            journal entries, and settings. This format
            is portable but not encrypted.
          </p>

          <div className="privacy-notice">
            Anyone with access to the exported JSON
            file may be able to read your records.
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={exportJson}
          >
            Export JSON
          </button>
        </section>

        <section className="privacy-card">
          <div className="privacy-card-icon">
            📥
          </div>

          <h3>Import JSON</h3>

          <p>
            Import data previously exported from Luna.
            The file will be validated before your
            existing data is replaced.
          </p>

          <div className="privacy-notice">
            This is a replacement import, not a merge.
            Back up your current data first.
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={importJson}
          >
            Import JSON
          </button>
        </section>
      </div>

      <section className="panel privacy-danger">
        <h2>Delete Local Records</h2>

        <p>
          Delete all period history, daily journal
          entries, and settings from Luna's active
          database.
        </p>

        <p>
          This does not delete previously exported
          backups or guarantee secure erasure from
          your storage device.
        </p>

        <label>
          Type DELETE LUNA DATA to continue
          <input
            type="text"
            value={confirmText}
            autoComplete="off"
            placeholder="DELETE LUNA DATA"
            onChange={e =>
              setConfirmText(e.target.value)
            }
            disabled={busy}
          />
        </label>

        <button
          type="button"
          className="privacy-delete-button"
          disabled={
            busy ||
            confirmText !== "DELETE LUNA DATA"
          }
          onClick={eraseData}
        >
          Delete All Local Records
        </button>
      </section>

      {(message || error) && (
        <section className="panel">
          {message && (
            <p className="privacy-success" role="status">
              {message}
            </p>
          )}

          {error && (
            <p className="privacy-error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}

      <section className="panel privacy-footer">
        <h3>About Luna's Privacy</h3>

        <p>
          Luna works offline and does not need a cloud
          account. Backups use AES-256-GCM encryption
          with a password-derived key.
        </p>

        <p>
          The live SQLite database is not yet encrypted.
          Protect your Windows account, enable device
          encryption where available, and avoid sharing
          unencrypted exports.
        </p>
      </section>
    </div>
  );
}
