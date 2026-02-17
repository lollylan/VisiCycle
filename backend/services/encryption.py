"""
Encryption service for patient data (field-level encryption).
Uses Fernet (AES-128-CBC) derived from the user's master password.
"""
import base64
import hashlib
from cryptography.fernet import Fernet


class EncryptionService:
    """Handles encryption/decryption of sensitive patient fields."""

    def __init__(self):
        self._fernet = None
        self._is_unlocked = False

    def derive_key(self, password: str, salt: bytes = b"visicycle_salt_v1") -> bytes:
        """Derive a Fernet-compatible key from a password using PBKDF2."""
        # PBKDF2 with SHA256, 100k iterations
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
        # Fernet needs a url-safe base64-encoded 32-byte key
        return base64.urlsafe_b64encode(dk)

    def unlock(self, password: str):
        """Unlock the encryption service with the master password."""
        key = self.derive_key(password)
        self._fernet = Fernet(key)
        self._is_unlocked = True

    def lock(self):
        """Lock the encryption service (clear key from memory)."""
        self._fernet = None
        self._is_unlocked = False

    @property
    def is_unlocked(self) -> bool:
        return self._is_unlocked

    def encrypt(self, plaintext: str) -> str:
        """Encrypt a string and return base64 ciphertext."""
        if not self._fernet:
            raise RuntimeError("Encryption service is locked. Call unlock() first.")
        if not plaintext:
            return plaintext
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt a base64 ciphertext and return the original string."""
        if not self._fernet:
            raise RuntimeError("Encryption service is locked. Call unlock() first.")
        if not ciphertext:
            return ciphertext
        try:
            return self._fernet.decrypt(ciphertext.encode()).decode()
        except Exception:
            # If decryption fails (wrong password or unencrypted data), return as-is
            return ciphertext


# Singleton instance
encryption_service = EncryptionService()
