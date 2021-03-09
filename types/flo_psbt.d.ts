import { Psbt as PsbtBase } from 'bip174';
import { Psbt } from './psbt';
import { Network } from './networks';
import { FLOTransaction } from './flo_transaction';
interface FLOPsbtOptsOptional {
    network?: Network;
    maximumFeeRate?: number;
}
interface FLOPsbtCache {
    __NON_WITNESS_UTXO_TX_CACHE: FLOTransaction[];
    __NON_WITNESS_UTXO_BUF_CACHE: Buffer[];
    __TX_IN_CACHE: {
        [index: string]: number;
    };
    __TX: FLOTransaction;
    __FEE_RATE?: number;
    __FEE?: number;
    __EXTRACTED_TX?: FLOTransaction;
    __UNSAFE_SIGN_NONSEGWIT: boolean;
}
declare class FLOPsbt extends Psbt {
    readonly data: PsbtBase;
    protected __CACHE: FLOPsbtCache;
    constructor(opts?: FLOPsbtOptsOptional, data?: PsbtBase);
    setFloData(flodata: Buffer): this;
}
export { FLOPsbt };
