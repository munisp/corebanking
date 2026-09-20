import logging
import uuid

import tigerbeetle as tb
from utils import create_logger, get_config

logging.basicConfig(level=logging.DEBUG)

logger = create_logger(__name__)

config = get_config()

tb.configure_logging(debug=True)


def deterministic_transfer_id(key: str) -> int:
    """MN-07/MN-10/MN-14: derive a deterministic uint128 TigerBeetle id from an
    idempotency key so replays are no-ops at the ledger level."""
    return int.from_bytes(
        uuid.uuid5(uuid.NAMESPACE_URL, f"54link:{key}").bytes, "big"
    )


class TigerBeetleAdapter:
    def __init__(self):
        self._cluster_id = int(config.TB_CLUSTER_ID)
        self._address = config.TB_ADDRESS

    def _client(self) -> tb.ClientSync:
        return tb.ClientSync(
            cluster_id=self._cluster_id, replica_addresses=self._address
        )

    @staticmethod
    def _raise_for_errors(transfer_errors, allow_exists: bool = False):
        if not transfer_errors:
            return
        error_codes = [
            str(getattr(error, "result", "")) for error in transfer_errors
        ]
        if allow_exists and all("EXISTS" in code for code in error_codes):
            # Idempotent replay: the deterministic transfer id already exists.
            return
        if any("EXCEEDS_CREDITS" in code for code in error_codes):
            raise TigerBeetleBusinessError(
                "Insufficient balance for transfer.",
                error_code="EXCEEDS_CREDITS",
            )
        raise Exception(f"TigerBeetle transfer failed: {transfer_errors}")

    def transfer(
        self,
        payer: int,
        payee: int,
        amount: int,
        ledger: int = 1,
        idempotency_key: str | None = None,
    ):
        # MN-14: deterministic id when an idempotency key is supplied,
        # random id otherwise (legacy behaviour).
        id = (
            deterministic_transfer_id(idempotency_key)
            if idempotency_key
            else tb.id()
        )

        with self._client() as client:
            transfer_errors = client.create_transfers(
                [
                    tb.Transfer(
                        id=id,
                        debit_account_id=payer,
                        credit_account_id=payee,
                        amount=amount,
                        code=1,
                        ledger=ledger,
                    ),
                ]
            )
            logger.info(f"TigerBeetle transfer_errors errors: {transfer_errors}")

            self._raise_for_errors(transfer_errors, allow_exists=bool(idempotency_key))

        return id

    def pending_transfer(
        self,
        payer: int,
        payee: int,
        amount: int,
        ledger: int,
        idempotency_key: str,
        timeout_seconds: int = 0,
    ):
        """MN-07/MN-11: create a real TigerBeetle pending transfer (funds hold).

        The hold id is deterministic from the idempotency key so callers can
        always re-derive it (reserve:{transaction_id}) and replays are no-ops.
        """
        id = deterministic_transfer_id(idempotency_key)

        with self._client() as client:
            transfer_errors = client.create_transfers(
                [
                    tb.Transfer(
                        id=id,
                        debit_account_id=payer,
                        credit_account_id=payee,
                        amount=amount,
                        code=1,
                        ledger=ledger,
                        flags=tb.TransferFlags.PENDING,
                        timeout=timeout_seconds,
                    ),
                ]
            )
            logger.info(f"TigerBeetle pending transfer errors: {transfer_errors}")
            self._raise_for_errors(transfer_errors, allow_exists=True)

        return id

    def void_pending_transfer(self, idempotency_key: str, ledger: int) -> bool:
        """MN-07: void (release) a pending transfer. Idempotent — returns True
        when the hold is gone (voided or never existed)."""
        pending_id = deterministic_transfer_id(idempotency_key)
        with self._client() as client:
            existing = client.lookup_transfers([pending_id])
            if not existing:
                logger.info(
                    "void_pending_transfer: hold %s not found, treating as released",
                    pending_id,
                )
                return True
            if not (int(existing[0].flags) & int(tb.TransferFlags.PENDING)):
                # Already posted/voided — nothing to release.
                return True
            void_errors = client.create_transfers(
                [
                    tb.Transfer(
                        id=deterministic_transfer_id(f"{idempotency_key}:void"),
                        debit_account_id=existing[0].debit_account_id,
                        credit_account_id=existing[0].credit_account_id,
                        amount=existing[0].amount,
                        code=existing[0].code,
                        ledger=ledger,
                        pending_id=pending_id,
                        flags=tb.TransferFlags.VOID_PENDING_TRANSFER,
                    ),
                ]
            )
            logger.info(f"TigerBeetle void pending errors: {void_errors}")
            self._raise_for_errors(void_errors, allow_exists=True)
        return True

    def post_pending_transfer(self, idempotency_key: str, ledger: int) -> int:
        """MN-07: post (settle) a pending transfer, returning the posted id."""
        pending_id = deterministic_transfer_id(idempotency_key)
        post_id = deterministic_transfer_id(f"{idempotency_key}:post")
        with self._client() as client:
            existing = client.lookup_transfers([pending_id])
            if not existing:
                raise Exception(f"Pending hold not found for key {idempotency_key}")
            post_errors = client.create_transfers(
                [
                    tb.Transfer(
                        id=post_id,
                        debit_account_id=existing[0].debit_account_id,
                        credit_account_id=existing[0].credit_account_id,
                        amount=existing[0].amount,
                        code=existing[0].code,
                        ledger=ledger,
                        pending_id=pending_id,
                        flags=tb.TransferFlags.POST_PENDING_TRANSFER,
                    ),
                ]
            )
            logger.info(f"TigerBeetle post pending errors: {post_errors}")
            self._raise_for_errors(post_errors, allow_exists=True)
        return post_id

    def get_account(self, id: int):
        with self._client() as client:
            accounts = client.lookup_accounts([id])

            logger.info(f"TigerBeetle get_account result: {accounts}")

            if len(accounts) == 0:
                return None

            return accounts[0]

    def account_to_dict(self, acc: tb.Account):
        return {
            "id": acc.id,
            "debits_pending": acc.debits_pending,
            "debits_posted": acc.debits_posted,
            "credits_pending": acc.credits_pending,
            "credits_posted": acc.credits_posted,
            "user_data_128": acc.user_data_128,
            "user_data_64": acc.user_data_64,
            "user_data_32": acc.user_data_32,
            "ledger": acc.ledger,
            "code": acc.code,
            "flags": int(acc.flags),  # Enum -> number
            "timestamp": acc.timestamp,
        }


class TigerBeetleBusinessError(Exception):
    def __init__(self, message: str, error_code: str | None = None):
        super().__init__(message)
        self.error_code = error_code
