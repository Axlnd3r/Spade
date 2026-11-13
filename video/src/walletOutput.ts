// Written by capture/wallet.mjs from the run that recorded public/wallet.mp4. Do not edit.
export const WALLET_RUN = {
  "account": "spade-demo.testnet",
  "caseLink": "OPEN CASE #6",
  "outcome": "HELD. Mr. X said 1500 again (close enough). Your 25 $TAKSIR stake was burned.",
  "appraisal": {
    "id": 6,
    "price": 2500
  },
  "challenge": {
    "price": 1500,
    "status": "Survived"
  },
  "list": [
    "Warung Bu Sri price list, 2026-11-13 06:05 UTC",
    "nasi goreng 25000",
    "mie ayam 18000",
    "es teh manis 5000",
    "sate ayam 10 tusuk 30000",
    "kerupuk 2000"
  ],
  "signed": [
    {
      "label": "appraise",
      "command": "near contract \\\n    call-function \\\n    as-transaction 'v2.spade-taksir.testnet' 'appraise' \\\n    json-args '{\"data\":\"Warung Bu Sri price list, 2026-11-13 06:05 UTC\\nnasi goreng 25000\\nmie ayam 18000\\nes teh manis 5000\\nsate ayam 10 tusuk 30000\\nkerupuk 2000\"}' \\\n    prepaid-gas '300 Tgas' \\\n    attached-deposit '0.0571 NEAR' \\\n    sign-as 'spade-demo.testnet' \\\n    network-config testnet \\\n    sign-with-keychain",
      "hash": "Cr6KzPFY9oJSarDe89jxe9SDTUyDfHAArDoB2o4WQCRm",
      "output": [
        "Gas burned: 0.316 Tgas",
        "Transaction fee: 0.0000315641210685 NEAR",
        "Transaction ID: Cr6KzPFY9oJSarDe89jxe9SDTUyDfHAArDoB2o4WQCRm",
        "The \"appraise\" call to <v2.spade-taksir.testnet> on behalf of <spade-demo.testnet> succeeded."
      ]
    },
    {
      "label": "sidak",
      "command": "near contract \\\n    call-function \\\n    as-transaction 'v2.spade-taksir.testnet' 'challenge' \\\n    json-args '{\"appraisal_id\":6,\"variant\":\"kerupuk 2000\\nsate ayam 10 tusuk 30000\\nes teh manis 5000\\nmie ayam 18000\\nnasi goreng 25000\\nWarung Bu Sri price list, 2026-11-13 06:05 UTC\"}' \\\n    prepaid-gas '300 Tgas' \\\n    attached-deposit '0.0571 NEAR' \\\n    sign-as 'spade-demo.testnet' \\\n    network-config testnet \\\n    sign-with-keychain",
      "hash": "51MfuLLPnUCWa1H4Uanyp5Br25qxPfvHxi2DsVDG6itg",
      "output": [
        "Gas burned: 0.317 Tgas",
        "Transaction fee: 0.00003166425687 NEAR",
        "Transaction ID: 51MfuLLPnUCWa1H4Uanyp5Br25qxPfvHxi2DsVDG6itg",
        "The \"challenge\" call to <v2.spade-taksir.testnet> on behalf of <spade-demo.testnet> succeeded."
      ]
    }
  ],
  "events": {
    "start": -0.02,
    "appraise:click": 13.93,
    "appraise:prompt": 17.25,
    "appraise:run": 20.87,
    "appraise:signed": 130.67,
    "appraise:verify": 136.19,
    "appraise:result": 140.74,
    "case:open": 148.23,
    "sidak:reverse": 157.64,
    "sidak:click": 159.54,
    "sidak:prompt": 162.72,
    "sidak:run": 166.15,
    "sidak:signed": 255.43,
    "sidak:verify": 261.41,
    "sidak:verdict": 265.49,
    "end": 271.49
  }
} as const;
