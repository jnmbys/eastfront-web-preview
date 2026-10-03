// Offline extraction only; original 016 v1 view values are unchanged.
export const RECORDS_016 = {
  "schema": "industry-016-view.v1",
  "sourceCommit": "15e4d13fa9423ddb474432719468a8a8409823e9",
  "uiBaseCommit": "1519ab5138acbca7f5c3ee9f1e8f3e9ab84bc59d",
  "sources": {
    "LEDGER.json": {
      "gitBlob": "f490db1a1b0e5d3d291ed354dc8796d5d1d843f6",
      "sha256": "1df942ad7e74e6445fa912496f423c9a249c8dbee9055d106489cff13d9c6ef5"
    },
    "README.md": {
      "gitBlob": "9792b1df31cce70d3498604f13d5ec4d0e371dab",
      "sha256": "a7fda1a1617981e7c2bab7211f3acfb0cd71fdc8c8e1af876fce3720f7e192cf"
    },
    "RUN.json": {
      "gitBlob": "fe437ef639805e7c75ec9fe387ea3340cc00adef",
      "sha256": "2d13658235decb90de38d5a0ced909778d376fbc08cbec0fb25b502d7f9fca43"
    },
    "SYNTHETIC-VIEWS.json": {
      "gitBlob": "b216dbabe4a2b28a583df74688641a5adbb1b813",
      "sha256": "6e1dcc0650ea5a916448d7708628b4f7463da3ebfa42dd9eb93aa1d6a04e631f"
    },
    "TRACE.json.gz": {
      "gitBlob": "e8ff97e4e2dc6d3431e782113477bb26c1fbdb38",
      "sha256": "cf63ed1c8c67fddf0ea9cf8da96d4ea3bc9bf86ed614ebbe696754093f6162ba"
    },
    "VERIFICATION.json": {
      "gitBlob": "216c4187994fb5cb4123641e62bf89e824d4dbdd",
      "sha256": "3ee2fbb19db1aa8fdacf5a9e52ae984804c82f57f316ba269516ee01c3d53f73"
    },
    "VIEWS.json": {
      "gitBlob": "28d2bb7f9971e35347c4168e51250d0b2a9d9c47",
      "sha256": "65c52d0e4af40a4f6ba07f415fc5419fb769aee5ca9162031e80f08819d73023"
    },
    "config.py": {
      "gitBlob": "b007c81e6d02634f9d76184957241a971c26784c",
      "sha256": "c484a2715bd1574ccdfc0119c8c46f8a6ec3286e420c5891fe18c99d93dd407c"
    },
    "report.py": {
      "gitBlob": "415dee782bad8be68759e596b3e45d6f120a78af",
      "sha256": "08232ebb1e4cfcf77f28158a8434cdc5d07f3a361165aa97c7465e717425ad2a"
    },
    "view.py": {
      "gitBlob": "3d2be4bff4ec7abd9f6fc008a749fcdc514e9d8b",
      "sha256": "afea00c9327937131da78b8798703624be6fe8aff8e181648d1a0c9fe374ed31"
    }
  },
  "traceSha256": "019077a06ad80dd865bbe84bc46bb8eae46d47bc65412fc489de1e3868c72461",
  "sourceAssumption": {
    "sourceKind": "SCENARIO_INITIAL_TRAINED_RESERVE_ASSUMPTION",
    "actualTrainingReceipt": null,
    "P": 1,
    "personnelI": 2
  },
  "verification": {
    "status": "PASS",
    "singleProcess": true,
    "crashDurability": false,
    "globalBlockersRetained": 35,
    "globalBlockersClosed": 0
  },
  "checks": [
    {
      "name": "complete_013_root_all_009_hashes_37_receipts_original_two_budgets_and_nonrefundable_care",
      "origin": "REAL_LEGAL_EXECUTION",
      "passed": true
    },
    {
      "name": "actual_E8_input_fixed_arc_plan_all_63_units_Soviet_sources_hubs_and_Core_effects_match_015",
      "origin": "REAL_LEGAL_EXECUTION",
      "passed": true
    },
    {
      "name": "same_start_no_operation_control_exact_original_game_SP_RNG_and_013_E8_expiry",
      "origin": "REAL_LEGAL_EXECUTION",
      "passed": true
    },
    {
      "name": "actual_PE_consumes_original_lots_once_RP_RNG_SP_unchanged_original_Core_count_0_to_1",
      "origin": "REAL_LEGAL_EXECUTION",
      "passed": true
    },
    {
      "name": "actual_unused_branch_normal_E9_maintenance_then_quarantine_ownership_capacity_no_refund",
      "origin": "REAL_LEGAL_EXECUTION",
      "passed": true
    },
    {
      "name": "care_atomic_rollback_after_care_payment",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "care_atomic_rollback_after_execute",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "care_atomic_rollback_before_commit",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "care_same_version_race_one_commit_duplicate_and_conflicting_ID",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "care_committed_lost_receipt_and_late_retry_never_revert_newer_root",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "E8_atomic_rollback_after_fixed_settlement",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "E8_atomic_rollback_after_reserve",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "E8_atomic_rollback_after_dispatch",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "E8_atomic_rollback_after_transfer",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "E8_atomic_rollback_after_execute",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "E8_atomic_rollback_before_commit",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "E8_same_version_race_one_commit_duplicate_and_conflicting_ID",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "E8_committed_lost_receipt_and_late_retry_never_revert_newer_root",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "recovery_atomic_rollback_after_material_payment",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "recovery_atomic_rollback_after_execute",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "recovery_atomic_rollback_before_commit",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "recovery_same_version_race_one_commit_duplicate_and_conflicting_ID",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "recovery_committed_lost_receipt_and_late_retry_never_revert_newer_root",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_approvalHash",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_candidateHash",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_fixed015Hash",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_materialHash",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_rootHash",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_override_09c239ea",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_override_a5eafe3e",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_override_2f7c9a79",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_override_330b334e",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_second_care_new_ID",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_explicit_duplicate_transport",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_cross_phase_care",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_T8_PE",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_second_PE_via_original_Core_shared_limit",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_E9_expired_front_inventory",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_service_status",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_service_unitId",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_service_paidW",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_service_approvalHash",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "reject_real_boundary_input_mismatch_rolls_back_all",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "deadline_failure_rolls_back_not_zero_shipment",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "refused_receipt_retains_transit_owner_spent_capacity_no_terminal_then_E9_isolates_releases_hold",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "readonly_export_repeated_and_detached_full_root_inventory_receipts_revision_RNG_unchanged",
      "origin": "REAL_LEGAL_EXECUTION",
      "passed": true
    },
    {
      "name": "same_match_owner_reimport_rejected",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    },
    {
      "name": "original_RP_counterfactual_also_blocks_PE_by_real_shared_Core_limit",
      "origin": "SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY",
      "passed": true
    }
  ],
  "qPerSP": 4,
  "records": [
    {
      "id": "start",
      "title": "T8起点",
      "branch": "main",
      "origin": "REAL",
      "sourceOrigin": "REAL_LEGAL_EXECUTION_SINGLE_PROCESS",
      "sourceLabel": "T8_START",
      "savedViewKey": "start",
      "tracePath": "start",
      "rootHash": "759ac0d6510d7e0fad38be2c8464623c700d73afc172026faece84c6d6a3e09a",
      "view": {
        "schema": "industry-016-view.v1",
        "readOnly": true,
        "rootRevision": 37,
        "gameRevision": 142,
        "turn": 8,
        "phase": "GERMAN_RECOVERY",
        "materialRevision": 0,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 5,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": null,
        "transport": null,
        "shipment": null,
        "terminal": null,
        "materials": {
          "P": {
            "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
            "quantityP": 1,
            "owner": "RC007-REAR-G-A10",
            "custody": "REAR_AVAILABLE",
            "receivedEpoch": 7,
            "availableFromTurn": 8,
            "dispatchEpoch": 7,
            "dueEpoch": 7
          },
          "E2:L": {
            "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
            "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
            "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
            "quantityE2": 2,
            "materialType": "E2:L",
            "custody": "REAR_AVAILABLE",
            "owner": "RC007-REAR-G-A10",
            "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
            "receivedEpoch": 6,
            "availableFromTurn": 7,
            "dispatchEpoch": 6,
            "dueEpoch": 6
          }
        },
        "frontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "availableFrontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "rearInventory": {
          "P": 1,
          "E2:L": 2
        },
        "receiver": null,
        "recovery": null,
        "expired": false,
        "historicalOffmapPersonnelLQ": {
          "used": 4,
          "remaining": 0,
          "reusable": false
        },
        "blockers": [
          "CARE_NOT_PAID"
        ],
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0,
        "sourceGapSP": {
          "G": 9,
          "S": 14
        },
        "runtimeDefaultEnabled": false
      },
      "ledger": {
        "checkpoint": "T8_START",
        "rootHash": "759ac0d6510d7e0fad38be2c8464623c700d73afc172026faece84c6d6a3e09a",
        "rootRevision": 37,
        "gameRevision": 142,
        "materialRevision": 0,
        "legacyEquipmentRevision": 4,
        "legacyPersonnelRevision": 3,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 5,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": null,
        "P": {
          "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "quantityP": 1,
          "owner": "RC007-REAR-G-A10",
          "custody": "REAR_AVAILABLE",
          "receivedEpoch": 7,
          "availableFromTurn": 8,
          "dispatchEpoch": 7,
          "dueEpoch": 7
        },
        "E2": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
          "quantityE2": 2,
          "materialType": "E2:L",
          "custody": "REAR_AVAILABLE",
          "owner": "RC007-REAR-G-A10",
          "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
          "receivedEpoch": 6,
          "availableFromTurn": 7,
          "dispatchEpoch": 6,
          "dueEpoch": 6
        },
        "frontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "availableFrontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "RP": {
          "GERMAN": 8,
          "SOVIET": 12
        },
        "step": 1,
        "expired": false
      },
      "requestError": null
    },
    {
      "id": "carePaid",
      "title": "照管付款",
      "branch": "main",
      "origin": "REAL",
      "sourceOrigin": "REAL_LEGAL_EXECUTION_SINGLE_PROCESS",
      "sourceLabel": "T8_CARE_PAID",
      "savedViewKey": "carePaid",
      "tracePath": "care",
      "rootHash": "6ae2409f2ef1a5cdbbc1ebd1ee38428b5199a1162e980f0f78832ff2eca9ff5f",
      "view": {
        "schema": "industry-016-view.v1",
        "readOnly": true,
        "rootRevision": 38,
        "gameRevision": 142,
        "turn": 8,
        "phase": "GERMAN_RECOVERY",
        "materialRevision": 0,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 4,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0,
          "careTransferOutI": 1
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "accountId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/CARE-I",
          "transferId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/budget-transfer-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "receivedI": 1,
          "spentI": 1,
          "availableI": 0,
          "oldEndEpoch": 8,
          "endEpoch": 9,
          "nonrefundable": true,
          "status": "PAID_ACTIVE"
        },
        "transport": null,
        "shipment": null,
        "terminal": null,
        "materials": {
          "P": {
            "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
            "quantityP": 1,
            "owner": "RC007-REAR-G-A10",
            "custody": "REAR_AVAILABLE",
            "receivedEpoch": 7,
            "availableFromTurn": 8,
            "dispatchEpoch": 7,
            "dueEpoch": 7
          },
          "E2:L": {
            "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
            "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
            "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
            "quantityE2": 2,
            "materialType": "E2:L",
            "custody": "REAR_AVAILABLE",
            "owner": "RC007-REAR-G-A10",
            "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
            "receivedEpoch": 6,
            "availableFromTurn": 7,
            "dispatchEpoch": 6,
            "dueEpoch": 6
          }
        },
        "frontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "availableFrontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "rearInventory": {
          "P": 1,
          "E2:L": 2
        },
        "receiver": {
          "id": "RC009-G-C10-GI01",
          "capacity": {
            "P": 1,
            "E2:L": 2
          },
          "incoming": {}
        },
        "recovery": null,
        "expired": false,
        "historicalOffmapPersonnelLQ": {
          "used": 4,
          "remaining": 0,
          "reusable": false
        },
        "blockers": [
          "AWAIT_E8_SHIPMENT"
        ],
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0,
        "sourceGapSP": {
          "G": 9,
          "S": 14
        },
        "runtimeDefaultEnabled": false
      },
      "ledger": {
        "checkpoint": "T8_CARE_PAID",
        "rootHash": "6ae2409f2ef1a5cdbbc1ebd1ee38428b5199a1162e980f0f78832ff2eca9ff5f",
        "rootRevision": 38,
        "gameRevision": 142,
        "materialRevision": 0,
        "legacyEquipmentRevision": 5,
        "legacyPersonnelRevision": 3,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 4,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0,
          "careTransferOutI": 1
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "accountId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/CARE-I",
          "transferId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/budget-transfer-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "receivedI": 1,
          "spentI": 1,
          "availableI": 0,
          "oldEndEpoch": 8,
          "endEpoch": 9,
          "nonrefundable": true,
          "status": "PAID_ACTIVE"
        },
        "P": {
          "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "quantityP": 1,
          "owner": "RC007-REAR-G-A10",
          "custody": "REAR_AVAILABLE",
          "receivedEpoch": 7,
          "availableFromTurn": 8,
          "dispatchEpoch": 7,
          "dueEpoch": 7
        },
        "E2": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
          "quantityE2": 2,
          "materialType": "E2:L",
          "custody": "REAR_AVAILABLE",
          "owner": "RC007-REAR-G-A10",
          "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
          "receivedEpoch": 6,
          "availableFromTurn": 7,
          "dispatchEpoch": 6,
          "dueEpoch": 6
        },
        "frontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "availableFrontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "RP": {
          "GERMAN": 8,
          "SOVIET": 12
        },
        "step": 1,
        "expired": false
      },
      "requestError": null
    },
    {
      "id": "received",
      "title": "E8到账 · T9开始",
      "branch": "main",
      "origin": "REAL",
      "sourceOrigin": "REAL_LEGAL_EXECUTION_SINGLE_PROCESS",
      "sourceLabel": "E8_ARRIVED_T9_BEGIN",
      "savedViewKey": null,
      "tracePath": "records[6].afterBoundary",
      "rootHash": "58537492272b01b3c6ff241288eb447f8bbf592039e91b8a202015fe8dc26fca",
      "view": {
        "schema": "industry-016-view.v1",
        "readOnly": true,
        "rootRevision": 45,
        "gameRevision": 149,
        "turn": 9,
        "phase": "GERMAN_SUPPLY_RAIL",
        "materialRevision": 1,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 4,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0,
          "careTransferOutI": 1
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "accountId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/CARE-I",
          "transferId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/budget-transfer-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "receivedI": 1,
          "spentI": 1,
          "availableI": 0,
          "oldEndEpoch": 8,
          "endEpoch": 9,
          "nonrefundable": true,
          "status": "PAID_ACTIVE"
        },
        "transport": [
          {
            "id": "rail:A10~B10",
            "originalCap": 40,
            "spUsed": 32,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          },
          {
            "id": "rail:B10~C10",
            "originalCap": 40,
            "spUsed": 32,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          },
          {
            "id": "T",
            "originalCap": 2200,
            "spUsed": 108,
            "cargo": 16,
            "remaining": 2076,
            "reservation": 0,
            "freight": 16
          },
          {
            "id": "W:GH2",
            "originalCap": 96,
            "spUsed": 88,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          }
        ],
        "shipment": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "dispatchEpoch": 8,
          "arrivalEpoch": 8,
          "availableFromTurn": 9,
          "inputHash": "c4e6c61b65d1f5254d35d153e65e1c3a51f95ae6f0f44c618f812006bedf6297",
          "candidateHash": "50c31db0bb29330b4a581e5c3bdec26190f6fd0d9d25f2918f9342ef58c5ac25",
          "capacityWitnessHash": "c1bc5365e6471501d988e942d0c796c757e6a18933751514a2da0d97da75339f",
          "careExtensionId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "status": "RECEIVED",
          "inputRootHash": "9af98995240bf54466fd421e92b21a258c47490b3ab08bbb03453d5669f3e587",
          "requestId": "016-phase-148",
          "requestFingerprint": "a6be2b72e7a15c34aa336acd05525b39802dd8c1a1ae7f3b45d2c8a3575badf6",
          "inputMaterialRevision": 0,
          "receiptId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/receipt-0001"
        },
        "terminal": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/terminal-GI01-0001",
          "status": "PAID",
          "unitId": "G-I-01",
          "controllerId": "G-HUMAN-1",
          "side": "G",
          "node": "C10",
          "key": "2,8",
          "paidW": 8,
          "extraRecoveryW": 0,
          "shipmentId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "arrivalEpoch": 8,
          "availableFromTurn": 9,
          "approvalHash": "239a479dcfba305b89eeacbc12ec6acfeea3610fa3c7e80be1ce91a76cfacd27",
          "candidateHash": "8f433f64818bd2b294b9a9626b6c9969cc6cd821e643405cc33f7e38058255ab",
          "fixedCandidateHash": "50c31db0bb29330b4a581e5c3bdec26190f6fd0d9d25f2918f9342ef58c5ac25",
          "inputHash": "c4e6c61b65d1f5254d35d153e65e1c3a51f95ae6f0f44c618f812006bedf6297",
          "capacityWitnessHash": "c1bc5365e6471501d988e942d0c796c757e6a18933751514a2da0d97da75339f",
          "careExtensionId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "expiresAfterEpoch": 9,
          "inputRootHash": "9af98995240bf54466fd421e92b21a258c47490b3ab08bbb03453d5669f3e587",
          "requestFingerprint": "a6be2b72e7a15c34aa336acd05525b39802dd8c1a1ae7f3b45d2c8a3575badf6",
          "materialRevision": 1
        },
        "materials": {
          "P": {
            "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
            "quantityP": 1,
            "owner": "RC009-G-C10-GI01",
            "custody": "FRONT_AVAILABLE",
            "receivedEpoch": 7,
            "availableFromTurn": 8,
            "dispatchEpoch": 7,
            "dueEpoch": 7
          },
          "E2:L": {
            "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
            "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
            "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
            "quantityE2": 2,
            "materialType": "E2:L",
            "custody": "FRONT_AVAILABLE",
            "owner": "RC009-G-C10-GI01",
            "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
            "receivedEpoch": 6,
            "availableFromTurn": 7,
            "dispatchEpoch": 6,
            "dueEpoch": 6
          }
        },
        "frontInventory": {
          "P": 1,
          "E2:L": 2
        },
        "availableFrontInventory": {
          "P": 1,
          "E2:L": 2
        },
        "rearInventory": {
          "P": 0,
          "E2:L": 0
        },
        "receiver": {
          "id": "RC009-G-C10-GI01",
          "capacity": {
            "P": 1,
            "E2:L": 2
          },
          "incoming": {}
        },
        "recovery": null,
        "expired": false,
        "historicalOffmapPersonnelLQ": {
          "used": 4,
          "remaining": 0,
          "reusable": false
        },
        "blockers": [
          "AWAIT_T9_CORE_QUALIFICATION"
        ],
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0,
        "sourceGapSP": {
          "G": 9,
          "S": 14
        },
        "runtimeDefaultEnabled": false
      },
      "ledger": {
        "checkpoint": "E8_ARRIVED_T9_BEGIN",
        "rootHash": "58537492272b01b3c6ff241288eb447f8bbf592039e91b8a202015fe8dc26fca",
        "rootRevision": 45,
        "gameRevision": 149,
        "materialRevision": 1,
        "legacyEquipmentRevision": 6,
        "legacyPersonnelRevision": 4,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 4,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0,
          "careTransferOutI": 1
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "accountId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/CARE-I",
          "transferId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/budget-transfer-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "receivedI": 1,
          "spentI": 1,
          "availableI": 0,
          "oldEndEpoch": 8,
          "endEpoch": 9,
          "nonrefundable": true,
          "status": "PAID_ACTIVE"
        },
        "P": {
          "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "quantityP": 1,
          "owner": "RC009-G-C10-GI01",
          "custody": "FRONT_AVAILABLE",
          "receivedEpoch": 7,
          "availableFromTurn": 8,
          "dispatchEpoch": 7,
          "dueEpoch": 7
        },
        "E2": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
          "quantityE2": 2,
          "materialType": "E2:L",
          "custody": "FRONT_AVAILABLE",
          "owner": "RC009-G-C10-GI01",
          "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
          "receivedEpoch": 6,
          "availableFromTurn": 7,
          "dispatchEpoch": 6,
          "dueEpoch": 6
        },
        "frontInventory": {
          "P": 1,
          "E2:L": 2
        },
        "availableFrontInventory": {
          "P": 1,
          "E2:L": 2
        },
        "RP": {
          "GERMAN": 8,
          "SOVIET": 12
        },
        "step": 1,
        "expired": false
      },
      "requestError": null
    },
    {
      "id": "preRecovery",
      "title": "T9恢复前",
      "branch": "main",
      "origin": "REAL",
      "sourceOrigin": "REAL_LEGAL_EXECUTION_SINGLE_PROCESS",
      "sourceLabel": "T9_RECOVERY_BEFORE",
      "savedViewKey": "received",
      "tracePath": "preRecovery",
      "rootHash": "00f2fa816eaaf2580e457df867357c9ef005019c99770789f6c83dbabef0ef4d",
      "view": {
        "schema": "industry-016-view.v1",
        "readOnly": true,
        "rootRevision": 48,
        "gameRevision": 152,
        "turn": 9,
        "phase": "GERMAN_RECOVERY",
        "materialRevision": 1,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 4,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0,
          "careTransferOutI": 1
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "accountId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/CARE-I",
          "transferId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/budget-transfer-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "receivedI": 1,
          "spentI": 1,
          "availableI": 0,
          "oldEndEpoch": 8,
          "endEpoch": 9,
          "nonrefundable": true,
          "status": "PAID_ACTIVE"
        },
        "transport": [
          {
            "id": "rail:A10~B10",
            "originalCap": 40,
            "spUsed": 32,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          },
          {
            "id": "rail:B10~C10",
            "originalCap": 40,
            "spUsed": 32,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          },
          {
            "id": "T",
            "originalCap": 2200,
            "spUsed": 108,
            "cargo": 16,
            "remaining": 2076,
            "reservation": 0,
            "freight": 16
          },
          {
            "id": "W:GH2",
            "originalCap": 96,
            "spUsed": 88,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          }
        ],
        "shipment": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "dispatchEpoch": 8,
          "arrivalEpoch": 8,
          "availableFromTurn": 9,
          "inputHash": "c4e6c61b65d1f5254d35d153e65e1c3a51f95ae6f0f44c618f812006bedf6297",
          "candidateHash": "50c31db0bb29330b4a581e5c3bdec26190f6fd0d9d25f2918f9342ef58c5ac25",
          "capacityWitnessHash": "c1bc5365e6471501d988e942d0c796c757e6a18933751514a2da0d97da75339f",
          "careExtensionId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "status": "RECEIVED",
          "inputRootHash": "9af98995240bf54466fd421e92b21a258c47490b3ab08bbb03453d5669f3e587",
          "requestId": "016-phase-148",
          "requestFingerprint": "a6be2b72e7a15c34aa336acd05525b39802dd8c1a1ae7f3b45d2c8a3575badf6",
          "inputMaterialRevision": 0,
          "receiptId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/receipt-0001"
        },
        "terminal": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/terminal-GI01-0001",
          "status": "PAID",
          "unitId": "G-I-01",
          "controllerId": "G-HUMAN-1",
          "side": "G",
          "node": "C10",
          "key": "2,8",
          "paidW": 8,
          "extraRecoveryW": 0,
          "shipmentId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "arrivalEpoch": 8,
          "availableFromTurn": 9,
          "approvalHash": "239a479dcfba305b89eeacbc12ec6acfeea3610fa3c7e80be1ce91a76cfacd27",
          "candidateHash": "8f433f64818bd2b294b9a9626b6c9969cc6cd821e643405cc33f7e38058255ab",
          "fixedCandidateHash": "50c31db0bb29330b4a581e5c3bdec26190f6fd0d9d25f2918f9342ef58c5ac25",
          "inputHash": "c4e6c61b65d1f5254d35d153e65e1c3a51f95ae6f0f44c618f812006bedf6297",
          "capacityWitnessHash": "c1bc5365e6471501d988e942d0c796c757e6a18933751514a2da0d97da75339f",
          "careExtensionId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "expiresAfterEpoch": 9,
          "inputRootHash": "9af98995240bf54466fd421e92b21a258c47490b3ab08bbb03453d5669f3e587",
          "requestFingerprint": "a6be2b72e7a15c34aa336acd05525b39802dd8c1a1ae7f3b45d2c8a3575badf6",
          "materialRevision": 1
        },
        "materials": {
          "P": {
            "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
            "quantityP": 1,
            "owner": "RC009-G-C10-GI01",
            "custody": "FRONT_AVAILABLE",
            "receivedEpoch": 7,
            "availableFromTurn": 8,
            "dispatchEpoch": 7,
            "dueEpoch": 7
          },
          "E2:L": {
            "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
            "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
            "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
            "quantityE2": 2,
            "materialType": "E2:L",
            "custody": "FRONT_AVAILABLE",
            "owner": "RC009-G-C10-GI01",
            "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
            "receivedEpoch": 6,
            "availableFromTurn": 7,
            "dispatchEpoch": 6,
            "dueEpoch": 6
          }
        },
        "frontInventory": {
          "P": 1,
          "E2:L": 2
        },
        "availableFrontInventory": {
          "P": 1,
          "E2:L": 2
        },
        "rearInventory": {
          "P": 0,
          "E2:L": 0
        },
        "receiver": {
          "id": "RC009-G-C10-GI01",
          "capacity": {
            "P": 1,
            "E2:L": 2
          },
          "incoming": {}
        },
        "recovery": null,
        "expired": false,
        "historicalOffmapPersonnelLQ": {
          "used": 4,
          "remaining": 0,
          "reusable": false
        },
        "blockers": [
          "AWAIT_T9_CORE_QUALIFICATION"
        ],
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0,
        "sourceGapSP": {
          "G": 9,
          "S": 14
        },
        "runtimeDefaultEnabled": false
      },
      "ledger": {
        "checkpoint": "T9_RECOVERY_BEFORE",
        "rootHash": "00f2fa816eaaf2580e457df867357c9ef005019c99770789f6c83dbabef0ef4d",
        "rootRevision": 48,
        "gameRevision": 152,
        "materialRevision": 1,
        "legacyEquipmentRevision": 6,
        "legacyPersonnelRevision": 4,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 4,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0,
          "careTransferOutI": 1
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "accountId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/CARE-I",
          "transferId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/budget-transfer-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "receivedI": 1,
          "spentI": 1,
          "availableI": 0,
          "oldEndEpoch": 8,
          "endEpoch": 9,
          "nonrefundable": true,
          "status": "PAID_ACTIVE"
        },
        "P": {
          "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "quantityP": 1,
          "owner": "RC009-G-C10-GI01",
          "custody": "FRONT_AVAILABLE",
          "receivedEpoch": 7,
          "availableFromTurn": 8,
          "dispatchEpoch": 7,
          "dueEpoch": 7
        },
        "E2": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
          "quantityE2": 2,
          "materialType": "E2:L",
          "custody": "FRONT_AVAILABLE",
          "owner": "RC009-G-C10-GI01",
          "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
          "receivedEpoch": 6,
          "availableFromTurn": 7,
          "dispatchEpoch": 6,
          "dueEpoch": 6
        },
        "frontInventory": {
          "P": 1,
          "E2:L": 2
        },
        "availableFrontInventory": {
          "P": 1,
          "E2:L": 2
        },
        "RP": {
          "GERMAN": 8,
          "SOVIET": 12
        },
        "step": 1,
        "expired": false
      },
      "requestError": null
    },
    {
      "id": "recovered",
      "title": "恢复后",
      "branch": "main",
      "origin": "REAL",
      "sourceOrigin": "REAL_LEGAL_EXECUTION_SINGLE_PROCESS",
      "sourceLabel": "T9_RECOVERY_AFTER",
      "savedViewKey": "recovered",
      "tracePath": "recovered",
      "rootHash": "44f00dbd079df823ad866652565b279c655334ea3994f7aa2cc46d3757655103",
      "view": {
        "schema": "industry-016-view.v1",
        "readOnly": true,
        "rootRevision": 49,
        "gameRevision": 153,
        "turn": 9,
        "phase": "GERMAN_RECOVERY",
        "materialRevision": 2,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 4,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0,
          "careTransferOutI": 1
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "accountId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/CARE-I",
          "transferId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/budget-transfer-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "receivedI": 1,
          "spentI": 1,
          "availableI": 0,
          "oldEndEpoch": 8,
          "endEpoch": 9,
          "nonrefundable": true,
          "status": "PAID_ACTIVE"
        },
        "transport": [
          {
            "id": "rail:A10~B10",
            "originalCap": 40,
            "spUsed": 32,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          },
          {
            "id": "rail:B10~C10",
            "originalCap": 40,
            "spUsed": 32,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          },
          {
            "id": "T",
            "originalCap": 2200,
            "spUsed": 108,
            "cargo": 16,
            "remaining": 2076,
            "reservation": 0,
            "freight": 16
          },
          {
            "id": "W:GH2",
            "originalCap": 96,
            "spUsed": 88,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          }
        ],
        "shipment": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "dispatchEpoch": 8,
          "arrivalEpoch": 8,
          "availableFromTurn": 9,
          "inputHash": "c4e6c61b65d1f5254d35d153e65e1c3a51f95ae6f0f44c618f812006bedf6297",
          "candidateHash": "50c31db0bb29330b4a581e5c3bdec26190f6fd0d9d25f2918f9342ef58c5ac25",
          "capacityWitnessHash": "c1bc5365e6471501d988e942d0c796c757e6a18933751514a2da0d97da75339f",
          "careExtensionId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "status": "RECEIVED",
          "inputRootHash": "9af98995240bf54466fd421e92b21a258c47490b3ab08bbb03453d5669f3e587",
          "requestId": "016-phase-148",
          "requestFingerprint": "a6be2b72e7a15c34aa336acd05525b39802dd8c1a1ae7f3b45d2c8a3575badf6",
          "inputMaterialRevision": 0,
          "receiptId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/receipt-0001"
        },
        "terminal": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/terminal-GI01-0001",
          "status": "CONSUMED",
          "unitId": "G-I-01",
          "controllerId": "G-HUMAN-1",
          "side": "G",
          "node": "C10",
          "key": "2,8",
          "paidW": 8,
          "extraRecoveryW": 0,
          "shipmentId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "arrivalEpoch": 8,
          "availableFromTurn": 9,
          "approvalHash": "239a479dcfba305b89eeacbc12ec6acfeea3610fa3c7e80be1ce91a76cfacd27",
          "candidateHash": "8f433f64818bd2b294b9a9626b6c9969cc6cd821e643405cc33f7e38058255ab",
          "fixedCandidateHash": "50c31db0bb29330b4a581e5c3bdec26190f6fd0d9d25f2918f9342ef58c5ac25",
          "inputHash": "c4e6c61b65d1f5254d35d153e65e1c3a51f95ae6f0f44c618f812006bedf6297",
          "capacityWitnessHash": "c1bc5365e6471501d988e942d0c796c757e6a18933751514a2da0d97da75339f",
          "careExtensionId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "expiresAfterEpoch": 9,
          "inputRootHash": "9af98995240bf54466fd421e92b21a258c47490b3ab08bbb03453d5669f3e587",
          "requestFingerprint": "a6be2b72e7a15c34aa336acd05525b39802dd8c1a1ae7f3b45d2c8a3575badf6",
          "materialRevision": 1,
          "consumedBy": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/recovery-0001"
        },
        "materials": {
          "P": {
            "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
            "quantityP": 0,
            "owner": "RC009-G-C10-GI01",
            "custody": "CONSUMED",
            "receivedEpoch": 7,
            "availableFromTurn": 8,
            "dispatchEpoch": 7,
            "dueEpoch": 7,
            "consumedP016": 1
          },
          "E2:L": {
            "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
            "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
            "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
            "quantityE2": 0,
            "materialType": "E2:L",
            "custody": "CONSUMED",
            "owner": "RC009-G-C10-GI01",
            "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
            "receivedEpoch": 6,
            "availableFromTurn": 7,
            "dispatchEpoch": 6,
            "dueEpoch": 6,
            "consumedE2016": 2
          }
        },
        "frontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "availableFrontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "rearInventory": {
          "P": 0,
          "E2:L": 0
        },
        "receiver": {
          "id": "RC009-G-C10-GI01",
          "capacity": {
            "P": 1,
            "E2:L": 2
          },
          "incoming": {}
        },
        "recovery": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/recovery-0001",
          "requestId": "016-repair",
          "unitId": "G-I-01",
          "payment": {
            "P": 1,
            "E2:L": 2,
            "RP": 0,
            "extraW": 0
          },
          "beforeStep": 1,
          "afterStep": 0,
          "beforeGameRevision": 152,
          "afterGameRevision": 153,
          "commonBefore": {
            "commonEligible": true,
            "commonIssues": [],
            "requestIssues": [],
            "envelopeIssues": [],
            "enginePreconditions": {
              "passed": true,
              "issues": []
            },
            "integrityIssues": [],
            "recoveryIssues": [],
            "rpIssues": [],
            "target": {
              "id": "G-I-01",
              "side": "GERMAN",
              "templateId": "G-INF",
              "step": 1,
              "nodeId": "C10",
              "supplyState": "SUPPLIED"
            },
            "context": {
              "revision": 152,
              "snapshotHash": "10d26609365cbd9e512a95f7c7ee6df358ea3dcebfddf6f653485c5cae7b2a13",
              "turn": 9,
              "phase": "GERMAN_RECOVERY",
              "recoveryCount": 0,
              "recoveryLimit": 1
            }
          }
        },
        "expired": false,
        "historicalOffmapPersonnelLQ": {
          "used": 4,
          "remaining": 0,
          "reusable": false
        },
        "blockers": [],
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0,
        "sourceGapSP": {
          "G": 9,
          "S": 14
        },
        "runtimeDefaultEnabled": false
      },
      "ledger": {
        "checkpoint": "T9_RECOVERY_AFTER",
        "rootHash": "44f00dbd079df823ad866652565b279c655334ea3994f7aa2cc46d3757655103",
        "rootRevision": 49,
        "gameRevision": 153,
        "materialRevision": 2,
        "legacyEquipmentRevision": 7,
        "legacyPersonnelRevision": 5,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 4,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0,
          "careTransferOutI": 1
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "accountId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/CARE-I",
          "transferId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/budget-transfer-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "receivedI": 1,
          "spentI": 1,
          "availableI": 0,
          "oldEndEpoch": 8,
          "endEpoch": 9,
          "nonrefundable": true,
          "status": "PAID_ACTIVE"
        },
        "P": {
          "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "quantityP": 0,
          "owner": "RC009-G-C10-GI01",
          "custody": "CONSUMED",
          "receivedEpoch": 7,
          "availableFromTurn": 8,
          "dispatchEpoch": 7,
          "dueEpoch": 7,
          "consumedP016": 1
        },
        "E2": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
          "quantityE2": 0,
          "materialType": "E2:L",
          "custody": "CONSUMED",
          "owner": "RC009-G-C10-GI01",
          "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
          "receivedEpoch": 6,
          "availableFromTurn": 7,
          "dispatchEpoch": 6,
          "dueEpoch": 6,
          "consumedE2016": 2
        },
        "frontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "availableFrontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "RP": {
          "GERMAN": 8,
          "SOVIET": 12
        },
        "step": 0,
        "expired": false
      },
      "requestError": null
    },
    {
      "id": "controlExpired",
      "title": "无操作 · E8到期",
      "branch": "control",
      "origin": "REAL",
      "sourceOrigin": "REAL_SAME_START_NO_CARE_NO_SHIPMENT",
      "sourceLabel": "NO_OPERATION_END_E8",
      "savedViewKey": "controlExpired",
      "tracePath": "control.root",
      "rootHash": "a83662f3aeb26c723d29cceccbbdbe041030636030abaa63fef22a79eb25af9a",
      "view": {
        "schema": "industry-016-view.v1",
        "readOnly": true,
        "rootRevision": 47,
        "gameRevision": 152,
        "turn": 9,
        "phase": "GERMAN_RECOVERY",
        "materialRevision": 1,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 5,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": null,
        "transport": null,
        "shipment": null,
        "terminal": null,
        "materials": {
          "P": {
            "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
            "quantityP": 1,
            "owner": "RC007-REAR-G-A10",
            "custody": "REAR_QUARANTINED",
            "receivedEpoch": 7,
            "availableFromTurn": 8,
            "dispatchEpoch": 7,
            "dueEpoch": 7
          },
          "E2:L": {
            "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
            "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
            "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
            "quantityE2": 2,
            "materialType": "E2:L",
            "custody": "REAR_AVAILABLE",
            "owner": "RC007-REAR-G-A10",
            "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
            "receivedEpoch": 6,
            "availableFromTurn": 7,
            "dispatchEpoch": 6,
            "dueEpoch": 6
          }
        },
        "frontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "availableFrontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "rearInventory": {
          "P": 1,
          "E2:L": 2
        },
        "receiver": {
          "id": "RC009-G-C10-GI01",
          "capacity": {
            "P": 1,
            "E2:L": 2
          },
          "incoming": {}
        },
        "recovery": null,
        "expired": true,
        "historicalOffmapPersonnelLQ": {
          "used": 4,
          "remaining": 0,
          "reusable": false
        },
        "blockers": [
          "SCOPE_EXPIRED"
        ],
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0,
        "sourceGapSP": {
          "G": 9,
          "S": 14
        },
        "runtimeDefaultEnabled": false
      },
      "ledger": {
        "checkpoint": "NO_OPERATION_END_E8",
        "rootHash": "a83662f3aeb26c723d29cceccbbdbe041030636030abaa63fef22a79eb25af9a",
        "rootRevision": 47,
        "gameRevision": 152,
        "materialRevision": 1,
        "legacyEquipmentRevision": 4,
        "legacyPersonnelRevision": 4,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 5,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": null,
        "P": {
          "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "quantityP": 1,
          "owner": "RC007-REAR-G-A10",
          "custody": "REAR_QUARANTINED",
          "receivedEpoch": 7,
          "availableFromTurn": 8,
          "dispatchEpoch": 7,
          "dueEpoch": 7
        },
        "E2": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
          "quantityE2": 2,
          "materialType": "E2:L",
          "custody": "REAR_AVAILABLE",
          "owner": "RC007-REAR-G-A10",
          "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
          "receivedEpoch": 6,
          "availableFromTurn": 7,
          "dispatchEpoch": 6,
          "dueEpoch": 6
        },
        "frontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "availableFrontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "RP": {
          "GERMAN": 8,
          "SOVIET": 12
        },
        "step": 1,
        "expired": true
      },
      "requestError": null
    },
    {
      "id": "unusedExpired",
      "title": "未恢复 · E9到期",
      "branch": "unused",
      "origin": "REAL",
      "sourceOrigin": "REAL_LEGAL_CONTINUATION_NO_RECOVERY_NORMAL_MAINTENANCE",
      "sourceLabel": "UNUSED_END_E9",
      "savedViewKey": "unusedExpired",
      "tracePath": "unusedEndE9.root",
      "rootHash": "c3c8b860ca077b6c8e634b7d956aaf8fd27a81c71d8ebfd8f4ac178714163fef",
      "view": {
        "schema": "industry-016-view.v1",
        "readOnly": true,
        "rootRevision": 55,
        "gameRevision": 159,
        "turn": 10,
        "phase": "GERMAN_SUPPLY_RAIL",
        "materialRevision": 2,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 4,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0,
          "careTransferOutI": 1
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "accountId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/CARE-I",
          "transferId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/budget-transfer-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "receivedI": 1,
          "spentI": 1,
          "availableI": 0,
          "oldEndEpoch": 8,
          "endEpoch": 9,
          "nonrefundable": true,
          "status": "EXPIRED_PAID_NO_REFUND"
        },
        "transport": [
          {
            "id": "rail:A10~B10",
            "originalCap": 40,
            "spUsed": 32,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          },
          {
            "id": "rail:B10~C10",
            "originalCap": 40,
            "spUsed": 32,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          },
          {
            "id": "T",
            "originalCap": 2200,
            "spUsed": 108,
            "cargo": 16,
            "remaining": 2076,
            "reservation": 0,
            "freight": 16
          },
          {
            "id": "W:GH2",
            "originalCap": 96,
            "spUsed": 88,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          }
        ],
        "shipment": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "dispatchEpoch": 8,
          "arrivalEpoch": 8,
          "availableFromTurn": 9,
          "inputHash": "c4e6c61b65d1f5254d35d153e65e1c3a51f95ae6f0f44c618f812006bedf6297",
          "candidateHash": "50c31db0bb29330b4a581e5c3bdec26190f6fd0d9d25f2918f9342ef58c5ac25",
          "capacityWitnessHash": "c1bc5365e6471501d988e942d0c796c757e6a18933751514a2da0d97da75339f",
          "careExtensionId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "status": "RECEIVED",
          "inputRootHash": "2b01005881342c7d8e0ebc7defcba02874879a86bbc350764d300544eff35569",
          "requestId": "016-phase-148",
          "requestFingerprint": "9fb9e6983e786eddaec4eb2fb85dd15fd3292f91c91f18079e6480931de82f6f",
          "inputMaterialRevision": 0,
          "receiptId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/receipt-0001"
        },
        "terminal": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/terminal-GI01-0001",
          "status": "EXPIRED_NO_REFUND",
          "unitId": "G-I-01",
          "controllerId": "G-HUMAN-1",
          "side": "G",
          "node": "C10",
          "key": "2,8",
          "paidW": 8,
          "extraRecoveryW": 0,
          "shipmentId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "arrivalEpoch": 8,
          "availableFromTurn": 9,
          "approvalHash": "239a479dcfba305b89eeacbc12ec6acfeea3610fa3c7e80be1ce91a76cfacd27",
          "candidateHash": "8f433f64818bd2b294b9a9626b6c9969cc6cd821e643405cc33f7e38058255ab",
          "fixedCandidateHash": "50c31db0bb29330b4a581e5c3bdec26190f6fd0d9d25f2918f9342ef58c5ac25",
          "inputHash": "c4e6c61b65d1f5254d35d153e65e1c3a51f95ae6f0f44c618f812006bedf6297",
          "capacityWitnessHash": "c1bc5365e6471501d988e942d0c796c757e6a18933751514a2da0d97da75339f",
          "careExtensionId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "expiresAfterEpoch": 9,
          "inputRootHash": "2b01005881342c7d8e0ebc7defcba02874879a86bbc350764d300544eff35569",
          "requestFingerprint": "9fb9e6983e786eddaec4eb2fb85dd15fd3292f91c91f18079e6480931de82f6f",
          "materialRevision": 1
        },
        "materials": {
          "P": {
            "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
            "quantityP": 1,
            "owner": "RC009-G-C10-GI01",
            "custody": "FRONT_QUARANTINED",
            "receivedEpoch": 7,
            "availableFromTurn": 8,
            "dispatchEpoch": 7,
            "dueEpoch": 7
          },
          "E2:L": {
            "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
            "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
            "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
            "quantityE2": 2,
            "materialType": "E2:L",
            "custody": "FRONT_QUARANTINED",
            "owner": "RC009-G-C10-GI01",
            "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
            "receivedEpoch": 6,
            "availableFromTurn": 7,
            "dispatchEpoch": 6,
            "dueEpoch": 6
          }
        },
        "frontInventory": {
          "P": 1,
          "E2:L": 2
        },
        "availableFrontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "rearInventory": {
          "P": 0,
          "E2:L": 0
        },
        "receiver": {
          "id": "RC009-G-C10-GI01",
          "capacity": {
            "P": 1,
            "E2:L": 2
          },
          "incoming": {}
        },
        "recovery": null,
        "expired": true,
        "historicalOffmapPersonnelLQ": {
          "used": 4,
          "remaining": 0,
          "reusable": false
        },
        "blockers": [
          "SCOPE_EXPIRED"
        ],
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0,
        "sourceGapSP": {
          "G": 9,
          "S": 14
        },
        "runtimeDefaultEnabled": false
      },
      "ledger": {
        "checkpoint": "UNUSED_END_E9",
        "rootHash": "c3c8b860ca077b6c8e634b7d956aaf8fd27a81c71d8ebfd8f4ac178714163fef",
        "rootRevision": 55,
        "gameRevision": 159,
        "materialRevision": 2,
        "legacyEquipmentRevision": 7,
        "legacyPersonnelRevision": 5,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 4,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0,
          "careTransferOutI": 1
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "accountId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/CARE-I",
          "transferId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/budget-transfer-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "receivedI": 1,
          "spentI": 1,
          "availableI": 0,
          "oldEndEpoch": 8,
          "endEpoch": 9,
          "nonrefundable": true,
          "status": "EXPIRED_PAID_NO_REFUND"
        },
        "P": {
          "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "quantityP": 1,
          "owner": "RC009-G-C10-GI01",
          "custody": "FRONT_QUARANTINED",
          "receivedEpoch": 7,
          "availableFromTurn": 8,
          "dispatchEpoch": 7,
          "dueEpoch": 7
        },
        "E2": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
          "quantityE2": 2,
          "materialType": "E2:L",
          "custody": "FRONT_QUARANTINED",
          "owner": "RC009-G-C10-GI01",
          "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
          "receivedEpoch": 6,
          "availableFromTurn": 7,
          "dispatchEpoch": 6,
          "dueEpoch": 6
        },
        "frontInventory": {
          "P": 1,
          "E2:L": 2
        },
        "availableFrontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "RP": {
          "GERMAN": 8,
          "SOVIET": 12
        },
        "step": 1,
        "expired": true
      },
      "requestError": null
    },
    {
      "id": "careFailed",
      "title": "careFailed",
      "branch": "synthetic",
      "origin": "SYNTHETIC",
      "sourceOrigin": "SYNTHETIC_FAULT_ON_REAL_CHECKPOINT",
      "sourceLabel": "careFailed",
      "tracePath": null,
      "rootHash": null,
      "view": {
        "schema": "industry-016-view.v1",
        "readOnly": true,
        "rootRevision": 37,
        "gameRevision": 142,
        "turn": 8,
        "phase": "GERMAN_RECOVERY",
        "materialRevision": 0,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 5,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": null,
        "transport": null,
        "shipment": null,
        "terminal": null,
        "materials": {
          "P": {
            "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
            "quantityP": 1,
            "owner": "RC007-REAR-G-A10",
            "custody": "REAR_AVAILABLE",
            "receivedEpoch": 7,
            "availableFromTurn": 8,
            "dispatchEpoch": 7,
            "dueEpoch": 7
          },
          "E2:L": {
            "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
            "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
            "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
            "quantityE2": 2,
            "materialType": "E2:L",
            "custody": "REAR_AVAILABLE",
            "owner": "RC007-REAR-G-A10",
            "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
            "receivedEpoch": 6,
            "availableFromTurn": 7,
            "dispatchEpoch": 6,
            "dueEpoch": 6
          }
        },
        "frontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "availableFrontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "rearInventory": {
          "P": 1,
          "E2:L": 2
        },
        "receiver": null,
        "recovery": null,
        "expired": false,
        "historicalOffmapPersonnelLQ": {
          "used": 4,
          "remaining": 0,
          "reusable": false
        },
        "blockers": [
          "CARE_NOT_PAID"
        ],
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0,
        "sourceGapSP": {
          "G": 9,
          "S": 14
        },
        "runtimeDefaultEnabled": false
      },
      "ledger": null,
      "requestError": {
        "ok": false,
        "error": "REJECTED_UNCHANGED",
        "detail": "SYNTHETIC_PRECOMMIT:before_commit"
      }
    },
    {
      "id": "E8Failed",
      "title": "E8Failed",
      "branch": "synthetic",
      "origin": "SYNTHETIC",
      "sourceOrigin": "SYNTHETIC_FAULT_ON_REAL_CHECKPOINT",
      "sourceLabel": "E8Failed",
      "tracePath": null,
      "rootHash": null,
      "view": {
        "schema": "industry-016-view.v1",
        "readOnly": true,
        "rootRevision": 44,
        "gameRevision": 148,
        "turn": 8,
        "phase": "SOVIET_ENTRENCHMENT",
        "materialRevision": 0,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 4,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0,
          "careTransferOutI": 1
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "accountId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/CARE-I",
          "transferId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/budget-transfer-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "receivedI": 1,
          "spentI": 1,
          "availableI": 0,
          "oldEndEpoch": 8,
          "endEpoch": 9,
          "nonrefundable": true,
          "status": "PAID_ACTIVE"
        },
        "transport": null,
        "shipment": null,
        "terminal": null,
        "materials": {
          "P": {
            "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
            "quantityP": 1,
            "owner": "RC007-REAR-G-A10",
            "custody": "REAR_AVAILABLE",
            "receivedEpoch": 7,
            "availableFromTurn": 8,
            "dispatchEpoch": 7,
            "dueEpoch": 7
          },
          "E2:L": {
            "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
            "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
            "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
            "quantityE2": 2,
            "materialType": "E2:L",
            "custody": "REAR_AVAILABLE",
            "owner": "RC007-REAR-G-A10",
            "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
            "receivedEpoch": 6,
            "availableFromTurn": 7,
            "dispatchEpoch": 6,
            "dueEpoch": 6
          }
        },
        "frontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "availableFrontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "rearInventory": {
          "P": 1,
          "E2:L": 2
        },
        "receiver": {
          "id": "RC009-G-C10-GI01",
          "capacity": {
            "P": 1,
            "E2:L": 2
          },
          "incoming": {}
        },
        "recovery": null,
        "expired": false,
        "historicalOffmapPersonnelLQ": {
          "used": 4,
          "remaining": 0,
          "reusable": false
        },
        "blockers": [
          "AWAIT_E8_SHIPMENT"
        ],
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0,
        "sourceGapSP": {
          "G": 9,
          "S": 14
        },
        "runtimeDefaultEnabled": false
      },
      "ledger": null,
      "requestError": {
        "ok": false,
        "error": "REJECTED_UNCHANGED",
        "detail": "SYNTHETIC_PRECOMMIT:before_commit"
      }
    },
    {
      "id": "recoveryFailed",
      "title": "recoveryFailed",
      "branch": "synthetic",
      "origin": "SYNTHETIC",
      "sourceOrigin": "SYNTHETIC_FAULT_ON_REAL_CHECKPOINT",
      "sourceLabel": "recoveryFailed",
      "tracePath": null,
      "rootHash": null,
      "view": {
        "schema": "industry-016-view.v1",
        "readOnly": true,
        "rootRevision": 48,
        "gameRevision": 152,
        "turn": 9,
        "phase": "GERMAN_RECOVERY",
        "materialRevision": 1,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 4,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0,
          "careTransferOutI": 1
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "accountId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/CARE-I",
          "transferId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/budget-transfer-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "receivedI": 1,
          "spentI": 1,
          "availableI": 0,
          "oldEndEpoch": 8,
          "endEpoch": 9,
          "nonrefundable": true,
          "status": "PAID_ACTIVE"
        },
        "transport": [
          {
            "id": "rail:A10~B10",
            "originalCap": 40,
            "spUsed": 32,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          },
          {
            "id": "rail:B10~C10",
            "originalCap": 40,
            "spUsed": 32,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          },
          {
            "id": "T",
            "originalCap": 2200,
            "spUsed": 108,
            "cargo": 16,
            "remaining": 2076,
            "reservation": 0,
            "freight": 16
          },
          {
            "id": "W:GH2",
            "originalCap": 96,
            "spUsed": 88,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          }
        ],
        "shipment": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "dispatchEpoch": 8,
          "arrivalEpoch": 8,
          "availableFromTurn": 9,
          "inputHash": "c4e6c61b65d1f5254d35d153e65e1c3a51f95ae6f0f44c618f812006bedf6297",
          "candidateHash": "50c31db0bb29330b4a581e5c3bdec26190f6fd0d9d25f2918f9342ef58c5ac25",
          "capacityWitnessHash": "c1bc5365e6471501d988e942d0c796c757e6a18933751514a2da0d97da75339f",
          "careExtensionId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "status": "RECEIVED",
          "inputRootHash": "9af98995240bf54466fd421e92b21a258c47490b3ab08bbb03453d5669f3e587",
          "requestId": "016-phase-148",
          "requestFingerprint": "a6be2b72e7a15c34aa336acd05525b39802dd8c1a1ae7f3b45d2c8a3575badf6",
          "inputMaterialRevision": 0,
          "receiptId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/receipt-0001"
        },
        "terminal": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/terminal-GI01-0001",
          "status": "PAID",
          "unitId": "G-I-01",
          "controllerId": "G-HUMAN-1",
          "side": "G",
          "node": "C10",
          "key": "2,8",
          "paidW": 8,
          "extraRecoveryW": 0,
          "shipmentId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "arrivalEpoch": 8,
          "availableFromTurn": 9,
          "approvalHash": "239a479dcfba305b89eeacbc12ec6acfeea3610fa3c7e80be1ce91a76cfacd27",
          "candidateHash": "8f433f64818bd2b294b9a9626b6c9969cc6cd821e643405cc33f7e38058255ab",
          "fixedCandidateHash": "50c31db0bb29330b4a581e5c3bdec26190f6fd0d9d25f2918f9342ef58c5ac25",
          "inputHash": "c4e6c61b65d1f5254d35d153e65e1c3a51f95ae6f0f44c618f812006bedf6297",
          "capacityWitnessHash": "c1bc5365e6471501d988e942d0c796c757e6a18933751514a2da0d97da75339f",
          "careExtensionId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "expiresAfterEpoch": 9,
          "inputRootHash": "9af98995240bf54466fd421e92b21a258c47490b3ab08bbb03453d5669f3e587",
          "requestFingerprint": "a6be2b72e7a15c34aa336acd05525b39802dd8c1a1ae7f3b45d2c8a3575badf6",
          "materialRevision": 1
        },
        "materials": {
          "P": {
            "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
            "quantityP": 1,
            "owner": "RC009-G-C10-GI01",
            "custody": "FRONT_AVAILABLE",
            "receivedEpoch": 7,
            "availableFromTurn": 8,
            "dispatchEpoch": 7,
            "dueEpoch": 7
          },
          "E2:L": {
            "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
            "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
            "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
            "quantityE2": 2,
            "materialType": "E2:L",
            "custody": "FRONT_AVAILABLE",
            "owner": "RC009-G-C10-GI01",
            "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
            "receivedEpoch": 6,
            "availableFromTurn": 7,
            "dispatchEpoch": 6,
            "dueEpoch": 6
          }
        },
        "frontInventory": {
          "P": 1,
          "E2:L": 2
        },
        "availableFrontInventory": {
          "P": 1,
          "E2:L": 2
        },
        "rearInventory": {
          "P": 0,
          "E2:L": 0
        },
        "receiver": {
          "id": "RC009-G-C10-GI01",
          "capacity": {
            "P": 1,
            "E2:L": 2
          },
          "incoming": {}
        },
        "recovery": null,
        "expired": false,
        "historicalOffmapPersonnelLQ": {
          "used": 4,
          "remaining": 0,
          "reusable": false
        },
        "blockers": [
          "AWAIT_T9_CORE_QUALIFICATION"
        ],
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0,
        "sourceGapSP": {
          "G": 9,
          "S": 14
        },
        "runtimeDefaultEnabled": false
      },
      "ledger": null,
      "requestError": {
        "ok": false,
        "error": "REJECTED_UNCHANGED",
        "detail": "SYNTHETIC_PRECOMMIT:before_commit"
      }
    },
    {
      "id": "held",
      "title": "held",
      "branch": "synthetic",
      "origin": "SYNTHETIC",
      "sourceOrigin": "SYNTHETIC_RECEIVER_REFUSAL_ON_REAL_BOUNDARY",
      "sourceLabel": "held",
      "tracePath": null,
      "rootHash": null,
      "view": {
        "schema": "industry-016-view.v1",
        "readOnly": true,
        "rootRevision": 45,
        "gameRevision": 149,
        "turn": 9,
        "phase": "GERMAN_SUPPLY_RAIL",
        "materialRevision": 1,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 4,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0,
          "careTransferOutI": 1
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "accountId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/CARE-I",
          "transferId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/budget-transfer-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "receivedI": 1,
          "spentI": 1,
          "availableI": 0,
          "oldEndEpoch": 8,
          "endEpoch": 9,
          "nonrefundable": true,
          "status": "PAID_ACTIVE"
        },
        "transport": [
          {
            "id": "rail:A10~B10",
            "originalCap": 40,
            "spUsed": 32,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          },
          {
            "id": "rail:B10~C10",
            "originalCap": 40,
            "spUsed": 32,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          },
          {
            "id": "T",
            "originalCap": 2200,
            "spUsed": 108,
            "cargo": 16,
            "remaining": 2076,
            "reservation": 0,
            "freight": 16
          },
          {
            "id": "W:GH2",
            "originalCap": 96,
            "spUsed": 88,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          }
        ],
        "shipment": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "dispatchEpoch": 8,
          "arrivalEpoch": null,
          "availableFromTurn": 9,
          "inputHash": "c4e6c61b65d1f5254d35d153e65e1c3a51f95ae6f0f44c618f812006bedf6297",
          "candidateHash": "50c31db0bb29330b4a581e5c3bdec26190f6fd0d9d25f2918f9342ef58c5ac25",
          "capacityWitnessHash": "c1bc5365e6471501d988e942d0c796c757e6a18933751514a2da0d97da75339f",
          "careExtensionId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "status": "HELD",
          "inputRootHash": "9af98995240bf54466fd421e92b21a258c47490b3ab08bbb03453d5669f3e587",
          "requestId": "refusal",
          "requestFingerprint": "497fa521ea7895d0fee67ef8fbf5f947a70e5c8bc676528f0d3a8df04f947970",
          "inputMaterialRevision": 0,
          "refusal": "SYNTHETIC_RECEIVER_REFUSAL"
        },
        "terminal": null,
        "materials": {
          "P": {
            "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
            "quantityP": 1,
            "owner": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
            "custody": "HELD",
            "receivedEpoch": 7,
            "availableFromTurn": 8,
            "dispatchEpoch": 7,
            "dueEpoch": 7
          },
          "E2:L": {
            "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
            "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
            "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
            "quantityE2": 2,
            "materialType": "E2:L",
            "custody": "HELD",
            "owner": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
            "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
            "receivedEpoch": 6,
            "availableFromTurn": 7,
            "dispatchEpoch": 6,
            "dueEpoch": 6
          }
        },
        "frontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "availableFrontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "rearInventory": {
          "P": 0,
          "E2:L": 0
        },
        "receiver": {
          "id": "RC009-G-C10-GI01",
          "capacity": {
            "P": 1,
            "E2:L": 2
          },
          "incoming": {
            "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001": {
              "P": 1,
              "E2:L": 2
            }
          }
        },
        "recovery": null,
        "expired": false,
        "historicalOffmapPersonnelLQ": {
          "used": 4,
          "remaining": 0,
          "reusable": false
        },
        "blockers": [
          "MATERIAL_HELD"
        ],
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0,
        "sourceGapSP": {
          "G": 9,
          "S": 14
        },
        "runtimeDefaultEnabled": false
      },
      "ledger": null,
      "requestError": null
    },
    {
      "id": "heldExpired",
      "title": "heldExpired",
      "branch": "synthetic",
      "origin": "SYNTHETIC",
      "sourceOrigin": "SYNTHETIC_REFUSAL_FOLLOWED_BY_LEGAL_E9_CONTINUATION",
      "sourceLabel": "heldExpired",
      "tracePath": null,
      "rootHash": null,
      "view": {
        "schema": "industry-016-view.v1",
        "readOnly": true,
        "rootRevision": 55,
        "gameRevision": 159,
        "turn": 10,
        "phase": "GERMAN_SUPPLY_RAIL",
        "materialRevision": 2,
        "equipmentBudget": {
          "granted": 10,
          "freeI": 4,
          "productionSpent": 3,
          "handoffSpent": 2,
          "escrow": 0,
          "careTransferOutI": 1
        },
        "personnelBudget": {
          "id": "RC008-G-PERSONNEL-SERVICE-I",
          "grantedI": 2,
          "availableI": 0,
          "acceptanceCareSpentI": 1,
          "escrowI": 0,
          "carriageSpentI": 1
        },
        "care": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "accountId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/CARE-I",
          "transferId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/budget-transfer-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "receivedI": 1,
          "spentI": 1,
          "availableI": 0,
          "oldEndEpoch": 8,
          "endEpoch": 9,
          "nonrefundable": true,
          "status": "EXPIRED_PAID_NO_REFUND"
        },
        "transport": [
          {
            "id": "rail:A10~B10",
            "originalCap": 40,
            "spUsed": 32,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          },
          {
            "id": "rail:B10~C10",
            "originalCap": 40,
            "spUsed": 32,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          },
          {
            "id": "T",
            "originalCap": 2200,
            "spUsed": 108,
            "cargo": 16,
            "remaining": 2076,
            "reservation": 0,
            "freight": 16
          },
          {
            "id": "W:GH2",
            "originalCap": 96,
            "spUsed": 88,
            "cargo": 8,
            "remaining": 0,
            "reservation": 0,
            "freight": 8
          }
        ],
        "shipment": {
          "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
          "packageId": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "dispatchEpoch": 8,
          "arrivalEpoch": null,
          "availableFromTurn": 9,
          "inputHash": "c4e6c61b65d1f5254d35d153e65e1c3a51f95ae6f0f44c618f812006bedf6297",
          "candidateHash": "50c31db0bb29330b4a581e5c3bdec26190f6fd0d9d25f2918f9342ef58c5ac25",
          "capacityWitnessHash": "c1bc5365e6471501d988e942d0c796c757e6a18933751514a2da0d97da75339f",
          "careExtensionId": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/care-extension-0001",
          "status": "HELD",
          "inputRootHash": "9af98995240bf54466fd421e92b21a258c47490b3ab08bbb03453d5669f3e587",
          "requestId": "refusal",
          "requestFingerprint": "497fa521ea7895d0fee67ef8fbf5f947a70e5c8bc676528f0d3a8df04f947970",
          "inputMaterialRevision": 0,
          "refusal": "SYNTHETIC_RECEIVER_REFUSAL"
        },
        "terminal": null,
        "materials": {
          "P": {
            "id": "LEADER-INDUSTRY-INTEGRATE-013-20261003/EASTFRONT-012-ISOLATED/G/personnel/source-0001/P-0001",
            "quantityP": 1,
            "owner": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
            "custody": "TRANSIT_QUARANTINED",
            "receivedEpoch": 7,
            "availableFromTurn": 8,
            "dispatchEpoch": 7,
            "dueEpoch": 7
          },
          "E2:L": {
            "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
            "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
            "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received",
            "quantityE2": 2,
            "materialType": "E2:L",
            "custody": "TRANSIT_QUARANTINED",
            "owner": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/shipment-0001",
            "productionReceiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/batch/E12_INDUSTRIAL_OUTPUT/6",
            "receivedEpoch": 6,
            "availableFromTurn": 7,
            "dispatchEpoch": 6,
            "dueEpoch": 6
          }
        },
        "frontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "availableFrontInventory": {
          "P": 0,
          "E2:L": 0
        },
        "rearInventory": {
          "P": 0,
          "E2:L": 0
        },
        "receiver": {
          "id": "RC009-G-C10-GI01",
          "capacity": {
            "P": 1,
            "E2:L": 2
          },
          "incoming": {}
        },
        "recovery": null,
        "expired": true,
        "historicalOffmapPersonnelLQ": {
          "used": 4,
          "remaining": 0,
          "reusable": false
        },
        "blockers": [
          "SCOPE_EXPIRED"
        ],
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0,
        "sourceGapSP": {
          "G": 9,
          "S": 14
        },
        "runtimeDefaultEnabled": false
      },
      "ledger": null,
      "requestError": null
    }
  ],
  "e8Impact": {
    "source": "LEDGER.unitComparison; actual E8 vs fixed 015 reference",
    "epoch": 8,
    "units": [
      {
        "id": "G-I-01",
        "side": "G",
        "reference": {
          "id": "G-I-01",
          "before": 8,
          "received": 4,
          "due": 4,
          "maintenance": 4,
          "net": 0,
          "after": 8,
          "debt": "0",
          "loss": 0,
          "attrition": "0",
          "strength": 2
        },
        "alternative": {
          "id": "G-I-01",
          "before": 8,
          "received": 8,
          "due": 4,
          "maintenance": 4,
          "net": 0,
          "after": 12,
          "debt": "0",
          "loss": 0,
          "attrition": "0",
          "strength": 2
        },
        "deliveryDeltaQ": 4,
        "maintenanceDeltaQ": 0,
        "reductionQ": 0,
        "reductionSP": "0",
        "stockDeltaQ": 4,
        "openingDebt": "0",
        "additionalStepLoss": 0,
        "crossedThresholds": [],
        "newlyWorsenedThresholds": [],
        "openingCoreSupplyEffects": {
          "factor": 1,
          "cap": null,
          "exhausted": false
        },
        "referenceCoreSupplyEffects": {
          "factor": 1,
          "cap": null,
          "exhausted": false
        },
        "alternativeCoreSupplyEffects": {
          "factor": 1,
          "cap": null,
          "exhausted": false
        },
        "actualCore": {
          "alive": true,
          "step": 1,
          "supplyState": "SUPPLIED",
          "expSupply": {
            "attackFactor": 1,
            "movementCap": null
          }
        }
      },
      {
        "id": "G-PZ-01",
        "side": "G",
        "reference": {
          "id": "G-PZ-01",
          "before": 24,
          "received": 8,
          "due": 8,
          "maintenance": 8,
          "net": 0,
          "after": 24,
          "debt": "0",
          "loss": 0,
          "attrition": "0",
          "strength": 3
        },
        "alternative": {
          "id": "G-PZ-01",
          "before": 24,
          "received": 6,
          "due": 8,
          "maintenance": 8,
          "net": 0,
          "after": 22,
          "debt": "0",
          "loss": 0,
          "attrition": "0",
          "strength": 3
        },
        "deliveryDeltaQ": -2,
        "maintenanceDeltaQ": 0,
        "reductionQ": 0,
        "reductionSP": "0",
        "stockDeltaQ": -2,
        "openingDebt": "0",
        "additionalStepLoss": 0,
        "crossedThresholds": [],
        "newlyWorsenedThresholds": [],
        "openingCoreSupplyEffects": {
          "factor": 1,
          "cap": null,
          "exhausted": false
        },
        "referenceCoreSupplyEffects": {
          "factor": 1,
          "cap": null,
          "exhausted": false
        },
        "alternativeCoreSupplyEffects": {
          "factor": 1,
          "cap": null,
          "exhausted": false
        },
        "actualCore": {
          "alive": true,
          "step": 0,
          "supplyState": "SUPPLIED",
          "expSupply": {
            "attackFactor": 1,
            "movementCap": null
          }
        }
      },
      {
        "id": "G-REC-02",
        "side": "G",
        "reference": {
          "id": "G-REC-02",
          "before": 0,
          "received": 2,
          "due": 4,
          "maintenance": 2,
          "net": 2,
          "after": 0,
          "debt": "2",
          "loss": 0,
          "attrition": "0",
          "strength": 3
        },
        "alternative": {
          "id": "G-REC-02",
          "before": 0,
          "received": 0,
          "due": 4,
          "maintenance": 0,
          "net": 0,
          "after": 0,
          "debt": "5/2",
          "loss": 0,
          "attrition": "0",
          "strength": 3
        },
        "deliveryDeltaQ": -2,
        "maintenanceDeltaQ": -2,
        "reductionQ": 2,
        "reductionSP": "1/2",
        "stockDeltaQ": 0,
        "openingDebt": "3/2",
        "additionalStepLoss": 0,
        "crossedThresholds": [
          2
        ],
        "newlyWorsenedThresholds": [],
        "openingCoreSupplyEffects": {
          "factor": 0.75,
          "cap": null,
          "exhausted": false
        },
        "referenceCoreSupplyEffects": {
          "factor": 0.5,
          "cap": 1,
          "exhausted": true
        },
        "alternativeCoreSupplyEffects": {
          "factor": 0.5,
          "cap": 1,
          "exhausted": true
        },
        "actualCore": {
          "alive": true,
          "step": 0,
          "supplyState": "OUT_OF_SUPPLY",
          "expSupply": {
            "attackFactor": 0.5,
            "movementCap": 1
          }
        }
      }
    ],
    "conservation": {
      "G": {
        "reference": {
          "openingQ": 84,
          "sourceQ": 76,
          "maintenanceQ": 68,
          "closingQ": 92,
          "balanced": true
        },
        "alternative": {
          "openingQ": 84,
          "sourceQ": 76,
          "maintenanceQ": 66,
          "closingQ": 94,
          "balanced": true
        }
      },
      "S": {
        "reference": {
          "openingQ": 72,
          "sourceQ": 96,
          "maintenanceQ": 136,
          "closingQ": 32,
          "balanced": true
        },
        "alternative": {
          "openingQ": 72,
          "sourceQ": 96,
          "maintenanceQ": 136,
          "closingQ": 32,
          "balanced": true
        }
      }
    }
  },
  "e9Unused": {
    "source": "LEDGER.actualE9UnusedMaintenance",
    "epoch": 9,
    "interpretation": "Actual normal E9 attrition in the unused branch. No matched E9 no-freight counterfactual; not an attribution of all losses to the material shipment.",
    "sides": [
      {
        "side": "G",
        "units": [
          {
            "id": "G-ART-01",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "9/4",
            "loss": 0
          },
          {
            "id": "G-ART-02",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "2",
            "loss": 0
          },
          {
            "id": "G-ENG-01",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "3/2",
            "loss": 0
          },
          {
            "id": "G-ENG-02",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "3/2",
            "loss": 0
          },
          {
            "id": "G-I-01",
            "before": 12,
            "received": 2,
            "maintenance": 4,
            "due": 4,
            "after": 10,
            "debt": "0",
            "loss": 0
          },
          {
            "id": "G-I-02",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "3/2",
            "loss": 0
          },
          {
            "id": "G-I-03",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "3/2",
            "loss": 0
          },
          {
            "id": "G-I-04",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "3/2",
            "loss": 0
          },
          {
            "id": "G-I-05",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "3/2",
            "loss": 0
          },
          {
            "id": "G-I-06",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "3/2",
            "loss": 0
          },
          {
            "id": "G-I-07",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "7/4",
            "loss": 0
          },
          {
            "id": "G-I-08",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "2",
            "loss": 0
          },
          {
            "id": "G-I-09",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "2",
            "loss": 0
          },
          {
            "id": "G-I-10",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "5/2",
            "loss": 0
          },
          {
            "id": "G-I-11",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "5/2",
            "loss": 0
          },
          {
            "id": "G-J-01",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "5/2",
            "loss": 0
          },
          {
            "id": "G-J-02",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "5/2",
            "loss": 0
          },
          {
            "id": "G-MOT-01",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 8,
            "after": 0,
            "debt": "3",
            "loss": 1
          },
          {
            "id": "G-MOT-02",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 8,
            "after": 0,
            "debt": "3",
            "loss": 1
          },
          {
            "id": "G-MOT-03",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 8,
            "after": 0,
            "debt": "3",
            "loss": 1
          },
          {
            "id": "G-PZ-01",
            "before": 22,
            "received": 10,
            "maintenance": 8,
            "due": 8,
            "after": 24,
            "debt": "0",
            "loss": 0
          },
          {
            "id": "G-PZ-02",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 8,
            "after": 0,
            "debt": "3",
            "loss": 1
          },
          {
            "id": "G-PZ-03",
            "before": 0,
            "received": 4,
            "maintenance": 4,
            "due": 8,
            "after": 0,
            "debt": "21/8",
            "loss": 0
          },
          {
            "id": "G-PZ-04",
            "before": 0,
            "received": 4,
            "maintenance": 4,
            "due": 8,
            "after": 0,
            "debt": "23/8",
            "loss": 0
          },
          {
            "id": "G-REC-01",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "5/2",
            "loss": 0
          },
          {
            "id": "G-REC-02",
            "before": 0,
            "received": 2,
            "maintenance": 2,
            "due": 4,
            "after": 0,
            "debt": "3",
            "loss": 1
          }
        ]
      },
      {
        "side": "S",
        "units": [
          {
            "id": "S-ART-01",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-ART-02",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "3/4",
            "loss": 0
          },
          {
            "id": "S-ART-03",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "3/4",
            "loss": 0
          },
          {
            "id": "S-AT-01",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-AT-02",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/4",
            "loss": 0
          },
          {
            "id": "S-AT-03",
            "before": 4,
            "received": 0,
            "maintenance": 4,
            "due": 4,
            "after": 0,
            "debt": "0",
            "loss": 0
          },
          {
            "id": "S-EL-01",
            "before": 4,
            "received": 0,
            "maintenance": 4,
            "due": 4,
            "after": 0,
            "debt": "0",
            "loss": 0
          },
          {
            "id": "S-EL-02",
            "before": 4,
            "received": 0,
            "maintenance": 4,
            "due": 4,
            "after": 0,
            "debt": "0",
            "loss": 0
          },
          {
            "id": "S-ENG-01",
            "before": 4,
            "received": 0,
            "maintenance": 4,
            "due": 4,
            "after": 0,
            "debt": "0",
            "loss": 0
          },
          {
            "id": "S-ENG-02",
            "before": 4,
            "received": 0,
            "maintenance": 4,
            "due": 4,
            "after": 0,
            "debt": "0",
            "loss": 0
          },
          {
            "id": "S-HV-01",
            "before": 8,
            "received": 0,
            "maintenance": 8,
            "due": 8,
            "after": 0,
            "debt": "0",
            "loss": 0
          },
          {
            "id": "S-I-02",
            "before": 4,
            "received": 0,
            "maintenance": 4,
            "due": 4,
            "after": 0,
            "debt": "0",
            "loss": 0
          },
          {
            "id": "S-I-03",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/4",
            "loss": 0
          },
          {
            "id": "S-I-04",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-I-05",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-I-06",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-I-07",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-I-08",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-I-09",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-I-10",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-I-11",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-I-12",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-I-13",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-I-14",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-I-15",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-I-16",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-MOT-01",
            "before": 0,
            "received": 5,
            "maintenance": 5,
            "due": 8,
            "after": 0,
            "debt": "7/8",
            "loss": 0
          },
          {
            "id": "S-MOT-02",
            "before": 0,
            "received": 5,
            "maintenance": 5,
            "due": 8,
            "after": 0,
            "debt": "7/8",
            "loss": 0
          },
          {
            "id": "S-TK-01",
            "before": 0,
            "received": 5,
            "maintenance": 5,
            "due": 8,
            "after": 0,
            "debt": "7/8",
            "loss": 0
          },
          {
            "id": "S-TK-02",
            "before": 0,
            "received": 5,
            "maintenance": 5,
            "due": 8,
            "after": 0,
            "debt": "7/8",
            "loss": 0
          },
          {
            "id": "S-TK-03",
            "before": 0,
            "received": 4,
            "maintenance": 4,
            "due": 8,
            "after": 0,
            "debt": "1",
            "loss": 0
          },
          {
            "id": "S-R-T04-G01-U01",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-R-T04-G01-U02",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-R-T07-G02-U01",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-R-T07-G02-U02",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          },
          {
            "id": "S-R-T07-G02-U03",
            "before": 0,
            "received": 3,
            "maintenance": 3,
            "due": 4,
            "after": 0,
            "debt": "1/2",
            "loss": 0
          }
        ]
      }
    ]
  },
  "recoveryComparison": {
    "before": 1,
    "after": 2,
    "result": {
      "id": "EASTFRONT-012-ISOLATED/RC009/E8-G-I-01/recovery-0001",
      "requestId": "016-repair",
      "unitId": "G-I-01",
      "payment": {
        "P": 1,
        "E2:L": 2,
        "RP": 0,
        "extraW": 0
      },
      "beforeStep": 1,
      "afterStep": 0,
      "beforeGameRevision": 152,
      "afterGameRevision": 153,
      "commonBefore": {
        "commonEligible": true,
        "commonIssues": [],
        "requestIssues": [],
        "envelopeIssues": [],
        "enginePreconditions": {
          "passed": true,
          "issues": []
        },
        "integrityIssues": [],
        "recoveryIssues": [],
        "rpIssues": [],
        "target": {
          "id": "G-I-01",
          "side": "GERMAN",
          "templateId": "G-INF",
          "step": 1,
          "nodeId": "C10",
          "supplyState": "SUPPLIED"
        },
        "context": {
          "revision": 152,
          "snapshotHash": "10d26609365cbd9e512a95f7c7ee6df358ea3dcebfddf6f653485c5cae7b2a13",
          "turn": 9,
          "phase": "GERMAN_RECOVERY",
          "recoveryCount": 0,
          "recoveryLimit": 1
        }
      }
    },
    "CoreBefore": {
      "commonEligible": true,
      "commonIssues": [],
      "requestIssues": [],
      "envelopeIssues": [],
      "enginePreconditions": {
        "passed": true,
        "issues": []
      },
      "integrityIssues": [],
      "recoveryIssues": [],
      "rpIssues": [],
      "target": {
        "id": "G-I-01",
        "side": "GERMAN",
        "templateId": "G-INF",
        "step": 1,
        "nodeId": "C10",
        "supplyState": "SUPPLIED"
      },
      "context": {
        "revision": 152,
        "snapshotHash": "10d26609365cbd9e512a95f7c7ee6df358ea3dcebfddf6f653485c5cae7b2a13",
        "turn": 9,
        "phase": "GERMAN_RECOVERY",
        "recoveryCount": 0,
        "recoveryLimit": 1
      }
    },
    "CoreAfter": {
      "commonEligible": false,
      "commonIssues": [
        {
          "code": "INVALID_SUPPORT",
          "message": "Full-strength units cannot recover.",
          "details": {
            "reason": "UNIT_NOT_DAMAGED",
            "unitId": "G-I-01"
          }
        },
        {
          "code": "INVALID_SUPPORT",
          "message": "A unit may recover only once in its Recovery phase.",
          "details": {
            "reason": "UNIT_ALREADY_RECOVERED_THIS_TURN",
            "unitId": "G-I-01"
          }
        },
        {
          "code": "INVALID_SUPPORT",
          "message": "Side-wide Recovery unit limit has been reached for this turn.",
          "details": {
            "reason": "RECOVERY_UNIT_LIMIT_REACHED",
            "side": "GERMAN",
            "turn": 9,
            "recoveredUnits": 1,
            "limit": 1
          }
        }
      ],
      "requestIssues": [],
      "envelopeIssues": [],
      "enginePreconditions": {
        "passed": true,
        "issues": []
      },
      "integrityIssues": [],
      "recoveryIssues": [
        {
          "code": "INVALID_SUPPORT",
          "message": "Full-strength units cannot recover.",
          "details": {
            "reason": "UNIT_NOT_DAMAGED",
            "unitId": "G-I-01"
          }
        },
        {
          "code": "INVALID_SUPPORT",
          "message": "A unit may recover only once in its Recovery phase.",
          "details": {
            "reason": "UNIT_ALREADY_RECOVERED_THIS_TURN",
            "unitId": "G-I-01"
          }
        },
        {
          "code": "INVALID_SUPPORT",
          "message": "Side-wide Recovery unit limit has been reached for this turn.",
          "details": {
            "reason": "RECOVERY_UNIT_LIMIT_REACHED",
            "side": "GERMAN",
            "turn": 9,
            "recoveredUnits": 1,
            "limit": 1
          }
        }
      ],
      "rpIssues": [],
      "target": {
        "id": "G-I-01",
        "side": "GERMAN",
        "templateId": "G-INF",
        "step": 0,
        "nodeId": "C10",
        "supplyState": "SUPPLIED"
      },
      "context": {
        "revision": 153,
        "snapshotHash": "74544152483c5d614449bbbefaf3160ca1938496a43d45325b12eb271e9682cb",
        "turn": 9,
        "phase": "GERMAN_RECOVERY",
        "recoveryCount": 1,
        "recoveryLimit": 1
      }
    }
  }
};
