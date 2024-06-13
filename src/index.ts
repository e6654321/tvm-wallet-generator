import { getHttpEndpoint } from "@orbs-network/ton-access";
import { Address, TonClient, WalletContractV4, internal, toNano } from '@ton/ton';
import { KeyPair, mnemonicNew, mnemonicToWalletKey } from 'ton-crypto';

const MNEMONIC = '';
const MAX_NUM_WALLETS = 1;
const TON_FWD = '0.02';
const TON_BACK = '0.01';

main();

async function main() {
  const key = await mnemonicToWalletKey(MNEMONIC.split(" "));
  const fundingWallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
  console.log('fundingWallet: ', fundingWallet.address);

  for(let i = 0; i < MAX_NUM_WALLETS; i++) {
      let m = await mnemonicNew(24);
      console.log(m);
      await initializeWallet(fundingWallet, m, key.secretKey);
  }
}

async function initializeWallet(fundingWallet: WalletContractV4, mnemonic: string[], secretKey: Buffer) {
  // initialize ton rpc client on testnet
  const endpoint = await getHttpEndpoint({ network: "testnet", accessVersion: 2, host: 'https://toncenter.com/api/v2/jsonRPC', protocol: 'json-rpc' });
  const client = new TonClient({ endpoint });
  const key = await mnemonicToWalletKey(mnemonic);
  const generatedWallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
  console.log('generatedWallet: ', generatedWallet.address);

  try {
    // send 0.1 TON from funding wallet to new wallet
    const walletContract = client.open(fundingWallet);
    const seqno = await walletContract.getSeqno();
    console.log('seqno ', seqno);
    await walletContract.sendTransfer({
      secretKey: secretKey,
      seqno: seqno,
      messages: [
        internal({
          to: generatedWallet.address, 
          value: toNano(TON_FWD),
          bounce: false,
        })
      ]
    });

    await waitForTransaction(seqno, walletContract);
  
    // send 0.9 back TON to funding wallet
    const walletContract2 = client.open(generatedWallet);
    const seqno2 = await walletContract2.getSeqno();
    const balance = await walletContract2.getBalance();
    console.log('seqno ', seqno2);
    
    await waitForBalance(balance, walletContract2);

    await walletContract.sendTransfer({
      secretKey: key.secretKey,
      seqno: seqno2,
      timeout: 5 * 60 * 1000,
      messages: [
        internal({
          to: fundingWallet.address, 
          value: toNano(TON_BACK),
          bounce: false,
          body: 'init',
        })
      ]
    });
    // const content = beginCell()
    //   .storeUint(7614653257073527469736132165096662684165476, 144);
    // const body = beginCell()
    //   .storeUint(0, 32)
    //   .storeBuilder(content)
    //   .endCell();
    // const msg = beginCell()
    //   .storeUint(0x18, 6)
    //   .storeAddress(fundingWallet.address)
    //   .storeCoins(toNano(TON_BACK))
    //   .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
    //   .storeUint(0, 32)
    //   .storeUint(0, 64)
    //   .endCell();
    // await walletContract.send(msg);
  
    await waitForTransaction(seqno2, walletContract2);
  } catch (err) {
    console.log(err);
  }
}

async function waitForBalance(bal: bigint, walletContract: any) {
  // wait until confirmed
  let currentBal = bal;
  while (currentBal <= bal) {
    console.log("waiting for balance to update...");
    await sleep(1500);
    currentBal = await walletContract.getBalance();
  }
  console.log("balance updated!", currentBal);
}

async function waitForTransaction(seqno: number, walletContract: any) {
  // wait until confirmed
  let currentSeqno = seqno;
  while (currentSeqno == seqno) {
    console.log("waiting for transaction to confirm...");
    await sleep(1500);
    currentSeqno = await walletContract.getSeqno();
  }
  console.log("transaction confirmed!");
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

