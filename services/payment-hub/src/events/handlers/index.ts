import { complete_txn } from "./complete_txn";
import { process_inflow } from "./process_inflow";
import { process_vfd_inflow } from "./process_vfd_inflow";
import { quote_agreed } from "./quote_agreed";
import { quote_failed } from "./quote_failed";
import { quote_initiated } from "./quote_initiated";
import { reverse_txn } from "./reverse_txn";
import { txn_failed } from "./txn_failed";
import { update_local_txn_id } from "./update_local_txn_id";

// OR-10: reserve_txn and initiate_txn_generic handlers deleted — their topics
// have no producers (dead listeners superseded by the real MN-07
// /internal/funds/reserve|release endpoints).
export const handlers = {
  quote_initiated,
  quote_agreed,
  quote_failed,
  txn_failed,
  complete_txn,
  update_local_txn_id,
  process_vfd_inflow,
  process_inflow,
  reverse_txn,
};
