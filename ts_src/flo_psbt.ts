import * as bscript from './script';
import { Psbt as PsbtBase } from 'bip174';
import {
    Transaction as ITransaction,
  } from 'bip174/src/lib/interfaces';

import { Psbt } from './psbt'
import { flo as floNetwork, Network } from './networks';
import { PartialSig, PsbtInput } from 'bip174/src/lib/interfaces';
import { FLOTransaction } from './flo_transaction';
import { reverseBuffer } from './bufferutils';

interface FLOPsbtOptsOptional {
    network?: Network;
    maximumFeeRate?: number;
}
  
interface PsbtOpts {
    network: Network;
    maximumFeeRate: number;
}

interface FLOPsbtCache {
    __NON_WITNESS_UTXO_TX_CACHE: FLOTransaction[];
    __NON_WITNESS_UTXO_BUF_CACHE: Buffer[];
    __TX_IN_CACHE: { [index: string]: number };
    __TX: FLOTransaction;
    __FEE_RATE?: number;
    __FEE?: number;
    __EXTRACTED_TX?: FLOTransaction;
    __UNSAFE_SIGN_NONSEGWIT: boolean;
  }

const DEFAULT_OPTS: PsbtOpts = {
    /**
     * A bitcoinjs Network object. This is only used if you pass an `address`
     * parameter to addOutput. Otherwise it is not needed and can be left default.
     */
    network: floNetwork,
    /**
     * When extractTransaction is called, the fee rate is checked.
     * THIS IS NOT TO BE RELIED ON.
     * It is only here as a last ditch effort to prevent sending a 500 BTC fee etc.
     */
    maximumFeeRate: 1000, // satoshi per byte
  };

class FLOPsbt extends Psbt {
    protected __CACHE: FLOPsbtCache

    constructor(
        opts: FLOPsbtOptsOptional = {},
        readonly data: PsbtBase = new PsbtBase(new FLOPsbtTransaction())
    ) {
        super()
        this.opts = Object.assign({}, DEFAULT_OPTS, opts);
        this.__CACHE = {
            __NON_WITNESS_UTXO_TX_CACHE: [],
            __NON_WITNESS_UTXO_BUF_CACHE: [],
            __TX_IN_CACHE: {},
            __TX: (this.data.globalMap.unsignedTx as FLOPsbtTransaction).tx,
            // Old TransactionBuilder behavior was to not confirm input values
            // before signing. Even though we highly encourage people to get
            // the full parent transaction to verify values, the ability to
            // sign non-segwit inputs without the full transaction was often
            // requested. So the only way to activate is to use @ts-ignore.
            // We will disable exporting the Psbt when unsafe sign is active.
            // because it is not BIP174 compliant.
            __UNSAFE_SIGN_NONSEGWIT: false,
          };
    }

  public setFloData(flodata: Buffer): this {
    // check32Bit(locktime);
    checkInputsForPartialSig(this.data.inputs, 'setFloData')
    const c = this.__CACHE
    c.__TX.floData = flodata
    c.__EXTRACTED_TX = undefined
    return this;
  }

}

class FLOPsbtTransaction implements ITransaction {
    tx: FLOTransaction;
    constructor(buffer: Buffer = Buffer.from([2, 0, 0, 0, 0, 0, 0, 0, 0, 0])) {
      this.tx = FLOTransaction.fromBuffer(buffer);
      checkTxEmpty(this.tx);
      Object.defineProperty(this, 'tx', {
        enumerable: false,
        writable: true,
      });
    }
  
    getInputOutputCounts(): {
      inputCount: number;
      outputCount: number;
    } {
      return {
        inputCount: this.tx.ins.length,
        outputCount: this.tx.outs.length,
      };
    }
  
    addInput(input: any): void {
      if (
        (input as any).hash === undefined ||
        (input as any).index === undefined ||
        (!Buffer.isBuffer((input as any).hash) &&
          typeof (input as any).hash !== 'string') ||
        typeof (input as any).index !== 'number'
      ) {
        throw new Error('Error adding input.');
      }
      const hash =
        typeof input.hash === 'string'
          ? reverseBuffer(Buffer.from(input.hash, 'hex'))
          : input.hash;
      this.tx.addInput(hash, input.index, input.sequence);
    }
  
    addOutput(output: any): void {
      if (
        (output as any).script === undefined ||
        (output as any).value === undefined ||
        !Buffer.isBuffer((output as any).script) ||
        typeof (output as any).value !== 'number'
      ) {
        throw new Error('Error adding output.');
      }
      this.tx.addOutput(output.script, output.value);
    }
  
    toBuffer(): Buffer {
      return this.tx.toBuffer();
    }
  }

function checkInputsForPartialSig(inputs: PsbtInput[], action: string): void {
    inputs.forEach(input => {
      let throws = false;
      let pSigs: PartialSig[] = [];
      if ((input.partialSig || []).length === 0) {
        if (!input.finalScriptSig && !input.finalScriptWitness) return;
        pSigs = getPsigsFromInputFinalScripts(input);
      } else {
        pSigs = input.partialSig!;
      }
      pSigs.forEach(pSig => {
        const { hashType } = bscript.signature.decode(pSig.signature);
        const whitelist: string[] = [];
        const isAnyoneCanPay = hashType & FLOTransaction.SIGHASH_ANYONECANPAY;
        if (isAnyoneCanPay) whitelist.push('addInput');
        const hashMod = hashType & 0x1f;
        switch (hashMod) {
          case FLOTransaction.SIGHASH_ALL:
            break;
          case FLOTransaction.SIGHASH_SINGLE:
          case FLOTransaction.SIGHASH_NONE:
            whitelist.push('addOutput');
            whitelist.push('setInputSequence');
            break;
        }
        if (whitelist.indexOf(action) === -1) {
          throws = true;
        }
      });
      if (throws) {
        throw new Error('Can not modify transaction, signatures exist.');
      }
    });
  }

function getPsigsFromInputFinalScripts(input: PsbtInput): PartialSig[] {
const scriptItems = !input.finalScriptSig
    ? []
    : bscript.decompile(input.finalScriptSig) || [];
const witnessItems = !input.finalScriptWitness
    ? []
    : bscript.decompile(input.finalScriptWitness) || [];
return scriptItems
    .concat(witnessItems)
    .filter(item => {
    return Buffer.isBuffer(item) && bscript.isCanonicalScriptSignature(item);
    })
    .map(sig => ({ signature: sig })) as PartialSig[];
}

function checkTxEmpty(tx: FLOTransaction): void {
    const isEmpty = tx.ins.every(
      input =>
        input.script &&
        input.script.length === 0 &&
        input.witness &&
        input.witness.length === 0,
    );
    if (!isEmpty) {
      throw new Error('Format Error: Transaction ScriptSigs are not empty');
    }
  }

export {
    FLOPsbt
}