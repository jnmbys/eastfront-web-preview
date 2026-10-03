// Generated offline by extract-012.py; unmodified v1 view values.
export const RECORDS_012 = {
  "sourceCommit": "e64c0e11fb16b05cfe725240193e8590b4eefd88",
  "uiBaseCommit": "00a97635d882509675fe4d5f6e789cdbc791fdc0",
  "schema": "industry-012-view.v1",
  "extraction": "Original export_view.py; six --checkpoint and ten --sample reads; no Core startup",
  "sources": {
    "VIEW-CONTRACT.md": {
      "gitBlob": "8176af7c9a62f8580f7aa4894fbd5b25cd4f9912",
      "sha256": "fa3601e4e54971739f32c3447409abc7c90c77be33e264c63e8226b6195a7bf4"
    },
    "export_view.py": {
      "gitBlob": "70a913f4dcc41148130c0b415ef7f31be6d02164",
      "sha256": "3a1d28e26e537dc0f18abfc51fac85b202890048c2a6c2d8dc1b538058b4beda"
    },
    "view.py": {
      "gitBlob": "f1655bac70df7c12b4d5faecf5586ea556ed3cf4",
      "sha256": "7c0a99ffebb4d09725d8e2e0520fbf17ad95204f3ed31873fadf02b7b83e13a8"
    },
    "config.py": {
      "gitBlob": "5ae5e31a5a2710aa477aa872b7c3cde12ebd6d33",
      "sha256": "dae117138ee138a9b29287d7c0fe05bf6b4269de7838f4bc20f3fb74e0c8c4f1"
    },
    "VIEWS.json": {
      "gitBlob": "e86d26133832659573dc0c1e2099225280abec4f",
      "sha256": "7fdb05cb67734ffb8ffb0f701a65568e8820df9a119d4beba48e79e3f4531334"
    },
    "EVIDENCE.json": {
      "gitBlob": "9d5b38b108abc96494e819d70ffe31e719662534",
      "sha256": "c78617ab51efd73e13fc59dd7ffac032886e8a81c68cd40a5aa24ce1e16e58f1"
    },
    "TRACE.json.gz": {
      "gitBlob": "8119699e2942b2ecbb9f4a6e89dd73ae61e1a3f6",
      "sha256": "c126db45c9ca40f49ecac7ee22bb3331343a911d2695db92a535650ecbb55679"
    },
    "README.md": {
      "gitBlob": "8cb25ade74f82a6d623d6cf011753ce3950a4750",
      "sha256": "4292f2bc192f29ecc4d3cf33c3964dde4f823f9873603fed2ec6ebfa656ea827"
    },
    "FINANCE-VERIFICATION.json": {
      "gitBlob": "82e96dc8885dc07a9d7c622d8bf69782bfbd9e52",
      "sha256": "88c8acc45d7d4c24853ce8ba5658c023bd25b2baf88ee83dd84140607fc8f912"
    }
  },
  "evidenceSummary": {
    "status": "PASS_REAL_PRODUCTION_TO_A10_T7_AVAILABLE",
    "traceSha256": "82b74d72717a15e477777900670e4d49a23526f1d653fe2d36b6ce8a34825acc",
    "viewsSha256": "37d924128978a70f07edd850d0769d8989b8cd55c602a65b2c962fb1d9b46434",
    "onlySingleProcessGuarantee": true,
    "cases": [
      {
        "name": "fixed_real_T5_grant_and_paid_order_no_game_change",
        "origin": "REAL_T5_T7",
        "passed": true
      },
      {
        "name": "real_E5_one_work_no_output",
        "origin": "REAL_T5_T7",
        "passed": true
      },
      {
        "name": "real_E6_unique_output_external_handoff_and_receipt",
        "origin": "REAL_T5_T7",
        "passed": true
      },
      {
        "name": "all_commands_full_game_SP_RNG_equal_no_order_control",
        "origin": "REAL_T5_T7",
        "passed": true
      },
      {
        "name": "late_grant_order_retries_no_new_I_equipment_or_rollback",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "capacity_counts_used_capacity",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "capacity_counts_reserved_capacity",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "capacity_counts_both_capacity",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "incoming_warehouse_hold_counts_without_double_stock",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "blocked_dispatch_correct_owner_escrow_capacity",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "blocked_receipt_correct_owner_escrow_capacity",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "Core_receiver_enemy_control_rejected",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "Core_receiver_enemy_occupation_rejected",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "Core_receiver_enemy_zoc_rejected",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "Core_receiver_unknown_control_rejected",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "E6_all_root_rollback_after_output",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "E6_all_root_rollback_after_dispatch",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "E6_all_root_rollback_after_receipt",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "E6_all_root_rollback_before_commit",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "same_version_order_competition_and_single_order_limit",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "same_version_E6_competition_one_output_receipt",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "lost_E6_ack_late_retry_no_restock_or_rollback",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "no_approval_startup_reject",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "parameter_tamper_startup_reject",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      },
      {
        "name": "candidate_tamper_startup_reject",
        "origin": "SYNTHETIC_TEST",
        "passed": true
      }
    ]
  },
  "records": [
    {
      "label": "initial",
      "sourceLabel": null,
      "checkpoint": "initial",
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "REAL",
        "readOnly": true,
        "rootRevision": 0,
        "gameRevision": 109,
        "industryRevision": 0,
        "turn": 5,
        "phase": "GERMAN_RECOVERY",
        "budget": {
          "availableI": 0,
          "escrowI": 0,
          "productionPaidI": 0,
          "handoffPaidI": 0,
          "grantedI": 0
        },
        "order": null,
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 0,
          "productionStoreE2": 0,
          "inTransitOrHeldE2": 0,
          "rearE2": 0,
          "availableRearE2": 0,
          "P": 0,
          "productionReservedE2": 0,
          "incomingReservedE2": 0,
          "custody": "NOT_CREATED"
        },
        "arrival": null,
        "externalCapacity": [],
        "blockingReasons": [],
        "lastRequestError": null,
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "funded",
      "sourceLabel": null,
      "checkpoint": "funded",
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "REAL",
        "readOnly": true,
        "rootRevision": 1,
        "gameRevision": 109,
        "industryRevision": 1,
        "turn": 5,
        "phase": "GERMAN_RECOVERY",
        "budget": {
          "availableI": 10,
          "escrowI": 0,
          "productionPaidI": 0,
          "handoffPaidI": 0,
          "grantedI": 10
        },
        "order": null,
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 0,
          "productionStoreE2": 0,
          "inTransitOrHeldE2": 0,
          "rearE2": 0,
          "availableRearE2": 0,
          "P": 0,
          "productionReservedE2": 0,
          "incomingReservedE2": 0,
          "custody": "NOT_CREATED"
        },
        "arrival": null,
        "externalCapacity": [],
        "blockingReasons": [],
        "lastRequestError": null,
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "accepted",
      "sourceLabel": "accepted_waiting_E5",
      "checkpoint": "accepted",
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "REAL",
        "readOnly": true,
        "rootRevision": 2,
        "gameRevision": 109,
        "industryRevision": 2,
        "turn": 5,
        "phase": "GERMAN_RECOVERY",
        "budget": {
          "availableI": 5,
          "escrowI": 2,
          "productionPaidI": 3,
          "handoffPaidI": 0,
          "grantedI": 10
        },
        "order": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001",
          "status": "WORKING",
          "workCompleted": 0,
          "workRequired": 2,
          "workEpochs": [],
          "expectedCompletionEpoch": 6,
          "expectedCompletionIsConditional": true,
          "completedEpoch": null
        },
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 0,
          "productionStoreE2": 0,
          "inTransitOrHeldE2": 0,
          "rearE2": 0,
          "availableRearE2": 0,
          "P": 0,
          "productionReservedE2": 2,
          "incomingReservedE2": 0,
          "custody": "NOT_CREATED"
        },
        "arrival": null,
        "externalCapacity": [],
        "blockingReasons": [],
        "lastRequestError": null,
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "E5",
      "sourceLabel": "E5_one_of_two_waiting",
      "checkpoint": "E5",
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "REAL",
        "readOnly": true,
        "rootRevision": 9,
        "gameRevision": 116,
        "industryRevision": 3,
        "turn": 6,
        "phase": "GERMAN_SUPPLY_RAIL",
        "budget": {
          "availableI": 5,
          "escrowI": 2,
          "productionPaidI": 3,
          "handoffPaidI": 0,
          "grantedI": 10
        },
        "order": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001",
          "status": "WORKING",
          "workCompleted": 1,
          "workRequired": 2,
          "workEpochs": [
            5
          ],
          "expectedCompletionEpoch": 6,
          "expectedCompletionIsConditional": true,
          "completedEpoch": null
        },
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 0,
          "productionStoreE2": 0,
          "inTransitOrHeldE2": 0,
          "rearE2": 0,
          "availableRearE2": 0,
          "P": 0,
          "productionReservedE2": 2,
          "incomingReservedE2": 0,
          "custody": "NOT_CREATED"
        },
        "arrival": null,
        "externalCapacity": [
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 5,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          }
        ],
        "blockingReasons": [],
        "lastRequestError": null,
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "E6",
      "sourceLabel": "E6_received_T7_available",
      "checkpoint": "E6",
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "REAL",
        "readOnly": true,
        "rootRevision": 19,
        "gameRevision": 126,
        "industryRevision": 4,
        "turn": 7,
        "phase": "GERMAN_SUPPLY_RAIL",
        "budget": {
          "availableI": 5,
          "escrowI": 0,
          "productionPaidI": 3,
          "handoffPaidI": 2,
          "grantedI": 10
        },
        "order": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001",
          "status": "AVAILABLE",
          "workCompleted": 2,
          "workRequired": 2,
          "workEpochs": [
            5,
            6
          ],
          "expectedCompletionEpoch": 6,
          "expectedCompletionIsConditional": true,
          "completedEpoch": 6
        },
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 2,
          "productionStoreE2": 0,
          "inTransitOrHeldE2": 0,
          "rearE2": 2,
          "availableRearE2": 2,
          "P": 0,
          "productionReservedE2": 0,
          "incomingReservedE2": 0,
          "custody": "REAR_AVAILABLE"
        },
        "arrival": {
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receivedEpoch": 6,
          "availableFromTurn": 7,
          "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received"
        },
        "externalCapacity": [
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 5,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          },
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 6,
            "cap": 4,
            "usedByAllCommittedTraffic": 4,
            "reserved": 0,
            "remaining": 0,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          }
        ],
        "blockingReasons": [],
        "lastRequestError": null,
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "T7",
      "sourceLabel": "T7_German_recovery_success",
      "checkpoint": "T7",
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "REAL",
        "readOnly": true,
        "rootRevision": 22,
        "gameRevision": 129,
        "industryRevision": 4,
        "turn": 7,
        "phase": "GERMAN_RECOVERY",
        "budget": {
          "availableI": 5,
          "escrowI": 0,
          "productionPaidI": 3,
          "handoffPaidI": 2,
          "grantedI": 10
        },
        "order": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001",
          "status": "AVAILABLE",
          "workCompleted": 2,
          "workRequired": 2,
          "workEpochs": [
            5,
            6
          ],
          "expectedCompletionEpoch": 6,
          "expectedCompletionIsConditional": true,
          "completedEpoch": 6
        },
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 2,
          "productionStoreE2": 0,
          "inTransitOrHeldE2": 0,
          "rearE2": 2,
          "availableRearE2": 2,
          "P": 0,
          "productionReservedE2": 0,
          "incomingReservedE2": 0,
          "custody": "REAR_AVAILABLE"
        },
        "arrival": {
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receivedEpoch": 6,
          "availableFromTurn": 7,
          "receiptId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001/received"
        },
        "externalCapacity": [
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 5,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          },
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 6,
            "cap": 4,
            "usedByAllCommittedTraffic": 4,
            "reserved": 0,
            "remaining": 0,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          }
        ],
        "blockingReasons": [],
        "lastRequestError": null,
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "blocked_used_capacity",
      "sourceLabel": "blocked_used_capacity",
      "checkpoint": null,
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "SYNTHETIC_FIXTURE",
        "readOnly": true,
        "rootRevision": 18,
        "gameRevision": 126,
        "industryRevision": 4,
        "turn": 7,
        "phase": "GERMAN_SUPPLY_RAIL",
        "budget": {
          "availableI": 5,
          "escrowI": 2,
          "productionPaidI": 3,
          "handoffPaidI": 0,
          "grantedI": 10
        },
        "order": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001",
          "status": "WAITING_HANDOFF",
          "workCompleted": 2,
          "workRequired": 2,
          "workEpochs": [
            5,
            6
          ],
          "expectedCompletionEpoch": 6,
          "expectedCompletionIsConditional": true,
          "completedEpoch": 6
        },
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 2,
          "productionStoreE2": 2,
          "inTransitOrHeldE2": 0,
          "rearE2": 0,
          "availableRearE2": 0,
          "P": 0,
          "productionReservedE2": 0,
          "incomingReservedE2": 0,
          "custody": "PRODUCTION_STORE"
        },
        "arrival": {
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receivedEpoch": null,
          "availableFromTurn": null,
          "receiptId": null
        },
        "externalCapacity": [
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 5,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          },
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 6,
            "cap": 4,
            "usedByAllCommittedTraffic": 1,
            "reserved": 0,
            "remaining": 3,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          }
        ],
        "blockingReasons": [
          "EXTERNAL_CAPACITY_INSUFFICIENT",
          "SERVICE_WINDOW_EXPIRED_NO_AUTOMATIC_RETRY"
        ],
        "lastRequestError": null,
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "blocked_reserved_capacity",
      "sourceLabel": "blocked_reserved_capacity",
      "checkpoint": null,
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "SYNTHETIC_FIXTURE",
        "readOnly": true,
        "rootRevision": 18,
        "gameRevision": 126,
        "industryRevision": 4,
        "turn": 7,
        "phase": "GERMAN_SUPPLY_RAIL",
        "budget": {
          "availableI": 5,
          "escrowI": 2,
          "productionPaidI": 3,
          "handoffPaidI": 0,
          "grantedI": 10
        },
        "order": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001",
          "status": "WAITING_HANDOFF",
          "workCompleted": 2,
          "workRequired": 2,
          "workEpochs": [
            5,
            6
          ],
          "expectedCompletionEpoch": 6,
          "expectedCompletionIsConditional": true,
          "completedEpoch": 6
        },
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 2,
          "productionStoreE2": 2,
          "inTransitOrHeldE2": 0,
          "rearE2": 0,
          "availableRearE2": 0,
          "P": 0,
          "productionReservedE2": 0,
          "incomingReservedE2": 0,
          "custody": "PRODUCTION_STORE"
        },
        "arrival": {
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receivedEpoch": null,
          "availableFromTurn": null,
          "receiptId": null
        },
        "externalCapacity": [
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 5,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          },
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 6,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 1,
            "remaining": 3,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          }
        ],
        "blockingReasons": [
          "EXTERNAL_CAPACITY_INSUFFICIENT",
          "SERVICE_WINDOW_EXPIRED_NO_AUTOMATIC_RETRY"
        ],
        "lastRequestError": null,
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "blocked_both_capacity",
      "sourceLabel": "blocked_both_capacity",
      "checkpoint": null,
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "SYNTHETIC_FIXTURE",
        "readOnly": true,
        "rootRevision": 18,
        "gameRevision": 126,
        "industryRevision": 4,
        "turn": 7,
        "phase": "GERMAN_SUPPLY_RAIL",
        "budget": {
          "availableI": 5,
          "escrowI": 2,
          "productionPaidI": 3,
          "handoffPaidI": 0,
          "grantedI": 10
        },
        "order": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001",
          "status": "WAITING_HANDOFF",
          "workCompleted": 2,
          "workRequired": 2,
          "workEpochs": [
            5,
            6
          ],
          "expectedCompletionEpoch": 6,
          "expectedCompletionIsConditional": true,
          "completedEpoch": 6
        },
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 2,
          "productionStoreE2": 2,
          "inTransitOrHeldE2": 0,
          "rearE2": 0,
          "availableRearE2": 0,
          "P": 0,
          "productionReservedE2": 0,
          "incomingReservedE2": 0,
          "custody": "PRODUCTION_STORE"
        },
        "arrival": {
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receivedEpoch": null,
          "availableFromTurn": null,
          "receiptId": null
        },
        "externalCapacity": [
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 5,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          },
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 6,
            "cap": 4,
            "usedByAllCommittedTraffic": 1,
            "reserved": 1,
            "remaining": 2,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          }
        ],
        "blockingReasons": [
          "EXTERNAL_CAPACITY_INSUFFICIENT",
          "SERVICE_WINDOW_EXPIRED_NO_AUTOMATIC_RETRY"
        ],
        "lastRequestError": null,
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "blocked_warehouse_hold",
      "sourceLabel": "blocked_warehouse_hold",
      "checkpoint": null,
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "SYNTHETIC_FIXTURE",
        "readOnly": true,
        "rootRevision": 18,
        "gameRevision": 126,
        "industryRevision": 4,
        "turn": 7,
        "phase": "GERMAN_SUPPLY_RAIL",
        "budget": {
          "availableI": 5,
          "escrowI": 2,
          "productionPaidI": 3,
          "handoffPaidI": 0,
          "grantedI": 10
        },
        "order": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001",
          "status": "WAITING_HANDOFF",
          "workCompleted": 2,
          "workRequired": 2,
          "workEpochs": [
            5,
            6
          ],
          "expectedCompletionEpoch": 6,
          "expectedCompletionIsConditional": true,
          "completedEpoch": 6
        },
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 2,
          "productionStoreE2": 2,
          "inTransitOrHeldE2": 0,
          "rearE2": 0,
          "availableRearE2": 0,
          "P": 0,
          "productionReservedE2": 0,
          "incomingReservedE2": 1,
          "custody": "PRODUCTION_STORE"
        },
        "arrival": {
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receivedEpoch": null,
          "availableFromTurn": null,
          "receiptId": null
        },
        "externalCapacity": [
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 5,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          },
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 6,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          }
        ],
        "blockingReasons": [
          "WAREHOUSE_CAPACITY_INSUFFICIENT",
          "SERVICE_WINDOW_EXPIRED_NO_AUTOMATIC_RETRY"
        ],
        "lastRequestError": null,
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "blocked_dispatch",
      "sourceLabel": "blocked_dispatch",
      "checkpoint": null,
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "SYNTHETIC_FIXTURE",
        "readOnly": true,
        "rootRevision": 18,
        "gameRevision": 126,
        "industryRevision": 4,
        "turn": 7,
        "phase": "GERMAN_SUPPLY_RAIL",
        "budget": {
          "availableI": 5,
          "escrowI": 2,
          "productionPaidI": 3,
          "handoffPaidI": 0,
          "grantedI": 10
        },
        "order": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001",
          "status": "WAITING_HANDOFF",
          "workCompleted": 2,
          "workRequired": 2,
          "workEpochs": [
            5,
            6
          ],
          "expectedCompletionEpoch": 6,
          "expectedCompletionIsConditional": true,
          "completedEpoch": 6
        },
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 2,
          "productionStoreE2": 2,
          "inTransitOrHeldE2": 0,
          "rearE2": 0,
          "availableRearE2": 0,
          "P": 0,
          "productionReservedE2": 0,
          "incomingReservedE2": 0,
          "custody": "PRODUCTION_STORE"
        },
        "arrival": {
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receivedEpoch": null,
          "availableFromTurn": null,
          "receiptId": null
        },
        "externalCapacity": [
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 5,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          },
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 6,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          }
        ],
        "blockingReasons": [
          "SYNTHETIC_RECEIVER_BLOCK",
          "SERVICE_WINDOW_EXPIRED_NO_AUTOMATIC_RETRY"
        ],
        "lastRequestError": null,
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "blocked_receipt",
      "sourceLabel": "blocked_receipt",
      "checkpoint": null,
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "SYNTHETIC_FIXTURE",
        "readOnly": true,
        "rootRevision": 18,
        "gameRevision": 126,
        "industryRevision": 4,
        "turn": 7,
        "phase": "GERMAN_SUPPLY_RAIL",
        "budget": {
          "availableI": 5,
          "escrowI": 0,
          "productionPaidI": 3,
          "handoffPaidI": 2,
          "grantedI": 10
        },
        "order": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001",
          "status": "HELD",
          "workCompleted": 2,
          "workRequired": 2,
          "workEpochs": [
            5,
            6
          ],
          "expectedCompletionEpoch": 6,
          "expectedCompletionIsConditional": true,
          "completedEpoch": 6
        },
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 2,
          "productionStoreE2": 0,
          "inTransitOrHeldE2": 2,
          "rearE2": 0,
          "availableRearE2": 0,
          "P": 0,
          "productionReservedE2": 0,
          "incomingReservedE2": 2,
          "custody": "HELD"
        },
        "arrival": {
          "batchId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001",
          "shipmentId": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-main/G/production/0001/E2L/0001/to-A10/0001",
          "receivedEpoch": null,
          "availableFromTurn": null,
          "receiptId": null
        },
        "externalCapacity": [
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 5,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          },
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 6,
            "cap": 4,
            "usedByAllCommittedTraffic": 4,
            "reserved": 0,
            "remaining": 0,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          }
        ],
        "blockingReasons": [
          "SYNTHETIC_RECEIVER_BLOCK",
          "SERVICE_WINDOW_EXPIRED_NO_AUTOMATIC_RETRY"
        ],
        "lastRequestError": null,
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "failure_after_output",
      "sourceLabel": "failure_after_output",
      "checkpoint": null,
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "SYNTHETIC_FAULT_ON_REAL_REPLAY",
        "readOnly": true,
        "rootRevision": 18,
        "gameRevision": 125,
        "industryRevision": 3,
        "turn": 6,
        "phase": "SOVIET_ENTRENCHMENT",
        "budget": {
          "availableI": 5,
          "escrowI": 2,
          "productionPaidI": 3,
          "handoffPaidI": 0,
          "grantedI": 10
        },
        "order": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-test-3/G/production/0001",
          "status": "WORKING",
          "workCompleted": 1,
          "workRequired": 2,
          "workEpochs": [
            5
          ],
          "expectedCompletionEpoch": 6,
          "expectedCompletionIsConditional": true,
          "completedEpoch": null
        },
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 0,
          "productionStoreE2": 0,
          "inTransitOrHeldE2": 0,
          "rearE2": 0,
          "availableRearE2": 0,
          "P": 0,
          "productionReservedE2": 2,
          "incomingReservedE2": 0,
          "custody": "NOT_CREATED"
        },
        "arrival": null,
        "externalCapacity": [
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 5,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          }
        ],
        "blockingReasons": [],
        "lastRequestError": {
          "ok": false,
          "error": "REJECTED_NO_DOMAIN_COMMIT",
          "detail": "SYNTHETIC:after_output"
        },
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "failure_after_dispatch",
      "sourceLabel": "failure_after_dispatch",
      "checkpoint": null,
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "SYNTHETIC_FAULT_ON_REAL_REPLAY",
        "readOnly": true,
        "rootRevision": 18,
        "gameRevision": 125,
        "industryRevision": 3,
        "turn": 6,
        "phase": "SOVIET_ENTRENCHMENT",
        "budget": {
          "availableI": 5,
          "escrowI": 2,
          "productionPaidI": 3,
          "handoffPaidI": 0,
          "grantedI": 10
        },
        "order": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-test-4/G/production/0001",
          "status": "WORKING",
          "workCompleted": 1,
          "workRequired": 2,
          "workEpochs": [
            5
          ],
          "expectedCompletionEpoch": 6,
          "expectedCompletionIsConditional": true,
          "completedEpoch": null
        },
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 0,
          "productionStoreE2": 0,
          "inTransitOrHeldE2": 0,
          "rearE2": 0,
          "availableRearE2": 0,
          "P": 0,
          "productionReservedE2": 2,
          "incomingReservedE2": 0,
          "custody": "NOT_CREATED"
        },
        "arrival": null,
        "externalCapacity": [
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 5,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          }
        ],
        "blockingReasons": [],
        "lastRequestError": {
          "ok": false,
          "error": "REJECTED_NO_DOMAIN_COMMIT",
          "detail": "SYNTHETIC:after_dispatch"
        },
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "failure_after_receipt",
      "sourceLabel": "failure_after_receipt",
      "checkpoint": null,
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "SYNTHETIC_FAULT_ON_REAL_REPLAY",
        "readOnly": true,
        "rootRevision": 18,
        "gameRevision": 125,
        "industryRevision": 3,
        "turn": 6,
        "phase": "SOVIET_ENTRENCHMENT",
        "budget": {
          "availableI": 5,
          "escrowI": 2,
          "productionPaidI": 3,
          "handoffPaidI": 0,
          "grantedI": 10
        },
        "order": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-test-5/G/production/0001",
          "status": "WORKING",
          "workCompleted": 1,
          "workRequired": 2,
          "workEpochs": [
            5
          ],
          "expectedCompletionEpoch": 6,
          "expectedCompletionIsConditional": true,
          "completedEpoch": null
        },
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 0,
          "productionStoreE2": 0,
          "inTransitOrHeldE2": 0,
          "rearE2": 0,
          "availableRearE2": 0,
          "P": 0,
          "productionReservedE2": 2,
          "incomingReservedE2": 0,
          "custody": "NOT_CREATED"
        },
        "arrival": null,
        "externalCapacity": [
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 5,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          }
        ],
        "blockingReasons": [],
        "lastRequestError": {
          "ok": false,
          "error": "REJECTED_NO_DOMAIN_COMMIT",
          "detail": "SYNTHETIC:after_receipt"
        },
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    },
    {
      "label": "failure_before_commit",
      "sourceLabel": "failure_before_commit",
      "checkpoint": null,
      "view": {
        "schema": "industry-012-view.v1",
        "origin": "SYNTHETIC_FAULT_ON_REAL_REPLAY",
        "readOnly": true,
        "rootRevision": 18,
        "gameRevision": 125,
        "industryRevision": 3,
        "turn": 6,
        "phase": "SOVIET_ENTRENCHMENT",
        "budget": {
          "availableI": 5,
          "escrowI": 2,
          "productionPaidI": 3,
          "handoffPaidI": 0,
          "grantedI": 10
        },
        "order": {
          "id": "EASTFRONT-012-ISOLATED/5dbd9b473dc2480d227ec641a1381d4a382d498221f09795426b405d0b62cd65/012-test-6/G/production/0001",
          "status": "WORKING",
          "workCompleted": 1,
          "workRequired": 2,
          "workEpochs": [
            5
          ],
          "expectedCompletionEpoch": 6,
          "expectedCompletionIsConditional": true,
          "completedEpoch": null
        },
        "equipment": {
          "materialType": "E2:L",
          "producedE2": 0,
          "productionStoreE2": 0,
          "inTransitOrHeldE2": 0,
          "rearE2": 0,
          "availableRearE2": 0,
          "P": 0,
          "productionReservedE2": 2,
          "incomingReservedE2": 0,
          "custody": "NOT_CREATED"
        },
        "arrival": null,
        "externalCapacity": [
          {
            "resourceId": "EXTERNAL_G_A10",
            "epoch": 5,
            "cap": 4,
            "usedByAllCommittedTraffic": 0,
            "reserved": 0,
            "remaining": 4,
            "epochClosed": true,
            "carryForward": false,
            "independentOfSP": true
          }
        ],
        "blockingReasons": [],
        "lastRequestError": {
          "ok": false,
          "error": "REJECTED_NO_DOMAIN_COMMIT",
          "detail": "SYNTHETIC:before_commit"
        },
        "globalBlockersRetained": 35,
        "globalBlockersClosed": 0
      }
    }
  ]
};
